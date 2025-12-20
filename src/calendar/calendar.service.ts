import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { calendar_v3 } from 'googleapis';
import { DateTime, Interval } from 'luxon';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { GoogleCalendarIntegrationService } from 'src/integrations/google-calendar/google-calendar.service';
import {
  CalendarEvent,
  CalendarSourceType,
  CalendarStatus,
} from './entities/calendar.entity';

type CreateEventOptions = {
  staffMemberId?: string;
  serviceId?: string;
  sourceType?: CalendarSourceType;
  sourceId?: string;
  externalCalendarId?: string;
  isBusy?: boolean;
  sync?: boolean;
};

type UpdateEventOptions = CreateEventOptions & { status?: CalendarStatus };

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventsRepository: Repository<CalendarEvent>,
    private readonly googleCalendar: GoogleCalendarIntegrationService,
  ) {}

  async createEvent(
    body: calendar_v3.Schema$Event,
    options?: CreateEventOptions,
  ): Promise<string> {
    this.ensureBody(body);

    const { startDate, endDate, timeZone } = this.resolveDates(body);

    const event = this.eventsRepository.create({
      summary: body.summary ?? 'Event',
      description: body.description ?? undefined,
      location: body.location ?? undefined,
      start: startDate.toUTC().toJSDate(),
      end: endDate.toUTC().toJSDate(),
      timeZone,
      staffMemberId: options?.staffMemberId,
      serviceId: options?.serviceId,
      sourceType: options?.sourceType ?? 'appointment',
      sourceId: options?.sourceId,
      externalCalendarId: options?.externalCalendarId,
      isBusy: options?.isBusy ?? true,
      status: 'confirmed',
    });

    const saved = await this.eventsRepository.save(event);

    let externalEventId: string | undefined;
    if (options?.sync !== false) {
      externalEventId = await this.googleCalendar.createEvent(
        this.mapToGoogleEvent(body, timeZone, startDate, endDate),
        options?.externalCalendarId,
      );

      if (externalEventId) {
        await this.eventsRepository.update(saved.id, {
          externalEventId,
          externalCalendarId:
            options?.externalCalendarId ?? this.googleCalendar.getCalendarId(),
        });
      }
    }

    return externalEventId ?? saved.id;
  }

  async updateEvent(
    eventId: string,
    eventDetails: calendar_v3.Schema$Event,
    options?: UpdateEventOptions,
  ): Promise<void> {
    const existing = await this.findEvent(eventId);
    if (!existing) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    this.ensureBody(eventDetails);
    const { startDate, endDate, timeZone } = this.resolveDates(eventDetails);

    const merged: CalendarEvent = {
      ...existing,
      summary: eventDetails.summary ?? existing.summary,
      description: eventDetails.description ?? existing.description,
      location: eventDetails.location ?? existing.location,
      start: startDate.toUTC().toJSDate(),
      end: endDate.toUTC().toJSDate(),
      timeZone,
      staffMemberId: options?.staffMemberId ?? existing.staffMemberId,
      serviceId: options?.serviceId ?? existing.serviceId,
      sourceType: options?.sourceType ?? existing.sourceType,
      sourceId: options?.sourceId ?? existing.sourceId,
      isBusy: options?.isBusy ?? existing.isBusy,
      status: options?.status ?? existing.status,
    };

    await this.eventsRepository.save(merged);

    if (options?.sync !== false && merged.externalEventId) {
      await this.googleCalendar.updateEvent(
        merged.externalEventId,
        this.mapToGoogleEvent(eventDetails, timeZone, startDate, endDate),
        merged.externalCalendarId ?? options?.externalCalendarId,
      );
    }
  }

  async deleteEvent(
    eventId: string,
    opts?: { removeExternal?: boolean },
  ): Promise<void> {
    const existing = await this.findEvent(eventId);

    if (existing) {
      existing.status = 'cancelled';
      await this.eventsRepository.save(existing);

      if (opts?.removeExternal !== false && existing.externalEventId) {
        await this.googleCalendar.deleteEvent(
          existing.externalEventId,
          existing.externalCalendarId,
        );
      }
      return;
    }

    // Compatibilidad: si no existe interno, intentar borrar el ID externo directo.
    if (opts?.removeExternal !== false) {
      await this.googleCalendar.deleteEvent(eventId);
    }
  }

  async listUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
    const now = DateTime.utc().toJSDate();
    return this.eventsRepository.find({
      where: { start: MoreThan(now), status: 'confirmed' },
      take: maxResults,
      order: { start: 'ASC' },
    });
  }

  async checkEventsInRange(
    startDateTime: string,
    endDateTime: string,
    targetTimeZone = 'UTC',
    staffMemberId?: string,
  ): Promise<Interval[]> {
    if (!startDateTime || !endDateTime) {
      throw new BadRequestException(
        'startDateTime and endDateTime are required',
      );
    }

    const start = DateTime.fromISO(startDateTime, { zone: 'utc' });
    const end = DateTime.fromISO(endDateTime, { zone: 'utc' });

    if (!start.isValid || !end.isValid) {
      throw new BadRequestException('Invalid date range');
    }

    const events = await this.eventsRepository.find({
      where: {
        status: 'confirmed',
        isBusy: true,
        ...(staffMemberId ? { staffMemberId } : {}),
        start: LessThan(end.toJSDate()),
        end: MoreThan(start.toJSDate()),
      },
    });

    return events.map((event) =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(event.start, { zone: 'utc' }).setZone(
          targetTimeZone,
        ),
        DateTime.fromJSDate(event.end, { zone: 'utc' }).setZone(targetTimeZone),
      ),
    );
  }

  private ensureBody(body: calendar_v3.Schema$Event): void {
    if (!body?.start?.dateTime || !body?.end?.dateTime) {
      throw new BadRequestException('Event body, start and end are required');
    }
  }

  private resolveDates(body: calendar_v3.Schema$Event): {
    startDate: DateTime;
    endDate: DateTime;
    timeZone: string;
  } {
    const timeZone = body.start?.timeZone || body.end?.timeZone || 'UTC';

    const startDate = DateTime.fromISO(body.start?.dateTime ?? '', {
      zone: timeZone,
    });
    const endDate = DateTime.fromISO(body.end?.dateTime ?? '', {
      zone: timeZone,
    });

    if (!startDate.isValid || !endDate.isValid || endDate <= startDate) {
      throw new BadRequestException('Invalid start/end date range');
    }

    return { startDate, endDate, timeZone };
  }

  private mapToGoogleEvent(
    body: calendar_v3.Schema$Event,
    timeZone: string,
    startDate: DateTime,
    endDate: DateTime,
  ): calendar_v3.Schema$Event {
    return {
      ...body,
      start: {
        dateTime: startDate.setZone(timeZone).toISO(),
        timeZone,
      },
      end: {
        dateTime: endDate.setZone(timeZone).toISO(),
        timeZone,
      },
      reminders: body.reminders ?? {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
  }

  private async findEvent(eventId: string): Promise<CalendarEvent | null> {
    // Validar si es un UUID antes de buscar por id
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        eventId,
      );

    if (isUuid) {
      const byId = await this.eventsRepository.findOne({
        where: { id: eventId },
      });
      if (byId) return byId;
    }

    const byExternal = await this.eventsRepository.findOne({
      where: { externalEventId: eventId },
    });
    return byExternal ?? null;
  }
}

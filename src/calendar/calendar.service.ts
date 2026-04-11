import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { calendar_v3 } from 'googleapis';
import { DateTime, Interval } from 'luxon';
import { Repository, LessThan, MoreThan, IsNull } from 'typeorm';
import { CalendarConnectionService } from './calendar-connection.service';
import {
  CalendarEvent,
  CalendarSourceType,
  CalendarStatus,
} from './entities/calendar.entity';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { CommonMessages, ValidationMessages } from '@ascencio/shared';
import { CalendarActorType } from './entities/calendar-connection.entity';

interface CreateEventOptions {
  staffMemberId?: string;
  serviceId?: string;
  sourceType?: CalendarSourceType;
  sourceId?: string;
  actorType?: CalendarActorType;
  actorId?: string;
  externalCalendarId?: string;
  isBusy?: boolean;
  sync?: boolean;
}

type UpdateEventOptions = CreateEventOptions & { status?: CalendarStatus };

interface CalendarSyncTarget {
  actorType: CalendarActorType;
  actorId: string;
  calendarId: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventsRepository: Repository<CalendarEvent>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    private readonly connectionService: CalendarConnectionService,
  ) {}

  async upsertExternalEvents(
    events: calendar_v3.Schema$Event[],
    params: {
      calendarId?: string;
      defaultTimeZone?: string;
      fallbackStaffMemberId?: string;
      actorType?: CalendarActorType;
      actorId?: string;
    },
  ): Promise<{ imported: number; updated: number; skipped: number }> {
    const {
      calendarId,
      defaultTimeZone = 'UTC',
      fallbackStaffMemberId,
      actorType,
      actorId,
    } = params;

    const staffMembers = await this.staffRepository.find({
      where: { isActive: true },
    });

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const event of events) {
      const externalEventId = event.id;

      if (!externalEventId || !event.start?.dateTime || !event.end?.dateTime) {
        skipped += 1;
        continue;
      }

      const existing = await this.eventsRepository.findOne({
        where: { externalEventId },
      });

      // No sobrescribir eventos creados por la app.
      if (existing?.sourceType === 'appointment') {
        skipped += 1;
        continue;
      }

      const staffName = this.extractStaffNameFromDescription(
        event.description ?? '',
      );
      const resolvedStaffIdByName = staffName
        ? this.resolveStaffMemberIdByName(staffMembers, staffName)
        : undefined;
      const resolvedStaffId = resolvedStaffIdByName ?? fallbackStaffMemberId;

      const timeZone =
        event.start.timeZone ?? event.end.timeZone ?? defaultTimeZone;
      const start = DateTime.fromISO(event.start.dateTime, { zone: timeZone });
      const end = DateTime.fromISO(event.end.dateTime, { zone: timeZone });

      if (!start.isValid || !end.isValid || end <= start) {
        skipped += 1;
        continue;
      }

      const sourceId =
        event.organizer?.email ?? event.creator?.email ?? 'external';

      if (existing) {
        const mergedExisting = this.eventsRepository.merge(existing, {
          summary: event.summary ?? existing.summary,
          description: event.description ?? existing.description,
          location: event.location ?? existing.location,
          start: start.toUTC().toJSDate(),
          end: end.toUTC().toJSDate(),
          timeZone,
          staffMemberId: existing.staffMemberId ?? resolvedStaffId,
          sourceType: 'imported',
          sourceId,
          externalCalendarId:
            calendarId ??
            existing.externalCalendarId ??
            this.getDefaultExternalCalendarId(),
          externalActorType: existing.externalActorType ?? actorType,
          externalActorId: existing.externalActorId ?? actorId,
          isBusy: true,
          status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
        });
        await this.eventsRepository.save(mergedExisting);
        updated += 1;
        continue;
      }

      await this.eventsRepository.save(
        this.eventsRepository.create({
          summary: event.summary ?? 'External Event',
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          start: start.toUTC().toJSDate(),
          end: end.toUTC().toJSDate(),
          timeZone,
          staffMemberId: resolvedStaffId,
          sourceType: 'imported',
          sourceId,
          externalEventId,
          externalCalendarId: calendarId ?? this.getDefaultExternalCalendarId(),
          externalActorType: actorType,
          externalActorId: actorId,
          isBusy: true,
          status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
        }),
      );
      imported += 1;
    }

    return { imported, updated, skipped };
  }

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
      externalActorType: options?.actorType,
      externalActorId: options?.actorId,
      externalCalendarId: options?.externalCalendarId,
      isBusy: options?.isBusy ?? true,
      status: 'confirmed',
    });

    const saved = await this.eventsRepository.save(event);

    let externalEventId: string | undefined;
    if (options?.sync !== false) {
      const syncTarget = await this.resolveSyncTarget(options, saved);

      if (!syncTarget) {
        this.logger.warn(
          `No active OAuth calendar connection found for event ${saved.id}. External sync skipped.`,
        );
      } else {
        try {
          const adapter = await this.connectionService.getAdapter(
            syncTarget.actorType,
            syncTarget.actorId,
          );

          externalEventId = await adapter.createEvent(
            this.mapToGoogleEvent(body, timeZone, startDate, endDate),
            syncTarget.calendarId,
          );

          if (externalEventId) {
            await this.eventsRepository.update(saved.id, {
              externalEventId,
              externalCalendarId: syncTarget.calendarId,
              externalActorType: syncTarget.actorType,
              externalActorId: syncTarget.actorId,
            });
          }
        } catch (error) {
          this.logger.error(
            `Failed to sync event ${saved.id} to OAuth calendar: ${(error as Error).message}`,
          );
        }
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
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    this.ensureBody(eventDetails);
    const { startDate, endDate, timeZone } = this.resolveDates(eventDetails);

    const merged = this.eventsRepository.merge(existing, {
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
    });

    await this.eventsRepository.save(merged);

    if (options?.sync !== false && merged.externalEventId) {
      const syncTarget = await this.resolveSyncTarget(options, merged);

      if (!syncTarget) {
        this.logger.warn(
          `No OAuth sync target found for update on event ${merged.id}. External update skipped.`,
        );
      } else {
        const adapter = await this.connectionService.getAdapter(
          syncTarget.actorType,
          syncTarget.actorId,
        );

        await adapter.updateEvent(
          merged.externalEventId,
          this.mapToGoogleEvent(eventDetails, timeZone, startDate, endDate),
          syncTarget.calendarId,
        );

        if (
          merged.externalCalendarId !== syncTarget.calendarId ||
          merged.externalActorType !== syncTarget.actorType ||
          merged.externalActorId !== syncTarget.actorId
        ) {
          await this.eventsRepository.update(merged.id, {
            externalCalendarId: syncTarget.calendarId,
            externalActorType: syncTarget.actorType,
            externalActorId: syncTarget.actorId,
          });
        }
      }
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
        const syncTarget = await this.resolveSyncTarget(undefined, existing);

        if (!syncTarget) {
          this.logger.warn(
            `No OAuth sync target found for delete on event ${existing.id}. External delete skipped.`,
          );
        } else {
          const adapter = await this.connectionService.getAdapter(
            syncTarget.actorType,
            syncTarget.actorId,
          );
          await adapter.deleteEvent(
            existing.externalEventId,
            syncTarget.calendarId,
          );
        }
      }
      return;
    }

    // Compatibilidad: si no existe interno, intentar borrar el ID externo directo.
    if (opts?.removeExternal !== false) {
      const companyConn = await this.connectionService.getConnection(
        'company',
        'company',
      );

      if (!companyConn?.isActive || !companyConn.calendarId) {
        this.logger.warn(
          `No active company OAuth connection available to delete external event ${eventId}.`,
        );
        return;
      }

      const adapter = await this.connectionService.getAdapter(
        'company',
        'company',
      );
      await adapter.deleteEvent(eventId, companyConn.calendarId);
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
      throw new BadRequestException(ValidationMessages.REQUIRED);
    }

    const start = DateTime.fromISO(startDateTime, { zone: 'utc' });
    const end = DateTime.fromISO(endDateTime, { zone: 'utc' });

    if (!start.isValid || !end.isValid) {
      throw new BadRequestException(ValidationMessages.ISO_DATETIME);
    }

    const dateFilter = {
      start: LessThan(end.toJSDate()),
      end: MoreThan(start.toJSDate()),
    };

    const whereClause = staffMemberId
      ? [
          {
            status: 'confirmed' as const,
            isBusy: true,
            staffMemberId,
            ...dateFilter,
          },
          {
            status: 'confirmed' as const,
            isBusy: true,
            staffMemberId: IsNull(),
            ...dateFilter,
          },
        ]
      : { status: 'confirmed' as const, isBusy: true, ...dateFilter };

    const events = await this.eventsRepository.find({ where: whereClause });

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
    if (!body.start?.dateTime || !body.end?.dateTime) {
      throw new BadRequestException(ValidationMessages.REQUIRED);
    }
  }

  private resolveDates(body: calendar_v3.Schema$Event): {
    startDate: DateTime;
    endDate: DateTime;
    timeZone: string;
  } {
    const timeZone = body.start?.timeZone ?? body.end?.timeZone ?? 'UTC';

    const startDate = DateTime.fromISO(body.start?.dateTime ?? '', {
      zone: timeZone,
    });
    const endDate = DateTime.fromISO(body.end?.dateTime ?? '', {
      zone: timeZone,
    });

    if (!startDate.isValid || !endDate.isValid || endDate <= startDate) {
      throw new BadRequestException(ValidationMessages.ISO_DATETIME);
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

  private getDefaultExternalCalendarId(): string {
    return 'primary';
  }

  private async resolveSyncTarget(
    options?: CreateEventOptions,
    existing?: CalendarEvent,
  ): Promise<CalendarSyncTarget | null> {
    const explicitActorType = options?.actorType ?? existing?.externalActorType;
    const explicitActorId = options?.actorId ?? existing?.externalActorId;

    if (explicitActorType && explicitActorId) {
      const explicitConn = await this.connectionService.getConnection(
        explicitActorType,
        explicitActorId,
      );

      if (explicitConn?.isActive && explicitConn.calendarId) {
        return {
          actorType: explicitActorType,
          actorId: explicitActorId,
          calendarId:
            options?.externalCalendarId ??
            existing?.externalCalendarId ??
            explicitConn.calendarId,
        };
      }
    }

    const companyConn = await this.connectionService.getConnection(
      'company',
      'company',
    );

    if (companyConn?.isActive && companyConn.calendarId) {
      return {
        actorType: 'company',
        actorId: 'company',
        calendarId:
          options?.externalCalendarId ??
          existing?.externalCalendarId ??
          companyConn.calendarId,
      };
    }

    const staffMemberId = options?.staffMemberId ?? existing?.staffMemberId;
    if (staffMemberId) {
      const staffConn = await this.connectionService.getConnection(
        'staff',
        staffMemberId,
      );
      if (staffConn?.isActive && staffConn.calendarId) {
        return {
          actorType: 'staff',
          actorId: staffMemberId,
          calendarId:
            options?.externalCalendarId ??
            existing?.externalCalendarId ??
            staffConn.calendarId,
        };
      }
    }

    return null;
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

  private extractStaffNameFromDescription(description: string): string | null {
    if (!description) {
      return null;
    }

    const patterns = [
      /staff\s*[:\-]\s*([^\n\r]+)/i,
      /personal\s*[:\-]\s*([^\n\r]+)/i,
      /asesor\s*[:\-]\s*([^\n\r]+)/i,
      /consultor\s*[:\-]\s*([^\n\r]+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private resolveStaffMemberIdByName(
    staffMembers: StaffMember[],
    rawName: string,
  ): string | undefined {
    const normalizedTarget = this.normalizeName(rawName);

    const matched = staffMembers.find((staff) => {
      const normalizedFullName = this.normalizeName(
        `${staff.firstName} ${staff.lastName}`,
      );
      return normalizedFullName === normalizedTarget;
    });

    return matched?.id;
  }

  private normalizeName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

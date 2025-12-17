import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';
import { DateTime, Interval } from 'luxon';

@Injectable()
export class GoogleCalendarIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(GoogleCalendarIntegrationService.name);

  private calendar: calendar_v3.Calendar | null = null;
  private auth: Auth.GoogleAuth | Auth.OAuth2Client;
  private defaultCalendarId: string;

  constructor() {
    this.defaultCalendarId = process.env.GOOGLE_CALENDAR_ID ?? '';
    if (!this.defaultCalendarId) {
      this.logger.warn(
        'GOOGLE_CALENDAR_ID no está configurado. Usa setDefaultCalendarId antes de sincronizar.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      this.logger.warn(
        'GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY no están configuradas. La sincronización externa no estará disponible hasta configurarlas.',
      );
      return;
    }

    try {
      this.auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      await (this.auth as Auth.JWT).authorize();
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.logger.log(
        'Google Calendar Integration inicializada correctamente.',
      );
    } catch (error) {
      this.logger.error(
        'Error inicializando cliente de Google Calendar:',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Failed to initialize Google Calendar client: ${(error as Error).message}`,
      );
    }
  }

  setDefaultCalendarId(calendarId: string): void {
    this.defaultCalendarId = calendarId;
  }

  getCalendarId(calendarId?: string): string {
    return calendarId ?? this.defaultCalendarId;
  }

  async createEvent(
    body: calendar_v3.Schema$Event,
    calendarId?: string,
  ): Promise<string | undefined> {
    if (!body?.start || !body.end) {
      throw new BadRequestException('Event body, start and end are required');
    }
    if (!this.calendar) {
      this.logger.warn(
        'Google Calendar no inicializado; omitiendo sincronización.',
      );
      return undefined;
    }

    const targetCalendarId = this.getCalendarId(calendarId);
    if (!targetCalendarId) {
      this.logger.warn(
        'No hay calendarId configurado; omitiendo creación en Google.',
      );
      return undefined;
    }

    try {
      const response = await this.calendar.events.insert({
        calendarId: targetCalendarId,
        requestBody: body,
      });
      this.logger.log(`Evento creado en Google Calendar: ${response.data.id}`);
      return response.data.id ?? undefined;
    } catch (error) {
      this.handleGoogleApiError(error, 'Error creating event');
    }
  }

  async updateEvent(
    eventId: string,
    eventDetails: calendar_v3.Schema$Event,
    calendarId?: string,
  ): Promise<calendar_v3.Schema$Event | undefined> {
    if (!eventId || !eventDetails) {
      throw new BadRequestException('eventId and eventDetails are required');
    }
    if (!this.calendar) {
      this.logger.warn(
        'Google Calendar no inicializado; omitiendo actualización.',
      );
      return undefined;
    }
    const targetCalendarId = this.getCalendarId(calendarId);
    if (!targetCalendarId) {
      this.logger.warn(
        'No hay calendarId configurado; omitiendo actualización en Google.',
      );
      return undefined;
    }

    try {
      const response = await this.calendar.events.update({
        calendarId: targetCalendarId,
        eventId,
        requestBody: eventDetails,
      });
      this.logger.log(`Evento ${eventId} actualizado en Google Calendar.`);
      return response.data;
    } catch (error) {
      this.handleGoogleApiError(error, `Failed to update event ${eventId}`);
    }
  }

  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    if (!eventId) {
      throw new BadRequestException('eventId is required');
    }
    if (!this.calendar) {
      this.logger.warn(
        'Google Calendar no inicializado; omitiendo eliminación.',
      );
      return;
    }
    const targetCalendarId = this.getCalendarId(calendarId);
    if (!targetCalendarId) {
      this.logger.warn(
        'No hay calendarId configurado; omitiendo eliminación en Google.',
      );
      return;
    }
    try {
      await this.calendar.events.delete({
        calendarId: targetCalendarId,
        eventId,
      });
      this.logger.log(`Evento ${eventId} eliminado de Google Calendar.`);
    } catch (error) {
      this.handleGoogleApiError(error, `Failed to delete event ${eventId}`);
    }
  }

  async listUpcomingEvents(
    maxResults = 10,
    calendarId?: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    if (!this.calendar) {
      this.logger.warn(
        'Google Calendar no inicializado; no se listan eventos.',
      );
      return [];
    }
    const targetCalendarId = this.getCalendarId(calendarId);
    if (!targetCalendarId) {
      return [];
    }
    try {
      const now = new Date().toISOString();
      const response = await this.calendar.events.list({
        calendarId: targetCalendarId,
        timeMin: now,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return response.data.items || [];
    } catch (error) {
      this.handleGoogleApiError(error, 'Failed to list upcoming events');
    }
  }

  async checkEventsInRange(
    startDateTime: string,
    endDateTime: string,
    targetTimeZone = 'UTC',
    calendarId?: string,
  ): Promise<Interval[]> {
    if (!startDateTime || !endDateTime) {
      throw new BadRequestException(
        'startDateTime and endDateTime are required',
      );
    }
    if (!this.calendar) {
      this.logger.warn(
        'Google Calendar no inicializado; no se consultan eventos.',
      );
      return [];
    }
    const targetCalendarId = this.getCalendarId(calendarId);
    if (!targetCalendarId) {
      return [];
    }
    try {
      const timeMin = new Date(startDateTime).toISOString();
      const timeMax = new Date(endDateTime).toISOString();
      const response = await this.calendar.events.list({
        calendarId: targetCalendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });
      const eventIntervals = (response.data.items || [])
        .filter((event) => event.start?.dateTime && event.end?.dateTime)
        .map((event) =>
          Interval.fromDateTimes(
            DateTime.fromISO(event.start?.dateTime ?? '', {
              zone: event.start?.timeZone || targetTimeZone,
            }).setZone(targetTimeZone),
            DateTime.fromISO(event.end?.dateTime ?? '', {
              zone: event.end?.timeZone || targetTimeZone,
            }).setZone(targetTimeZone),
          ),
        );
      return eventIntervals;
    } catch (error) {
      this.logger.error(
        'Error in checkEventsInRange:',
        (error as Error).message,
      );
      return [];
    }
  }

  private handleGoogleApiError(error: any, contextMsg: string): never {
    const message = error?.message ?? 'Unknown error';
    this.logger.error(`${contextMsg}: ${message}`, error?.stack);
    const googleApiError = error.response?.data?.error;
    if (googleApiError) {
      this.logger.error(
        `Google API Error: ${googleApiError.message} (Code: ${googleApiError.code})`,
      );
      if (googleApiError.code === 404) {
        throw new NotFoundException(`${contextMsg}: Not found.`);
      }
      throw new BadRequestException(`${contextMsg}: ${googleApiError.message}`);
    }
    throw new InternalServerErrorException(`${contextMsg}: ${message}`);
  }
}

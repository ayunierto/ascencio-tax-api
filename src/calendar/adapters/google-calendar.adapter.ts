import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';
import { DateTime, Interval } from 'luxon';
import {
  ICalendarProvider,
  WebhookSetupResult,
} from '../interfaces/calendar-provider.interface';

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

@Injectable()
export class GoogleCalendarAdapter implements ICalendarProvider {
  private readonly logger = new Logger(GoogleCalendarAdapter.name);

  /**
   * Build an adapter using a service account (company-wide, no user context).
   */
  static fromServiceAccount(): GoogleCalendarAdapter {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(
      /\\n/g,
      '\n',
    );
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return new GoogleCalendarAdapter(
      google.calendar({ version: 'v3', auth }),
      auth,
    );
  }

  /**
   * Build an adapter using per-user OAuth tokens.
   */
  static fromOAuthTokens(tokens: OAuthTokens): GoogleCalendarAdapter {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.tokenExpiry?.getTime(),
    });
    return new GoogleCalendarAdapter(
      google.calendar({ version: 'v3', auth: oauth2Client }),
      oauth2Client,
    );
  }

  private constructor(
    private readonly calendarClient: calendar_v3.Calendar,
    private readonly auth: Auth.JWT | Auth.OAuth2Client,
  ) {}

  async listEventsInRange(
    startDateTime: string,
    endDateTime: string,
    calendarId: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    try {
      const response = await this.calendarClient.events.list({
        calendarId,
        timeMin: new Date(startDateTime).toISOString(),
        timeMax: new Date(endDateTime).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items ?? [];
    } catch (error) {
      this.logger.error('listEventsInRange failed', (error as Error).message);
      return [];
    }
  }

  async getEventsInRange(
    startDateTime: string,
    endDateTime: string,
    calendarId: string,
    targetTimeZone = 'UTC',
  ): Promise<Interval[]> {
    try {
      const response = await this.calendarClient.events.list({
        calendarId,
        timeMin: new Date(startDateTime).toISOString(),
        timeMax: new Date(endDateTime).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      return (response.data.items ?? [])
        .filter(
          (e) =>
            e.transparency !== 'transparent' &&
            e.start?.dateTime != null &&
            e.end?.dateTime != null,
        )
        .map((e) => {
          const startDt = e.start?.dateTime ?? '';
          const endDt = e.end?.dateTime ?? '';
          return Interval.fromDateTimes(
            DateTime.fromISO(startDt, {
              zone: e.start?.timeZone ?? targetTimeZone,
            }).setZone(targetTimeZone),
            DateTime.fromISO(endDt, {
              zone: e.end?.timeZone ?? targetTimeZone,
            }).setZone(targetTimeZone),
          );
        });
    } catch (error) {
      this.logger.error('getEventsInRange failed', (error as Error).message);
      return [];
    }
  }

  async createEvent(
    body: calendar_v3.Schema$Event,
    calendarId: string,
  ): Promise<string | undefined> {
    try {
      const res = await this.calendarClient.events.insert({
        calendarId,
        requestBody: body,
      });
      return res.data.id ?? undefined;
    } catch (error) {
      this.logger.error('createEvent failed', (error as Error).message);
      throw new InternalServerErrorException('Failed to create calendar event');
    }
  }

  async updateEvent(
    eventId: string,
    body: calendar_v3.Schema$Event,
    calendarId: string,
  ): Promise<void> {
    try {
      await this.calendarClient.events.update({
        calendarId,
        eventId,
        requestBody: body,
      });
    } catch (error) {
      this.logger.error('updateEvent failed', (error as Error).message);
      throw new InternalServerErrorException('Failed to update calendar event');
    }
  }

  async deleteEvent(eventId: string, calendarId: string): Promise<void> {
    try {
      await this.calendarClient.events.delete({ calendarId, eventId });
    } catch (error) {
      this.logger.error('deleteEvent failed', (error as Error).message);
      throw new InternalServerErrorException('Failed to delete calendar event');
    }
  }

  async setupWebhook(
    calendarId: string,
    webhookUrl: string,
    channelId: string,
  ): Promise<WebhookSetupResult> {
    try {
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const res = await this.calendarClient.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration: String(expiry.getTime()),
        },
      });
      return {
        channelId: res.data.id ?? channelId,
        resourceId: res.data.resourceId ?? '',
        expiry: expiry,
      };
    } catch (error) {
      this.logger.error('setupWebhook failed', (error as Error).message);
      throw new InternalServerErrorException(
        'Failed to setup Google Calendar webhook',
      );
    }
  }

  async stopWebhook(channelId: string, resourceId: string): Promise<void> {
    try {
      await this.calendarClient.channels.stop({
        requestBody: { id: channelId, resourceId },
      });
    } catch (error) {
      this.logger.warn(
        `stopWebhook failed for channel ${channelId}:`,
        (error as Error).message,
      );
    }
  }

  /** Refresh access token if expired and return new token data */
  async refreshTokenIfNeeded(): Promise<{
    accessToken: string;
    expiry: Date;
  } | null> {
    if (!(this.auth instanceof google.auth.OAuth2)) return null;
    try {
      const { credentials } = await this.auth.refreshAccessToken();
      return {
        accessToken: credentials.access_token ?? '',
        expiry: new Date(credentials.expiry_date ?? Date.now() + 3600000),
      };
    } catch (error) {
      this.logger.error('Token refresh failed', (error as Error).message);
      return null;
    }
  }
}

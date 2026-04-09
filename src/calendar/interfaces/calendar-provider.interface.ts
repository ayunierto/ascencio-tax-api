import { Interval } from 'luxon';
import { calendar_v3 } from 'googleapis';

export interface WebhookSetupResult {
  channelId: string;
  resourceId: string;
  expiry: Date;
}

export interface ICalendarProvider {
  listEventsInRange(
    startDateTime: string,
    endDateTime: string,
    calendarId: string,
  ): Promise<calendar_v3.Schema$Event[]>;

  getEventsInRange(
    startDateTime: string,
    endDateTime: string,
    calendarId: string,
    targetTimeZone?: string,
  ): Promise<Interval[]>;

  createEvent(
    body: calendar_v3.Schema$Event,
    calendarId: string,
  ): Promise<string | undefined>;

  updateEvent(
    eventId: string,
    body: calendar_v3.Schema$Event,
    calendarId: string,
  ): Promise<void>;

  deleteEvent(eventId: string, calendarId: string): Promise<void>;

  setupWebhook(
    calendarId: string,
    webhookUrl: string,
    channelId: string,
  ): Promise<WebhookSetupResult>;

  stopWebhook(channelId: string, resourceId: string): Promise<void>;
}

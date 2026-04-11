import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  CalendarConnection,
  CalendarActorType,
} from './entities/calendar-connection.entity';
import {
  CalendarListItemDto,
  GoogleCalendarAdapter,
} from './adapters/google-calendar.adapter';
import { EncryptionService } from './encryption.service';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommonMessages } from '@ascencio/shared';
import { calendar_v3, google } from 'googleapis';

export interface SaveConnectionDto {
  actorType: CalendarActorType;
  actorId: string;
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  connectedEmail?: string;
}

@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);

  constructor(
    @InjectRepository(CalendarConnection)
    private readonly repo: Repository<CalendarConnection>,
    private readonly encryption: EncryptionService,
  ) {}

  async saveConnection(dto: SaveConnectionDto): Promise<CalendarConnection> {
    const existing = await this.repo.findOne({
      where: {
        actorType: dto.actorType,
        actorId: dto.actorId,
        provider: 'google',
      },
    });

    const entity =
      existing ??
      this.repo.create({
        actorType: dto.actorType,
        actorId: dto.actorId,
        provider: 'google',
      });

    entity.calendarId = dto.calendarId;
    entity.encryptedAccessToken = this.encryption.encrypt(dto.accessToken);
    entity.encryptedRefreshToken = dto.refreshToken
      ? this.encryption.encrypt(dto.refreshToken)
      : undefined;
    entity.tokenExpiry = dto.tokenExpiry;
    entity.connectedEmail = dto.connectedEmail;
    entity.isActive = true;

    return this.repo.save(entity);
  }

  async getAdapter(
    actorType: CalendarActorType,
    actorId: string,
  ): Promise<GoogleCalendarAdapter> {
    const conn = await this.repo.findOne({
      where: { actorType, actorId, provider: 'google', isActive: true },
      select: [
        'id',
        'calendarId',
        'encryptedAccessToken',
        'encryptedRefreshToken',
        'tokenExpiry',
      ],
    });

    if (!conn?.encryptedAccessToken) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    const accessToken = this.encryption.decrypt(conn.encryptedAccessToken);
    const refreshToken = conn.encryptedRefreshToken
      ? this.encryption.decrypt(conn.encryptedRefreshToken)
      : undefined;

    return GoogleCalendarAdapter.fromOAuthTokens({
      accessToken,
      refreshToken,
      tokenExpiry: conn.tokenExpiry,
    });
  }

  async getConnection(
    actorType: CalendarActorType,
    actorId: string,
  ): Promise<CalendarConnection | null> {
    return this.repo.findOne({
      where: { actorType, actorId, provider: 'google' },
    });
  }

  async listCalendars(
    actorType: CalendarActorType,
    actorId: string,
  ): Promise<CalendarListItemDto[]> {
    const adapter = await this.getAdapter(actorType, actorId);
    return adapter.listCalendars();
  }

  async listEventsInRangeForConnection(
    actorType: CalendarActorType,
    actorId: string,
    startDateTime: string,
    endDateTime: string,
    calendarId: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const conn = await this.repo.findOne({
      where: { actorType, actorId, provider: 'google', isActive: true },
      select: ['encryptedAccessToken', 'encryptedRefreshToken', 'tokenExpiry'],
    });

    if (!conn?.encryptedAccessToken) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: this.encryption.decrypt(conn.encryptedAccessToken),
      refresh_token: conn.encryptedRefreshToken
        ? this.encryption.decrypt(conn.encryptedRefreshToken)
        : undefined,
      expiry_date: conn.tokenExpiry?.getTime(),
    });

    const calendarClient = google.calendar({
      version: 'v3',
      auth: oauth2Client,
    });
    const response = await calendarClient.events.list({
      calendarId,
      timeMin: new Date(startDateTime).toISOString(),
      timeMax: new Date(endDateTime).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items ?? [];
  }

  async updateWebhook(
    connectionId: string,
    webhookChannelId: string,
    webhookResourceId: string,
    webhookExpiry: Date,
  ): Promise<void> {
    await this.repo.update(connectionId, {
      webhookChannelId,
      webhookResourceId,
      webhookExpiry,
    });
  }

  async deactivate(
    actorType: CalendarActorType,
    actorId: string,
  ): Promise<void> {
    await this.repo.update(
      { actorType, actorId, provider: 'google' },
      { isActive: false },
    );
  }

  async findAllActive(): Promise<CalendarConnection[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  /** Renew webhooks that will expire within the next 2 days */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async renewExpiringWebhooks(): Promise<void> {
    const threshold = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const expiring = await this.repo.find({
      where: {
        isActive: true,
        webhookExpiry: LessThan(threshold),
      },
      select: [
        'id',
        'actorType',
        'actorId',
        'calendarId',
        'webhookChannelId',
        'webhookResourceId',
        'encryptedAccessToken',
        'encryptedRefreshToken',
        'tokenExpiry',
      ],
    });

    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL ?? '';
    if (!webhookBaseUrl) {
      this.logger.warn('WEBHOOK_BASE_URL not set, skipping webhook renewal');
      return;
    }

    for (const conn of expiring) {
      try {
        const adapter = await this.getAdapter(conn.actorType, conn.actorId);

        if (conn.webhookChannelId && conn.webhookResourceId) {
          await adapter.stopWebhook(
            conn.webhookChannelId,
            conn.webhookResourceId,
          );
        }

        const newChannelId = crypto.randomUUID();
        const webhookUrl = `${webhookBaseUrl}/calendar/webhook/${conn.actorType}/${conn.actorId}`;
        const result = await adapter.setupWebhook(
          conn.calendarId ?? 'primary',
          webhookUrl,
          newChannelId,
        );

        await this.updateWebhook(
          conn.id,
          result.channelId,
          result.resourceId,
          result.expiry,
        );

        this.logger.log(
          `Renewed webhook for ${conn.actorType}:${conn.actorId}, channel: ${result.channelId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to renew webhook for connection ${conn.id}:`,
          (error as Error).message,
        );
      }
    }
  }
}

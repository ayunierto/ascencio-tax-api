import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CalendarConnectionService } from './calendar-connection.service';
import { CalendarOauthService } from './calendar-oauth.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { User } from 'src/auth/entities/user.entity';
import { calendar_v3 } from 'googleapis';
import * as crypto from 'crypto';
import {
  CalendarClientConnectQueryRequest,
  calendarClientConnectQuerySchema,
  CalendarCompanyConnectQueryRequest,
  calendarCompanyConnectQuerySchema,
  CalendarDisconnectParamsRequest,
  calendarDisconnectParamsSchema,
  CalendarOauthCallbackQueryRequest,
  calendarOauthCallbackQuerySchema,
  CalendarStaffConnectQueryRequest,
  calendarStaffConnectQuerySchema,
  CalendarWebhookParamsRequest,
  calendarWebhookParamsSchema,
  ImportExternalEventsRequest,
  importExternalEventsSchema,
  ListCalendarEventsQueryRequest,
  listCalendarEventsQuerySchema,
  ValidationMessages,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly connectionService: CalendarConnectionService,
    private readonly oauthService: CalendarOauthService,
  ) {}

  private resolveOAuthCallbackUrl(req: Request): string {
    if (process.env.GOOGLE_CALENDAR_CALLBACK_URL) {
      return process.env.GOOGLE_CALENDAR_CALLBACK_URL;
    }

    const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
    const protocol = forwardedProto ?? req.protocol ?? 'http';
    const host = forwardedHost ?? req.get('host');

    if (host) {
      return `${protocol}://${host}/api/v1/calendar/oauth/callback`;
    }

    return `${process.env.API_URL ?? process.env.WEBHOOK_BASE_URL ?? 'http://localhost:3001'}/api/v1/calendar/oauth/callback`;
  }

  // ─── Eventos internos ────────────────────────────────────────────────────────

  @Auth(Role.Admin, Role.Staff)
  @Post('events')
  async createEvent(@Body() body: calendar_v3.Schema$Event) {
    return this.calendarService.createEvent(body);
  }

  @Auth(Role.Admin, Role.Staff)
  @Get('events')
  async listEvents(
    @Query(new ZodValidationPipe(listCalendarEventsQuerySchema))
    query: ListCalendarEventsQueryRequest,
  ) {
    const {
      startDateTime: start,
      endDateTime: end,
      staffMemberId,
      timeZone,
    } = query;

    if (start && end) {
      return this.calendarService.checkEventsInRange(
        start,
        end,
        timeZone ?? 'UTC',
        staffMemberId,
      );
    }
    return this.calendarService.listUpcomingEvents();
  }

  @Auth(Role.Admin)
  @Post('import-external')
  @UsePipes(new ZodValidationPipe(importExternalEventsSchema))
  async importExternalEvents(@Body() body: ImportExternalEventsRequest) {
    const conn = await this.connectionService.getConnection(
      'company',
      'company',
    );
    if (!conn?.isActive || !conn.calendarId) {
      throw new BadRequestException('Company calendar is not connected');
    }

    const calendarId = body.calendarId ?? conn.calendarId;
    const events = await this.connectionService.listEventsInRangeForConnection(
      'company',
      'company',
      body.startDateTime,
      body.endDateTime,
      calendarId,
    );

    return this.calendarService.upsertExternalEvents(events, {
      calendarId,
      defaultTimeZone: body.defaultTimeZone,
    });
  }

  // ─── OAuth — Empresa ─────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Obtener URL de autorización para calendario de empresa',
  })
  @Auth(Role.Admin, Role.SuperUser)
  @Get('oauth/company/connect')
  companyConnect(
    @Req() req: Request,
    @Query(new ZodValidationPipe(calendarCompanyConnectQuerySchema))
    query: CalendarCompanyConnectQueryRequest,
  ) {
    const { redirectUrl } = query;
    const callbackUrl = this.resolveOAuthCallbackUrl(req);
    const url = this.oauthService.generateAuthUrl({
      actorType: 'company',
      actorId: 'company',
      redirectUrl,
    }, callbackUrl);
    return { url };
  }

  // ─── OAuth — Staff ────────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Obtener URL de autorización para calendario de staff',
  })
  @Auth(Role.Admin, Role.Staff)
  @Get('oauth/staff/connect')
  staffConnect(
    @Req() req: Request,
    @GetUser() user: User,
    @Query(new ZodValidationPipe(calendarStaffConnectQuerySchema))
    query: CalendarStaffConnectQueryRequest,
  ) {
    void user;
    const { staffMemberId, redirectUrl } = query;
    const actorId = staffMemberId;
    const callbackUrl = this.resolveOAuthCallbackUrl(req);
    const url = this.oauthService.generateAuthUrl({
      actorType: 'staff',
      actorId,
      redirectUrl,
    }, callbackUrl);
    return { url };
  }

  // ─── OAuth — Cliente ──────────────────────────────────────────────────────────

  @ApiOperation({
    summary: 'Obtener URL de autorización para calendario de cliente',
  })
  @Auth()
  @Get('oauth/client/connect')
  clientConnect(
    @Req() req: Request,
    @GetUser() user: User,
    @Query(new ZodValidationPipe(calendarClientConnectQuerySchema))
    query: CalendarClientConnectQueryRequest,
  ) {
    const { redirectUrl } = query;
    const callbackUrl = this.resolveOAuthCallbackUrl(req);
    const url = this.oauthService.generateAuthUrl({
      actorType: 'client',
      actorId: user.id,
      redirectUrl,
    }, callbackUrl);
    return { url };
  }

  // ─── OAuth — Callback unificado ───────────────────────────────────────────────

  @ApiOperation({
    summary:
      'Callback OAuth de Google Calendar (NO requiere auth — viene de Google)',
  })
  @Get('oauth/callback')
  async oauthCallback(
    @Req() req: Request,
    @Query(new ZodValidationPipe(calendarOauthCallbackQuerySchema))
    query: CalendarOauthCallbackQueryRequest,
    @Res() res: Response,
  ) {
    const { code, state, error: oauthError } = query;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:8081';

    if (oauthError) {
      this.logger.warn(`OAuth error: ${oauthError}`);
      res.redirect(`${frontendUrl}/calendar/oauth?error=${oauthError}`);
      return;
    }

    try {
      if (!code || !state) {
        throw new BadRequestException(ValidationMessages.REQUIRED);
      }

      const { actorType, actorId, redirectUrl } =
        this.oauthService.decodeState(state);
      const callbackUrl = this.resolveOAuthCallbackUrl(req);
      const tokens = await this.oauthService.exchangeCodeForTokens(
        code,
        callbackUrl,
      );

      const conn = await this.connectionService.saveConnection({
        actorType,
        actorId,
        calendarId:
          actorType === 'company'
            ? (process.env.GOOGLE_CALENDAR_ID ?? 'primary')
            : 'primary',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiry,
        connectedEmail: tokens.email,
      });

      // Configurar webhook automáticamente
      const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
      if (webhookBaseUrl && conn.calendarId) {
        try {
          const adapter = await this.connectionService.getAdapter(
            actorType,
            actorId,
          );
          const channelId = crypto.randomUUID();
          const webhookUrl = `${webhookBaseUrl}/api/v1/calendar/webhook/${actorType}/${actorId}`;
          const webhook = await adapter.setupWebhook(
            conn.calendarId,
            webhookUrl,
            channelId,
          );
          await this.connectionService.updateWebhook(
            conn.id,
            webhook.channelId,
            webhook.resourceId,
            webhook.expiry,
          );
          this.logger.log(`Webhook registered for ${actorType}:${actorId}`);
        } catch (err) {
          this.logger.warn(
            `Webhook setup failed (non-fatal): ${(err as Error).message}`,
          );
        }
      }

      const successUrl =
        redirectUrl ??
        `${frontendUrl}/calendar/oauth?success=true&actorType=${actorType}`;
      res.redirect(successUrl);
      return;
    } catch (error) {
      this.logger.error('OAuth callback failed', (error as Error).message);
      res.redirect(`${frontendUrl}/calendar/oauth?error=callback_failed`);
      return;
    }
  }

  // ─── Webhook (Google Push Notifications) ─────────────────────────────────────

  @ApiOperation({ summary: 'Webhook Google Calendar Push Notifications' })
  @Post('webhook/:actorType/:actorId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param(new ZodValidationPipe(calendarWebhookParamsSchema))
    params: CalendarWebhookParamsRequest,
    @Headers('x-goog-channel-token') channelToken: string,
    @Headers('x-goog-resource-state') resourceState: string,
  ) {
    void channelToken;
    const { actorType, actorId } = params;

    if (resourceState === 'sync') {
      // Initial sync confirmation — no action needed
      return;
    }

    this.logger.log(
      `Calendar webhook received for ${actorType}:${actorId}, state: ${resourceState}`,
    );

    try {
      const conn = await this.connectionService.getConnection(
        actorType,
        actorId,
      );
      if (!conn?.calendarId) return;

      // Re-import today's and tomorrow's events into local DB
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const events =
        await this.connectionService.listEventsInRangeForConnection(
          actorType,
          actorId,
          now.toISOString(),
          tomorrow.toISOString(),
          conn.calendarId,
        );

      const result = await this.calendarService.upsertExternalEvents(events, {
        calendarId: conn.calendarId,
        fallbackStaffMemberId: actorType === 'staff' ? actorId : undefined,
      });

      this.logger.log(
        `Webhook sync: fetched=${String(events.length)} imported=${String(result.imported)} updated=${String(result.updated)} skipped=${String(result.skipped)} for ${actorType}:${actorId}`,
      );
    } catch (error) {
      this.logger.error(
        `Webhook processing failed for ${actorType}:${actorId}`,
        (error as Error).message,
      );
    }
  }

  // ─── Estado de conexiones ─────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Ver estado de conexión de calendario de empresa' })
  @Auth(Role.Admin, Role.SuperUser)
  @Get('oauth/company/status')
  async companyStatus() {
    const conn = await this.connectionService.getConnection(
      'company',
      'company',
    );
    if (!conn) return { connected: false };
    return {
      connected: true,
      email: conn.connectedEmail,
      calendarId: conn.calendarId,
      webhookActive:
        !!conn.webhookChannelId &&
        !!conn.webhookExpiry &&
        conn.webhookExpiry > new Date(),
      updatedAt: conn.updatedAt,
    };
  }

  @ApiOperation({ summary: 'Ver estado de conexión de calendario de staff' })
  @Auth(Role.Admin, Role.Staff)
  @Get('oauth/staff/:staffMemberId/status')
  async staffStatus(@Param('staffMemberId') staffMemberId: string) {
    const conn = await this.connectionService.getConnection(
      'staff',
      staffMemberId,
    );
    if (!conn) return { connected: false };
    return {
      connected: true,
      email: conn.connectedEmail,
      calendarId: conn.calendarId,
      webhookActive:
        !!conn.webhookChannelId &&
        !!conn.webhookExpiry &&
        conn.webhookExpiry > new Date(),
      updatedAt: conn.updatedAt,
    };
  }

  @ApiOperation({ summary: 'Ver estado de conexión de calendario del cliente' })
  @Auth()
  @Get('oauth/client/status')
  async clientStatus(@GetUser() user: User) {
    const conn = await this.connectionService.getConnection('client', user.id);
    if (!conn) return { connected: false };

    return {
      connected: true,
      email: conn.connectedEmail,
      calendarId: conn.calendarId,
      webhookActive:
        !!conn.webhookChannelId &&
        !!conn.webhookExpiry &&
        conn.webhookExpiry > new Date(),
      updatedAt: conn.updatedAt,
    };
  }

  @ApiOperation({ summary: 'Desconectar calendario' })
  @Auth(Role.Admin, Role.Staff)
  @Post('oauth/:actorType/:actorId/disconnect')
  async disconnect(
    @Param(new ZodValidationPipe(calendarDisconnectParamsSchema))
    params: CalendarDisconnectParamsRequest,
  ) {
    const { actorType, actorId } = params;
    const conn = await this.connectionService.getConnection(actorType, actorId);
    if (conn?.webhookChannelId && conn.webhookResourceId) {
      try {
        const adapter = await this.connectionService.getAdapter(
          actorType,
          actorId,
        );
        await adapter.stopWebhook(
          conn.webhookChannelId,
          conn.webhookResourceId,
        );
      } catch {
        // ignore webhook stop errors
      }
    }
    await this.connectionService.deactivate(actorType, actorId);
    return { disconnected: true };
  }

  /** Staff — self-service disconnect */
  @Auth(Role.Staff)
  @Post('oauth/staff/me/disconnect')
  async staffSelfDisconnect(@GetUser() user: User) {
    await this.connectionService.deactivate('staff', user.id);
    return { disconnected: true };
  }

  /** Client — self-service disconnect */
  @Auth()
  @Post('oauth/client/me/disconnect')
  async clientSelfDisconnect(@GetUser() user: User) {
    await this.connectionService.deactivate('client', user.id);
    return { disconnected: true };
  }
}

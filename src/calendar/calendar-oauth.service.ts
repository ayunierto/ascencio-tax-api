import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { CommonMessages, ValidationMessages } from '@ascencio/shared';

export interface CalendarOAuthState {
  actorType: 'company' | 'staff' | 'client';
  actorId: string;
  nonce: string;
  calendarId?: string;
  redirectUrl?: string;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

@Injectable()
export class CalendarOauthService {
  private readonly logger = new Logger(CalendarOauthService.name);

  private getOAuth2Client(callbackUrl?: string) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl ??
        process.env.GOOGLE_CALENDAR_CALLBACK_URL ??
        `${process.env.API_URL ?? process.env.WEBHOOK_BASE_URL ?? 'http://localhost:3001'}/calendar/oauth/callback`,
    );
  }

  private getStateSecret(): string {
    return process.env.JWT_SECRET ?? 'fallback-state-secret';
  }

  encodeState(payload: CalendarOAuthState): string {
    const data = JSON.stringify(payload);
    const encoded = Buffer.from(data).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.getStateSecret())
      .update(encoded)
      .digest('hex');
    return `${encoded}.${sig}`;
  }

  decodeState(state: string): CalendarOAuthState {
    const [encoded, sig] = state.split('.');
    if (!encoded || !sig) {
      throw new UnauthorizedException(CommonMessages.ACCESS_DENIED);
    }
    const expectedSig = crypto
      .createHmac('sha256', this.getStateSecret())
      .update(encoded)
      .digest('hex');
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      )
    ) {
      throw new UnauthorizedException(CommonMessages.ACCESS_DENIED);
    }
    try {
      return JSON.parse(
        Buffer.from(encoded, 'base64url').toString(),
      ) as CalendarOAuthState;
    } catch {
      throw new BadRequestException(ValidationMessages.INVALID_FORMAT);
    }
  }

  generateAuthUrl(
    payload: Omit<CalendarOAuthState, 'nonce'>,
    callbackUrl?: string,
  ): string {
    const state = this.encodeState({
      ...payload,
      nonce: crypto.randomBytes(16).toString('hex'),
    });
    const oauth2Client = this.getOAuth2Client(callbackUrl);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    });
  }

  async exchangeCodeForTokens(
    code: string,
    callbackUrl?: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiry: Date;
    email?: string;
  }> {
    const oauth2Client = this.getOAuth2Client(callbackUrl);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new BadRequestException(ValidationMessages.REQUIRED);
    }

    let email: string | undefined;
    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email;
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiry: new Date(tokens.expiry_date ?? Date.now() + 3600000),
      email,
    };
  }
}

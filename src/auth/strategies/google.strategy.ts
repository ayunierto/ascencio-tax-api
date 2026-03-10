import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-google-oauth20';

export interface GoogleUserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  pictureUrl?: string;
  googleId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    console.log('🔍 GoogleStrategy Configuration:');
    console.log(
      '  ✓ Client ID:',
      clientID ? `${clientID.substring(0, 20)}...` : '❌ MISSING',
    );
    console.log('  ✓ Client ID (full):', clientID || '❌ MISSING');
    console.log('  ✓ Client Secret:', clientSecret ? '***' : '❌ MISSING');
    console.log(
      '  ✓ Client Secret (length):',
      clientSecret ? clientSecret.length : 0,
    );
    console.log('  ✓ Callback URL:', callbackURL || '❌ MISSING');

    if (!clientID || !clientSecret || !callbackURL) {
      throw new Error(
        'Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });

    console.log('✅ GoogleStrategy initialized successfully');
  }

  validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: GoogleUserProfile) => void,
  ) {
    console.log('🔐 Google OAuth Validation Started');
    console.log('  Profile ID:', profile.id);
    console.log('  Emails:', profile.emails);

    const email = profile.emails?.[0]?.value;
    const pictureUrl = (profile.photos?.[0] as any)?.value as
      | string
      | undefined;

    if (!email) {
      console.error('❌ Google profile missing email');
      return done(new Error('Google profile missing email'));
    }

    const user: GoogleUserProfile = {
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      pictureUrl,
    };

    console.log('✅ Google OAuth Validation Success:', email);

    // Preservar el authMode del request si existe
    if ((req as any).authMode) {
      (req as any).authModeForCallback = (req as any).authMode;
    }

    return done(null, user);
  }
}

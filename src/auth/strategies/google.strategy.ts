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

interface GoogleAuthRequest {
  authMode?: string;
  authModeForCallback?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

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
  }

  validate(
    req: GoogleAuthRequest,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: unknown, user?: GoogleUserProfile) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    const pictureUrl = profile.photos?.[0]?.value;

    if (!email) {
      done(new Error('Google profile missing email'));
      return;
    }

    const user: GoogleUserProfile = {
      googleId: profile.id,
      email,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
      pictureUrl,
    };

    if (req.authMode) {
      req.authModeForCallback = req.authMode;
    }

    done(null, user);
  }
}

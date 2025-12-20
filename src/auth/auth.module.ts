import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategies/google.strategy';
import { ConfigService } from '@nestjs/config';

const GoogleStrategyProvider = {
  provide: 'GOOGLE_STRATEGY',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientID || !clientSecret || !callbackURL) {
      return null;
    }
    // Instanciar para que Nest registre la estrategia en Passport
    return new GoogleStrategy(configService);
  },
};

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      useFactory: () => {
        return {
          global: true,
          secret: process.env.JWT_SECRET,
          signOptions: {
            expiresIn: process.env.JWT_EXPIRY,
          },
        };
      },
    }),
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([User]),
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategyProvider],
  exports: [AuthService, JwtModule, TypeOrmModule],
})
export class AuthModule {}

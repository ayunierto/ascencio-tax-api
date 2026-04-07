import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth } from './decorators/auth.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { UserMapper } from './mappers/user.mapper';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import {
  ChangePasswordResponse,
  CheckStatusResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  ResendEmailCodeResponse,
  ResendResetPasswordCodeResponse,
  ResetPasswordResponse,
  SignInResponse,
  SignUpResponse,
  SimpleUser,
  VerifyEmailCodeResponse,
} from '@ascencio/shared/interfaces';
import {
  ChangePasswordRequest,
  changePasswordSchema,
  DeleteAccountRequest,
  deleteAccountSchema,
  ForgotPasswordRequest,
  forgotPasswordSchema,
  ResendEmailCodeRequest,
  resendEmailCodeSchema,
  ResendResetPasswordCodeRequest,
  resendResetPasswordCodeSchema,
  ResetPasswordRequest,
  resetPasswordSchema,
  SignInRequest,
  signInSchema,
  SignUpRequest,
  signUpSchema,
  UpdateProfileRequest,
  updateProfileSchema,
  VerifyEmailCodeRequest,
  verifyEmailCodeSchema,
} from '@ascencio/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @Auth()
  me(@GetUser() user: User): SimpleUser {
    return UserMapper.toBasicUser(user);
  }

  @Post('signin')
  @UsePipes(new ZodValidationPipe(signInSchema))
  login(@Body() signInDto: SignInRequest): Promise<SignInResponse> {
    return this.authService.signIn(signInDto);
  }

  @Post('signup')
  @UsePipes(new ZodValidationPipe(signUpSchema))
  register(@Body() signUpDto: SignUpRequest): Promise<SignUpResponse> {
    return this.authService.signUp(signUpDto);
  }

  @Post('verify-email-code')
  @UsePipes(new ZodValidationPipe(verifyEmailCodeSchema))
  verifyEmail(
    @Body() verifyCodeDto: VerifyEmailCodeRequest,
  ): Promise<VerifyEmailCodeResponse> {
    return this.authService.verifyEmailCode(verifyCodeDto);
  }

  @Post('resend-email-code')
  @UsePipes(new ZodValidationPipe(resendEmailCodeSchema))
  resendEmailVerification(
    @Body() resendEmailCodeDto: ResendEmailCodeRequest,
  ): Promise<ResendEmailCodeResponse> {
    return this.authService.resendEmailCode(resendEmailCodeDto);
  }

  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('resend-reset-password-code')
  resendResetPasswordCode(
    @Body(new ZodValidationPipe(resendResetPasswordCodeSchema))
    resendResetPasswordCodeDto: ResendResetPasswordCodeRequest,
  ): Promise<ResendResetPasswordCodeResponse> {
    return this.authService.resendResetPasswordCode(resendResetPasswordCodeDto);
  }

  @Get('check-status')
  @Auth()
  checkStatus(@GetUser() user: User): Promise<CheckStatusResponse> {
    return this.authService.checkStatus(user);
  }

  @Post('change-password')
  @Auth()
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema))
    changePasswordDto: ChangePasswordRequest,
    @GetUser() user: User,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(changePasswordDto, user);
  }

  @Patch('update-profile')
  @Auth()
  updateProfile(
    @Body(new ZodValidationPipe(updateProfileSchema))
    updateProfileDto: UpdateProfileRequest,
    @GetUser() user: User,
  ): Promise<SimpleUser> {
    return this.authService.updateProfile(updateProfileDto, user);
  }

  @Post('delete-account')
  @Auth()
  deleteAccount(
    @Body(new ZodValidationPipe(deleteAccountSchema))
    deleteAccountDto: DeleteAccountRequest,
    @GetUser() user: User,
  ): Promise<DeleteAccountResponse> {
    return this.authService.deleteAccount(deleteAccountDto, user);
  }

  // Sign in with Google OAuth (redirect)
  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  googleAuth() {
    return;
  }

  // Sign in with Google OAuth for mobile
  @Get('google/mobile')
  @UseGuards(PassportAuthGuard('google'))
  googleAuthMobile(@Req() req?: Request, @Res() res?: Response) {
    // Establecer una cookie temporal para marcar que es mobile
    if (res) {
      res.cookie('oauth_mode', 'mobile', {
        httpOnly: true,
        secure: process.env.STAGE !== 'dev',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 5, // 5 minutos
        path: '/',
      });
    }
    return;
  }

  // Sign in with Google OAuth for web
  @Get('google/web')
  @UseGuards(PassportAuthGuard('google'))
  googleAuthWeb(@Req() req?: Request, @Res() res?: Response) {
    // Establecer una cookie temporal para marcar que es web
    if (res) {
      res.cookie('oauth_mode', 'web', {
        httpOnly: true,
        secure: process.env.STAGE !== 'dev',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 5, // 5 minutos
        path: '/',
      });
    }
    return;
  }

  // Verify Google ID Token for mobile native sign-in
  @Post('google/verify')
  @UsePipes(new ZodValidationPipe(z.object({ idToken: z.string() })))
  async googleVerifyToken(
    @Body() body: { idToken: string },
  ): Promise<SignInResponse> {
    return this.authService.signInWithGoogleIdToken(body.idToken);
  }

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // Leer el mode desde la cookie
      const oauthMode =
        (req.cookies as Record<string, string | undefined> | undefined)
          ?.oauth_mode ?? 'web';
      const result = await this.authService.signInWithGoogle(req.user);

      // Limpiar la cookie de modo
      res.clearCookie('oauth_mode', { path: '/' });

      // Handle mobile deep link redirect
      if (oauthMode === 'mobile') {
        const mobileScheme = process.env.MOBILE_APP_SCHEME ?? 'ascenciotaxapp';
        const redirectUrl = `${mobileScheme}://auth/google/callback?access_token=${encodeURIComponent(result.access_token)}`;
        res.redirect(redirectUrl);
        return;
      }

      // Handle web redirect
      const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:4000';
      const userLocale = (result.user.locale ?? 'en').toLowerCase();
      const langCandidate = userLocale.split(/[-_]/)[0];
      const lang = ['en', 'es'].includes(langCandidate) ? langCandidate : 'en';
      const successPath = '/api/auth/google/callback';

      const redirectUrl = new URL(successPath, webAppUrl);
      redirectUrl.searchParams.set('access_token', result.access_token);
      redirectUrl.searchParams.set('lang', lang);
      res.redirect(redirectUrl.toString());
      return;
    } catch (error) {
      console.error('❌ Error in Google OAuth callback:', error);
      const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:4000';
      const errorUrl = new URL(
        '/en/signin?error=google_auth_failed',
        webAppUrl,
      );
      res.redirect(errorUrl.toString());
      return;
    }
  }
}

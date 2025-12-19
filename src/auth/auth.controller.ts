import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  UseGuards,
  Req,
  Res,
  Query,
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
import {
  signinSchema,
  signUpSchema,
  verifyEmailCodeSchema,
  resendEmailVerificationCodeSchema,
  resendResetPasswordCodeSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  deleteAccountSchema,
  type SigninDto,
  type SignUpDto,
  type VerifyEmailCodeDto,
  type ResendEmailCodeDto,
  type ResendResetPasswordCodeDto,
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type UpdateProfileDto,
  type DeleteAccountDto,
} from '@ascencio/shared/schemas';
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
  UpdateProfileResponse,
  VerifyEmailResponse,
} from '@ascencio/shared/interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @Auth()
  me(@GetUser() user: User): SimpleUser {
    return UserMapper.toBasicUser(user);
  }

  @Post('signin')
  @UsePipes(new ZodValidationPipe(signinSchema))
  login(@Body() signInDto: SigninDto): Promise<SignInResponse> {
    return this.authService.signIn(signInDto);
  }

  @Post('signup')
  @UsePipes(new ZodValidationPipe(signUpSchema))
  register(@Body() signUpDto: SignUpDto): Promise<SignUpResponse> {
    return this.authService.signUp(signUpDto);
  }

  @Post('verify-email-code')
  @UsePipes(new ZodValidationPipe(verifyEmailCodeSchema))
  verifyEmail(
    @Body() verifyCodeDto: VerifyEmailCodeDto,
  ): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmailCode(verifyCodeDto);
  }

  @Post('resend-email-code')
  @UsePipes(new ZodValidationPipe(resendEmailVerificationCodeSchema))
  resendEmailVerification(
    @Body() resendEmailCodeDto: ResendEmailCodeDto,
  ): Promise<ResendEmailCodeResponse> {
    return this.authService.resendEmailCode(resendEmailCodeDto);
  }

  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('resend-reset-password-code')
  @UsePipes(new ZodValidationPipe(resendResetPasswordCodeSchema))
  resendResetPasswordCode(
    @Body() resendResetPasswordCodeDto: ResendResetPasswordCodeDto,
  ): Promise<ResendResetPasswordCodeResponse> {
    return this.authService.resendResetPasswordCode(resendResetPasswordCodeDto);
  }

  @Get('check-status')
  @Auth()
  checkStatus(@GetUser() user: User): Promise<CheckStatusResponse> {
    return this.authService.checkStatus(user);
  }

  @Post('change-password')
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  @Auth()
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @GetUser() user: User,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(changePasswordDto, user);
  }

  @Patch('update-profile')
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  @Auth()
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @GetUser() user: User,
  ): Promise<UpdateProfileResponse> {
    return this.authService.updateProfile(updateProfileDto, user);
  }

  @Post('delete-account')
  @UsePipes(new ZodValidationPipe(deleteAccountSchema))
  @Auth()
  deleteAccount(
    @Body() deleteAccountDto: DeleteAccountDto,
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

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('mode') mode?: 'json',
  ) {
    const result = await this.authService.signInWithGoogle(req.user);

    if (mode === 'json') {
      return res.status(HttpStatus.OK).json(result);
    }

    const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.STAGE !== 'dev',
      sameSite: 'lax',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    });

    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const successPath = process.env.OAUTH_SUCCESS_REDIRECT ?? '/en/admin';
    const redirectUrl = new URL(successPath, webAppUrl);
    return res.redirect(redirectUrl.toString());
  }
}

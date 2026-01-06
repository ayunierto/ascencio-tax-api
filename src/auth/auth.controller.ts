import {
  Controller,
  Post,
  Body,
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
  @UsePipes(new ZodValidationPipe(resendResetPasswordCodeSchema))
  resendResetPasswordCode(
    @Body() resendResetPasswordCodeDto: ResendResetPasswordCodeRequest,
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
    @Body() changePasswordDto: ChangePasswordRequest,
    @GetUser() user: User,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(changePasswordDto, user);
  }

  @Patch('update-profile')
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  @Auth()
  updateProfile(
    @Body() updateProfileDto: UpdateProfileRequest,
    @GetUser() user: User,
  ): Promise<UpdateProfileResponse> {
    return this.authService.updateProfile(updateProfileDto, user);
  }

  @Post('delete-account')
  @UsePipes(new ZodValidationPipe(deleteAccountSchema))
  @Auth()
  deleteAccount(
    @Body() deleteAccountDto: DeleteAccountRequest,
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
    res.cookie('access_to ken', result.access_token, {
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

    // Remove comment to enable redirect after OAuth if needed
    // return res.redirect(redirectUrl.toString());

    res.redirect(redirectUrl.toString());
  }
}

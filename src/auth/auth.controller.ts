import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Auth } from './decorators/auth.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { User } from './entities/user.entity';
import {
  SignInDto,
  SignUpDto,
  VerifyEmailCodeDto,
  ResendEmailVerificationCodeDto,
  ResendResetPasswordCodeDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  DeleteAccountDto,
} from './dto/';
import { ChangePasswordResponse, CheckStatusResponse, DeleteAccountResponse, ForgotPasswordResponse, ResendEmailVerificationResponse, ResendResetPasswordCodeResponse, ResetPasswordResponse, SignInResponse, SignUpResponse, UpdateProfileResponse, VerifyEmailCodeResponse } from './interfaces/auth-responses.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @ApiOperation({ summary: 'Sign in a user' })
  @ApiResponse({ status: 201, description: 'User signed in successfully', type: SignInResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  login(@Body() signInDto: SignInDto): Promise<SignInResponse> {
    return this.authService.signIn(signInDto);
  }

  @Post('signup')
  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: SignUpResponse })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  register(@Body() signUpDto: SignUpDto): Promise<SignUpResponse> {
    return this.authService.signUp(signUpDto);
  }

  @Post('verify-email-code')
  @ApiOperation({ summary: 'Verify email with code' })
  @ApiResponse({ status: 201, description: 'Email verified successfully', type: VerifyEmailCodeResponse })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  verifyEmail(@Body() verifyCodeDto: VerifyEmailCodeDto): Promise<VerifyEmailCodeResponse> {
    return this.authService.verifyEmailCode(verifyCodeDto);
  }

  @Post('resend-email-code')
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully', type: ResendEmailVerificationResponse })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  resendEmailVerification(
    @Body() resendEmailVerificationCodeDto: ResendEmailVerificationCodeDto,
  ): Promise<ResendEmailVerificationResponse> {
    return this.authService.resendEmailVerification(
      resendEmailVerificationCodeDto,
    );
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent', type: ForgotPasswordResponse })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: ResetPasswordResponse })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('resend-reset-password-code')
  @ApiOperation({ summary: 'Resend password reset code' })
  @ApiResponse({ status: 200, description: 'Reset code sent successfully', type: ResendResetPasswordCodeResponse })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.OK)
  resendResetPasswordCode(
    @Body() resendResetPasswordCodeDto: ResendResetPasswordCodeDto,
  ): Promise<ResendResetPasswordCodeResponse> {
    return this.authService.resendResetPasswordCode(resendResetPasswordCodeDto);
  }

  @Get('check-status')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check user authentication status' })
  @ApiResponse({ status: 200, description: 'User is authenticated', type: CheckStatusResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.OK)
  checkStatus(@GetUser() user: User): Promise<CheckStatusResponse> {
    return this.authService.checkStatus(user);
  }

  @Post('change-password')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 201, description: 'Password changed successfully', type: ChangePasswordResponse })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @GetUser() user: User,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(changePasswordDto, user);
  }

  @Patch('update-profile')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UpdateProfileResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @GetUser() user: User,
  ): Promise<UpdateProfileResponse> {
    return this.authService.updateProfile(updateProfileDto, user);
  }

  @Post('delete-account')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 201, description: 'Account deleted successfully', type: DeleteAccountResponse })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteAccount(
    @Body() deleteAccountDto: DeleteAccountDto,
    @GetUser() user: User,
  ): Promise<DeleteAccountResponse> {
    return this.authService.deleteAccount(deleteAccountDto, user);
  }
}
import { ApiProperty } from '@nestjs/swagger';
import { BasicUser } from './basic-user.interface';

export class UserTokenResponse {
  @ApiProperty({ description: 'JWT Access Token' })
  access_token: string;

  @ApiProperty({ description: 'User information', type: BasicUser })
  user: BasicUser;
}

export class UserMessageResponse {
  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'User information', type: BasicUser })
  user: BasicUser;
}

export class OnlyMessageResponse {
  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'HTTP Status Code', required: false })
  statusCode?: number;

  @ApiProperty({ description: 'Error message', required: false })
  error?: string;
}

export class SignUpResponse extends UserMessageResponse {}
export class VerifyEmailCodeResponse extends UserMessageResponse {}
export class ResendEmailVerificationResponse extends OnlyMessageResponse {}
export class SignInResponse extends UserTokenResponse {}
export class ForgotPasswordResponse extends OnlyMessageResponse {}
export class ResetPasswordResponse extends OnlyMessageResponse {}
export class CheckStatusResponse extends UserTokenResponse {}
export class ResendResetPasswordCodeResponse extends OnlyMessageResponse {}
export class ChangePasswordResponse extends UserMessageResponse {}
export class DeleteAccountResponse extends UserMessageResponse {}
export class UpdateProfileResponse extends UserMessageResponse {}

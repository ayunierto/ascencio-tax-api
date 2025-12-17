import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  ResendEmailVerificationCodeDto,
  ResendResetPasswordCodeDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  UpdateProfileDto,
  VerifyEmailCodeDto,
} from './dto';
import {
  ChangePasswordResponse,
  CheckStatusResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  ResendEmailVerificationResponse,
  ResendResetPasswordCodeResponse,
  ResetPasswordResponse,
  SignInResponse,
  SignUpResponse,
  UpdateProfileResponse,
  VerifyEmailCodeResponse,
} from './interfaces/auth-responses.interface';
import { NotificationService } from 'src/notification/notification.service';
import { UserMapper } from './mappers/user.mapper';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { randomUUID } from 'crypto';
import type { GoogleUserProfile } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly emailVerificationCodeTTL: number;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly notification: NotificationService,
  ) {
    this.emailVerificationCodeTTL = process.env.VERIFICATION_CODE_TTL
      ? Number(process.env.VERIFICATION_CODE_TTL)
      : 15;
  }

  // Helpers
  private async sendEmail(
    type: 'verification' | 'reset',
    user: User,
  ): Promise<boolean> {
    if (type === 'verification') {
      return this.notification.sendVerificationEmail(
        user.firstName,
        user.email,
        user.verificationCode ?? '',
        this.emailVerificationCodeTTL,
      );
    }
    return this.notification.sendResetPasswordEmail(
      user.firstName,
      user.email,
      user.passwordResetCode ?? '',
      this.emailVerificationCodeTTL,
    );
  }

  private isCodeExpired(expiresAt: Date): boolean {
    return expiresAt < DateTime.utc().toJSDate();
  }

  private async setVerificationCode(
    user: User,
    type: 'email' | 'reset',
  ): Promise<User> {
    const code = this.generateNumericCode(6);
    const expiresAt = DateTime.utc()
      .plus({ minutes: this.emailVerificationCodeTTL })
      .toJSDate();

    if (type === 'email') {
      user.verificationCode = code;
      user.verificationCodeExpiresAt = expiresAt;
    } else {
      user.passwordResetCode = code;
      user.passwordResetExpiresAt = expiresAt;
    }

    return this.usersRepository.save(user);
  }

  private generateNumericCode(length: number): string {
    let code = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  private async generateJWT(user: User): Promise<string> {
    const payload: JwtPayload = { id: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }

  async signInWithGoogle(profile: unknown): Promise<SignInResponse> {
    const googleProfile = profile as GoogleUserProfile;
    const email = googleProfile?.email;

    if (!email) {
      throw new BadRequestException('Google profile missing email');
    }

    let user = await this.usersRepository.findOneBy({ email });

    if (!user) {
      const passwordHash = await this.hashPassword(randomUUID());
      user = this.usersRepository.create({
        firstName: googleProfile.firstName ?? 'User',
        lastName: googleProfile.lastName ?? '',
        email,
        password: passwordHash,
        timeZone: 'UTC',
        locale: 'en-CA',
        isActive: true,
        isEmailVerified: true,
        imageUrl: googleProfile.pictureUrl ?? null,
      });

      user = await this.usersRepository.save(user);
    }

    if (user.deletedAt !== null) {
      throw new UnauthorizedException('Login failed, invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive, please contact support');
    }

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.verificationCode = null;
      user.verificationCodeExpiresAt = null;
      user = await this.usersRepository.save(user);
    }

    if (!user.imageUrl && googleProfile.pictureUrl) {
      user.imageUrl = googleProfile.pictureUrl;
      user = await this.usersRepository.save(user);
    }

    await this.updateLastLogin(user.id);

    return {
      access_token: await this.generateJWT(user),
      user: UserMapper.toBasicUser(user),
    };
  }

  private async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async updateLastLogin(id: string): Promise<boolean> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) return false;
    user.lastLoginAt = DateTime.utc().toJSDate();
    await this.usersRepository.save(user);
    return true;
  }

  // Public API
  async signUp(signUpDto: SignUpDto): Promise<SignUpResponse> {
    this.logger.log(`Sign up attempt of: ${signUpDto.email}`);

    const existingUser = await this.usersRepository.findOneBy({
      email: signUpDto.email,
    });

    // If deletedAt is not null, allow to create account again
    if (existingUser && existingUser.deletedAt) {
      existingUser.deletedAt = null;
      existingUser.password = await this.hashPassword(signUpDto.password);
      const updatedUser = await this.setVerificationCode(existingUser, 'email');
      if (!updatedUser) {
        this.logger.error('Failed to update deleted user in the database');
        throw new InternalServerErrorException(
          'Failed to update user. Please try again later.',
        );
      }
      this.logger.log(
        `Deleted user reactivated successfully: ${updatedUser.email}. Verification code: ${updatedUser.verificationCode}`,
      );
      const emailSent = await this.sendEmail('verification', updatedUser);
      if (!emailSent) {
        this.logger.error(
          `Failed to send verification email to: ${updatedUser.email}. Please check your configuration.`,
        );
        throw new InternalServerErrorException(
          'Failed to send verification email. Please contact support.',
        );
      }
      this.logger.log(
        `Verification email sent successfully to: ${updatedUser.email}`,
      );
      return {
        message:
          'User reactivated successfully. Please check your email for verification.',
        user: UserMapper.toBasicUser(updatedUser),
      };
    }

    if (existingUser) {
      this.logger.warn(`Sign up failed - email already exists`);
      throw new ConflictException(
        'Email already exists, please login instead or contact support if you need help.',
      );
    }

    const passwordHash = await this.hashPassword(signUpDto.password);
    const newUser = this.usersRepository.create({
      ...signUpDto,
      password: passwordHash,
    });
    const savedUser = await this.setVerificationCode(newUser, 'email');
    if (!savedUser) {
      this.logger.error('Failed to create user in the database');
      throw new InternalServerErrorException(
        'Failed to create user. Please try again later.',
      );
    }
    this.logger.log(
      `User created successfully: ${savedUser.email}. Verification code: ${savedUser.verificationCode}`,
    );
    const emailSent = await this.sendEmail('verification', savedUser);
    if (!emailSent) {
      this.logger.error(
        `Failed to send verification email to: ${savedUser.email}. Please check your configuration.`,
      );
      await this.usersRepository.remove(savedUser);
      this.logger.warn(
        `User ${savedUser.email} removed due to email send failure.`,
      );
      throw new InternalServerErrorException(
        'Failed to send verification email. Please contact support.',
      );
    }
    this.logger.log(
      `Verification email sent successfully to: ${savedUser.email}`,
    );
    return {
      message:
        'User created successfully. Please check your email for verification.',
      user: UserMapper.toBasicUser(savedUser),
    };
  }

  async verifyEmailCode(
    verifyEmailCodeDto: VerifyEmailCodeDto,
  ): Promise<VerifyEmailCodeResponse> {
    this.logger.log(
      `Verification code attempt for: ${verifyEmailCodeDto.email}`,
    );

    const user = await this.usersRepository.findOneBy({
      email: verifyEmailCodeDto.email,
    });
    if (!user) {
      this.logger.warn(
        `Verification failed - user not found: ${verifyEmailCodeDto.email}`,
      );
      throw new NotFoundException('Verification failed - user not found');
    }

    if (user.isEmailVerified) {
      user.verificationCode = null;
      user.verificationCodeExpiresAt = null;
      await this.usersRepository.save(user);
      this.logger.warn(`Email is already verified: ${user.email}`);
      throw new BadRequestException('Email is already verified. Please login.');
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      this.logger.warn(
        `Verification code or expiration not found: ${user.email}`,
      );
      throw new BadRequestException('Verification code not found or expired.');
    }

    if (this.isCodeExpired(user.verificationCodeExpiresAt)) {
      this.logger.warn(`Verification code expired: ${user.email}`);
      await this.setVerificationCode(user, 'email');
      await this.sendEmail('verification', user);
      throw new BadRequestException(
        'Verification code expired. A new code has been sent to your email.',
      );
    }

    if (user.verificationCode !== verifyEmailCodeDto.code) {
      await this.setVerificationCode(user, 'email');
      await this.sendEmail('verification', user);
      this.logger.warn(
        `Verification failed - invalid code: ${verifyEmailCodeDto.code} for user: ${user.email}. New code sent: ${user.verificationCode}`,
      );
      throw new BadRequestException(
        'Invalid verification code. Please try again. A new code has been sent to your email.',
      );
    }

    this.logger.log(
      `Verification code matched for user: ${user.email}. Proceeding to verify email.`,
    );

    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    const updatedUser = await this.usersRepository.save(user);
    if (!updatedUser) {
      this.logger.error(
        `Failed to update user verification status: ${user.email}`,
      );
      throw new InternalServerErrorException(
        'Failed to verify email. Please try again later.',
      );
    }
    this.logger.log(`Email verified successfully for user: ${user.email}.`);

    return {
      message: 'Email verified successfully. You can now log in.',
      user: UserMapper.toBasicUser(updatedUser),
    };
  }

  async resendEmailVerification(
    resendEmailVerificationCodeDto: ResendEmailVerificationCodeDto,
  ): Promise<ResendEmailVerificationResponse> {
    const { email } = resendEmailVerificationCodeDto;
    this.logger.log(`Resend email verification code attempt for: ${email}`);
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      this.logger.warn(
        `Resend email verification failed - user not found: ${email}`,
      );
      throw new NotFoundException('User not found');
    }
    await this.setVerificationCode(user, 'email');
    const emailSent = await this.sendEmail('verification', user);
    if (!emailSent) {
      this.logger.error(
        `Failed to send verification email to: ${user.email}. Please check your configuration.`,
      );
      throw new InternalServerErrorException(
        'Failed to send verification email',
      );
    }
    this.logger.log(
      `Resent verification email successfully to: ${user.email}. New code: ${user.verificationCode}`,
    );
    return {
      message: 'If this email is registered, a new code has been sent.',
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const { email } = forgotPasswordDto;
    this.logger.log(`Forgot password attempt for: ${email}`);
    try {
      const user = await this.usersRepository.findOneBy({ email });

      if (!user) {
        this.logger.warn(`Forgot password failed - user not found: ${email}`);
        return {
          message: 'If this email is registered, a reset code has been sent.',
        };
      }

      if (!user.isActive) {
        this.logger.warn(`Forgot password failed - user is inactive: ${email}`);
        throw new ForbiddenException(
          'Your account is inactive. Please contact support.',
        );
      }

      await this.setVerificationCode(user, 'reset');
      const emailSent = await this.sendEmail('reset', user);
      if (!emailSent) {
        this.logger.error(
          `Failed to send reset password email to: ${user.email}. Please check your configuration.`,
        );
        throw new InternalServerErrorException(
          'Failed to send reset password email',
        );
      }

      this.logger.log(
        `Reset password email sent successfully to: ${user.email}. Reset code: ${user.passwordResetCode}`,
      );

      return {
        message:
          'Reset password email sent successfully. Please check your inbox.',
      };
    } catch (error) {
      this.logger.error(`Forgot password failed for: ${email}`, error);
      throw new InternalServerErrorException(
        'Failed to process forgot password request. Please try again later.',
      );
    }
  }

  async signIn(signInDto: SignInDto): Promise<SignInResponse> {
    const { email, password } = signInDto;
    this.logger.log(`Login attempt of: ${email}`);

    const user = await this.usersRepository.findOneBy({ email });

    // 1. Check if user exists
    if (!user) {
      this.logger.warn(`Login failed, user not found: ${email}`);
      throw new UnauthorizedException('Login failed, invalid credentials');
    }

    // 2. Check if user is deleted
    if (user.deletedAt !== null) {
      this.logger.warn(`Login failed, user is deleted: ${email}`);
      throw new UnauthorizedException('Login failed, invalid credentials');
    }

    // 3. Check if user is active and email is verified
    if (!user.isActive) {
      this.logger.warn(`Login failed, user is inactive: ${email}`);
      throw new UnauthorizedException(
        'Login failed, user is inactive. Please contact support.',
      );
    }

    if (!user.isEmailVerified) {
      this.logger.warn(`Login failed, email not verified: ${email}`);
      throw new UnauthorizedException(
        'Login failed, email not verified. Please verify your email first.',
        'Email Not Verified',
      );
    }

    const isValidCredentials = await this.comparePasswords(
      password,
      user.password,
    );
    if (!isValidCredentials) {
      this.logger.warn(`Login failed - invalid credentials: ${email}`);
      throw new UnauthorizedException('Login failed, invalid credentials');
    }
    this.logger.log(`Login successful for user: ${email}`);

    await this.updateLastLogin(user.id);

    return {
      access_token: await this.generateJWT(user),
      user: UserMapper.toBasicUser(user),
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    const { email, code, newPassword } = resetPasswordDto;
    this.logger.log(
      `Reset password attempt for: ${email}. At ${DateTime.utc().toISO()}`,
    );

    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      this.logger.warn(`Reset password failed - user not found: ${email}`);
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      this.logger.warn(`Reset password failed - user is inactive: ${email}`);
      throw new ForbiddenException(
        'Your account is inactive. Please contact support.',
      );
    }

    if (!user.passwordResetCode || !user.passwordResetExpiresAt) {
      this.logger.warn(
        `Reset password code or expiration not found for user: ${user.email}`,
      );
      throw new BadRequestException('Reset code not found.');
    }

    if (this.isCodeExpired(user.passwordResetExpiresAt)) {
      await this.setVerificationCode(user, 'reset');
      await this.sendEmail('reset', user);
      this.logger.warn(
        `Reset password failed - code expired for user: ${user.email}`,
      );
      throw new BadRequestException(
        'Reset code expired. A new code has been sent to your email.',
      );
    }

    if (user.passwordResetCode !== code) {
      await this.setVerificationCode(user, 'reset');
      await this.sendEmail('reset', user);
      this.logger.warn(
        `Reset password failed - invalid code: ${code} for user: ${user.email}. New code sent: ${user.passwordResetCode}`,
      );
      throw new BadRequestException(
        'Invalid reset code. A new code has been sent to your email. Please try again.',
      );
    }

    const hashedPassword = await this.hashPassword(newPassword);
    user.password = hashedPassword;
    user.passwordResetCode = null;
    user.passwordResetExpiresAt = null;

    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    this.logger.log(
      `Email verified for user: ${user.email} during password reset.`,
    );

    const updatedUser = await this.usersRepository.save(user);
    if (!updatedUser) {
      this.logger.error(`Failed to update password for user: ${user.email}`);
      throw new InternalServerErrorException(
        'Failed to reset password. Please try again later.',
      );
    }

    this.logger.log(`Password reset successfully for user: ${user.email}`);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  async resendResetPasswordCode(
    resendResetPasswordCodeDto: ResendResetPasswordCodeDto,
  ): Promise<ResendResetPasswordCodeResponse> {
    const { email } = resendResetPasswordCodeDto;
    this.logger.log(`Resend reset password code attempt for: ${email}`);
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      this.logger.warn(
        `Resend reset password code failed - user not found: ${email}`,
      );
      return {
        message: 'If this email is registered, a reset code has been sent.',
      };
    }
    if (!user.isActive) {
      this.logger.warn(
        `Resend reset password code failed - user is inactive: ${email}`,
      );
      throw new ForbiddenException(
        'Your account is inactive. Please contact support.',
      );
    }
    if (!user.passwordResetCode || !user.passwordResetExpiresAt) {
      this.logger.warn(
        `Reset password code or expiration not found for user: ${user.email}`,
      );
      throw new BadRequestException(
        'Reset code not found or expired. Please try again.',
      );
    }
    await this.setVerificationCode(user, 'reset');
    const emailSent = await this.sendEmail('reset', user);
    if (!emailSent) {
      this.logger.error(
        `Failed to send reset password email to: ${user.email}. Please check your configuration.`,
      );
      throw new InternalServerErrorException(
        'Failed to send reset password email',
      );
    }
    this.logger.log(
      `Resent reset password email successfully to: ${user.email}. New code: ${user.passwordResetCode}`,
    );
    return {
      message:
        'Reset password email resent successfully. Please check your inbox.',
    };
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    user: User,
  ): Promise<ChangePasswordResponse> {
    const { currentPassword, newPassword } = changePasswordDto;
    this.logger.log(`Change password attempt for user: ${user.email}`);

    const existingUser = await this.usersRepository.findOneBy({ id: user.id });

    if (!existingUser) {
      this.logger.warn(
        `Change password failed - user not found: ${user.email}`,
      );
      throw new NotFoundException('User not found');
    }

    const isValidPassword = await this.comparePasswords(
      currentPassword,
      existingUser.password,
    );
    if (!isValidPassword) {
      this.logger.warn(
        `Change password failed - invalid current password for user: ${user.email}`,
      );
      throw new BadRequestException('Invalid current password');
    }

    existingUser.password = await this.hashPassword(newPassword);
    const updatedUser = await this.usersRepository.save(existingUser);
    if (!updatedUser) {
      this.logger.error(`Failed to update password for user: ${user.email}`);
      throw new InternalServerErrorException(
        'Failed to change password. Please try again later.',
      );
    }

    this.logger.log(`Password changed successfully for user: ${user.email}`);
    return {
      message: 'Password changed successfully',
      user: UserMapper.toBasicUser(updatedUser),
    };
  }

  async deleteAccount(
    deleteAccountDto: DeleteAccountDto,
    user: User,
  ): Promise<DeleteAccountResponse> {
    this.logger.log(`Delete account attempt for user: ${user.email}`);

    const existingUser = await this.usersRepository.findOneBy({ id: user.id });
    if (!existingUser) {
      this.logger.warn(`Delete account failed - user not found: ${user.email}`);
      throw new NotFoundException('User not found');
    }

    if (!existingUser.isActive) {
      this.logger.warn(
        `Delete account failed - user is inactive: ${user.email}`,
      );
      throw new ForbiddenException(
        'Your account is inactive. Please contact support.',
      );
    }

    const isValidPassword = await this.comparePasswords(
      deleteAccountDto.password,
      existingUser.password,
    );
    if (!isValidPassword) {
      this.logger.warn(
        `Delete account failed - invalid password for user: ${user.email}`,
      );
      throw new BadRequestException('Invalid password');
    }

    existingUser.isActive = false;
    existingUser.deletedAt = DateTime.utc().toJSDate();
    await this.usersRepository.save(existingUser);
    this.logger.log(
      `Account inactivated (soft deleted) for user: ${user.email}`,
    );

    return {
      message:
        'Account deleted successfully. We are sorry to see you go. But we hope to see you again in the future.',
      user: UserMapper.toBasicUser(existingUser),
    };
  }

  async checkStatus(user: User): Promise<CheckStatusResponse> {
    this.logger.log(`Checking status for user: ${user.email}`);

    const existingUser = await this.usersRepository.findOneBy({ id: user.id });
    if (!existingUser) {
      this.logger.warn(`User not found: ${user.email}`);
      throw new NotFoundException('User not found');
    }

    if (!existingUser.isActive) {
      this.logger.warn(`User is inactive: ${user.email}`);
      throw new UnauthorizedException(
        'Your account is inactive. Please contact support.',
      );
    }

    if (!existingUser.isEmailVerified) {
      this.logger.warn(`Email not verified for user: ${user.email}`);
      throw new UnauthorizedException(
        'Email not verified. Please verify your email first.',
      );
    }

    this.logger.log(`User status check successful for: ${user.email}`);
    return {
      access_token: await this.generateJWT(existingUser),
      user: UserMapper.toBasicUser(existingUser),
    };
  }

  async updateProfile(
    updateProfileDto: UpdateProfileDto,
    user: User,
  ): Promise<UpdateProfileResponse> {
    const { password, ...userData } = updateProfileDto;

    this.logger.log(`Update profile attempt for user: ${user.email}`);

    try {
      if (password && password.trim().length > 0) {
        this.logger.log(
          `Updating profile with password for user: ${user.email}`,
        );
        const newPassword = await this.hashPassword(password);

        const updatedUser = await this.usersRepository.preload({
          id: user.id,
          password: newPassword,
          ...userData,
        });

        if (!updatedUser) {
          this.logger.error(`User not found: ${user.id}`);
          throw new NotFoundException('User not found');
        }

        await this.usersRepository.save(updatedUser);
        this.logger.log(
          `Profile updated successfully with password for user: ${user.email}`,
        );

        return {
          message: 'Profile updated successfully',
          user: UserMapper.toBasicUser(updatedUser),
        };
      }

      this.logger.log(
        `Updating profile without password for user: ${user.email}`,
      );
      const updatedUser = await this.usersRepository.preload({
        id: user.id,
        ...userData,
      });

      if (!updatedUser) {
        this.logger.error(`User not found: ${user.id}`);
        throw new NotFoundException('User not found');
      }

      await this.usersRepository.save(updatedUser);
      this.logger.log(`Profile updated successfully for user: ${user.email}`);

      return {
        message: 'Profile updated successfully',
        user: UserMapper.toBasicUser(updatedUser),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update profile for user: ${user.email}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to update profile for user ${user.id}.`,
      );
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { GoogleUserProfile } from './strategies/google.strategy';

import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  ResendEmailCodeDto,
  ResendResetPasswordCodeDto,
  ResetPasswordDto,
  SignUpDto,
  UpdateProfileDto,
  VerifyEmailCodeDto,
} from '@ascencio/shared/schemas';
import { AuthMessages, CommonMessages } from '@ascencio/shared/i18n';
import { User } from './entities/user.entity';
import { NotificationService } from 'src/notification/notification.service';
import { UserMapper } from './mappers/user.mapper';
import { JwtPayload } from './interfaces/jwt-payload.interface';
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
  UpdateProfileResponse,
  VerifyEmailResponse,
} from '@ascencio/shared/interfaces';
import { SignInDto } from './dto/sign-in.dto';

@Injectable()
export class AuthService {
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

  /**
   * Sets a verification code and its expiration on the user entity.
   *
   * @param user The user entity to set the verification code for.
   * @param type The type of verification code to set ('email' or 'reset').
   * @returns The updated user entity with the new verification code and expiration.
   */
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

  /**
   * Generates a numeric code of specified length.
   * @param length  Length of the numeric code to generate.
   * @returns  Generated numeric code as a string.
   *
   * Example: generateNumericCode(6) => "493027"
   */
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
      throw new BadRequestException(AuthMessages.GOOGLE_PROFILE_MISSING_EMAIL);
    }

    let user = await this.usersRepository.findOneBy({ email });

    if (user && !user.isActive)
      throw new ForbiddenException(AuthMessages.ACCOUNT_LOCKED);

    if (!user || user.deletedAt !== null) {
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
        lastLoginAt: DateTime.utc().toJSDate(),
        imageUrl: googleProfile.pictureUrl ?? null,
        deletedAt: null,
      });

      user = await this.usersRepository.save(user);
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

  /**
   *  Updates the last login timestamp for the user.
   *
   * @param id The ID of the user to update.
   * @returns  A promise that resolves to true if the update was successful, false otherwise.
   *
   * Example: updateLastLogin('user-id-123') => true
   */
  private async updateLastLogin(id: string): Promise<boolean> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) return false;
    user.lastLoginAt = DateTime.utc().toJSDate();
    await this.usersRepository.save(user);
    return true;
  }

  async signUp(signUpDto: SignUpDto): Promise<SignUpResponse> {
    const existingUser = await this.usersRepository.findOneBy({
      email: signUpDto.email,
    });

    // If deletedAt is not null, allow to create account again
    if (existingUser && existingUser.deletedAt) {
      existingUser.deletedAt = null;
      existingUser.isActive = true;
      existingUser.isEmailVerified = false;
      existingUser.password = await this.hashPassword(signUpDto.password);
      const updatedUser = await this.setVerificationCode(existingUser, 'email');

      if (!updatedUser) {
        throw new InternalServerErrorException(
          CommonMessages.INTERNAL_SERVER_ERROR,
        );
      }

      const emailSent = await this.sendEmail('verification', updatedUser);

      if (!emailSent)
        throw new InternalServerErrorException(
          CommonMessages.INTERNAL_SERVER_ERROR,
        );

      return {
        message: AuthMessages.SIGN_UP_SUCCESS,
        user: UserMapper.toBasicUser(updatedUser),
      };
    }

    if (existingUser)
      throw new ConflictException(AuthMessages.EMAIL_ALREADY_EXISTS);

    const passwordHash = await this.hashPassword(signUpDto.password);
    const newUser = this.usersRepository.create({
      ...signUpDto,
      password: passwordHash,
    });

    const savedUser = await this.setVerificationCode(newUser, 'email');
    if (!savedUser)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    const emailSent = await this.sendEmail('verification', savedUser);

    if (!emailSent) {
      await this.usersRepository.remove(savedUser);

      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: AuthMessages.SIGN_UP_SUCCESS,
      user: UserMapper.toBasicUser(savedUser),
    };
  }

  async verifyEmailCode(
    verifyEmailCodeDto: VerifyEmailCodeDto,
  ): Promise<VerifyEmailResponse> {
    const user = await this.usersRepository.findOneBy({
      email: verifyEmailCodeDto.email,
    });

    if (!user) throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    if (user.isEmailVerified) {
      user.verificationCode = null;
      user.verificationCodeExpiresAt = null;
      await this.usersRepository.save(user);
      throw new BadRequestException(AuthMessages.EMAIL_ALREADY_VERIFIED);
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt)
      throw new BadRequestException('Verification code not found or expired.');

    if (this.isCodeExpired(user.verificationCodeExpiresAt)) {
      await this.setVerificationCode(user, 'email');
      await this.sendEmail('verification', user);
      throw new BadRequestException(AuthMessages.CODE_EXPIRED);
    }

    if (user.verificationCode !== verifyEmailCodeDto.code) {
      await this.setVerificationCode(user, 'email');
      await this.sendEmail('verification', user);
      throw new BadRequestException(AuthMessages.INVALID_CODE);
    }

    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    const updatedUser = await this.usersRepository.save(user);
    if (!updatedUser)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    return {
      user: UserMapper.toBasicUser(updatedUser),
      access_token: await this.generateJWT(updatedUser),
    };
  }

  async resendEmailCode(
    resendEmailCodeDto: ResendEmailCodeDto,
  ): Promise<ResendEmailCodeResponse> {
    const { email } = resendEmailCodeDto;
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    await this.setVerificationCode(user, 'email');
    const emailSent = await this.sendEmail('verification', user);
    if (!emailSent)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    return {
      message: AuthMessages.VERIFICATION_EMAIL_RESENT,
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const { email } = forgotPasswordDto;

    try {
      const user = await this.usersRepository.findOneBy({ email });

      if (!user)
        return {
          message: AuthMessages.RESET_CODE_SENT,
        };

      if (!user.isActive)
        throw new ForbiddenException(AuthMessages.ACCOUNT_LOCKED);

      await this.setVerificationCode(user, 'reset');

      const emailSent = await this.sendEmail('reset', user);
      if (!emailSent)
        throw new InternalServerErrorException(
          CommonMessages.INTERNAL_SERVER_ERROR,
        );

      return {
        message: AuthMessages.RESET_PASSWORD_EMAIL_SENT,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async signIn(signInDto: SignInDto): Promise<SignInResponse> {
    const { email, password } = signInDto;

    const user = await this.usersRepository.findOneBy({ email });

    if (!user)
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);

    if (user.deletedAt !== null)
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);

    if (!user.isEmailVerified)
      throw new UnauthorizedException(AuthMessages.EMAIL_NOT_VERIFIED);

    if (!user.isActive)
      throw new UnauthorizedException(AuthMessages.ACCOUNT_LOCKED);

    const isValidCredentials = await this.comparePasswords(
      password,
      user.password,
    );

    if (!isValidCredentials)
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);

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

    const user = await this.usersRepository.findOneBy({ email });
    if (!user) throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    if (!user.isActive)
      throw new ForbiddenException(AuthMessages.ACCOUNT_LOCKED);

    if (!user.passwordResetCode || !user.passwordResetExpiresAt)
      throw new BadRequestException(AuthMessages.CODE_NOT_FOUND);

    if (this.isCodeExpired(user.passwordResetExpiresAt)) {
      await this.setVerificationCode(user, 'reset');
      await this.sendEmail('reset', user);
      throw new BadRequestException(AuthMessages.CODE_EXPIRED);
    }

    if (user.passwordResetCode !== code) {
      await this.setVerificationCode(user, 'reset');
      await this.sendEmail('reset', user);
      throw new BadRequestException(AuthMessages.INVALID_CODE);
    }

    const hashedPassword = await this.hashPassword(newPassword);
    user.password = hashedPassword;
    user.passwordResetCode = null;
    user.passwordResetExpiresAt = null;

    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;

    const updatedUser = await this.usersRepository.save(user);
    if (!updatedUser)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    return {
      access_token: await this.generateJWT(updatedUser),
      user: UserMapper.toBasicUser(updatedUser),
    };
  }

  async resendResetPasswordCode(
    resendResetPasswordCodeDto: ResendResetPasswordCodeDto,
  ): Promise<ResendResetPasswordCodeResponse> {
    const { email } = resendResetPasswordCodeDto;
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      return {
        message: AuthMessages.RESET_CODE_SENT,
      };
    }
    if (!user.isActive) {
      throw new ForbiddenException(AuthMessages.ACCOUNT_LOCKED);
    }
    if (!user.passwordResetCode || !user.passwordResetExpiresAt)
      throw new BadRequestException(AuthMessages.CODE_EXPIRED);

    await this.setVerificationCode(user, 'reset');
    const emailSent = await this.sendEmail('reset', user);
    if (!emailSent)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    return {
      message: AuthMessages.RESET_CODE_SENT,
    };
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
    user: User,
  ): Promise<ChangePasswordResponse> {
    const { currentPassword, newPassword } = changePasswordDto;

    const existingUser = await this.usersRepository.findOneBy({ id: user.id });

    if (!existingUser)
      throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    const isValidPassword = await this.comparePasswords(
      currentPassword,
      existingUser.password,
    );
    if (!isValidPassword)
      throw new BadRequestException(AuthMessages.INVALID_CURRENT_PASSWORD);

    existingUser.password = await this.hashPassword(newPassword);
    const updatedUser = await this.usersRepository.save(existingUser);
    if (!updatedUser)
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );

    return {
      user: UserMapper.toBasicUser(updatedUser),
      access_token: await this.generateJWT(updatedUser),
    };
  }

  async deleteAccount(
    deleteAccountDto: DeleteAccountDto,
    user: User,
  ): Promise<DeleteAccountResponse> {
    const existingUser = await this.usersRepository.findOneBy({ id: user.id });
    if (!existingUser)
      throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    if (!existingUser.isActive)
      throw new ForbiddenException(AuthMessages.ACCOUNT_LOCKED);

    const isValidPassword = await this.comparePasswords(
      deleteAccountDto.password,
      existingUser.password,
    );
    if (!isValidPassword)
      throw new BadRequestException(AuthMessages.INVALID_PASSWORD);

    existingUser.isActive = false;
    existingUser.deletedAt = DateTime.utc().toJSDate();
    await this.usersRepository.save(existingUser);

    return {
      message: AuthMessages.ACCOUNT_DELETED,
    };
  }

  async checkStatus(user: User): Promise<CheckStatusResponse> {
    const existingUser = await this.usersRepository.findOneBy({ id: user.id });
    if (!existingUser)
      throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

    if (!existingUser.isActive)
      throw new UnauthorizedException(AuthMessages.ACCOUNT_LOCKED);

    if (!existingUser.isEmailVerified)
      throw new UnauthorizedException(AuthMessages.EMAIL_NOT_VERIFIED);

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

    try {
      if (password && password.trim().length > 0) {
        const newPassword = await this.hashPassword(password);

        const updatedUser = await this.usersRepository.preload({
          id: user.id,
          password: newPassword,
          ...userData,
        });

        if (!updatedUser)
          throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

        await this.usersRepository.save(updatedUser);

        return UserMapper.toBasicUser(updatedUser);
      }

      const updatedUser = await this.usersRepository.preload({
        id: user.id,
        ...userData,
      });

      if (!updatedUser)
        throw new NotFoundException(CommonMessages.USER_NOT_FOUND);

      await this.usersRepository.save(updatedUser);

      return UserMapper.toBasicUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new InternalServerErrorException(
        CommonMessages.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

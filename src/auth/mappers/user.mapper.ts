import { SimpleUser } from '@ascencio/shared/interfaces';
import { User } from '../entities/user.entity';

export const UserMapper = {
  toBasicUser(user: User): SimpleUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl ?? undefined,
      email: user.email,
      countryCode: user.countryCode ?? undefined,
      phoneNumber: user.phoneNumber ?? undefined,
      locale: user.locale,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      timeZone: user.timeZone,
      deletedAt: user.deletedAt ?? undefined,
    };
  },
};

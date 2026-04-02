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
      lastLoginAt: user.lastLoginAt?.toISOString() ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      isActive: user.isActive,
      timeZone: user.timeZone,
    };
  },
};

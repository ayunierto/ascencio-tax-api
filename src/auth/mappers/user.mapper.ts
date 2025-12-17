import { User } from '../entities/user.entity';
import { BasicUser } from '../interfaces/basic-user.interface';

export class UserMapper {
  static toBasicUser(user: User): BasicUser {
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
    };
  }
}

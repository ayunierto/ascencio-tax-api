import { UserMapper } from './user.mapper';
import { User } from '../entities/user.entity';

const buildUser = (overrides: Partial<User> = {}): User => {
  const base: User = {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    password: 'hashed',
    roles: ['user'],
    locale: 'es',
    timeZone: 'UTC',
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    lastLoginAt: null,
    deletedAt: null,
    verificationCode: null,
    verificationCodeExpiresAt: null,
    passwordResetCode: null,
    passwordResetExpiresAt: null,
    phoneNumber: null,
    countryCode: null,
    imageUrl: null,
    expenses: [],
    appointments: [],
    logs: [],
    posts: [],
    reports: [],
  } as User;
  return { ...base, ...overrides } as User;
};

describe('UserMapper', () => {
  it('convierte User a BasicUser manejando nulls como undefined', () => {
    const user = buildUser();

    const result = UserMapper.toBasicUser(user);

    expect(result).toEqual({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      countryCode: undefined,
      phoneNumber: undefined,
      locale: 'es',
      roles: ['user'],
      lastLoginAt: undefined,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });
  });
});

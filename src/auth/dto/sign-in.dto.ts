import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  @ApiProperty({
    description: 'User email',
    example: 'john.doe@example.com',
    type: String,
  })
  email!: string;

  @MinLength(6)
  @ApiProperty({
    description: 'User password',
    example: 'password123',
    type: String,
  })
  password!: string;
}

import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import {
  SearchAvailabilityRequest,
  searchAvailabilitySchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(searchAvailabilitySchema))
  async checkAvailability(
    @Body() searchAvailabilityDto: SearchAvailabilityRequest,
  ) {
    return this.availabilityService.searchAvailability(searchAvailabilityDto);
  }

  @Post('me')
  @Auth()
  @UsePipes(new ZodValidationPipe(searchAvailabilitySchema))
  async checkAvailabilityForCurrentUser(
    @Body() searchAvailabilityDto: SearchAvailabilityRequest,
    @GetUser() user: User,
  ) {
    return this.availabilityService.searchAvailability(
      searchAvailabilityDto,
      user.id,
    );
  }
}

import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import {
  SearchAvailabilityRequest,
  searchAvailabilitySchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

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
}

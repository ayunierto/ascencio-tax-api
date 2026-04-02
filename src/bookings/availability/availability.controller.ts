import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';

@ApiTags('Bookings - Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Check availability for a service' })
  @ApiResponse({ status: 200, description: 'Return available slots' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async checkAvailability(
    @Body() searchAvailabilityDto: SearchAvailabilityDto,
  ) {
    return this.availabilityService.searchAvailability(searchAvailabilityDto);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { Service } from './entities';
import {
  serviceSchema,
  updateServiceSchema,
  type CreateServiceRequest,
  type UpdateServiceRequest,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Auth(Role.Admin, Role.Staff, Role.SuperUser)
  create(
    @Body(new ZodValidationPipe(serviceSchema))
    createServiceDto: CreateServiceRequest,
  ): Promise<Service> {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.servicesService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.Admin, Role.Staff, Role.SuperUser)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema))
    updateServiceDto: UpdateServiceRequest,
  ) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  @Auth(Role.Admin, Role.Staff, Role.SuperUser)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.remove(id);
  }
}

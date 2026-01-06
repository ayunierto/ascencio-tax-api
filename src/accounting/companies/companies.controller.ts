import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Role } from 'src/auth/enums/role.enum';
import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  createCompanySchema,
  updateCompanySchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CompaniesService } from './companies.service';
import { User } from 'src/auth/entities/user.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { Company } from './entities/company.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createCompanySchema))
    company: CreateCompanyRequest,
    @GetUser() user: User,
  ) {
    return this.companiesService.create(user, company);
  }

  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @GetUser() user: User,
  ): Promise<PaginatedResponse<Company>> {
    return this.companiesService.findAll(paginationDto, user.id);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User): Promise<Company> {
    return this.companiesService.findOne(user.id, id);
  }

  @Patch(':id')
  @Auth(Role.Admin, Role.Staff, Role.User)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompanySchema))
    body: UpdateCompanyRequest,
    @GetUser() user: User,
  ): Promise<Company> {
    return this.companiesService.update(user.id, id, body);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Company> {
    return this.companiesService.remove(user.id, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Role } from 'src/auth/enums/role.enum';
import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  createCompanySchema,
  updateCompanySchema,
} from '@ascencio/shared/schemas';
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
  @UsePipes(new ZodValidationPipe(createCompanySchema))
  create(
    @Body() createCompany: CreateCompanyRequest,
    @GetUser() user: User,
  ): Promise<Company> {
    return this.companiesService.create(user, createCompany);
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
  @UsePipes(new ZodValidationPipe(updateCompanySchema))
  update(
    @Param('id') id: string,
    @Body() body: UpdateCompanyRequest,
    @GetUser() user: User,
  ): Promise<Company> {
    return this.companiesService.update(user.id, id, body);
  }

  @Delete(':id')
  @Auth(Role.Admin, Role.Staff)
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Company> {
    return this.companiesService.remove(user.id, id);
  }
}

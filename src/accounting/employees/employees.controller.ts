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
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  createEmployeeSchema,
  updateEmployeeSchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { EmployeesService } from './employees.service';
import { User } from 'src/auth/entities/user.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { Employee } from './entities/employee.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createEmployeeSchema))
    employee: CreateEmployeeRequest,
    @GetUser() user: User,
  ) {
    return this.employeesService.create(user.id, employee);
  }

  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('companyId') companyId: string,
    @GetUser() user: User,
  ): Promise<PaginatedResponse<Employee>> {
    return this.employeesService.findAll(paginationDto, user.id, companyId);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User): Promise<Employee> {
    return this.employeesService.findOne(user.id, id);
  }

  @Patch(':id')
  @Auth(Role.Admin, Role.Staff, Role.User)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateEmployeeSchema))
    body: UpdateEmployeeRequest,
    @GetUser() user: User,
  ): Promise<Employee> {
    return this.employeesService.update(user.id, id, body);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Employee> {
    return this.employeesService.remove(user.id, id);
  }
}

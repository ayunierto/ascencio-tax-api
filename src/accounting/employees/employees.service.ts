import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import { IsNull, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
} from '@ascencio/shared/schemas';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async create(
    userId: string,
    input: CreateEmployeeRequest,
  ): Promise<Employee> {
    const { companyId, ...rest } = input;
    const employee = this.employeeRepo.create({
      ...rest,
      userId,
      ...(companyId ? { companyId } : {}),
    } as Partial<Employee>);

    return this.employeeRepo.save(employee);
  }

  async findAll(
    paginationDto: PaginationDto,
    userId: string,
    companyId?: string,
  ): Promise<PaginatedResponse<Employee>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const where: {
      userId: string;
      deletedAt: ReturnType<typeof IsNull>;
      companyId?: string;
    } = { userId, deletedAt: IsNull() };
    if (companyId) {
      where.companyId = companyId;
    }

    const [employees, total] = await this.employeeRepo.findAndCount({
      take: limit,
      skip: offset,
      where,
      relations: ['company'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });

    return {
      total,
      pages: Math.ceil(total / limit),
      items: employees,
    };
  }

  async findOne(userId: string, id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id, userId },
      relations: ['company'],
    });

    if (!employee) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    return employee;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateEmployeeRequest,
  ): Promise<Employee> {
    const employee = await this.findOne(userId, id);
    const { companyId, ...rest } = input;
    Object.assign(employee, rest);
    if (companyId !== undefined) {
      employee.companyId = companyId ?? undefined;
    }
    return this.employeeRepo.save(employee);
  }

  async remove(userId: string, id: string): Promise<Employee> {
    const employee = await this.findOne(userId, id);
    await this.employeeRepo.softRemove(employee);
    return employee;
  }
}

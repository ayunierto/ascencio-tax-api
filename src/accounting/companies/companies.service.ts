import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '@ascencio/shared/schemas';
import { IsNull, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  // TODO: Add user relation properly when multi-user support is added
  create(userId: string, input: CreateCompanyRequest): Promise<Company> {
    const company = this.companyRepo.create({ ...input });
    return this.companyRepo.save(company);
  }

  async findAll(
    paginationDto: PaginationDto,
    userId: string,
  ): Promise<PaginatedResponse<Company>> {
    const { limit = 10, offset = 0 } = paginationDto;
    const [companies, total] = await this.companyRepo.findAndCount({
      take: limit,
      skip: offset,
      where: { users: { id: userId }, deletedAt: IsNull() },
    });

    return {
      total,
      pages: Math.ceil(total / limit),
      items: companies,
    };
  }

  async findOne(userId: string, id: string) {
    const company = await this.companyRepo.findOne({
      where: { id, users: { id: userId } },
    });

    if (!company)
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);

    return company;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateCompanyRequest,
  ): Promise<Company> {
    const company = await this.findOne(userId, id);
    Object.assign(company, input);
    return this.companyRepo.save(company);
  }

  async remove(userId: string, id: string): Promise<Company> {
    const company = await this.findOne(userId, id);
    await this.companyRepo.softRemove(company);
    return company;
  }
}

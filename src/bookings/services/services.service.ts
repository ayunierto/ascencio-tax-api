import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { In, Repository, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Service } from './entities';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { DateTime } from 'luxon';
import { CommonMessages } from '@ascencio/shared/i18n';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
  ) {}

  async create(createServiceDto: CreateServiceDto): Promise<Service> {
    const { staffIds, ...serviceData } = createServiceDto;

    if (staffIds.length === 0)
      throw new BadRequestException(CommonMessages.VALIDATION_REQUIRED);

    // Validate and get staff members if provided
    const staff = await this.validateAndGetStaff(staffIds);

    const service = this.serviceRepository.create({
      ...serviceData,
      staffMembers: staff,
    });

    const savedService = await this.serviceRepository.save(service);

    return savedService;
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Service>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [services, total] = await this.serviceRepository.findAndCount({
      take: limit,
      skip: offset,
      where: { deletedAt: IsNull() }, // Only get non-deleted services
      relations: {
        staffMembers: true,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      items: services,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: {
        staffMembers: true,
      },
    });

    if (!service) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    const { staffIds, ...serviceData } = updateServiceDto;

    const existing = await this.findOne(id);

    // Validate and get staff members if provided; if not provided, keep current ones
    const staff =
      staffIds === undefined
        ? existing.staffMembers
        : await this.validateAndGetStaff(staffIds);

    if (staff.length === 0) {
      throw new BadRequestException(CommonMessages.VALIDATION_REQUIRED);
    }

    const service = await this.serviceRepository.preload({
      id,
      ...serviceData,
      staffMembers: staff,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const updatedService = await this.serviceRepository.save(service);

    return updatedService;
  }

  async remove(id: string): Promise<Service> {
    const service = await this.findOne(id);
    service.deletedAt = DateTime.now().toISO();

    const deletedService = await this.serviceRepository.save(service);

    return deletedService;
  }

  /**
   * Private helper method to validate and retrieve staff members
   */
  private async validateAndGetStaff(
    staffIds?: string[],
  ): Promise<StaffMember[]> {
    if (!staffIds || staffIds.length === 0) {
      throw new BadRequestException(CommonMessages.VALIDATION_REQUIRED);
    }

    const staff = await this.staffRepository.findBy({
      id: In(staffIds),
    });

    // Check if all requested staff members were found
    const foundStaffIds = staff.map((s) => s.id);
    const missingStaffIds = staffIds.filter(
      (id) => !foundStaffIds.includes(id),
    );

    if (missingStaffIds.length > 0) {
      throw new BadRequestException(CommonMessages.VALIDATION_UUID);
    }

    return staff;
  }
}

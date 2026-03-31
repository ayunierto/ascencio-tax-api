import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { In, Repository, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Service } from './entities';
import { StaffMember } from 'src/bookings/staff-members/entities/staff-member.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { DateTime } from 'luxon';
import { CommonMessages, ValidationMessages } from '@ascencio/shared/i18n';
import { FilesService } from 'src/files/files.service';
import type {
  CreateServiceRequest,
  UpdateServiceRequest,
} from '@ascencio/shared';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(StaffMember)
    private readonly staffRepository: Repository<StaffMember>,
    private readonly filesService: FilesService,
  ) {}

  async create(createServiceDto: CreateServiceRequest): Promise<Service> {
    const {
      staffIds,
      imageUrl: imageUrlOrPublicId,
      ...serviceData
    } = createServiceDto;

    if (staffIds.length === 0)
      throw new BadRequestException(ValidationMessages.REQUIRED);

    // Validate and get staff members if provided
    const staff = await this.validateAndGetStaff(staffIds);

    // Handle image promotion from temp_files to services folder
    let finalImageUrl: string | undefined;
    let imagePublicId: string | undefined;

    // Extract publicId from URL or use as-is if already a publicId
    const tempPublicId = this.extractTempPublicId(imageUrlOrPublicId);

    if (tempPublicId) {
      // Promote temp image to permanent storage
      const result = await this.filesService.promoteImage(
        tempPublicId,
        'services',
      );
      imagePublicId = result.publicId;
      finalImageUrl = result.secureUrl;
    } else if (imageUrlOrPublicId) {
      // Already a full URL (not temp), use as-is
      finalImageUrl = imageUrlOrPublicId;
    }

    const service = this.serviceRepository.create({
      ...serviceData,
      imageUrl: finalImageUrl,
      staffMembers: staff,
    });

    // Si falla el save, hacer rollback de la imagen promovida
    try {
      const savedService = await this.serviceRepository.save(service);
      return savedService;
    } catch (error) {
      // Rollback: eliminar la imagen que fue promovida
      if (imagePublicId) {
        this.filesService.scheduleDelete(imagePublicId);
      }
      throw error;
    }
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
    updateServiceDto: UpdateServiceRequest,
  ): Promise<Service> {
    const {
      staffIds,
      imageUrl: imageUrlOrPublicId,
      ...serviceData
    } = updateServiceDto;

    const existing = await this.findOne(id);

    // Validate and get staff members if provided; if not provided, keep current ones
    const staff =
      staffIds === undefined
        ? existing.staffMembers
        : await this.validateAndGetStaff(staffIds);

    if (staff.length === 0) {
      throw new BadRequestException(ValidationMessages.REQUIRED);
    }

    // Handle image update
    let finalImageUrl: string | undefined = existing.imageUrl;
    let newImagePublicId: string | undefined;
    let oldImagePublicIdToDelete: string | undefined;

    if (imageUrlOrPublicId !== undefined) {
      // Extract publicId from URL or use as-is if already a publicId
      const tempPublicId = this.extractTempPublicId(imageUrlOrPublicId);

      // Case 1: New temp image provided - promote it
      if (tempPublicId) {
        const result = await this.filesService.promoteImage(
          tempPublicId,
          'services',
        );
        newImagePublicId = result.publicId;
        finalImageUrl = result.secureUrl;
        oldImagePublicIdToDelete = this.extractCloudinaryPublicId(
          existing.imageUrl,
        );
      }
      // Case 2: Explicitly clearing the image
      else if (imageUrlOrPublicId === null || imageUrlOrPublicId === '') {
        finalImageUrl = undefined;
        oldImagePublicIdToDelete = this.extractCloudinaryPublicId(
          existing.imageUrl,
        );
      }
      // Case 3: Full URL provided (already promoted or external)
      else if (imageUrlOrPublicId) {
        finalImageUrl = imageUrlOrPublicId;
      }
    }

    const service = await this.serviceRepository.preload({
      id,
      ...serviceData,
      imageUrl: finalImageUrl,
      staffMembers: staff,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    // Si falla el save, hacer rollback de la imagen promovida
    try {
      const updatedService = await this.serviceRepository.save(service);
      if (
        oldImagePublicIdToDelete &&
        oldImagePublicIdToDelete !== newImagePublicId
      ) {
        this.filesService.scheduleDelete(oldImagePublicIdToDelete);
      }
      return updatedService;
    } catch (error) {
      // Rollback: eliminar la nueva imagen que fue promovida
      if (newImagePublicId) {
        this.filesService.scheduleDelete(newImagePublicId);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Service> {
    const service = await this.findOne(id);
    service.deletedAt = DateTime.now().toISO();

    const deletedService = await this.serviceRepository.softDelete(service);

    return service;
  }

  /**
   * Private helper method to validate and retrieve staff members
   */
  private async validateAndGetStaff(
    staffIds?: string[],
  ): Promise<StaffMember[]> {
    if (!staffIds || staffIds.length === 0) {
      throw new BadRequestException(ValidationMessages.REQUIRED);
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
      throw new BadRequestException(ValidationMessages.UUID);
    }

    return staff;
  }

  /**
   * Extract publicId from Cloudinary URL or return publicId as-is
   * Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{publicId}.{format}
   * or: https://res.cloudinary.com/{cloud_name}/image/upload/{publicId}.{format}
   *
   * @param imageUrlOrPublicId - Full Cloudinary URL or publicId
   * @returns publicId if starts with temp_files/, otherwise the original value
   */
  private extractTempPublicId(imageUrlOrPublicId?: string): string | undefined {
    if (!imageUrlOrPublicId) return undefined;

    const normalizeTempPublicId = (value: string): string => {
      const duplicatePrefix = 'temp_files/temp_files/';
      const normalized = value.startsWith(duplicatePrefix)
        ? `temp_files/${value.substring(duplicatePrefix.length)}`
        : value;

      const lastDotIndex = normalized.lastIndexOf('.');
      return lastDotIndex !== -1
        ? normalized.substring(0, lastDotIndex)
        : normalized;
    };

    // If already a publicId (starts with temp_files/), return as-is
    if (imageUrlOrPublicId.startsWith('temp_files/')) {
      return normalizeTempPublicId(imageUrlOrPublicId);
    }

    // Try to extract publicId from Cloudinary URL
    if (imageUrlOrPublicId.includes('res.cloudinary.com')) {
      // Match pattern: /upload/{optional_version}/{publicId}.{extension}
      const match = /\/upload\/(?:v\d+\/)?(.*)/.exec(imageUrlOrPublicId);
      if (match && match[1]) {
        // Remove file extension from publicId
        const publicIdWithExt = match[1];
        const lastDotIndex = publicIdWithExt.lastIndexOf('.');
        const publicId =
          lastDotIndex !== -1
            ? publicIdWithExt.substring(0, lastDotIndex)
            : publicIdWithExt;

        // Only return if it's a temp file
        if (publicId.startsWith('temp_files/')) {
          return normalizeTempPublicId(publicId);
        }
      }
    }

    // Not a temp file, return undefined
    return undefined;
  }

  /**
   * Extract publicId from a Cloudinary URL for deletion
   */
  private extractCloudinaryPublicId(imageUrl?: string): string | undefined {
    if (!imageUrl) return undefined;
    if (!imageUrl.includes('res.cloudinary.com')) return undefined;

    const match = /\/upload\/(?:v\d+\/)?(.*)/.exec(imageUrl);
    if (!match?.[1]) return undefined;

    const publicIdWithExt = match[1];
    const lastDotIndex = publicIdWithExt.lastIndexOf('.');
    const publicId =
      lastDotIndex !== -1
        ? publicIdWithExt.substring(0, lastDotIndex)
        : publicIdWithExt;

    return publicId || undefined;
  }
}

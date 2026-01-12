import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import { CreateCompanyRequest, UpdateCompanyRequest } from '@ascencio/shared';
import { IsNull, Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from 'src/auth/entities/user.entity';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly filesService: FilesService,
  ) {}

  async create(user: User, input: CreateCompanyRequest): Promise<Company> {
    const { mediaToken, ...companyData } = input;

    let logoPublicId: string | undefined;
    let logoUrl: string | undefined;

    // If a mediaToken is provided, promote the temp image to permanent storage
    if (mediaToken && mediaToken.startsWith('temp_files/')) {
      const result = await this.filesService.promoteImage(
        mediaToken,
        'companies',
      );
      logoPublicId = result.publicId;
      logoUrl = result.secureUrl;
    }

    const company = this.companyRepo.create({
      ...companyData,
      logoPublicId,
      logoUrl,
      users: [user],
    });

    // Si falla el save, hacer rollback de la imagen promovida
    try {
      return await this.companyRepo.save(company);
    } catch (error) {
      // Rollback: eliminar la imagen que fue promovida
      if (logoPublicId) {
        this.filesService.scheduleDelete(logoPublicId);
      }
      throw error;
    }
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
    const { mediaToken, ...updateData } = input;

    let newImagePublicId: string | undefined;

    // Handle image update
    if (mediaToken !== undefined) {
      // Case 1: New temp image provided - promote it
      if (mediaToken && mediaToken.startsWith('temp_files/')) {
        // Promover nueva imagen primero
        const result = await this.filesService.promoteImage(
          mediaToken,
          'companies',
        );
        newImagePublicId = result.publicId;

        // Programar eliminación de imagen anterior (fire and forget)
        if (company.logoPublicId) {
          this.filesService.scheduleDelete(company.logoPublicId);
        }

        company.logoPublicId = result.publicId;
        company.logoUrl = result.secureUrl;
      }
      // Case 2: Explicitly clearing the image (mediaToken is null/undefined but was passed)
      else if (mediaToken === null || mediaToken === '') {
        // Schedule deletion of old image
        if (company.logoPublicId) {
          this.filesService.scheduleDelete(company.logoPublicId);
        }
        company.logoPublicId = undefined;
        company.logoUrl = undefined;
      }
      // Case 3: mediaToken is the same as current logoPublicId (no change needed)
      // This happens when user didn't modify the image
    }

    Object.assign(company, updateData);

    // Si falla el save, hacer rollback de la imagen promovida
    try {
      return await this.companyRepo.save(company);
    } catch (error) {
      // Rollback: eliminar la nueva imagen que fue promovida
      if (newImagePublicId) {
        this.filesService.scheduleDelete(newImagePublicId);
      }
      throw error;
    }
  }

  // ========================
  // ELIMINAR (Soft Delete)
  // ========================
  async remove(userId: string, id: string): Promise<Company> {
    const company = await this.findOne(userId, id);

    // Eliminar la imagen asociada para evitar imágenes huérfanas
    if (company.logoPublicId) {
      this.filesService.scheduleDelete(company.logoPublicId);
    }

    await this.companyRepo.softRemove(company);
    return company;
  }
}

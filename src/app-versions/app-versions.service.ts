import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { AppPlatform, AppVersion } from './entities/app-version.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AppVersionsService {
  constructor(
    @InjectRepository(AppVersion)
    private repo: Repository<AppVersion>,
  ) {}

  private compareVersions(versionA: string, versionB: string): number {
    const a = versionA.split('.').map((part) => Number(part) || 0);
    const b = versionB.split('.').map((part) => Number(part) || 0);
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index++) {
      const currentA = a[index] ?? 0;
      const currentB = b[index] ?? 0;

      if (currentA > currentB) {
        return 1;
      }

      if (currentA < currentB) {
        return -1;
      }
    }

    return 0;
  }

  private validateVersionRange(
    minSupportedVersion: string,
    latestVersion: string,
  ): void {
    if (this.compareVersions(minSupportedVersion, latestVersion) === 1) {
      throw new BadRequestException(
        'minSupportedVersion cannot be greater than latestVersion',
      );
    }
  }

  async create(dto: CreateAppVersionDto) {
    this.validateVersionRange(dto.minSupportedVersion, dto.latestVersion);

    const activeVersion = await this.repo.findOne({
      where: { platform: dto.platform },
    });

    if (activeVersion) {
      // Only 1 active version per platform → is updated
      Object.assign(activeVersion, dto);
      return this.repo.save(activeVersion);
    }

    const version = this.repo.create(dto);
    return this.repo.save(version);
  }

  async getForPlatform(platform: AppPlatform) {
    const platformVersion = await this.repo.findOne({
      where: { platform },
      order: { updatedAt: 'DESC' },
    });

    if (platformVersion) return platformVersion;

    const fallbackVersion = await this.repo.findOne({
      where: { platform: AppPlatform.ALL },
      order: { updatedAt: 'DESC' },
    });

    if (fallbackVersion) return fallbackVersion;

    throw new NotFoundException('No version config found');
  }

  async update(id: number, dto: UpdateAppVersionDto) {
    const version = await this.repo.findOne({ where: { id } });
    if (!version) throw new NotFoundException('Version not found');

    const nextMinSupportedVersion =
      dto.minSupportedVersion ?? version.minSupportedVersion;
    const nextLatestVersion = dto.latestVersion ?? version.latestVersion;

    this.validateVersionRange(nextMinSupportedVersion, nextLatestVersion);

    Object.assign(version, dto);
    return this.repo.save(version);
  }

  async findOne(id: number) {
    const version = await this.repo.findOne({ where: { id } });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return version;
  }

  async findAll() {
    return this.repo.find({
      order: {
        updatedAt: 'DESC',
      },
    });
  }
}

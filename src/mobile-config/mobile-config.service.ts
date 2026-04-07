import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMobileConfigDto } from './dto/create-mobile-config.dto';
import { MobilePublicConfigDto } from './dto/mobile-public-config.dto';
import { UpdateMobileConfigDto } from './dto/update-mobile-config.dto';
import { MobileConfig } from './entities/mobile-config.entity';

interface MobileConfigCacheEntry {
  value: MobilePublicConfigDto;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

const normalizeString = (value?: string | null): string | null => {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
};

type MobileConfigSettings = Pick<
  MobileConfig,
  'cloudinaryCloudName' | 'googleWebClientId' | 'appStoreUrl' | 'playStoreUrl'
>;

@Injectable()
export class MobileConfigService implements OnModuleInit {
  private readonly logger = new Logger(MobileConfigService.name);

  private readonly cacheTtlMs = parsePositiveInteger(
    process.env.MOBILE_CONFIG_CACHE_TTL_MS,
    DEFAULT_CACHE_TTL_MS,
  );

  private cacheEntry: MobileConfigCacheEntry | null = null;
  private inFlightRequest: Promise<MobilePublicConfigDto> | null = null;

  constructor(
    @InjectRepository(MobileConfig)
    private readonly mobileConfigRepository: Repository<MobileConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedInitialConfigIfEmpty();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to seed initial mobile config on module init: ${message}`,
      );
    }
  }

  async getPublicConfig(): Promise<MobilePublicConfigDto> {
    await this.seedInitialConfigIfEmpty();

    const now = Date.now();
    if (this.cacheEntry && this.cacheEntry.expiresAt > now) {
      return this.cacheEntry.value;
    }

    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    this.inFlightRequest = this.buildPublicConfig().finally(() => {
      this.inFlightRequest = null;
    });

    return this.inFlightRequest;
  }

  private async buildPublicConfig(): Promise<MobilePublicConfigDto> {
    const current = await this.findCurrentConfigEntity();
    const value = this.toPublicDto(current);

    this.cacheEntry = {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return value;
  }

  async findAll(): Promise<MobileConfig[]> {
    await this.seedInitialConfigIfEmpty();

    return this.mobileConfigRepository.find({
      order: {
        isActive: 'DESC',
        updatedAt: 'DESC',
      },
    });
  }

  async findCurrentConfig(): Promise<MobileConfig> {
    await this.seedInitialConfigIfEmpty();

    const current = await this.findCurrentConfigEntity();
    if (!current) {
      throw new NotFoundException('No mobile configuration found');
    }

    return current;
  }

  async findOne(id: string): Promise<MobileConfig> {
    const config = await this.mobileConfigRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException('Mobile config not found');
    }

    return config;
  }

  async create(dto: CreateMobileConfigDto): Promise<MobileConfig> {
    await this.ensureSingletonOnCreate();
    const payload = this.normalizePayload(dto);
    this.ensureAtLeastOneSetting(payload);

    const config = this.mobileConfigRepository.create({
      ...payload,
      isActive: true,
    });

    const saved = await this.mobileConfigRepository.save(config);
    this.invalidateCache();

    return saved;
  }

  async update(id: string, dto: UpdateMobileConfigDto): Promise<MobileConfig> {
    const current = await this.findOne(id);

    if (dto.isActive === false) {
      throw new BadRequestException('mobileConfigCannotDeactivateSingleton');
    }

    const payload = this.normalizePayload(dto);
    const nextSettings: MobileConfigSettings = {
      cloudinaryCloudName:
        payload.cloudinaryCloudName ?? current.cloudinaryCloudName,
      googleWebClientId: payload.googleWebClientId ?? current.googleWebClientId,
      appStoreUrl: payload.appStoreUrl ?? current.appStoreUrl,
      playStoreUrl: payload.playStoreUrl ?? current.playStoreUrl,
    };

    this.ensureAtLeastOneSetting(nextSettings);

    Object.assign(current, payload);
    current.isActive = true;

    const saved = await this.mobileConfigRepository.save(current);
    this.invalidateCache();

    return saved;
  }

  async activate(id: string): Promise<MobileConfig> {
    const current = await this.findOne(id);

    await this.deactivateAllConfigs(id);
    current.isActive = true;

    const saved = await this.mobileConfigRepository.save(current);
    this.invalidateCache();

    return saved;
  }

  async remove(id: string): Promise<void> {
    const current = await this.findOne(id);
    const totalConfigs = await this.mobileConfigRepository.count();

    if (totalConfigs <= 1) {
      throw new BadRequestException('mobileConfigCannotDeleteOnlyRecord');
    }

    if (current.isActive) {
      const replacement = await this.mobileConfigRepository
        .createQueryBuilder('config')
        .where('config.id != :id', { id })
        .orderBy('config.updatedAt', 'DESC')
        .getOne();

      if (!replacement) {
        throw new BadRequestException('mobileConfigCannotDeleteOnlyRecord');
      }

      await this.deactivateAllConfigs(replacement.id);
      replacement.isActive = true;
      await this.mobileConfigRepository.save(replacement);
    }

    await this.mobileConfigRepository.softRemove(current);
    this.invalidateCache();
  }

  private normalizePayload(
    dto: Partial<CreateMobileConfigDto>,
  ): Partial<MobileConfig> {
    const payload: Partial<MobileConfig> = {};

    if (dto.cloudinaryCloudName !== undefined) {
      payload.cloudinaryCloudName = normalizeString(dto.cloudinaryCloudName);
    }

    if (dto.googleWebClientId !== undefined) {
      payload.googleWebClientId = normalizeString(dto.googleWebClientId);
    }

    if (dto.appStoreUrl !== undefined) {
      payload.appStoreUrl = normalizeString(dto.appStoreUrl);
    }

    if (dto.playStoreUrl !== undefined) {
      payload.playStoreUrl = normalizeString(dto.playStoreUrl);
    }

    return payload;
  }

  private async findCurrentConfigEntity(): Promise<MobileConfig | null> {
    const active = await this.mobileConfigRepository.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (active) {
      return active;
    }

    return this.mobileConfigRepository.findOne({
      order: { updatedAt: 'DESC' },
    });
  }

  private toPublicDto(config: MobileConfig | null): MobilePublicConfigDto {
    if (!config) {
      return {
        cloudinaryCloudName: null,
        googleWebClientId: null,
        appStoreUrl: null,
        playStoreUrl: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      cloudinaryCloudName: config.cloudinaryCloudName,
      googleWebClientId: config.googleWebClientId,
      appStoreUrl: config.appStoreUrl,
      playStoreUrl: config.playStoreUrl,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private async seedInitialConfigIfEmpty(): Promise<void> {
    const count = await this.mobileConfigRepository.count();
    if (count > 0) {
      if (count > 1) {
        this.logger.warn(
          `Detected ${String(count)} mobile configs. Singleton policy allows only one.`,
        );
      }
      return;
    }

    const initialConfig = this.mobileConfigRepository.create({
      cloudinaryCloudName: normalizeString(
        process.env.MOBILE_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_NAME,
      ),
      googleWebClientId: normalizeString(
        process.env.MOBILE_GOOGLE_WEB_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
      ),
      appStoreUrl: normalizeString(process.env.MOBILE_APP_STORE_URL),
      playStoreUrl: normalizeString(process.env.MOBILE_PLAY_STORE_URL),
      isActive: true,
    });

    await this.mobileConfigRepository.save(initialConfig);
    this.invalidateCache();
    this.logger.log(
      'Bootstrapped initial mobile config record in mobile_configs',
    );
  }

  private async deactivateAllConfigs(exceptId?: string): Promise<void> {
    const query = this.mobileConfigRepository
      .createQueryBuilder()
      .update(MobileConfig)
      .set({ isActive: false })
      .where('isActive = :isActive', { isActive: true });

    if (exceptId) {
      query.andWhere('id != :exceptId', { exceptId });
    }

    await query.execute();
  }

  private async ensureSingletonOnCreate(): Promise<void> {
    const count = await this.mobileConfigRepository.count();

    if (count > 0) {
      throw new BadRequestException('mobileConfigSingletonViolation');
    }
  }

  private ensureAtLeastOneSetting(
    settings: Partial<MobileConfigSettings>,
  ): void {
    const hasAtLeastOneSetting = [
      settings.cloudinaryCloudName,
      settings.googleWebClientId,
      settings.appStoreUrl,
      settings.playStoreUrl,
    ].some((value) => Boolean(value));

    if (!hasAtLeastOneSetting) {
      throw new BadRequestException('mobileConfigAtLeastOneFieldRequired');
    }
  }

  private invalidateCache(): void {
    this.cacheEntry = null;
    this.inFlightRequest = null;
  }
}

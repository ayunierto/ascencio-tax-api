import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSystemSettingDto } from './dto/create-system-setting.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  async create(dto: CreateSystemSettingDto) {
    const setting = this.settingsRepository.create(dto);
    return this.settingsRepository.save(setting);
  }

  async findAll() {
    return this.settingsRepository.find();
  }

  async findOne(key: string) {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  /**
   * Find a setting by key and return its value, or return the default value if not found.
   * This method never throws exceptions, making it ideal for configuration with fallbacks.
   *
   * @param key - The setting key to look up
   * @param defaultValue - The value to return if the setting is not found
   * @returns The setting value or the default value
   */
  async findOneOrDefault(key: string, defaultValue: string): Promise<string> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    return setting?.value ?? defaultValue;
  }

  async update(key: string, dto: UpdateSystemSettingDto) {
    await this.settingsRepository.update(key, dto);
    return this.settingsRepository.findOne({ where: { key } });
  }

  async upsert(dto: CreateSystemSettingDto) {
    let setting = await this.settingsRepository.findOne({
      where: { key: dto.key },
    });
    if (!setting) {
      setting = this.settingsRepository.create({
        key: dto.key,
        value: dto.value,
      });
    } else {
      setting.value = dto.value;
    }
    return this.settingsRepository.save(setting);
  }
}

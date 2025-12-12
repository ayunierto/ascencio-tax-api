import { Controller, Get, Body, Patch, Param, Post, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { CreateSystemSettingDto } from './dto/create-system-setting.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';

@ApiTags('System Settings')
@Controller('settings')
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all system settings' })
  @ApiResponse({ status: 200, description: 'Return all settings' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSettings() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a setting by key' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  @ApiResponse({ status: 200, description: 'Return the setting' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  async findOne(
    @Param('key') key: string,
  ) {
    const setting = await this.settingsService.findOne(key);
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  @Post()
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new setting' })
  @ApiResponse({ status: 201, description: 'Setting created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() dto: CreateSystemSettingDto) {
    return this.settingsService.create(dto);
  }

  @Patch(':key')
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a setting' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  @ApiResponse({ status: 200, description: 'Setting updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateSystemSettingDto,
  ) {
    return this.settingsService.update(key, dto);
  }

  @Post('upsert')
  @Auth(Role.Admin, Role.Staff)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a setting' })
  @ApiResponse({ status: 201, description: 'Setting upserted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upsert(@Body() dto: CreateSystemSettingDto) {
    return this.settingsService.upsert(dto);
  }
}

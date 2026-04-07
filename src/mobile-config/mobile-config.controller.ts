import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { CreateMobileConfigDto } from './dto/create-mobile-config.dto';
import { MobilePublicConfigDto } from './dto/mobile-public-config.dto';
import { UpdateMobileConfigDto } from './dto/update-mobile-config.dto';
import { MobileConfig } from './entities/mobile-config.entity';
import { MobileConfigService } from './mobile-config.service';

@ApiTags('Mobile Config')
@Controller('mobile-config')
export class MobileConfigController {
  constructor(private readonly mobileConfigService: MobileConfigService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get runtime mobile public configuration (cloudinary, google sign-in, store URLs).',
  })
  @ApiOkResponse({ type: MobilePublicConfigDto })
  getPublicConfig(): Promise<MobilePublicConfigDto> {
    return this.mobileConfigService.getPublicConfig();
  }

  @Get('admin')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'List all mobile configs for administration.' })
  @ApiOkResponse({ type: [MobileConfig] })
  findAll(): Promise<MobileConfig[]> {
    return this.mobileConfigService.findAll();
  }

  @Get('admin/current')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Get currently active mobile config.' })
  @ApiOkResponse({ type: MobileConfig })
  findCurrentConfig(): Promise<MobileConfig> {
    return this.mobileConfigService.findCurrentConfig();
  }

  @Get('admin/:id')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Get one mobile config by id.' })
  @ApiOkResponse({ type: MobileConfig })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MobileConfig> {
    return this.mobileConfigService.findOne(id);
  }

  @Post('admin')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Create a new mobile config.' })
  @ApiOkResponse({ type: MobileConfig })
  create(@Body() dto: CreateMobileConfigDto): Promise<MobileConfig> {
    return this.mobileConfigService.create(dto);
  }

  @Patch('admin/:id')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Update an existing mobile config.' })
  @ApiOkResponse({ type: MobileConfig })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMobileConfigDto,
  ): Promise<MobileConfig> {
    return this.mobileConfigService.update(id, dto);
  }

  @Post('admin/:id/activate')
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Activate a mobile config and deactivate others.' })
  @ApiOkResponse({ type: MobileConfig })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<MobileConfig> {
    return this.mobileConfigService.activate(id);
  }

  @Delete('admin/:id')
  @HttpCode(204)
  @Auth(Role.Admin)
  @ApiOperation({ summary: 'Soft-delete a mobile config.' })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.mobileConfigService.remove(id);
  }
}

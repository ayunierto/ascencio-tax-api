import { PartialType } from '@nestjs/mapped-types';
import { CreateMobileConfigDto } from './create-mobile-config.dto';

export class UpdateMobileConfigDto extends PartialType(CreateMobileConfigDto) {}

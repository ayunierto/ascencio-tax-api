import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StaffMembersService } from './staff-members.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from 'src/auth/enums/role.enum';
import {
  staffMemberSchema,
  updateStaffMemberSchema,
  type CreateStaffMemberRequest,
  type UpdateStaffMemberRequest,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('staff-members')
export class StaffMembersController {
  constructor(private readonly staffService: StaffMembersService) {}

  @Post()
  @Auth(Role.Admin)
  create(
    @Body(new ZodValidationPipe(staffMemberSchema))
    createStaffMemberDto: CreateStaffMemberRequest,
  ) {
    return this.staffService.create(createStaffMemberDto);
  }

  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.Admin)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStaffMemberSchema))
    updateStaffMemberDto: UpdateStaffMemberRequest,
  ) {
    return this.staffService.update(id, updateStaffMemberDto);
  }

  @Delete(':id')
  @Auth(Role.Admin)
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}

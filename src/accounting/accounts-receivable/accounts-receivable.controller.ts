import { Controller, Get, Param, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AccountsReceivableService } from './accounts-receivable.service';

@Controller('accounts-receivable')
export class AccountsReceivableController {
  constructor(private readonly arService: AccountsReceivableService) {}

  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('companyId') companyId: string,
    @Query('status') status: string,
    @GetUser() user: User,
  ) {
    return this.arService.findAll(paginationDto, user.id, companyId, status);
  }

  @Get('aging/:companyId')
  @Auth()
  getAgingReport(
    @Param('companyId') companyId: string,
    @GetUser() user: User,
  ) {
    return this.arService.getAgingReport(user.id, companyId);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.arService.findOne(user.id, id);
  }
}

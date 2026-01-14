import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Auth()
  recordPayment(
    @Body() body: {
      accountReceivableId: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    },
    @GetUser() user: User,
  ) {
    return this.paymentsService.recordPayment(
      user.id,
      body.accountReceivableId,
      body,
    );
  }

  @Get()
  @Auth()
  findAll(
    @Query('accountReceivableId') accountReceivableId: string,
    @GetUser() user: User,
  ) {
    return this.paymentsService.findAll(user.id, accountReceivableId);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.paymentsService.findOne(user.id, id);
  }
}

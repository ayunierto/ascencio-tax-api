import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Role } from 'src/auth/enums/role.enum';
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  createInvoiceSchema,
  updateInvoiceSchema,
  CreateInvoicePaymentRequest,
  createInvoicePaymentSchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { InvoicesService } from './invoices.service';
import { User } from 'src/auth/entities/user.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { Invoice } from './entities/invoice.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createInvoiceSchema))
    invoice: CreateInvoiceRequest,
    @GetUser() user: User,
  ) {
    return this.invoicesService.create(user.id, invoice);
  }

  @Get()
  @Auth()
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('status') status: string,
    @GetUser() user: User,
  ): Promise<PaginatedResponse<Invoice>> {
    return this.invoicesService.findAll(paginationDto, user.id, status);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User): Promise<Invoice> {
    return this.invoicesService.findOne(user.id, id);
  }

  @Patch(':id')
  @Auth(Role.Admin, Role.Staff, Role.User)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema))
    body: UpdateInvoiceRequest,
    @GetUser() user: User,
  ): Promise<Invoice> {
    return this.invoicesService.update(user.id, id, body);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @GetUser() user: User): Promise<Invoice> {
    return this.invoicesService.remove(user.id, id);
  }

  @Post('bulk-delete')
  @Auth()
  bulkDelete(@Body('ids') ids: string[], @GetUser() user: User): Promise<void> {
    return this.invoicesService.bulkDelete(user.id, ids);
  }

  @Post(':id/payment')
  @Auth()
  recordPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createInvoicePaymentSchema))
    body: CreateInvoicePaymentRequest,
    @GetUser() user: User,
  ): Promise<Invoice> {
    return this.invoicesService.recordPayment(
      user.id,
      id,
      body.amount,
      body.paidAt,
    );
  }

  @Get(':id/pdf')
  @Auth()
  async generatePdf(
    @Param('id') id: string,
    @GetUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    try {
      console.log('[PDF Controller] Generating PDF for invoice:', id);
      const { pdfDoc, invoiceNumber } = await this.invoicesService.generatePdf(
        user.id,
        id,
      );

      console.log('[PDF Controller] Setting response headers...');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      );

      console.log('[PDF Controller] Piping PDF to response...');
      pdfDoc.pipe(res);
      pdfDoc.end();
      console.log('[PDF Controller] PDF sent successfully');
    } catch (error) {
      console.error('[PDF Controller] Error generating PDF:', error);
      throw error;
    }
  }
}

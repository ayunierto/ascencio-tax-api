import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import { IsNull, Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
} from '@ascencio/shared/schemas';
import { PrinterService } from '../../printer/printer.service';
import { FilesService } from '../../files/files.service';
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,
    private readonly printerService: PrinterService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Generate next invoice number for the user
   * Format: INV-YYYY-XXXX (e.g., INV-2026-0001)
   */
  private async generateInvoiceNumber(userId: string): Promise<{
    invoiceNumber: string;
    invoiceYear: number;
  }> {
    const currentYear = new Date().getFullYear();

    // Get the last invoice for this user in the current year
    const lastInvoice = await this.invoiceRepo.findOne({
      where: { userId, invoiceYear: currentYear },
      order: { invoiceNumber: 'DESC' },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      // Extract the number from the invoice number (e.g., INV-2026-0001 -> 1)
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const invoiceNumber = `INV-${currentYear}-${nextNumber
      .toString()
      .padStart(4, '0')}`;

    return { invoiceNumber, invoiceYear: currentYear };
  }

  /**
   * Calculate invoice totals from line items
   */
  private calculateTotals(
    lineItems: { quantity: number; price: number }[],
    taxRate: number,
    amountPaid = 0,
  ): {
    subtotal: number;
    taxAmount: number;
    total: number;
    balanceDue: number;
  } {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    const balanceDue = total - amountPaid;

    return { subtotal, taxAmount, total, balanceDue };
  }

  async create(userId: string, input: CreateInvoiceRequest): Promise<Invoice> {
    const { lineItems: lineItemsInput, ...invoiceData } = input;

    // Generate invoice number
    const { invoiceNumber, invoiceYear } =
      await this.generateInvoiceNumber(userId);

    // Calculate totals
    const totals = this.calculateTotals(lineItemsInput, input.taxRate ?? 13);

    // Create invoice
    const invoice = this.invoiceRepo.create({
      ...invoiceData,
      userId,
      invoiceNumber,
      invoiceYear,
      ...totals,
      status: input.status ?? 'pending',
    });

    // Save invoice first to get the ID
    const savedInvoice = await this.invoiceRepo.save(invoice);

    // Create line items
    const lineItems = lineItemsInput.map((item) =>
      this.lineItemRepo.create({
        ...item,
        invoiceId: savedInvoice.id,
        lineTotal: item.quantity * item.price,
      }),
    );

    await this.lineItemRepo.save(lineItems);

    // Return the invoice with line items
    return this.findOne(userId, savedInvoice.id);
  }

  async findAll(
    paginationDto: PaginationDto,
    userId: string,
    status?: string,
  ): Promise<PaginatedResponse<Invoice>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const where: any = { userId, deletedAt: IsNull() };
    if (status && status !== 'all') {
      where.status = status;
    }

    const [invoices, total] = await this.invoiceRepo.findAndCount({
      take: limit,
      skip: offset,
      where,
      relations: ['fromCompany', 'lineItems'],
      order: { createdAt: 'DESC' },
    });

    return {
      total,
      pages: Math.ceil(total / limit),
      items: invoices,
    };
  }

  async findOne(userId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, userId },
      relations: ['fromCompany', 'lineItems'],
    });

    if (!invoice) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    return invoice;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateInvoiceRequest,
  ): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);
    const { lineItems: lineItemsInput, ...updateData } = input;

    // If line items are provided, update them
    if (lineItemsInput) {
      // Delete existing line items
      await this.lineItemRepo.delete({ invoiceId: id });

      // Create new line items
      const lineItems = lineItemsInput.map((item) =>
        this.lineItemRepo.create({
          ...item,
          invoiceId: id,
          lineTotal: item.quantity * item.price,
        }),
      );

      await this.lineItemRepo.save(lineItems);

      // Recalculate totals
      const totals = this.calculateTotals(
        lineItemsInput,
        updateData.taxRate ?? invoice.taxRate,
        invoice.amountPaid,
      );
      Object.assign(invoice, totals);
    }

    // Update invoice fields
    Object.assign(invoice, updateData);

    // If status is changed to paid, set paidDate
    if (updateData.status === 'paid' && !invoice.paidDate) {
      invoice.paidDate = new Date().toISOString().split('T')[0];
    }

    return this.invoiceRepo.save(invoice);
  }

  async remove(userId: string, id: string): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);
    await this.invoiceRepo.softRemove(invoice);
    return invoice;
  }

  async bulkDelete(userId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.remove(userId, id);
    }
  }

  /**
   * Record a payment on an invoice
   */
  async recordPayment(
    userId: string,
    id: string,
    amount: number,
    paidAt?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);

    invoice.amountPaid = Number(invoice.amountPaid) + amount;
    invoice.balanceDue = Number(invoice.total) - Number(invoice.amountPaid);

    // If fully paid, update status
    if (invoice.balanceDue <= 0) {
      invoice.status = 'paid';
      invoice.paidDate = paidAt || new Date().toISOString().split('T')[0];
      invoice.balanceDue = 0;
    }

    return this.invoiceRepo.save(invoice);
  }

  /**
   * Generate PDF for an invoice
   */
  async generatePdf(
    userId: string,
    id: string,
  ): Promise<{ pdfDoc: PDFKit.PDFDocument; invoiceNumber: string }> {
    console.log(
      '[PDF] Starting PDF generation for invoice:',
      id,
      'user:',
      userId,
    );

    const invoice = await this.findOne(userId, id);
    console.log('[PDF] Invoice found:', invoice.invoiceNumber);

    // Build PDF document definition
    console.log('[PDF] Building PDF definition...');
    const docDefinition = this.buildInvoicePdfDefinition(invoice);
    console.log('[PDF] PDF definition built successfully');

    // Create PDF
    console.log('[PDF] Creating PDF document...');
    const pdfDoc = this.printerService.createPdf(docDefinition);
    console.log('[PDF] PDF document created');

    return { pdfDoc, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Build PDF document definition for an invoice
   */
  private buildInvoicePdfDefinition(invoice: Invoice): TDocumentDefinitions {
    const primaryColor = '#002e5d';
    const formatCurrency = (amount: number) =>
      `CA$${Number(amount).toFixed(2)}`;
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Header content
    const headerContent: Content[] = [];

    // Company info (from)
    if (invoice.fromCompany) {
      headerContent.push({
        columns: [
          {
            width: '*',
            stack: [
              {
                text: invoice.fromCompany.name,
                style: 'companyName',
              },
              invoice.fromCompany.address
                ? { text: invoice.fromCompany.address, style: 'companyDetails' }
                : '',
              invoice.fromCompany.phone
                ? {
                    text: `Tel: ${invoice.fromCompany.phone}`,
                    style: 'companyDetails',
                  }
                : '',
              invoice.fromCompany.email
                ? { text: invoice.fromCompany.email, style: 'companyDetails' }
                : '',
            ].filter(Boolean),
          },
          {
            width: 'auto',
            stack: [
              {
                text: 'INVOICE',
                style: 'invoiceTitle',
              },
              {
                text: `#${invoice.invoiceNumber}`,
                style: 'invoiceNumber',
              },
            ],
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      });
    } else {
      headerContent.push({
        text: 'INVOICE',
        style: 'invoiceTitle',
        alignment: 'right',
        margin: [0, 0, 0, 5] as [number, number, number, number],
      });
      headerContent.push({
        text: `#${invoice.invoiceNumber}`,
        style: 'invoiceNumber',
        alignment: 'right',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      });
    }

    // Dates and Bill To
    const billToStack: Content[] = [
      { text: 'BILL TO', style: 'sectionLabel' },
      { text: invoice.billToFullName, style: 'billToName' },
    ];
    if (invoice.billToAddress) {
      billToStack.push({ text: invoice.billToAddress, style: 'billToDetails' });
    }
    if (invoice.billToEmail) {
      billToStack.push({ text: invoice.billToEmail, style: 'billToDetails' });
    }
    if (invoice.billToPhone) {
      billToStack.push({ text: invoice.billToPhone, style: 'billToDetails' });
    }
    if (invoice.billToBusinessNumber) {
      billToStack.push({
        text: `BN: ${invoice.billToBusinessNumber}`,
        style: 'billToDetails',
      });
    }

    headerContent.push({
      columns: [
        {
          width: '*',
          stack: billToStack,
        },
        {
          width: 'auto',
          stack: [
            { text: 'ISSUE DATE', style: 'sectionLabel' },
            { text: formatDate(invoice.issueDate), style: 'dateValue' },
            {
              text: 'DUE DATE',
              style: 'sectionLabel',
              margin: [0, 10, 0, 0] as [number, number, number, number],
            },
            { text: formatDate(invoice.dueDate), style: 'dateValue' },
            {
              text: 'STATUS',
              style: 'sectionLabel',
              margin: [0, 10, 0, 0] as [number, number, number, number],
            },
            {
              text: invoice.status.toUpperCase(),
              style:
                invoice.status === 'paid'
                  ? 'statusPaid'
                  : invoice.status === 'overdue'
                    ? 'statusOverdue'
                    : 'statusPending',
            },
          ],
          alignment: 'right',
        },
      ],
      margin: [0, 0, 0, 30] as [number, number, number, number],
    });

    // Line Items Table
    const tableBody: TableCell[][] = [
      [
        { text: 'Description', style: 'tableHeader' },
        { text: 'Qty', style: 'tableHeader', alignment: 'center' },
        { text: 'Price', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    invoice.lineItems.forEach((item) => {
      tableBody.push([
        { text: item.description, style: 'tableCell' },
        {
          text: item.quantity.toString(),
          style: 'tableCell',
          alignment: 'center',
        },
        {
          text: formatCurrency(item.price),
          style: 'tableCell',
          alignment: 'right',
        },
        {
          text: formatCurrency(item.lineTotal),
          style: 'tableCell',
          alignment: 'right',
        },
      ]);
    });

    // Summary section
    const summaryContent: Content = {
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Subtotal', style: 'summaryLabel' },
                {
                  text: formatCurrency(invoice.subtotal),
                  style: 'summaryValue',
                  alignment: 'right',
                },
              ],
              [
                { text: `Tax (${invoice.taxRate}%)`, style: 'summaryLabel' },
                {
                  text: formatCurrency(invoice.taxAmount),
                  style: 'summaryValue',
                  alignment: 'right',
                },
              ],
              [
                { text: 'Total', style: 'totalLabel' },
                {
                  text: formatCurrency(invoice.total),
                  style: 'totalValue',
                  alignment: 'right',
                },
              ],
              [
                { text: 'Amount Paid', style: 'summaryLabel' },
                {
                  text: formatCurrency(invoice.amountPaid),
                  style: 'summaryValue',
                  alignment: 'right',
                },
              ],
              [
                { text: 'Balance Due', style: 'balanceLabel' },
                {
                  text: formatCurrency(invoice.balanceDue),
                  style: 'balanceValue',
                  alignment: 'right',
                },
              ],
            ],
          },
          layout: 'noBorders',
        },
      ],
      margin: [0, 20, 0, 0] as [number, number, number, number],
    };

    // Notes
    const notesContent: Content[] = [];
    if (invoice.description) {
      notesContent.push({
        text: 'Description',
        style: 'sectionLabel',
        margin: [0, 20, 0, 5] as [number, number, number, number],
      });
      notesContent.push({ text: invoice.description, style: 'notes' });
    }
    if (invoice.notes) {
      notesContent.push({
        text: 'Notes',
        style: 'sectionLabel',
        margin: [0, 15, 0, 5] as [number, number, number, number],
      });
      notesContent.push({ text: invoice.notes, style: 'notes' });
    }

    return {
      content: [
        ...headerContent,
        {
          table: {
            headerRows: 1,
            widths: ['*', 50, 80, 80],
            body: tableBody,
          },
          layout: {
            hLineWidth: (
              i: number,
              node: { table: { body: TableCell[][] } },
            ) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0),
            vLineWidth: () => 0,
            hLineColor: () => '#e0e0e0',
            paddingTop: () => 8,
            paddingBottom: () => 8,
            fillColor: (i: number) => (i === 0 ? '#f5f5f5' : null),
          },
        },
        summaryContent,
        ...notesContent,
      ],
      styles: {
        companyName: {
          fontSize: 18,
          bold: true,
          color: primaryColor,
        },
        companyDetails: {
          fontSize: 10,
          color: '#666666',
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
        invoiceTitle: {
          fontSize: 28,
          bold: true,
          color: primaryColor,
        },
        invoiceNumber: {
          fontSize: 14,
          color: '#666666',
        },
        sectionLabel: {
          fontSize: 10,
          bold: true,
          color: '#999999',
        },
        billToName: {
          fontSize: 14,
          bold: true,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        },
        billToDetails: {
          fontSize: 10,
          color: '#666666',
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
        dateValue: {
          fontSize: 12,
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        statusPaid: {
          fontSize: 11,
          bold: true,
          color: '#22c55e',
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        statusOverdue: {
          fontSize: 11,
          bold: true,
          color: '#ef4444',
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        statusPending: {
          fontSize: 11,
          bold: true,
          color: '#f59e0b',
          margin: [0, 3, 0, 0] as [number, number, number, number],
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          color: '#333333',
        },
        tableCell: {
          fontSize: 10,
        },
        summaryLabel: {
          fontSize: 10,
          color: '#666666',
        },
        summaryValue: {
          fontSize: 10,
        },
        totalLabel: {
          fontSize: 12,
          bold: true,
          color: primaryColor,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        },
        totalValue: {
          fontSize: 12,
          bold: true,
          color: primaryColor,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        },
        balanceLabel: {
          fontSize: 11,
          bold: true,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        },
        balanceValue: {
          fontSize: 11,
          bold: true,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        },
        notes: {
          fontSize: 10,
          color: '#666666',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
      pageMargins: [40, 40, 40, 40] as [number, number, number, number],
    };
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonMessages } from '@ascencio/shared/i18n';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { PaginatedResponse } from '@ascencio/shared/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  IssueInvoiceRequest,
} from '@ascencio/shared/schemas';
import { PrinterService } from '../../printer/printer.service';
import { FilesService } from '../../files/files.service';
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { Company } from '../companies/entities/company.entity';
import { User } from 'src/auth/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import axios from 'axios';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly printerService: PrinterService,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => AccountsReceivableService))
    private readonly arService: AccountsReceivableService,
  ) {}

  /**
   * Get or create a "Sole Proprietor" company for a user
   * This is used when the user doesn't have any company registered
   */
  private async getOrCreateSoleProprietorCompany(
    userId: string,
  ): Promise<Company> {
    // Check if user has any company
    const existingCompany = await this.companyRepo.findOne({
      where: { users: { id: userId } },
      relations: ['users'],
    });

    if (existingCompany) {
      return existingCompany;
    }

    // Get user data to populate the company
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create "Sole Proprietor" company with user's data and associate user
    const soleProprietorCompany = this.companyRepo.create({
      name: 'Sole Proprietor',
      legalName: `${user.firstName} ${user.lastName}`,
      businessNumber: '', // User to fill later
      email: user.email,
      phone: user.phoneNumber ?? '',
      address: '', // User to fill later
      city: '',
      province: '',
      postalCode: '',
      users: [user], // Associate user directly during creation
    });

    return await this.companyRepo.save(soleProprietorCompany);
  }

  /**
   * Get or create a client from manual invoice data
   * This is used when the user provides client data directly in the invoice
   */
  private async getOrCreateClientFromManualData(
    userId: string,
    fullName: string,
    email: string,
    phone: string,
  ): Promise<string> {
    // Try to find existing client by email and user
    const existingClient = await this.clientRepo.findOne({
      where: { email, users: { id: userId } },
      relations: ['users'],
    });

    if (existingClient) {
      return existingClient.id;
    }

    // Get user to associate with the client
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create new client
    const client = this.clientRepo.create({
      fullName,
      email,
      phone,
      users: [user],
    });

    const savedClient = await this.clientRepo.save(client);
    return savedClient.id;
  }

  /**
   * Validate that a user belongs to a company (multi-tenant security)
   */
  private async validateUserCompanyAccess(
    userId: string,
    companyId: string,
  ): Promise<Company> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId, users: { id: userId } },
      relations: ['users'],
    });

    if (!company) {
      throw new ForbiddenException('User does not have access to this company');
    }

    return company;
  }

  private async setCompanyLogoFromTempToken(
    userId: string,
    companyId: string,
    mediaToken: string,
  ): Promise<void> {
    if (!mediaToken.startsWith('temp_files/')) {
      return;
    }

    const company = await this.companyRepo.findOne({
      where: { id: companyId, users: { id: userId } },
      relations: ['users'],
    });

    if (!company) {
      throw new ForbiddenException('User does not have access to this company');
    }

    const promoted = await this.filesService.promoteImage(
      mediaToken,
      'companies',
    );

    if (company.logoPublicId) {
      this.filesService.scheduleDelete(company.logoPublicId);
    }

    company.logoPublicId = promoted.publicId;
    company.logoUrl = promoted.secureUrl;
    await this.companyRepo.save(company);
  }

  private extractTempPublicId(imageRef?: string): string | undefined {
    if (!imageRef) return undefined;
    if (imageRef.startsWith('temp_files/')) return imageRef;
    if (!imageRef.includes('/temp_files/')) return undefined;

    const parts = imageRef.split('/upload/');
    if (parts.length < 2) return undefined;

    const pathWithoutQuery = parts[1].split('?')[0];
    const rawSegments = pathWithoutQuery.split('/').filter(Boolean);
    const segments = rawSegments.filter((segment) => !/^v\d+$/.test(segment));

    if (segments.length === 0) return undefined;

    const lastSegment = segments[segments.length - 1].replace(/\.[^.]+$/, '');
    const publicId = [...segments.slice(0, -1), lastSegment].join('/');

    return publicId.startsWith('temp_files/') ? publicId : undefined;
  }

  /**
   * Generate next invoice number globally.
   * Format: INV-YYYY-XXXX (e.g., INV-2026-0001)
   *
   * IMPORTANT: invoice_number has a GLOBAL unique constraint in the DB
   * (including soft-deleted rows), so we must search across ALL users/companies
   * and include soft-deleted records to avoid collisions.
   */
  private async generateInvoiceNumber(): Promise<{
    invoiceNumber: string;
    invoiceYear: number;
  }> {
    const currentYear = new Date().getFullYear();

    // Search globally across ALL invoices (all users, all companies, including soft-deleted)
    // because the unique constraint on invoice_number is global
    const lastInvoice = await this.invoiceRepo.findOne({
      where: { invoiceYear: currentYear },
      order: { invoiceNumber: 'DESC' },
      withDeleted: true,
    });

    console.log('[INVOICE SERVICE] Last invoice found (global):', {
      lastInvoice: lastInvoice?.invoiceNumber ?? 'none',
      year: currentYear,
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const invoiceNumber = `INV-${String(currentYear)}-${nextNumber
      .toString()
      .padStart(4, '0')}`;

    console.log('[INVOICE SERVICE] Generated invoice number:', invoiceNumber);

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

  private toSafeNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  private validateLineItemsTotalsGreaterThanZero(
    lineItems: { quantity: number; price: number }[],
  ): void {
    const hasInvalidPrice = lineItems.some((item) => item.price <= 0);
    if (hasInvalidPrice) {
      throw new BadRequestException(
        'invoiceLineItemPriceMustBeGreaterThanZero',
      );
    }

    const hasInvalidItem = lineItems.some(
      (item) => item.quantity * item.price <= 0,
    );

    if (hasInvalidItem) {
      throw new BadRequestException(
        'invoiceLineItemTotalMustBeGreaterThanZero',
      );
    }
  }

  async create(userId: string, input: CreateInvoiceRequest): Promise<Invoice> {
    console.log('[INVOICE SERVICE] create called:', {
      userId,
      input: JSON.stringify(input, null, 2),
    });

    const {
      lineItems: lineItemsInput,
      fromCompanyId,
      logoMediaToken,
      billToFullName,
      ...invoiceData
    } = input as CreateInvoiceRequest & { logoMediaToken?: string };

    const normalizedInvoiceData = {
      ...invoiceData,
      billToName: billToFullName,
    };

    const tempLogoToken =
      logoMediaToken ?? this.extractTempPublicId(normalizedInvoiceData.logoUrl);

    console.log('[INVOICE SERVICE] Line items count:', lineItemsInput.length);

    this.validateLineItemsTotalsGreaterThanZero(lineItemsInput);

    // If no company provided, get or create "Sole Proprietor"
    let finalCompanyId = fromCompanyId;
    if (!finalCompanyId) {
      console.log(
        '[INVOICE SERVICE] No company provided, creating/getting Sole Proprietor',
      );
      const company = await this.getOrCreateSoleProprietorCompany(userId);
      finalCompanyId = company.id;
      console.log('[INVOICE SERVICE] Using company:', finalCompanyId);
    } else {
      // Validate user has access to this company
      console.log(
        '[INVOICE SERVICE] Validating access to company:',
        finalCompanyId,
      );
      await this.validateUserCompanyAccess(userId, finalCompanyId);
    }

    if (tempLogoToken?.startsWith('temp_files/')) {
      invoiceData.logoUrl = undefined;
    }

    if (finalCompanyId && tempLogoToken?.startsWith('temp_files/')) {
      await this.setCompanyLogoFromTempToken(
        userId,
        finalCompanyId,
        tempLogoToken,
      );
    }

    // If no client ID provided but manual data exists, create or get client
    let finalClientId = invoiceData.billToClientId;
    if (
      !finalClientId &&
      billToFullName &&
      invoiceData.billToEmail &&
      invoiceData.billToPhone
    ) {
      finalClientId = await this.getOrCreateClientFromManualData(
        userId,
        billToFullName,
        invoiceData.billToEmail,
        invoiceData.billToPhone,
      );
    }

    // Calculate totals
    const totals = this.calculateTotals(lineItemsInput, input.taxRate);

    if (totals.total <= 0) {
      throw new BadRequestException('invoiceTotalMustBeGreaterThanZero');
    }

    console.log('[INVOICE SERVICE] Calculated totals:', totals);

    // Retry logic to handle race conditions with invoice number generation
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(
          `[INVOICE SERVICE] Attempt ${String(attempt + 1)} of ${String(maxRetries)}`,
        );

        // Generate invoice number (searches globally including soft-deleted)
        const { invoiceNumber, invoiceYear } =
          await this.generateInvoiceNumber();

        console.log('[INVOICE SERVICE] Using invoice number:', invoiceNumber);

        // Create invoice in draft state
        const invoice = this.invoiceRepo.create({
          ...normalizedInvoiceData,
          billToClientId: finalClientId,
          fromCompanyId: finalCompanyId,
          userId,
          invoiceNumber,
          invoiceYear,
          ...totals,
          status: 'draft', // Always start as draft
        });

        // Save invoice first to get the ID
        const savedInvoice = await this.invoiceRepo.save(invoice);
        console.log(
          '[INVOICE SERVICE] Invoice saved successfully:',
          savedInvoice.id,
        );

        // Create line items
        const lineItems = lineItemsInput.map((item) =>
          this.lineItemRepo.create({
            ...item,
            invoiceId: savedInvoice.id,
            lineTotal: item.quantity * item.price,
          }),
        );

        await this.lineItemRepo.save(lineItems);
        console.log('[INVOICE SERVICE] Line items saved:', lineItems.length);

        // Return the invoice with line items
        return await this.findOne(userId, savedInvoice.id);
      } catch (error: unknown) {
        const errorRecord =
          error && typeof error === 'object'
            ? (error as Record<string, unknown>)
            : {};
        const errorCode =
          typeof errorRecord.code === 'string' ? errorRecord.code : undefined;
        const errorDetail =
          typeof errorRecord.detail === 'string'
            ? errorRecord.detail
            : undefined;
        console.error('[INVOICE SERVICE] Error in create attempt:', {
          attempt: attempt + 1,
          error:
            typeof errorRecord.message === 'string'
              ? errorRecord.message
              : String(error),
          code: errorCode,
          detail: errorDetail,
        });

        // Check if it's a duplicate key error on invoice_number
        const isDuplicateKey =
          errorCode === '23505' && errorDetail?.includes('invoice_number');

        if (isDuplicateKey && attempt < maxRetries - 1) {
          console.log('[INVOICE SERVICE] Duplicate key detected, retrying...');
          // Small delay to reduce collision probability on concurrent requests
          await new Promise((resolve) =>
            setTimeout(resolve, 50 + Math.random() * 100),
          );
          continue;
        }

        // Re-throw if not a duplicate key error or max retries reached
        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new BadRequestException('Failed to create invoice after retries');
  }

  async findAll(
    paginationDto: PaginationDto,
    userId: string,
    companyId?: string,
    status?: string,
  ): Promise<PaginatedResponse<Invoice>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const where: FindOptionsWhere<Invoice> = {
      userId,
      deletedAt: IsNull(),
    };

    // Multi-tenant filtering
    if (companyId) {
      // Validate user has access to this company
      await this.validateUserCompanyAccess(userId, companyId);
      where.fromCompanyId = companyId;
    }

    if (status && status !== 'all') {
      if (status === 'pending') {
        // Pending in UI represents invoices still collectible.
        where.status = In(['draft', 'issued', 'partial']);
      } else {
        where.status = status as InvoiceStatus;
      }
    }

    const [invoices, total] = await this.invoiceRepo.findAndCount({
      take: limit,
      skip: offset,
      where,
      relations: ['fromCompany', 'billToClient', 'lineItems'],
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
      relations: ['fromCompany', 'billToClient', 'lineItems'],
    });

    if (!invoice) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

    // No need to validate company access since we already filter by userId
    // The invoice belongs to this user, so they have access

    return invoice;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateInvoiceRequest,
  ): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);

    // Check if invoice is immutable (issued or later states)
    if (invoice.status !== 'draft' && invoice.status !== 'canceled') {
      throw new BadRequestException(
        'Cannot modify invoice that has been issued. Only draft invoices can be edited.',
      );
    }

    const {
      lineItems: lineItemsInput,
      logoMediaToken,
      billToFullName,
      ...updateData
    } = input as UpdateInvoiceRequest & { logoMediaToken?: string };

    const normalizedUpdateData = {
      ...updateData,
      billToName: billToFullName,
    };

    // If manual bill-to data is present, force inline mode by clearing client relation.
    if (billToFullName !== undefined) {
      normalizedUpdateData.billToClientId = null as unknown as string;
    }

    const tempLogoToken =
      logoMediaToken ?? this.extractTempPublicId(normalizedUpdateData.logoUrl);

    if (tempLogoToken?.startsWith('temp_files/')) {
      normalizedUpdateData.logoUrl = undefined;
      await this.setCompanyLogoFromTempToken(
        userId,
        invoice.fromCompanyId,
        tempLogoToken,
      );
    }

    const mappedLineItemsForTotals = (lineItemsInput ?? invoice.lineItems).map(
      (item) => ({
        quantity: this.toSafeNumber(item.quantity),
        price: this.toSafeNumber(item.price),
      }),
    );

    this.validateLineItemsTotalsGreaterThanZero(mappedLineItemsForTotals);

    const effectiveTaxRate = this.toSafeNumber(
      normalizedUpdateData.taxRate ?? invoice.taxRate,
    );
    const expectedTotals = this.calculateTotals(
      mappedLineItemsForTotals,
      effectiveTaxRate,
      this.toSafeNumber(invoice.amountPaid),
    );

    if (expectedTotals.total <= 0) {
      throw new BadRequestException('invoiceTotalMustBeGreaterThanZero');
    }

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
      invoice.lineItems = lineItems;

      Object.assign(invoice, expectedTotals);
    }

    if (normalizedUpdateData.taxRate !== undefined) {
      Object.assign(invoice, expectedTotals);
    }

    // Persist with update() to avoid TypeORM side effects when entity has loaded relations.
    const updatePayload: Partial<Invoice> = {
      ...normalizedUpdateData,
      ...expectedTotals,
    };

    await this.invoiceRepo.update(id, updatePayload);

    return this.findOne(userId, id);
  }

  /**
   * Issue an invoice (draft -> issued) - Makes it immutable
   */
  async issueInvoice(
    userId: string,
    id: string,
    input?: IssueInvoiceRequest,
  ): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);

    // Can only issue draft invoices
    if (invoice.status !== 'draft') {
      throw new BadRequestException(
        `Cannot issue invoice with status '${invoice.status}'. Only draft invoices can be issued.`,
      );
    }

    // Validate the invoice has line items
    if (invoice.lineItems.length === 0) {
      throw new BadRequestException('Cannot issue invoice without line items.');
    }

    // Validate invoice has a client
    if (!invoice.billToClientId) {
      throw new BadRequestException('Cannot issue invoice without a client.');
    }

    // Set issued status and timestamp
    invoice.status = 'issued';
    invoice.issuedAt = new Date().toISOString();

    // Update issue date if provided
    if (input?.issueDate) {
      invoice.issueDate = input.issueDate;
    }

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // Create Account Receivable automatically
    await this.arService.createFromInvoice(savedInvoice, userId);

    return savedInvoice;
  }

  async remove(userId: string, id: string): Promise<Invoice> {
    const invoice = await this.findOne(userId, id);

    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be deleted.');
    }

    const deleteResult = await this.invoiceRepo.softDelete({
      id: invoice.id,
      userId,
    });

    if (!deleteResult.affected) {
      throw new NotFoundException(CommonMessages.RESOURCE_NOT_FOUND);
    }

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
    console.log('[INVOICE SERVICE] recordPayment called:', {
      userId,
      id,
      amount,
      amountType: typeof amount,
      paidAt,
    });

    const invoice = await this.findOne(userId, id);
    const invoiceTotal = this.toSafeNumber(invoice.total);
    const invoiceAmountPaid = this.toSafeNumber(invoice.amountPaid);
    const invoiceBalanceDue = this.toSafeNumber(invoice.balanceDue);

    console.log('[INVOICE SERVICE] Invoice found:', {
      id: invoice.id,
      status: invoice.status,
      total: invoiceTotal,
      amountPaid: invoiceAmountPaid,
      balanceDue: invoiceBalanceDue,
    });

    // Can only record payments on issued invoices
    if (!['issued', 'partial', 'overdue'].includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot record payment on invoice with status '${invoice.status}'. Invoice must be issued first.`,
      );
    }

    // Validate payment amount
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const newAmountPaid = invoiceAmountPaid + amount;
    const newBalance = invoiceTotal - newAmountPaid;

    console.log('[INVOICE SERVICE] Calculated values:', {
      newAmountPaid,
      newBalance,
    });

    if (newAmountPaid > invoiceTotal) {
      throw new BadRequestException(
        `Payment amount ($${String(amount)}) exceeds remaining balance ($${String(invoiceBalanceDue)})`,
      );
    }

    // Update status based on payment
    let newStatus: InvoiceStatus;
    let newPaidDate: string | undefined;
    let finalBalance: number;

    if (newBalance <= 0) {
      newStatus = 'paid';
      newPaidDate = paidAt ?? new Date().toISOString().split('T')[0];
      finalBalance = 0;
    } else {
      newStatus = 'partial';
      finalBalance = newBalance;
    }

    console.log('[INVOICE SERVICE] Saving invoice with new values:', {
      newAmountPaid,
      finalBalance,
      newStatus,
    });

    // Use update() instead of save() to avoid TypeORM nullifying FK columns
    // when the entity was loaded with relations
    const updatePayload: Partial<Invoice> = {
      amountPaid: newAmountPaid,
      balanceDue: finalBalance,
      status: newStatus,
      ...(newPaidDate ? { paidDate: newPaidDate } : {}),
    };

    await this.invoiceRepo.update(id, updatePayload);

    return this.findOne(userId, id);
  }

  /**
   * Generate PDF for an invoice
   */
  /**
   * Convert image URL to base64 string
   */
  private async imageUrlToBase64(url: string): Promise<string | null> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });

      const mimeTypeHeader: unknown = response.headers['content-type'];
      const mimeType =
        typeof mimeTypeHeader === 'string'
          ? mimeTypeHeader
          : 'application/octet-stream';
      const base64 = Buffer.from(response.data).toString('base64');

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('[PDF] Error converting image to base64:', error);
      return null;
    }
  }

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

    // Company logo is the primary source; invoice logoUrl remains legacy fallback.
    const logoUrl = invoice.fromCompany.logoUrl ?? invoice.logoUrl ?? null;
    console.log('[PDF] Logo URL:', logoUrl);

    // Convert logo to base64 if available
    let logoBase64: string | null = null;
    if (logoUrl) {
      console.log('[PDF] Converting logo to base64...');
      logoBase64 = await this.imageUrlToBase64(logoUrl);
      console.log('[PDF] Logo conversion:', logoBase64 ? 'success' : 'failed');
    }

    // Build PDF document definition
    console.log('[PDF] Building PDF definition...');
    const docDefinition = this.buildInvoicePdfDefinition(invoice, logoBase64);
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
  private buildInvoicePdfDefinition(
    invoice: Invoice,
    logoBase64?: string | null,
  ): TDocumentDefinitions {
    const primaryColor = '#002e5d';
    const formatCurrency = (amount: unknown) =>
      `CA$${this.toSafeNumber(amount).toFixed(2)}`;
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
    const fromCompany: Company = invoice.fromCompany;
    const companyInfoStack: Content[] = [];

    if (logoBase64) {
      companyInfoStack.push({
        image: 'logo',
        width: 88,
        margin: [0, 0, 0, 10] as [number, number, number, number],
      });
    }

    companyInfoStack.push(
      {
        text: fromCompany.legalName,
        style: 'companyName',
      },
      ...[
        fromCompany.address
          ? { text: fromCompany.address, style: 'companyDetails' }
          : '',
        fromCompany.phone
          ? {
              text: `Tel: ${fromCompany.phone}`,
              style: 'companyDetails',
            }
          : '',
        fromCompany.email
          ? { text: fromCompany.email, style: 'companyDetails' }
          : '',
      ].filter(Boolean),
    );

    headerContent.push({
      columns: [
        {
          width: '*',
          stack: companyInfoStack,
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

    // Dates and Bill To
    const billToStack: Content[] = [{ text: 'BILL TO', style: 'sectionLabel' }];

    if (invoice.billToName) {
      billToStack.push({
        text: invoice.billToName,
        style: 'billToName',
      });

      if (invoice.billToAddress) {
        billToStack.push({
          text: invoice.billToAddress,
          style: 'billToDetails',
        });
      }

      if (invoice.billToCity || invoice.billToProvince) {
        const location = [
          invoice.billToCity,
          invoice.billToProvince,
          invoice.billToPostalCode,
        ]
          .filter(Boolean)
          .join(', ');
        if (location) {
          billToStack.push({ text: location, style: 'billToDetails' });
        }
      }

      if (invoice.billToEmail) {
        billToStack.push({
          text: invoice.billToEmail,
          style: 'billToDetails',
        });
      }

      if (invoice.billToPhone) {
        billToStack.push({
          text: invoice.billToPhone,
          style: 'billToDetails',
        });
      }
    } else if (invoice.billToClient) {
      billToStack.push({
        text: invoice.billToClient.fullName,
        style: 'billToName',
      });

      if (invoice.billToClient.address) {
        billToStack.push({
          text: invoice.billToClient.address,
          style: 'billToDetails',
        });
      }

      if (invoice.billToClient.city || invoice.billToClient.province) {
        const location = [
          invoice.billToClient.city,
          invoice.billToClient.province,
          invoice.billToClient.postalCode,
        ]
          .filter(Boolean)
          .join(', ');
        if (location) {
          billToStack.push({ text: location, style: 'billToDetails' });
        }
      }

      if (invoice.billToClient.email) {
        billToStack.push({
          text: invoice.billToClient.email,
          style: 'billToDetails',
        });
      }

      if (invoice.billToClient.phone) {
        billToStack.push({
          text: invoice.billToClient.phone,
          style: 'billToDetails',
        });
      }

      if (invoice.billToClient.businessNumber) {
        billToStack.push({
          text: `BN: ${invoice.billToClient.businessNumber}`,
          style: 'billToDetails',
        });
      }
    } else {
      billToStack.push({ text: 'Client not found', style: 'billToName' });
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
                {
                  text: `Tax (${String(invoice.taxRate)}%)`,
                  style: 'summaryLabel',
                },
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
      images: logoBase64
        ? {
            logo: logoBase64,
          }
        : {},
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

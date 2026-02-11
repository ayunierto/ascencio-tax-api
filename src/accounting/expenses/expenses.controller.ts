import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';

import { ExpensesService } from './expenses.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from 'src/files/files.service';
import { RemoveReceiptImageDto } from './dto/remove-receipt-image.dto';
import { OcrService } from 'src/ocr/ocr.service';
import { OpenaiService } from 'src/openai/openai.service';
import {
  AnalyzeExpenseRequest,
  analyzeExpenseSchema,
  CreateExpenseRequest,
  createExpenseSchema,
  UpdateExpenseRequest,
  updateExpenseSchema,
} from '@ascencio/shared';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { Expense } from './entities/expense.entity';

@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly filesService: FilesService,
    private readonly ocrService: OcrService,
    private readonly openaiService: OpenaiService,
  ) {}

  @Post()
  @Auth()
  create(
    @Body(new ZodValidationPipe(createExpenseSchema))
    createExpenseDto: CreateExpenseRequest,
    @GetUser() user: User,
  ): Promise<Expense> {
    return this.expensesService.create(createExpenseDto, user);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto, @GetUser() user: User) {
    return this.expensesService.findAll(paginationDto, user);
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.expensesService.findOne(id, user);
  }

  @Patch(':id')
  @Auth()
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema))
    updateExpenseDto: UpdateExpenseRequest,
    @GetUser() user: User,
  ) {
    return this.expensesService.update(id, updateExpenseDto, user);
  }

  @Delete(':id')
  @Auth()
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.expensesService.remove(id, user);
  }

  @Post('upload-receipt-image')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException(
        'File is required, please upload a file in the "file" field',
      );
    }
    // Create temp folder for user.
    const folderPath = `ascencio_tax_inc/temp_receipts/${user.id}`;
    const uploadResult = await this.filesService.upload(file, folderPath);

    if (!uploadResult || !('secure_url' in uploadResult)) {
      throw new BadRequestException('Failed to upload receipt image');
    }

    return {
      url: uploadResult.secure_url,
    };
  }

  @Post('analyze-image-url')
  @Auth()
  async analyzeExpenseUrl(
    @Body(new ZodValidationPipe(analyzeExpenseSchema))
    { imageUrl }: AnalyzeExpenseRequest,
  ) {
    const text = await this.ocrService.extractTextFromImage(imageUrl);
    const data = await this.openaiService.analyzeReceiptText(text);
    return data;
  }

  @Post('delete-receipt-image')
  @Auth()
  async deleteReceipt(@Body() { imageUrl }: RemoveReceiptImageDto) {
    const publicId = this.extractPublicId(imageUrl);
    if (!publicId) {
      throw new BadRequestException('Invalid image URL');
    }
    return await this.filesService.delete(publicId);
  }

  extractPublicId(url: string): string | null {
    try {
      // Example:
      // https://res.cloudinary.com/demo/image/upload/v1720001234/ascencio_tax_inc/temp_receipts/42/receipt_abc123.jpg
      const parts = url.split('/upload/');
      const path = parts[1].split('.')[0]; // ascencio_tax_inc/temp_receipts/42/receipt_abc123
      // Delete prefix of version v1720001234/
      return path.replace(/^v\d+\//, '');
    } catch {
      return null;
    }
  }
}

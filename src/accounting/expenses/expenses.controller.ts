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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AnalyzeExpenseDto } from './dto/analyze-expense.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from 'src/files/files.service';
import { RemoveReceiptImageDto } from './dto/remove-receipt-image.dto';
import { OcrService } from 'src/ocr/ocr.service';
import { OpenaiService } from 'src/openai/openai.service';

@ApiTags('Accounting - Expenses')
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new expense' })
  @ApiResponse({ status: 201, description: 'Expense created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createExpenseDto: CreateExpenseDto, @GetUser() user: User) {
    return this.expensesService.create(createExpenseDto, user);
  }

  @Get()
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all expenses' })
  @ApiResponse({ status: 200, description: 'Return all expenses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() paginationDto: PaginationDto, @GetUser() user: User) {
    return this.expensesService.findAll(paginationDto, user);
  }

  @Get(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an expense by ID' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @ApiResponse({ status: 200, description: 'Return the expense' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.expensesService.findOne(id, user);
  }

  @Patch(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an expense' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @ApiResponse({ status: 200, description: 'Expense updated successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @GetUser() user: User,
  ) {
    return this.expensesService.update(id, updateExpenseDto, user);
  }

  @Delete(':id')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an expense' })
  @ApiParam({ name: 'id', description: 'Expense ID' })
  @ApiResponse({ status: 200, description: 'Expense deleted successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.expensesService.remove(id, user);
  }

  @Post('upload-receipt-image')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload receipt image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze receipt image URL' })
  @ApiResponse({ status: 201, description: 'Receipt analyzed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async analyzeExpenseUrl(@Body() { imageUrl }: AnalyzeExpenseDto) {
    const text = await this.ocrService.extractTextFromImage(imageUrl);
    const data = await this.openaiService.analyzeReceiptText(text);
    return data;
  }

  @Post('delete-receipt-image')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete receipt image' })
  @ApiResponse({ status: 201, description: 'Image deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

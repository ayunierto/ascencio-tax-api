import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Between } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { LogsService } from 'src/logs/logs.service';
import { ExpensesByCategory } from './interfaces/expenses-by-category.interface';

import { CategoriesService } from '../categories/categories.service';
import { SubcategoriesService } from '../subcategories/subcategories.service';
import { FilesService } from 'src/files/files.service';
import { Category } from '../categories/entities/category.entity';
import { Subcategory } from '../subcategories/entities/subcategory.entity';
import { CreateExpenseRequest, UpdateExpenseRequest } from '@ascencio/shared';

const UNCATEGORIZED_CATEGORY = 'Uncategorized';
const UNCATEGORIZED_SUBCATEGORY = 'Uncategorized';

const normalizeMoneyValue = (
  value: number | string | null | undefined,
): number => {
  const parsedValue =
    typeof value === 'number' ? value : Number.parseFloat(value ?? '0');

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly logService: LogsService,
    private readonly categoriesService: CategoriesService,
    private readonly subcategoriesService: SubcategoriesService,
    private readonly filesService: FilesService,
  ) {}

  async findAllByDateRange(startDate: Date, endDate: Date, user: User) {
    try {
      const expenses = await this.expenseRepository.find({
        where: {
          user: { id: user.id },
          date: Between(startDate, endDate),
        },
        relations: ['category', 'subcategory'],
      });

      console.log(
        `[EXPENSES] Found ${String(expenses.length)} expenses for user ${user.id}`,
      );
      console.log('[EXPENSES] Date range:', { startDate, endDate });

      const expensesByCategory: ExpensesByCategory = {};

      expenses.forEach((expense) => {
        const expenseCategory = expense.category as Category | null;
        const expenseSubcategory = expense.subcategory as Subcategory | null;

        const categoryName =
          (expenseCategory ? expenseCategory.name.trim() : undefined) ??
          UNCATEGORIZED_CATEGORY;
        const subcategoryName =
          (expenseSubcategory ? expenseSubcategory.name.trim() : undefined) ??
          UNCATEGORIZED_SUBCATEGORY;

        const categoryBucket = (expensesByCategory[categoryName] ??= {
          total: { gross: 0, hst: 0, net: 0 },
        });

        const subcategoryBucket = (categoryBucket[subcategoryName] ??= {
          gross: 0,
          hst: 0,
          net: 0,
        });

        const gross = normalizeMoneyValue(expense.total);
        const hst = normalizeMoneyValue(expense.tax);
        const net = gross - hst;

        console.log(`[EXPENSES] Processing expense: ${expense.merchant}`, {
          category: categoryName,
          subcategory: subcategoryName,
          gross,
          hst,
          net,
        });

        subcategoryBucket.gross += gross;
        subcategoryBucket.hst += hst;
        subcategoryBucket.net += net;

        categoryBucket.total.gross += gross;
        categoryBucket.total.hst += hst;
        categoryBucket.total.net += net;
      });

      console.log(
        '[EXPENSES] Final aggregation:',
        JSON.stringify(expensesByCategory, null, 2),
      );

      return {
        expensesByCategory,
      };
    } catch (error: unknown) {
      console.error('[EXPENSES] Error in findAllByDateRange:', error);
      throw error;
    }
  }

  async create(
    createExpenseDto: CreateExpenseRequest,
    user: User,
  ): Promise<Expense> {
    try {
      const { categoryId, subcategoryId, date, imageUrl, ...rest } =
        createExpenseDto;

      // Promote receipt image from temp folder to permanent folder when possible.
      const updatedImageUrl = await this.resolvePersistedImageUrl(imageUrl);

      // Validar si la categoría existe (puede ser nula)
      let category: Category | null = null;
      if (categoryId) {
        category = await this.categoriesService.findOne(categoryId);
      }

      // Validar si la subcategoría existe (puede ser nula)
      let subcategory: Subcategory | null = null;
      if (subcategoryId) {
        subcategory = await this.subcategoriesService.findOne(subcategoryId);
      }

      // Validar fecha nula
      let expenseDate: Date | undefined;
      if (date) {
        // Parse date as UTC to avoid timezone issues
        const dateParts = date.split('T')[0].split('-');
        expenseDate = new Date(
          Date.UTC(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
          ),
        );
        if (isNaN(expenseDate.getTime())) {
          throw new BadRequestException('Invalid date');
        }
      }

      const newExpense = this.expenseRepository.create({
        category: category ?? undefined,
        date: expenseDate,
        subcategory: subcategory ?? undefined,
        user: user,
        imageUrl: updatedImageUrl,
        ...rest,
      });

      await this.expenseRepository.save(newExpense);

      await this.logService.create(
        { description: `Expense added: ${category?.name ?? 'No category'}` },
        user,
      );

      return newExpense;
    } catch (error: unknown) {
      console.error(error);

      if (error instanceof HttpException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : undefined;

      throw new InternalServerErrorException(
        message ?? 'Error creating expense. Please try again later.',
      );
    }
  }

  async findAll(paginationDto: PaginationDto, user: User): Promise<Expense[]> {
    try {
      const { limit = 10, offset = 0 } = paginationDto;
      const expenses = await this.expenseRepository.find({
        take: limit,
        skip: offset,
        where: { user: { id: user.id } },
        relations: { category: true, subcategory: true },
        order: {
          createdAt: 'DESC',
        },
      });
      return expenses;
    } catch {
      throw new InternalServerErrorException(
        'Error fetching expenses. Please try again later.',
      );
    }
  }

  async findOne(id: string, user: User): Promise<Expense> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: id, user: { id: user.id } },
        relations: { category: true, subcategory: true },
      });
      if (!expense) {
        throw new BadRequestException('Expense not found');
      }
      return expense;
    } catch (error: unknown) {
      throw new BadRequestException(
        (error instanceof Error ? error.message : undefined) ??
          'Error fetching expense. Please try again later.',
      );
    }
  }

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseRequest,
    user: User,
  ): Promise<Expense> {
    try {
      const { categoryId, subcategoryId, date, imageUrl, ...rest } =
        updateExpenseDto;

      const expense = await this.expenseRepository.findOne({
        where: { id: id, user: { id: user.id } },
      });
      if (!expense) {
        throw new BadRequestException('Expense not found');
      }

      let category: Category | null = null;
      if (categoryId) {
        category = await this.categoriesService.findOne(categoryId);
      } else {
        category = expense.category;
      }

      let subcategory: Subcategory | null = null;
      if (subcategoryId) {
        subcategory = await this.subcategoriesService.findOne(subcategoryId);
      } else {
        subcategory = expense.subcategory;
      }

      let parsedDate = expense.date;
      if (date) {
        // Parse date as UTC to avoid timezone issues
        const dateParts = date.split('T')[0].split('-');
        parsedDate = new Date(
          Date.UTC(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
          ),
        );
        if (isNaN(parsedDate.getTime())) {
          throw new BadRequestException('Invalid date');
        }
      }

      const updatedImageUrl =
        imageUrl !== undefined
          ? await this.resolvePersistedImageUrl(imageUrl)
          : expense.imageUrl;
      const previousImageUrl = expense.imageUrl;

      const updatedExpense = await this.expenseRepository.preload({
        id,
        ...rest,
        date: parsedDate,
        imageUrl: updatedImageUrl,
        category,
        subcategory,
        user: user,
      });

      if (!updatedExpense) {
        throw new BadRequestException('Expense not found');
      }

      await this.expenseRepository.save(updatedExpense);

      await this.logService.create(
        { description: `Expense updated: ${updatedExpense.merchant}` },
        user,
      );

      this.scheduleDeleteIfReplaced(previousImageUrl, updatedImageUrl);

      return updatedExpense;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error updating expense. Please try again later.',
      );
    }
  }

  async remove(id: string, user: User): Promise<Expense> {
    try {
      const expense = await this.expenseRepository.findOne({
        where: { id: id, user: { id: user.id } },
      });
      if (!expense) {
        throw new BadRequestException('Expense not found');
      }
      await this.expenseRepository.remove(expense);

      const previousImagePath = expense.imageUrl
        ? this.extractPublicId(expense.imageUrl)
        : null;
      if (previousImagePath) {
        this.filesService.scheduleDelete(previousImagePath);
      }

      await this.logService.create(
        { description: `Expense deleted: ${expense.merchant}` },
        user,
      );

      return expense;
    } catch {
      throw new InternalServerErrorException(
        'Error deleting expense. Please try again later.',
      );
    }
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

  private async resolvePersistedImageUrl(
    imageUrl?: string | null,
  ): Promise<string | null> {
    if (!imageUrl) {
      return null;
    }

    const oldPath = this.extractPublicId(imageUrl);
    if (!oldPath) {
      return imageUrl;
    }

    // Only move files from temp_receipts to receipts.
    if (!oldPath.includes('temp_receipts')) {
      return imageUrl;
    }

    const newPath = oldPath.replace('temp_receipts', 'receipts');
    const promotedImageUrl = imageUrl.replace(oldPath, newPath);

    try {
      await this.filesService.move(oldPath, newPath);
      return promotedImageUrl;
    } catch (error: unknown) {
      // Do not block expense persistence because of external storage transient failures.
      console.warn(
        `[EXPENSES] Could not promote receipt image ${oldPath} -> ${newPath}. Saving expense with temp image URL.`,
      );
      console.warn(error);
      return imageUrl;
    }
  }

  private scheduleDeleteIfReplaced(
    previousImageUrl?: string | null,
    currentImageUrl?: string | null,
  ): void {
    if (!previousImageUrl) {
      return;
    }

    const previousPublicId = this.extractPublicId(previousImageUrl);
    if (!previousPublicId) {
      return;
    }

    const currentPublicId = this.extractPublicId(currentImageUrl ?? '');

    if (currentPublicId && currentPublicId === previousPublicId) {
      return;
    }

    this.filesService.scheduleDelete(previousPublicId);
  }
}

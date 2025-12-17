import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpensesService } from './expenses.service';
import { Expense } from './entities/expense.entity';
import { LogsService } from 'src/logs/logs.service';
import { CategoriesService } from '../categories/categories.service';
import { SubcategoriesService } from '../subcategories/subcategories.service';
import { FilesService } from 'src/files/files.service';
import { Category } from '../categories/entities/category.entity';
import { User } from 'src/auth/entities/user.entity';

const createRepositoryMock = () =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  }) as unknown as jest.Mocked<Repository<Expense>>;

const createLogsServiceMock = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

const createCategoriesServiceMock = () => ({
  findOne: jest.fn(),
});

const createSubcategoriesServiceMock = () => ({
  findOne: jest.fn(),
});

const createFilesServiceMock = () => ({
  move: jest.fn().mockResolvedValue(undefined),
});

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepository: jest.Mocked<Repository<Expense>>;
  let categoriesService: ReturnType<typeof createCategoriesServiceMock>;
  let subcategoriesService: ReturnType<typeof createSubcategoriesServiceMock>;
  let logsService: ReturnType<typeof createLogsServiceMock>;

  const user: User = { id: 'user-1' } as User;

  beforeEach(async () => {
    expenseRepository = createRepositoryMock();
    categoriesService = createCategoriesServiceMock();
    subcategoriesService = createSubcategoriesServiceMock();
    logsService = createLogsServiceMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: expenseRepository },
        { provide: LogsService, useValue: logsService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: SubcategoriesService, useValue: subcategoriesService },
        { provide: FilesService, useValue: createFilesServiceMock() },
      ],
    }).compile();

    service = moduleRef.get(ExpensesService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('crea un gasto con categoría opcional', async () => {
    const category: Category = { id: 'cat-1', name: 'Food' } as Category;
    categoriesService.findOne.mockResolvedValue(category);
    expenseRepository.create.mockReturnValue({
      merchant: 'Cafe',
      category,
    } as Expense);

    const result = await service.create(
      {
        merchant: 'Cafe',
        total: 10,
        tax: 1,
        categoryId: 'cat-1',
        date: '2024-01-01',
      } as any,
      user,
    );

    expect(categoriesService.findOne).toHaveBeenCalledWith('cat-1');
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ category, user }),
    );
    expect(expenseRepository.save).toHaveBeenCalled();
    expect(logsService.create).toHaveBeenCalled();
    expect(result).toEqual({ merchant: 'Cafe', category });
  });

  it('lanza BadRequest cuando no encuentra el gasto en findOne', async () => {
    expenseRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('bad-id', user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

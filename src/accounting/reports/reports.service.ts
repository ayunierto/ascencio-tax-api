import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Report } from './entities/report.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateReportDto } from './dto/create-report.dto';
import { User } from 'src/auth/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrinterService } from 'src/printer/printer.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CategoriesService } from '../categories/categories.service';
import { SubcategoriesService } from '../subcategories/subcategories.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    private readonly printer: PrinterService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
    private readonly subcategoriesService: SubcategoriesService,
  ) {}

  async generatePdfReport(
    createReportDto: CreateReportDto,
    user: User,
  ): Promise<PDFKit.PDFDocument> {
    const { startDate, endDate } = createReportDto;

    console.log('[REPORTS] Generating PDF report', {
      startDate,
      endDate,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
    });

    // Guardar registro del reporte en la base de datos
    try {
      console.log('[REPORTS] Creating report record...');
      const reportRecord = this.reportRepository.create({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        user,
      });
      console.log('[REPORTS] Report record created, saving...', {
        startDate: reportRecord.startDate,
        endDate: reportRecord.endDate,
        userId: user.id,
      });

      const savedReport = await this.reportRepository.save(reportRecord);

      console.log('[REPORTS] ✅ Report record saved successfully in database', {
        reportId: savedReport.id,
        createdAt: savedReport.createdAt,
      });
    } catch (error) {
      console.error('[REPORTS] ❌ Error saving report record:', error);
      console.error('[REPORTS] Error details:', {
        message: error.message,
        stack: error.stack,
      });
      // No lanzar error aquí, continuar con la generación del PDF
    }

    // Obtener datos de gastos con categorías y subcategorías calculadas
    const expensesData = await this.expensesService.findAllByDateRange(
      new Date(startDate),
      new Date(endDate),
      user,
    );

    console.log(
      '[REPORTS] Expenses data received:',
      JSON.stringify(expensesData, null, 2),
    );

    // Obtener todas las categorías y subcategorías de la base de datos
    const allCategories = await this.categoriesService.findAll();

    console.log(
      `[REPORTS] Found ${allCategories.length} categories from database`,
    );
    allCategories.forEach((cat) => {
      console.log(
        `  - Category: ${cat.name} with ${cat.subcategories?.length || 0} subcategories`,
      );
    });

    // Calcular totales generales
    const calculateGrandTotals = () => {
      let totalGross = 0;
      let totalHst = 0;
      let totalNet = 0;

      Object.keys(expensesData.expensesByCategory).forEach((categoryName) => {
        const category = expensesData.expensesByCategory[categoryName];
        totalGross += category.total.gross;
        totalHst += category.total.hst;
        totalNet += category.total.net;
      });

      return { totalGross, totalHst, totalNet };
    };

    const grandTotals = calculateGrandTotals();

    // Función para generar filas de tabla por categoría usando las subcategorías de la BD
    const getTableRows = (categoryName: string, subcategoriesFromDB: any[]) => {
      const categoryData = expensesData.expensesByCategory[categoryName];
      const rows: TableCell[][] = [];

      // Si la categoría tiene subcategorías en la BD, usarlas
      if (subcategoriesFromDB && subcategoriesFromDB.length > 0) {
        subcategoriesFromDB.forEach((subcat) => {
          const subcatData = categoryData?.[subcat.name] || {
            gross: 0,
            hst: 0,
            net: 0,
          };

          rows.push([
            { text: subcat.name, margin: [10, 0, 0, 0], bold: false },
            {
              text: subcatData.gross.toFixed(2),
              alignment: 'right',
            },
            {
              text: subcatData.hst.toFixed(2),
              alignment: 'right',
            },
            {
              text: subcatData.net.toFixed(2),
              alignment: 'right',
            },
          ]);
        });
      } else {
        // Si no tiene subcategorías en la BD, verificar si hay datos de gastos
        if (categoryData) {
          const subcategoryNames = Object.keys(categoryData).filter(
            (key) => key !== 'total',
          );

          subcategoryNames.forEach((subcatName) => {
            const subcatData = categoryData[subcatName];
            rows.push([
              { text: subcatName, margin: [10, 0, 0, 0], bold: false },
              {
                text: subcatData.gross.toFixed(2),
                alignment: 'right',
              },
              {
                text: subcatData.hst.toFixed(2),
                alignment: 'right',
              },
              {
                text: subcatData.net.toFixed(2),
                alignment: 'right',
              },
            ]);
          });
        }
      }

      // Fila de total
      const totalData = categoryData?.total || { gross: 0, hst: 0, net: 0 };
      rows.push([
        {
          text: 'Total',
          alignment: 'left',
          bold: true,
        },
        {
          text: totalData.gross.toFixed(2),
          alignment: 'right',
          bold: true,
        },
        {
          text: totalData.hst.toFixed(2),
          alignment: 'right',
          bold: true,
        },
        {
          text: totalData.net.toFixed(2),
          alignment: 'right',
          bold: true,
        },
      ]);

      return rows;
    };

    // Generar tablas para TODAS las categorías (con o sin datos)
    const categoryTables: any[] = [];

    allCategories.forEach((category) => {
      const rows = getTableRows(category.name, category.subcategories);

      // Siempre agregar la tabla, incluso si no hay gastos
      categoryTables.push({
        margin: [0, 0, 0, 10],
        table: {
          widths: ['*', 60, 60, 60],
          body: [
            [
              {
                text: category.name,
                bold: true,
                colSpan: 4,
                fillColor: '#ccc',
              },
              { text: '' },
              { text: '' },
              { text: '' },
            ],
            ...rows,
          ],
        },
      });
    });

    const documentDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 30],

      content: [
        // Header
        {
          table: {
            widths: [90, '*', '*'],
            body: [
              [
                {
                  rowSpan: 2,
                  text: 'AT',
                  fontSize: 42,
                  font: 'Times',
                  color: '#002e5d',
                  bold: true,
                },
                {
                  text: 'ASCENCIO TAX INC.',
                  bold: true,
                  fontSize: 20,
                  alignment: 'center',
                  font: 'Times',
                },
                {
                  text: `${user.firstName} ${user.lastName} / ${user.phoneNumber}`,
                  fontSize: 12,
                  bold: true,
                  alignment: 'center',
                },
              ],
              [
                '',
                {
                  text: 'Personal and Business Income Tax Services',
                  alignment: 'center',
                  font: 'Times',
                },
                {
                  text: 'Income Tax 2025',
                  alignment: 'center',
                  bold: true,
                  fontSize: 16,
                },
              ],
            ],
          },
          layout: 'noBorders',
        },
        // Date range section
        {
          margin: [0, 0, 0, 10],
          table: {
            widths: ['*', 60, 60, 60],
            body: [
              [
                { text: 'NOTES:', bold: true, colSpan: 4 },
                { text: '' },
                { text: '' },
                { text: '' },
              ],
              [
                { text: 'DESCRIPTION', style: 'tableHeaderField' },
                { text: 'GROSS', style: 'tableHeaderField' },
                { text: 'HST (13%)', style: 'tableHeaderField' },
                { text: 'NET', style: 'tableHeaderField' },
              ],
              [
                {
                  text: `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(
                    endDate,
                  ).toLocaleDateString()}`,
                  bold: true,
                  fillColor: '#cccccc',
                  colSpan: 4,
                },
                '',
                '',
                '',
              ],
            ],
          },
        },
        // Tablas dinámicas de categorías
        ...categoryTables,
        // Total general
        {
          margin: [0, 0, 0, 10],
          table: {
            widths: ['*', 60, 60, 60],
            body: [
              [
                {
                  text: 'TOTAL EXPENSES',
                  bold: true,
                  fillColor: '#ccc',
                },
                {
                  text: grandTotals.totalGross.toFixed(2),
                  alignment: 'right',
                  bold: true,
                  fillColor: '#ccc',
                },
                {
                  text: grandTotals.totalHst.toFixed(2),
                  alignment: 'right',
                  bold: true,
                  fillColor: '#ccc',
                },
                {
                  text: grandTotals.totalNet.toFixed(2),
                  alignment: 'right',
                  bold: true,
                  fillColor: '#ccc',
                },
              ],
            ],
          },
        },
      ],

      styles: {
        tableHeaderField: {
          bold: true,
          fillColor: '#ccc',
          alignment: 'center',
        },
        tableHeader: {
          bold: true,
          fillColor: '#ccc',
        },
      },

      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
    };

    return this.printer.createPdf(documentDefinition);
  }

  async create(createReportDto: CreateReportDto, user: User) {
    try {
      const plan = this.reportRepository.create({ user, ...createReportDto });
      await this.reportRepository.save(plan);
      return plan;
    } catch (error) {
      throw new BadRequestException('Unable to create plans');
    }
  }

  async findAll(paginationDto: PaginationDto, user: User): Promise<Report[]> {
    try {
      console.log('[REPORTS] Finding reports for user:', {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        limit: paginationDto.limit,
        offset: paginationDto.offset,
      });

      const { limit = 10, offset = 0 } = paginationDto;
      const userReportLogs = await this.reportRepository.find({
        take: limit,
        skip: offset,
        where: { user: { id: user.id } },
        order: {
          createdAt: 'DESC',
        },
      });

      console.log('[REPORTS] Found reports:', {
        count: userReportLogs.length,
        reports: userReportLogs.map((r) => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          createdAt: r.createdAt,
        })),
      });

      return userReportLogs;
    } catch (error) {
      console.error('[REPORTS] Error finding reports:', error);
      throw new InternalServerErrorException('Unable to find reports');
    }
  }
}

import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/auth/entities/user.entity';

@ApiTags('Accounting - Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('generate')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate PDF report' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Header('Content-Type', 'application/pdf')
  async generatePdf(
    @Res() response: Response,
    @Query() createReportDto: CreateReportDto,
    @GetUser() user: User,
  ) {
    const pdfReport = await this.reportsService.generatePdfReport(
      createReportDto,
      user,
    );

    pdfReport.info.Title = 'Report';
    pdfReport.pipe(response);
    pdfReport.end();
  }

  @Get()
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reports' })
  @ApiResponse({ status: 200, description: 'Return all reports' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() paginationDto: PaginationDto, @GetUser() user: User) {
    return this.reportsService.findAll(paginationDto, user);
  }
}

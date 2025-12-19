import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetrics } from '@ascencio/shared/interfaces';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  async getMetrics(): Promise<DashboardMetrics> {
    return this.dashboardService.getMetrics();
  }

  @Get('today-appointments')
  async getTodayAppointments() {
    return this.dashboardService.getTodayAppointments();
  }
}

import { Controller, Get, Post, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: any, @Query('module') module?: string) {
    const user = req.user;
    // Admins (role 0) can query any module dashboard.
    // Multi-role users can view any module assigned to them.
    const userRoles: number[] = user.roles
      ? (Array.isArray(user.roles) ? user.roles : user.roles.split(',').map(Number))
      : [user.role];

    let targetModule = user.module;
    if (module) {
      const moduleRoleMap: Record<string, number> = {
        admin: 0, frontdesk: 1, laboratory: 2, scanning: 3, pharmacy: 4, accounting: 5
      };
      const requestedRole = moduleRoleMap[module];
      if (userRoles.includes(0) || (requestedRole !== undefined && userRoles.includes(requestedRole))) {
        targetModule = module;
      }
    }

    return this.reportsService.getDashboardAnalytics(targetModule, user.id);
  }

  @Get('clinic')
  async getClinic(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getClinicStream(startDate, endDate, pageNum, limitNum);
  }

  @Get('pharmacy')
  async getPharmacy(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getPharmacyStream(startDate, endDate, pageNum, limitNum);
  }

  @Get('summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getCombinedSummary(startDate, endDate);
  }

  @Post('clinic/:id/void')
  async voidClinic(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.reportsService.voidClinicPayment(id, req.user.id, reason);
  }

  @Post('pharmacy/:id/void')
  async voidPharmacy(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.reportsService.voidPharmacySale(id, req.user.id, reason);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reportsService.getAuditLogs(pageNum, limitNum);
  }
}


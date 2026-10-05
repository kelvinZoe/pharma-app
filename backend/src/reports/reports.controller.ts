import { Controller, Get, Post, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission, canAccessModule } from '../auth/authorization/permissions';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermissions(Permission.DashboardRead)
  @Get('dashboard')
  async getDashboard(@Req() req: any, @Query('module') module?: string) {
    const user = req.user;
    let targetModule = user.module;
    if (module && canAccessModule(user, module)) targetModule = module;

    return this.reportsService.getDashboardAnalytics(targetModule, user.id);
  }

  @RequirePermissions(Permission.FinancialReportsRead)
  @Get('clinic')
  async getClinic(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getClinicStream(startDate, endDate, pageNum, limitNum);
  }

  @RequirePermissions(Permission.FinancialReportsRead)
  @Get('pharmacy')
  async getPharmacy(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationId') locationId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getPharmacyStream(startDate, endDate, pageNum, limitNum, locationId);
  }

  @RequirePermissions(Permission.FinancialReportsRead)
  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.reportsService.getCombinedSummary(startDate, endDate, locationId);
  }

  @RequirePermissions(Permission.FinancialPaymentVoid)
  @Post('clinic/:id/void')
  async voidClinic(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.reportsService.voidClinicPayment(id, req.user.id, reason);
  }

  @RequirePermissions(Permission.FinancialPaymentVoid)
  @Post('pharmacy/:id/void')
  async voidPharmacy(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.reportsService.voidPharmacySale(id, req.user.id, body.reason, body.stockDisposition);
  }

  @RequirePermissions(Permission.AuditRead)
  @Get('audit-logs')
  async getAuditLogs(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reportsService.getAuditLogs(pageNum, limitNum);
  }
}

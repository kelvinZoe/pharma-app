import { Controller, Get, Post, Query, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
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
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureRoles(req.user, [0, 5]);
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getClinicStream(startDate, endDate, pageNum, limitNum);
  }

  @Get('pharmacy')
  async getPharmacy(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('locationId') locationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 5]);
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.reportsService.getPharmacyStream(startDate, endDate, pageNum, limitNum, locationId);
  }

  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 5]);
    return this.reportsService.getCombinedSummary(startDate, endDate, locationId);
  }

  @Post('clinic/:id/void')
  async voidClinic(@Req() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    this.ensureRoles(req.user, [0, 5]);
    return this.reportsService.voidClinicPayment(id, req.user.id, reason);
  }

  @Post('pharmacy/:id/void')
  async voidPharmacy(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureRoles(req.user, [0, 5]);
    return this.reportsService.voidPharmacySale(id, req.user.id, body.reason, body.stockDisposition);
  }

  @Get('audit-logs')
  async getAuditLogs(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    this.ensureRoles(req.user, [0, 5]);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reportsService.getAuditLogs(pageNum, limitNum);
  }

  private ensureRoles(user: any, allowedRoles: number[]): void {
    const roles = Array.isArray(user?.roles)
      ? user.roles.map(Number)
      : String(user?.roles ?? user?.role ?? '').split(',').map(Number);
    if (!roles.some((role: number) => allowedRoles.includes(role))) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }
}

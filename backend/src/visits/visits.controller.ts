import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  // --- Patients ---
  @Get('patients/search')
  async search(@Req() req: any, @Query('query') query: string) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.searchPatients(query);
  }

  @Post('patients')
  async createPatient(@Req() req: any, @Body() body: any) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.createPatient(body);
  }

  @Put('patients/:id')
  async updatePatient(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.updatePatient(id, body);
  }

  @Get('patients/:id/history')
  async getHistory(@Req() req: any, @Param('id') patientId: string) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.getPatientHistory(patientId);
  }

  // --- Visits ---
  @Get('visits/active')
  async getActive(@Req() req: any, @Query('department') department?: string, @Query('all') all?: string) {
    this.ensureRoles(req.user, [0, 1, 2, 3]);
    const scopedDepartment = this.departmentForRole(Number(req.user.role)) ?? department;
    const includeAll = (Number(req.user.role) === 0 || Number(req.user.role) === 1) && all === 'true';
    return this.visitsService.getActiveVisits(scopedDepartment, includeAll);
  }


  @Get('visits/:id')
  async getDetails(@Req() req: any, @Param('id') id: string) {
    this.ensureRoles(req.user, [0, 1, 2, 3]);
    return this.visitsService.findVisitById(id, Number(req.user.role));
  }

  @Post('visits')
  async createVisit(@Req() req: any, @Body() body: any) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.createVisit(body, req.user.id);
  }

  @Delete('visits/:id')
  async deleteRegistration(@Req() req: any, @Param('id') id: string) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.deleteVisit(id, req.user.id);
  }

  // --- Department Actions ---
  @Post('visits/:id/services')
  async addExtra(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    this.ensureRoles(req.user, [0, 2, 3]);
    return this.visitsService.addExtraService(visitId, body, Number(req.user.role));
  }

  @Put('visits/:id/services/:visitServiceId/status')
  async updateServiceStatus(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body() body: any,
  ) {
    this.ensureRoles(req.user, [0, 2, 3]);
    return this.visitsService.updateServiceStatus(visitId, visitServiceId, body, Number(req.user.role));
  }

  @Put('visits/:id/services/:visitServiceId/approval')
  async approveExtraService(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body('approved') approved: boolean,
  ) {
    this.ensureRoles(req.user, [0, 1]);
    return this.visitsService.approveExtraService(visitId, visitServiceId, approved === true);
  }

  @Put('visits/:id/services/:visitServiceId/price-adjustment')
  async requestServicePriceAdjustment(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body() body: any,
  ) {
    this.ensureRoles(req.user, [0, 2, 3]);
    return this.visitsService.requestServicePriceAdjustment(visitId, visitServiceId, body, req.user.id, Number(req.user.role));
  }

  @Put('visits/:id/services/:visitServiceId/price-adjustment/approval')
  async approveServicePriceAdjustment(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body('approved') approved: boolean,
  ) {
    this.ensureRoles(req.user, [0, 1, 5]);
    return this.visitsService.approveServicePriceAdjustment(visitId, visitServiceId, approved === true, req.user.id);
  }

  @Delete('visits/:id/services/:visitServiceId')
  async removeService(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
  ) {
    this.ensureRoles(req.user, [0, 1, 2, 3]);
    return this.visitsService.removeExtraService(visitId, visitServiceId, Number(req.user.role));
  }

  // --- Capture Results ---
  @Post('visits/:id/results')
  async saveResult(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    this.ensureRoles(req.user, [0, 2, 3]);
    return this.visitsService.saveVisitResult(visitId, body, req.user.id, Number(req.user.role));
  }

  // --- Prescriptions ---
  @Post('visits/:id/prescriptions')
  async savePrescription(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    this.ensureRoles(req.user, [0, 2, 3]);
    return this.visitsService.savePrescription(visitId, body, req.user.id, Number(req.user.role));
  }

  private ensureRoles(user: any, allowedRoles: number[]): void {
    const roles = Array.isArray(user?.roles)
      ? user.roles.map(Number)
      : String(user?.roles ?? user?.role ?? '').split(',').map(Number);
    if (!roles.some((role: number) => allowedRoles.includes(role))) {
      throw new ForbiddenException('You do not have permission to perform this clinical operation');
    }
  }

  private departmentForRole(role: number): string | undefined {
    if (role === 2) return 'LAB';
    if (role === 3) return 'SCAN';
    return undefined;
  }
}

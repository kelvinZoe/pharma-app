import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission, Role } from '../auth/authorization/permissions';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  // --- Patients ---
  @RequirePermissions(Permission.PatientRead)
  @Get('patients/search')
  async search(@Req() req: any, @Query('query') query: string) {
    return this.visitsService.searchPatients(query);
  }

  @RequirePermissions(Permission.PatientManage)
  @Post('patients')
  async createPatient(@Req() req: any, @Body() body: any) {
    return this.visitsService.createPatient(body);
  }

  @RequirePermissions(Permission.PatientManage)
  @Put('patients/:id')
  async updatePatient(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.visitsService.updatePatient(id, body);
  }

  @RequirePermissions(Permission.PatientRead)
  @Get('patients/:id/history')
  async getHistory(@Req() req: any, @Param('id') patientId: string) {
    return this.visitsService.getPatientHistory(patientId);
  }

  // --- Visits ---
  @RequirePermissions(Permission.VisitRead)
  @Get('visits/active')
  async getActive(@Req() req: any, @Query('department') department?: string, @Query('all') all?: string) {
    const scopedDepartment = this.departmentForRole(Number(req.user.role)) ?? department;
    const includeAll = (Number(req.user.role) === Role.Admin || Number(req.user.role) === Role.Frontdesk) && all === 'true';
    return this.visitsService.getActiveVisits(scopedDepartment, includeAll);
  }


  @RequirePermissions(Permission.VisitRead)
  @Get('visits/:id')
  async getDetails(@Req() req: any, @Param('id') id: string) {
    return this.visitsService.findVisitById(id, Number(req.user.role));
  }

  @RequirePermissions(Permission.VisitManage)
  @Post('visits')
  async createVisit(@Req() req: any, @Body() body: any) {
    return this.visitsService.createVisit(body, req.user.id);
  }

  @RequirePermissions(Permission.VisitManage)
  @Delete('visits/:id')
  async deleteRegistration(@Req() req: any, @Param('id') id: string) {
    return this.visitsService.deleteVisit(id, req.user.id);
  }

  // --- Department Actions ---
  @RequirePermissions(Permission.ClinicalServicePerform)
  @Post('visits/:id/services')
  async addExtra(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.addExtraService(visitId, body, Number(req.user.role));
  }

  @RequirePermissions(Permission.ClinicalServicePerform)
  @Put('visits/:id/services/:visitServiceId/status')
  async updateServiceStatus(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body() body: any,
  ) {
    return this.visitsService.updateServiceStatus(visitId, visitServiceId, body, Number(req.user.role));
  }

  @RequirePermissions(Permission.ClinicalServiceApprove)
  @Put('visits/:id/services/:visitServiceId/approval')
  async approveExtraService(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body('approved') approved: boolean,
  ) {
    return this.visitsService.approveExtraService(visitId, visitServiceId, approved === true);
  }

  @RequirePermissions(Permission.ClinicalPriceRequest)
  @Put('visits/:id/services/:visitServiceId/price-adjustment')
  async requestServicePriceAdjustment(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body() body: any,
  ) {
    return this.visitsService.requestServicePriceAdjustment(visitId, visitServiceId, body, req.user.id, Number(req.user.role));
  }

  @RequirePermissions(Permission.ClinicalPriceApprove)
  @Put('visits/:id/services/:visitServiceId/price-adjustment/approval')
  async approveServicePriceAdjustment(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body('approved') approved: boolean,
  ) {
    return this.visitsService.approveServicePriceAdjustment(visitId, visitServiceId, approved === true, req.user.id);
  }

  @RequirePermissions(Permission.ClinicalServiceRemove)
  @Delete('visits/:id/services/:visitServiceId')
  async removeService(
    @Req() req: any,
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
  ) {
    return this.visitsService.removeExtraService(visitId, visitServiceId, Number(req.user.role));
  }

  // --- Capture Results ---
  @RequirePermissions(Permission.ClinicalResultWrite)
  @Post('visits/:id/results')
  async saveResult(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.saveVisitResult(visitId, body, req.user.id, Number(req.user.role));
  }

  // --- Prescriptions ---
  @RequirePermissions(Permission.ClinicalPrescriptionWrite)
  @Post('visits/:id/prescriptions')
  async savePrescription(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.savePrescription(visitId, body, req.user.id, Number(req.user.role));
  }

  private departmentForRole(role: number): string | undefined {
    if (role === Role.Laboratory) return 'LAB';
    if (role === Role.Scanning) return 'SCAN';
    return undefined;
  }
}

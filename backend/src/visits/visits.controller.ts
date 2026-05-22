import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  // --- Patients ---
  @Get('patients/search')
  async search(@Query('query') query: string) {
    return this.visitsService.searchPatients(query);
  }

  @Post('patients')
  async createPatient(@Body() body: any) {
    return this.visitsService.createPatient(body);
  }

  @Put('patients/:id')
  async updatePatient(@Param('id') id: string, @Body() body: any) {
    return this.visitsService.updatePatient(id, body);
  }

  @Get('patients/:id/history')
  async getHistory(@Param('id') patientId: string) {
    return this.visitsService.getPatientHistory(patientId);
  }

  // --- Visits ---
  @Get('visits/active')
  async getActive(@Query('department') department?: string) {
    return this.visitsService.getActiveVisits(department);
  }

  @Get('visits/:id')
  async getDetails(@Param('id') id: string) {
    return this.visitsService.findVisitById(id);
  }

  @Post('visits')
  async createVisit(@Req() req: any, @Body() body: any) {
    return this.visitsService.createVisit(body, req.user.id);
  }

  // --- Department Actions ---
  @Post('visits/:id/services')
  async addExtra(@Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.addExtraService(visitId, body);
  }

  @Put('visits/:id/services/:visitServiceId/status')
  async updateServiceStatus(
    @Param('id') visitId: string,
    @Param('visitServiceId') visitServiceId: string,
    @Body() body: any,
  ) {
    return this.visitsService.updateServiceStatus(visitId, visitServiceId, body);
  }

  // --- Capture Results ---
  @Post('visits/:id/results')
  async saveResult(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.saveVisitResult(visitId, body, req.user.id);
  }

  // --- Prescriptions ---
  @Post('visits/:id/prescriptions')
  async savePrescription(@Req() req: any, @Param('id') visitId: string, @Body() body: any) {
    return this.visitsService.savePrescription(visitId, body, req.user.id);
  }
}

import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // --- Departments ---
  @Get('departments')
  async getDepartments() {
    return this.servicesService.findAllDepartments();
  }

  @Post('departments')
  async createDepartment(@Req() req: any, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.createDepartment(body);
  }

  // --- Services ---
  @Get('services')
  async getServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;
    return this.servicesService.findAllServices(pageNum, limitNum, search);
  }

  @Post('services')
  async createService(@Req() req: any, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.createService(body);
  }

  @Put('services/:id')
  async updateService(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.updateService(id, body);
  }

  // --- Result Templates ---
  @Get('services/:id/template')
  async getTemplate(@Param('id') serviceId: string) {
    return this.servicesService.findTemplateByServiceId(serviceId);
  }

  @Post('services/:id/template')
  async saveTemplate(@Req() req: any, @Param('id') serviceId: string, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.saveTemplate(serviceId, body);
  }

  private ensureAdmin(user: any) {
    if (!user || user.role !== 0) {
      throw new ForbiddenException('Only admin accounts can perform setup actions');
    }
  }
}

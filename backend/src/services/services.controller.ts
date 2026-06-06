import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ForbiddenException, Query } from '@nestjs/common';
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

  @Delete('services/:id')
  async deleteService(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req.user);
    return this.servicesService.deleteService(id);
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

  // --- General Templates ---
  @Get('general-templates')
  async getGeneralTemplates(@Query('department') department?: string) {
    return this.servicesService.findAllGeneralTemplates(department);
  }

  @Get('general-templates/:id')
  async getGeneralTemplate(@Param('id') id: string) {
    return this.servicesService.findGeneralTemplateById(id);
  }

  @Post('general-templates')
  async createGeneralTemplate(@Req() req: any, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.createGeneralTemplate(body);
  }

  @Put('general-templates/:id')
  async updateGeneralTemplate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.ensureAdmin(req.user);
    return this.servicesService.updateGeneralTemplate(id, body);
  }

  @Delete('general-templates/:id')
  async deleteGeneralTemplate(@Req() req: any, @Param('id') id: string) {
    this.ensureAdmin(req.user);
    return this.servicesService.deleteGeneralTemplate(id);
  }

  private ensureAdmin(user: any) {
    if (!user || user.role !== 0) {
      throw new ForbiddenException('Only admin accounts can perform setup actions');
    }
  }
}

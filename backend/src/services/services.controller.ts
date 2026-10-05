import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // --- Departments ---
  @RequirePermissions(Permission.ClinicalCatalogueRead)
  @Get('departments')
  async getDepartments() {
    return this.servicesService.findAllDepartments();
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Post('departments')
  async createDepartment(@Req() req: any, @Body() body: any) {
    return this.servicesService.createDepartment(body, req.user.id);
  }

  // --- Services ---
  @RequirePermissions(Permission.ClinicalCatalogueRead)
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

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Post('services')
  async createService(@Req() req: any, @Body() body: any) {
    return this.servicesService.createService(body, req.user.id);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Put('services/:id')
  async updateService(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.servicesService.updateService(id, body, req.user.id);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Delete('services/:id')
  async deleteService(@Req() req: any, @Param('id') id: string) {
    return this.servicesService.deleteService(id, req.user.id);
  }

  // --- Result Templates ---
  @RequirePermissions(Permission.ClinicalCatalogueRead)
  @Get('services/:id/template')
  async getTemplate(@Param('id') serviceId: string) {
    return this.servicesService.findTemplateByServiceId(serviceId);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Post('services/:id/template')
  async saveTemplate(@Req() req: any, @Param('id') serviceId: string, @Body() body: any) {
    return this.servicesService.saveTemplate(serviceId, body, req.user.id);
  }

  // --- General Templates ---
  @RequirePermissions(Permission.ClinicalCatalogueRead)
  @Get('general-templates')
  async getGeneralTemplates(@Query('department') department?: string) {
    return this.servicesService.findAllGeneralTemplates(department);
  }

  @RequirePermissions(Permission.ClinicalCatalogueRead)
  @Get('general-templates/:id')
  async getGeneralTemplate(@Param('id') id: string) {
    return this.servicesService.findGeneralTemplateById(id);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Post('general-templates')
  async createGeneralTemplate(@Req() req: any, @Body() body: any) {
    return this.servicesService.createGeneralTemplate(body, req.user.id);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Put('general-templates/:id')
  async updateGeneralTemplate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.servicesService.updateGeneralTemplate(id, body, req.user.id);
  }

  @RequirePermissions(Permission.ClinicalCatalogueManage)
  @Delete('general-templates/:id')
  async deleteGeneralTemplate(@Req() req: any, @Param('id') id: string) {
    return this.servicesService.deleteGeneralTemplate(id, req.user.id);
  }
}

import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('products')
  async getProducts() {
    return this.pharmacyService.findAllProducts();
  }

  @Post('products')
  async createProduct(@Body() body: any) {
    return this.pharmacyService.createProduct(body);
  }

  @Post('products/:id/batches')
  async addBatch(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: any,
  ) {
    return this.pharmacyService.addBatch(productId, body, req.user.id);
  }

  @Get('prescriptions/active')
  async getActivePrescriptions() {
    return this.pharmacyService.getActivePrescriptions();
  }

  @Post('sales')
  async checkout(@Req() req: any, @Body() body: any) {
    return this.pharmacyService.processSale(body, req.user.id);
  }

  @Get('sales/unclosed')
  async getUnclosedSales(@Req() req: any) {
    return this.pharmacyService.getUnclosedSalesSummary(req.user.id);
  }

  @Post('sales/close')
  async closeSales(@Req() req: any, @Body() body: any) {
    return this.pharmacyService.closeSalesSession(req.user.id, body);
  }

  @Get('closures')
  async getClosures(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.pharmacyService.findAllClosures(startDate, endDate);
  }

  @Get('closures/:id')
  async getClosureById(@Param('id') id: string) {
    return this.pharmacyService.findClosureById(id);
  }
}


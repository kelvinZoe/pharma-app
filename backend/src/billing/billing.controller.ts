import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('visits/:id')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoice')
  async getInvoice(@Param('id') visitId: string) {
    return this.billingService.getVisitInvoice(visitId);
  }

  @Post('invoice/pay')
  async payInvoice(
    @Req() req: any,
    @Param('id') visitId: string,
    @Body() body: any,
  ) {
    return this.billingService.recordPayment(visitId, body, req.user.id);
  }
}

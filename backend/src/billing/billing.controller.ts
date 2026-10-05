import { Controller, Get, Post, Body, Param, UseGuards, Req, Query, Headers } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission, hasPermission } from '../auth/authorization/permissions';
import { IdempotencyService } from '../common/idempotency.service';

@Controller('visits/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @RequirePermissions(Permission.ClinicInvoiceRead)
  @Get('invoice')
  async getInvoice(@Req() req: any, @Param('id') visitId: string) {
    return this.billingService.getVisitInvoice(visitId);
  }

  @RequirePermissions(Permission.ClinicPaymentCreate)
  @Post('invoice/pay')
  async payInvoice(
    @Req() req: any,
    @Param('id') visitId: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_invoice_payment',
      req.user.id,
      { visitId, body },
      () => this.billingService.recordPayment(visitId, body, req.user.id),
    );
  }
}

@Controller('billing/sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingSessionsController {
  constructor(
    private readonly billingService: BillingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @RequirePermissions(Permission.ClinicSessionRead)
  @Get('active')
  async getActiveSession(@Req() req: any) {
    return this.billingService.findActiveClinicSession(req.user.id);
  }

  @RequirePermissions(Permission.ClinicSessionManage)
  @Post('open')
  async openSession(
    @Req() req: any,
    @Body('openingFloat') openingFloat: number,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_cash_session_open',
      req.user.id,
      { openingFloat },
      () => this.billingService.openClinicSession(req.user.id, openingFloat),
    );
  }

  @RequirePermissions(Permission.ClinicSessionManage)
  @Post('close')
  async closeSession(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_cash_session_close',
      req.user.id,
      { body },
      () => this.billingService.closeClinicSession(req.user.id, body),
    );
  }

  @RequirePermissions(Permission.ClinicSessionRead)
  @Get()
  async getSessions(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const canViewAll = hasPermission(req.user, Permission.ClinicSessionReadAll);
    return this.billingService.findClinicSessions(startDate, endDate, canViewAll ? undefined : req.user.id, Number(limit));
  }

  @RequirePermissions(Permission.ClinicSessionRead)
  @Get(':id')
  async getSession(@Req() req: any, @Param('id') id: string) {
    const canViewAll = hasPermission(req.user, Permission.ClinicSessionReadAll);
    return this.billingService.findClinicSessionById(id, canViewAll ? undefined : req.user.id);
  }
}

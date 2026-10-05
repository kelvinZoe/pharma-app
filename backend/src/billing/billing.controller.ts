import { Controller, Get, Post, Body, Param, UseGuards, Req, Query, ForbiddenException, Headers } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IdempotencyService } from '../common/idempotency.service';

@Controller('visits/:id')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('invoice')
  async getInvoice(@Req() req: any, @Param('id') visitId: string) {
    this.ensureClinicCashier(req.user);
    return this.billingService.getVisitInvoice(visitId);
  }

  @Post('invoice/pay')
  async payInvoice(
    @Req() req: any,
    @Param('id') visitId: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    this.ensureClinicCashier(req.user);
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_invoice_payment',
      req.user.id,
      { visitId, body },
      () => this.billingService.recordPayment(visitId, body, req.user.id),
    );
  }

  private ensureClinicCashier(user: any) {
    const roles = user?.roles
      ? (Array.isArray(user.roles) ? user.roles : String(user.roles).split(',').map(Number))
      : [user?.role];
    const canHandleClinicCash = roles.includes(0) || roles.includes(1) || roles.includes(5);
    if (!canHandleClinicCash) {
      throw new ForbiddenException('Only frontdesk, accounting, or admin users can manage clinic payments');
    }
  }
}

@Controller('billing/sessions')
@UseGuards(JwtAuthGuard)
export class BillingSessionsController {
  constructor(
    private readonly billingService: BillingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('active')
  async getActiveSession(@Req() req: any) {
    this.ensureClinicCashier(req.user);
    return this.billingService.findActiveClinicSession(req.user.id);
  }

  @Post('open')
  async openSession(
    @Req() req: any,
    @Body('openingFloat') openingFloat: number,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    this.ensureClinicCashier(req.user);
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_cash_session_open',
      req.user.id,
      { openingFloat },
      () => this.billingService.openClinicSession(req.user.id, openingFloat),
    );
  }

  @Post('close')
  async closeSession(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    this.ensureClinicCashier(req.user);
    return this.idempotency.run(
      idempotencyKey ?? legacyIdempotencyKey,
      'clinic_cash_session_close',
      req.user.id,
      { body },
      () => this.billingService.closeClinicSession(req.user.id, body),
    );
  }

  @Get()
  async getSessions(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureClinicCashier(req.user);
    const canViewAll = this.hasRole(req.user, 0) || this.hasRole(req.user, 5);
    return this.billingService.findClinicSessions(startDate, endDate, canViewAll ? undefined : req.user.id, Number(limit));
  }

  @Get(':id')
  async getSession(@Req() req: any, @Param('id') id: string) {
    this.ensureClinicCashier(req.user);
    const canViewAll = this.hasRole(req.user, 0) || this.hasRole(req.user, 5);
    return this.billingService.findClinicSessionById(id, canViewAll ? undefined : req.user.id);
  }

  private ensureClinicCashier(user: any) {
    const roles = user?.roles
      ? (Array.isArray(user.roles) ? user.roles : String(user.roles).split(',').map(Number))
      : [user?.role];
    const canHandleClinicCash = roles.includes(0) || roles.includes(1) || roles.includes(5);
    if (!canHandleClinicCash) {
      throw new ForbiddenException('Only frontdesk, accounting, or admin users can manage clinic cashier sessions');
    }
  }

  private hasRole(user: any, role: number): boolean {
    const roles = user?.roles
      ? (Array.isArray(user.roles) ? user.roles.map(Number) : String(user.roles).split(',').map(Number))
      : [Number(user?.role)];
    return roles.includes(role);
  }
}

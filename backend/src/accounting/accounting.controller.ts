import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IdempotencyService } from '../common/idempotency.service';
import { AccountingService } from './accounting.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('periods')
  listPeriods(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.authorize(req.user);
    return this.accounting.listPeriods(Number(page ?? 1), Number(limit ?? 50));
  }

  @Post('periods/lock')
  lockPeriod(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') key?: string,
  ) {
    this.authorize(req.user);
    return this.idempotency.run(
      key,
      'accounting_period_lock',
      req.user.id,
      body,
      () => this.accounting.lockPeriod(body, req.user.id),
    );
  }

  @Get('reversals')
  listReversals(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.authorize(req.user);
    return this.accounting.listReversals(
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  @Post('reversals')
  requestReversal(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') key?: string,
  ) {
    this.authorize(req.user);
    return this.idempotency.run(
      key,
      'financial_reversal_request',
      req.user.id,
      body,
      () => this.accounting.requestReversal(body, req.user.id),
    );
  }

  @Post('reversals/:id/approve')
  approveReversal(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    this.authorize(req.user);
    return this.idempotency.run(
      key,
      'financial_reversal_approve',
      req.user.id,
      { id },
      () => this.accounting.reviewReversal(id, req.user.id, true),
    );
  }

  @Post('reversals/:id/reject')
  rejectReversal(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('idempotency-key') key?: string,
  ) {
    this.authorize(req.user);
    return this.idempotency.run(
      key,
      'financial_reversal_reject',
      req.user.id,
      { id, reason },
      () => this.accounting.reviewReversal(id, req.user.id, false, reason),
    );
  }

  private authorize(user: any) {
    const roles = Array.isArray(user.roles)
      ? user.roles
      : String(user.roles ?? user.role)
          .split(',')
          .map(Number);
    if (!roles.includes(0) && !roles.includes(5))
      throw new ForbiddenException(
        'Only administrators and accounting staff can manage accounting periods and reversals.',
      );
  }
}

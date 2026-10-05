import {
  Body,
  Controller, Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission } from '../auth/authorization/permissions';
import { IdempotencyService } from '../common/idempotency.service';
import { AccountingService } from './accounting.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @RequirePermissions(Permission.AccountingPeriodRead)
  @Get('periods')
  listPeriods(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accounting.listPeriods(Number(page ?? 1), Number(limit ?? 50));
  }

  @RequirePermissions(Permission.AccountingPeriodLock)
  @Post('periods/lock')
  lockPeriod(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.idempotency.run(
      key,
      'accounting_period_lock',
      req.user.id,
      body,
      () => this.accounting.lockPeriod(body, req.user.id),
    );
  }

  @RequirePermissions(Permission.FinancialReversalRead)
  @Get('reversals')
  listReversals(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accounting.listReversals(
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  @RequirePermissions(Permission.FinancialReversalRequest)
  @Post('reversals')
  requestReversal(
    @Req() req: any,
    @Body() body: any,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.idempotency.run(
      key,
      'financial_reversal_request',
      req.user.id,
      body,
      () => this.accounting.requestReversal(body, req.user.id),
    );
  }

  @RequirePermissions(Permission.FinancialReversalReview)
  @Post('reversals/:id/approve')
  approveReversal(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.idempotency.run(
      key,
      'financial_reversal_approve',
      req.user.id,
      { id },
      () => this.accounting.reviewReversal(id, req.user.id, true),
    );
  }

  @RequirePermissions(Permission.FinancialReversalReview)
  @Post('reversals/:id/reject')
  rejectReversal(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.idempotency.run(
      key,
      'financial_reversal_reject',
      req.user.id,
      { id, reason },
      () => this.accounting.reviewReversal(id, req.user.id, false, reason),
    );
  }
}

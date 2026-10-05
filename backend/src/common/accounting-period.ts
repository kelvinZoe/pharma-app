import { BadRequestException, ConflictException } from '@nestjs/common';
import { TenantContextService } from './multitenancy/tenant-context.service';

export async function assertAccountingDateOpen(
  tx: any,
  date: Date,
): Promise<void> {
  if (!Number.isFinite(date.getTime()))
    throw new BadRequestException('A valid accounting date is required');
  const tenantId = TenantContextService.getTenantId();
  if (!tenantId) throw new BadRequestException('Tenant context is required');
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 0))::text`;
  const period = await tx.accountingPeriod.findFirst({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true },
  });
  if (period)
    throw new ConflictException(
      'This accounting period is locked. Request a reversal to correct a posted entry.',
    );
}

export async function assertNoFinancialReversal(
  tx: any,
  entityType: string,
  entityId: string,
): Promise<void> {
  const reversal = await tx.financialReversal.findFirst({
    where: { entityType, entityId, status: { in: ['pending', 'approved'] } },
    select: { id: true },
  });
  if (reversal)
    throw new ConflictException(
      'This entry already has a pending or approved reversal.',
    );
}

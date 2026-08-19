import { ForbiddenException } from '@nestjs/common';
import { VisitsService } from './visits.service';

describe('VisitsService department isolation', () => {
  it('prevents laboratory staff from adjusting a scanning service', async () => {
    const prisma = {
      visitService: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1',
          visitId: 'visit-1',
          status: 'pending',
          lineTotal: 100,
          priceAdjustmentStatus: 'none',
          visit: { invoice: { amountPaid: 0, status: 'draft' } },
          service: { name: 'Ultrasound', department: { code: 'SCAN' } },
        }),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new VisitsService(prisma, { create: jest.fn() } as any);

    await expect(service.requestServicePriceAdjustment(
      'visit-1',
      'line-1',
      { requestedLineTotal: 150, reason: 'Complex case' },
      'lab-user',
      2,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

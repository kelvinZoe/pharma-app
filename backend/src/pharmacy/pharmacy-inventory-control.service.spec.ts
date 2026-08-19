import { BadRequestException, ConflictException } from '@nestjs/common';
import { PharmacyInventoryControlService } from './pharmacy-inventory-control.service';

describe('PharmacyInventoryControlService controls', () => {
  it('prevents an adjustment maker from approving their own request', async () => {
    const prisma = {
      pharmacyStockAdjustment: { findFirst: jest.fn().mockResolvedValue({ id: 'adjustment-1', status: 'pending', createdByUserId: 'user-1' }) },
      $transaction: jest.fn(),
    } as any;
    const service = new PharmacyInventoryControlService(prisma);
    await expect(service.approveAdjustment('adjustment-1', 'user-1', 'location-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails safely when another approval already claimed a stock count', async () => {
    const count = { id: 'count-1', status: 'submitted', createdByUserId: 'maker', lines: [] };
    const tx = { pharmacyStockCount: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const prisma = {
      pharmacyStockCount: { findFirst: jest.fn().mockResolvedValue(count) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new PharmacyInventoryControlService(prisma);
    await expect(service.approveCount('count-1', 'approver', 'location-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

import { BadRequestException, ConflictException } from '@nestjs/common';
import { PharmacyTransferService } from './pharmacy-transfer.service';

describe('PharmacyTransferService controls', () => {
  const transfer = {
    id: 'transfer-1',
    status: 'requested',
    requestedByUserId: 'maker',
    sourceLocationId: 'source-1',
    destinationLocationId: 'destination-1',
    lines: [],
    sourceLocation: { name: 'Source' },
    destinationLocation: { name: 'Destination' },
  };

  it('prevents a transfer requester from approving the same transfer', async () => {
    const prisma = { pharmacyTransfer: { findFirst: jest.fn().mockResolvedValue(transfer) }, $transaction: jest.fn() } as any;
    const service = new PharmacyTransferService(prisma, { create: jest.fn() } as any);
    await expect(service.approveTransfer('transfer-1', { lines: [] }, 'maker', 'source-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a stale dispatch before any stock is changed', async () => {
    const approved = { ...transfer, status: 'approved', requestedByUserId: 'maker' };
    const tx = {
      pharmacyTransfer: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      pharmacyBatch: { updateMany: jest.fn() },
    };
    const prisma = {
      pharmacyTransfer: { findFirst: jest.fn().mockResolvedValue(approved) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new PharmacyTransferService(prisma, { create: jest.fn() } as any);
    await expect(service.dispatchTransfer('transfer-1', {}, 'dispatcher', 'source-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.pharmacyBatch.updateMany).not.toHaveBeenCalled();
  });
});

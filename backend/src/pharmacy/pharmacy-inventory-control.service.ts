import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import * as crypto from 'crypto';

@Injectable()
export class PharmacyInventoryControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(locationId: string) {
    const [pendingCounts, pendingAdjustments, movements] = await Promise.all([
      this.prisma.pharmacyStockCount.count({ where: { locationId, status: { in: ['counting', 'submitted'] } } }),
      this.prisma.pharmacyStockAdjustment.count({ where: { locationId, status: 'pending' } }),
      this.prisma.pharmacyStockMovement.count({ where: { locationId } }),
    ]);
    return { pendingCounts, pendingAdjustments, movementCount: movements };
  }

  async listLedger(locationId: string, query: any) {
    const movementType = String(query.movementType ?? '').trim();
    const productId = String(query.productId ?? '').trim();
    const batchId = String(query.batchId ?? '').trim();
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;
    if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) throw new BadRequestException('Ledger dates are invalid');
    if (endDate) endDate.setUTCHours(23, 59, 59, 999);
    return this.prisma.pharmacyStockMovement.findMany({
      where: {
        locationId,
        ...(movementType ? { movementType } : {}),
        ...(productId ? { productId } : {}),
        ...(batchId ? { batchId } : {}),
        ...(startDate || endDate ? { createdAt: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } } : {}),
      },
      include: {
        product: { select: { id: true, productCode: true, name: true, unitOfMeasure: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        createdByUser: { select: { fullName: true, username: true } },
        location: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async listCounts(locationId: string) {
    const counts = await this.prisma.pharmacyStockCount.findMany({
      where: { locationId },
      include: { createdBy: { select: { fullName: true, username: true } }, approvedBy: { select: { fullName: true, username: true } }, lines: { select: { expectedQty: true, countedQty: true, varianceQty: true, varianceCost: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return counts.map((count) => ({ ...count, lineCount: count.lines.length, countedLines: count.lines.filter((line) => line.countedQty !== null).length, varianceUnits: count.lines.reduce((sum, line) => sum + Number(line.varianceQty ?? 0), 0), varianceCost: count.lines.reduce((sum, line) => sum + Number(line.varianceCost ?? 0), 0) }));
  }

  async findCount(countId: string, locationId: string) {
    const count = await this.prisma.pharmacyStockCount.findFirst({
      where: { id: countId, locationId },
      include: { location: true, createdBy: { select: { fullName: true, username: true } }, approvedBy: { select: { fullName: true, username: true } }, lines: { include: { product: true, batch: true, adjustment: true }, orderBy: [{ product: { name: 'asc' } }, { batch: { expiryDate: 'asc' } }] } },
    });
    if (!count) throw new NotFoundException('Stock count not found');
    return count;
  }

  async createCount(data: any, userId: string, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const active = await this.prisma.pharmacyStockCount.findFirst({ where: { locationId, status: { in: ['counting', 'updating', 'submitting', 'submitted', 'posting'] } }, select: { countNumber: true } });
    if (active) throw new ConflictException(`Complete or cancel active count ${active.countNumber} first`);
    const countType = String(data.countType ?? 'cycle').trim().toLowerCase();
    if (!['full', 'cycle'].includes(countType)) throw new BadRequestException('Count type must be full or cycle');
    const selectedBatchIds: string[] = Array.isArray(data.batchIds) ? [...new Set<string>(data.batchIds.map((id: any) => String(id).trim()).filter(Boolean))] : [];
    if (countType === 'cycle' && selectedBatchIds.length === 0) throw new BadRequestException('Select at least one batch for a cycle count');
    const batches = await this.prisma.pharmacyBatch.findMany({
      where: { locationId, ...(countType === 'cycle' ? { id: { in: selectedBatchIds } } : {}) },
      include: { product: true },
      orderBy: [{ product: { name: 'asc' } }, { expiryDate: 'asc' }],
    });
    if (batches.length === 0) throw new BadRequestException('No batches are available for this stock count');
    if (countType === 'cycle' && batches.length !== selectedBatchIds.length) throw new BadRequestException('One or more selected batches are unavailable at this location');
    const countNumber = `SC-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const count = await tx.pharmacyStockCount.create({
          data: { tenantId: location.tenantId, locationId, createdByUserId: userId, countNumber, countType, status: 'counting', snapshotAt: getInternetDate(), notes: data.notes ? String(data.notes).trim() : null, lines: { create: batches.map((batch) => ({ tenantId: location.tenantId, productId: batch.productId, batchId: batch.id, expectedQty: batch.quantityRemaining, unitCost: batch.purchasePrice })) } },
          include: { lines: { include: { product: true, batch: true } } },
        });
        await tx.auditLog.create({
          data: { actionType: 'create', entityType: 'pharmacy_stock_count', entityId: count.id, afterData: JSON.stringify({ countNumber, countType, locationId, lineCount: batches.length }), actorUserId: userId },
        });
        return count;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Another active stock count already exists for this location');
      throw error;
    }
  }

  async saveCount(countId: string, data: any, userId: string, locationId: string) {
    const count = await this.requireCount(countId, locationId);
    if (count.status !== 'counting') throw new ConflictException('Only an active counting session can be updated');
    const inputLines = Array.isArray(data.lines) ? data.lines : [];
    const countLines = new Map(count.lines.map((line: any) => [line.id, line]));
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyStockCount.updateMany({
        where: { id: countId, locationId, status: 'counting' },
        data: { status: 'updating' },
      });
      if (claim.count !== 1) throw new ConflictException('The stock count is being submitted or changed');
      for (const input of inputLines) {
        const line = countLines.get(String(input.id ?? ''));
        if (!line) throw new BadRequestException('A submitted count line is invalid');
        const countedQty = input.countedQty === null || input.countedQty === '' ? null : Number(input.countedQty);
        if (countedQty !== null && (!Number.isFinite(countedQty) || countedQty < 0)) throw new BadRequestException('Counted quantities cannot be negative');
        const varianceQty = countedQty === null ? null : countedQty - Number(line.expectedQty);
        await tx.pharmacyStockCountLine.update({ where: { id: line.id }, data: { countedQty, varianceQty, varianceCost: varianceQty === null ? null : varianceQty * Number(line.unitCost), notes: input.notes ? String(input.notes).trim() : null } });
      }
      await tx.auditLog.create({
        data: { actionType: 'update', entityType: 'pharmacy_stock_count', entityId: countId, afterData: JSON.stringify({ updatedLines: inputLines.length }), actorUserId: userId },
      });
      return tx.pharmacyStockCount.update({ where: { id: countId }, data: { status: 'counting' }, include: { lines: { include: { product: true, batch: true } } } });
    });
  }

  async submitCount(countId: string, userId: string, locationId: string) {
    const count = await this.requireCount(countId, locationId);
    if (count.status !== 'counting') throw new ConflictException('Only an active count can be submitted');
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyStockCount.updateMany({
        where: { id: countId, locationId, status: 'counting' },
        data: { status: 'submitting' },
      });
      if (claim.count !== 1) throw new ConflictException('The stock count changed. Refresh and try again.');
      const current = await tx.pharmacyStockCount.findUniqueOrThrow({ where: { id: countId }, include: { lines: true } });
      if (current.lines.some((line: any) => line.countedQty === null)) throw new BadRequestException('Every batch requires a physical quantity before submission');
      await tx.pharmacyStockCount.update({ where: { id: countId }, data: { status: 'submitted', submittedAt: getInternetDate() } });
      await tx.auditLog.create({
        data: { actionType: 'submit', entityType: 'pharmacy_stock_count', entityId: countId, afterData: JSON.stringify({ status: 'submitted' }), actorUserId: userId },
      });
      return tx.pharmacyStockCount.findUniqueOrThrow({ where: { id: countId } });
    });
  }

  async approveCount(countId: string, approverId: string, locationId: string) {
    const count = await this.requireCount(countId, locationId);
    if (count.status !== 'submitted') throw new ConflictException('Only a submitted count can be approved');
    if (count.createdByUserId === approverId) throw new BadRequestException('The stock-count maker cannot approve the same count');
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyStockCount.updateMany({
        where: { id: countId, locationId, status: 'submitted', createdByUserId: { not: approverId } },
        data: { status: 'posting' },
      });
      if (claim.count !== 1) throw new ConflictException('The stock count was already handled or cannot be self-approved');
      for (const line of count.lines as any[]) {
        const currentBatch = await tx.pharmacyBatch.findFirst({ where: { id: line.batchId, locationId } });
        if (!currentBatch) throw new NotFoundException(`Batch ${line.batchId} is no longer available`);
        if (Math.abs(Number(currentBatch.quantityRemaining) - Number(line.expectedQty)) > 0.000001) throw new ConflictException(`Stock changed for batch ${currentBatch.batchNumber} after counting began. Start a new count.`);
        const countedQty = Number(line.countedQty);
        const variance = countedQty - Number(line.expectedQty);
        if (Math.abs(variance) < 0.000001) continue;
        const adjustmentNumber = `ADJ-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        if (countedQty + 0.000001 < Number(currentBatch.quantityReserved ?? 0) + Number(currentBatch.quantityQuarantined ?? 0)) throw new ConflictException(`Counted stock for batch ${currentBatch.batchNumber} is below its reserved and quarantined quantity.`);
        const batchUpdate = await tx.pharmacyBatch.updateMany({
          where: { id: line.batchId, locationId, quantityRemaining: currentBatch.quantityRemaining, quantityReserved: currentBatch.quantityReserved, quantityQuarantined: currentBatch.quantityQuarantined },
          data: { quantityRemaining: countedQty },
        });
        if (batchUpdate.count !== 1) throw new ConflictException(`Stock changed for batch ${currentBatch.batchNumber}. Approval was not posted.`);
        const adjustment = await tx.pharmacyStockAdjustment.create({ data: { tenantId: count.tenantId, locationId, productId: line.productId, batchId: line.batchId, stockCountId: count.id, stockCountLineId: line.id, createdByUserId: count.createdByUserId, approvedByUserId: approverId, adjustmentNumber, adjustmentType: 'count_correction', status: 'posted', quantity: Math.abs(variance), quantityBefore: Number(line.expectedQty), quantityAfter: countedQty, unitCost: line.unitCost, reason: `Approved stock count ${count.countNumber}`, approvedAt: getInternetDate(), postedAt: getInternetDate() } });
        await tx.pharmacyStockMovement.create({ data: { tenantId: count.tenantId, locationId, productId: line.productId, batchId: line.batchId, movementType: 'count_correction', quantity: variance, quantityBefore: Number(line.expectedQty), quantityAfter: countedQty, unitCost: line.unitCost, referenceId: adjustment.id, referenceType: 'stock_adjustment', reason: adjustment.reason, createdByUserId: approverId } });
      }
      const posted = await tx.pharmacyStockCount.update({ where: { id: count.id }, data: { status: 'posted', approvedByUserId: approverId, approvedAt: getInternetDate(), postedAt: getInternetDate() }, include: { lines: { include: { product: true, batch: true, adjustment: true } } } });
      await tx.auditLog.create({
        data: { actionType: 'approve', entityType: 'pharmacy_stock_count', entityId: count.id, beforeData: JSON.stringify({ status: 'submitted' }), afterData: JSON.stringify({ status: 'posted', varianceLines: count.lines.filter((line: any) => Math.abs(Number(line.varianceQty ?? 0)) > 0.000001).length }), actorUserId: approverId },
      });
      return posted;
    });
  }

  async listAdjustments(locationId: string) {
    return this.prisma.pharmacyStockAdjustment.findMany({ where: { locationId }, include: { product: true, batch: true, createdBy: { select: { fullName: true, username: true } }, approvedBy: { select: { fullName: true, username: true } } }, orderBy: { requestedAt: 'desc' }, take: 200 });
  }

  async requestAdjustment(data: any, userId: string, locationId: string) {
    const batchId = String(data.batchId ?? '').trim();
    const batch = await this.prisma.pharmacyBatch.findFirst({ where: { id: batchId, locationId }, include: { product: true, location: true } });
    if (!batch || !batch.location) throw new NotFoundException('Batch not found at the active location');
    const adjustmentType = String(data.adjustmentType ?? '').trim().toLowerCase();
    if (!['damage', 'expiry', 'loss', 'correction_in', 'correction_out'].includes(adjustmentType)) throw new BadRequestException('Select a valid adjustment type');
    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Adjustment quantity must be greater than zero');
    const availableStock = Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0));
    if (!adjustmentType.endsWith('_in') && quantity > availableStock + 0.000001) throw new BadRequestException('Adjustment quantity exceeds stock not reserved for transfer');
    if (adjustmentType === 'expiry' && batch.expiryDate > getInternetDate()) throw new BadRequestException('Only an expired batch can use the expiry write-off type');
    const reason = String(data.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A detailed adjustment reason is required');
    const adjustmentNumber = `ADJ-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.pharmacyStockAdjustment.create({ data: { tenantId: batch.location!.tenantId, locationId, productId: batch.productId, batchId, createdByUserId: userId, adjustmentNumber, adjustmentType, quantity, unitCost: batch.purchasePrice, reason, notes: data.notes ? String(data.notes).trim() : null, status: 'pending' }, include: { product: true, batch: true } });
      await tx.auditLog.create({
        data: { actionType: 'request', entityType: 'pharmacy_stock_adjustment', entityId: adjustment.id, afterData: JSON.stringify({ adjustmentNumber, adjustmentType, quantity, batchId, reason }), actorUserId: userId },
      });
      return adjustment;
    });
  }

  async approveAdjustment(adjustmentId: string, approverId: string, locationId: string) {
    const adjustment = await this.requireAdjustment(adjustmentId, locationId);
    if (adjustment.status !== 'pending') throw new ConflictException('Only a pending adjustment can be approved');
    if (adjustment.createdByUserId === approverId) throw new BadRequestException('The adjustment maker cannot approve the same adjustment');
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyStockAdjustment.updateMany({
        where: { id: adjustmentId, locationId, status: 'pending', createdByUserId: { not: approverId } },
        data: { status: 'posting' },
      });
      if (claim.count !== 1) throw new ConflictException('The stock adjustment was already handled or cannot be self-approved');
      const batch = await tx.pharmacyBatch.findFirst({ where: { id: adjustment.batchId, locationId } });
      if (!batch) throw new NotFoundException('Adjustment batch not found');
      const isIncrease = adjustment.adjustmentType === 'correction_in';
      const delta = isIncrease ? Number(adjustment.quantity) : -Number(adjustment.quantity);
      const after = Number(batch.quantityRemaining) + delta;
      if (after < -0.000001) throw new ConflictException('Current stock is lower than the requested write-off quantity');
      if (!isIncrease && after + 0.000001 < Number(batch.quantityReserved ?? 0) + Number(batch.quantityQuarantined ?? 0)) throw new ConflictException('This adjustment would consume stock reserved or quarantined for review');
      const updated = await tx.pharmacyBatch.updateMany({ where: { id: batch.id, locationId, quantityRemaining: batch.quantityRemaining, quantityReserved: batch.quantityReserved, quantityQuarantined: batch.quantityQuarantined }, data: { quantityRemaining: after } });
      if (updated.count !== 1) throw new ConflictException('Batch stock changed. Refresh and review the adjustment again.');
      const posted = await tx.pharmacyStockAdjustment.update({ where: { id: adjustment.id }, data: { status: 'posted', approvedByUserId: approverId, approvedAt: getInternetDate(), postedAt: getInternetDate(), quantityBefore: batch.quantityRemaining, quantityAfter: after } });
      await tx.pharmacyStockMovement.create({ data: { tenantId: adjustment.tenantId, locationId, productId: adjustment.productId, batchId: adjustment.batchId, movementType: this.movementTypeForAdjustment(adjustment.adjustmentType), quantity: delta, quantityBefore: batch.quantityRemaining, quantityAfter: after, unitCost: adjustment.unitCost, referenceId: adjustment.id, referenceType: 'stock_adjustment', reason: adjustment.reason, createdByUserId: approverId } });
      await tx.auditLog.create({
        data: { actionType: 'approve', entityType: 'pharmacy_stock_adjustment', entityId: adjustment.id, beforeData: JSON.stringify({ status: 'pending', quantityBefore: Number(batch.quantityRemaining) }), afterData: JSON.stringify({ status: 'posted', quantityAfter: after }), actorUserId: approverId },
      });
      return posted;
    });
  }

  async rejectAdjustment(adjustmentId: string, approverId: string, locationId: string, reason?: string) {
    const adjustment = await this.requireAdjustment(adjustmentId, locationId);
    if (adjustment.status !== 'pending') throw new ConflictException('Only a pending adjustment can be rejected');
    if (adjustment.createdByUserId === approverId) throw new BadRequestException('The adjustment maker cannot reject the same adjustment');
    return this.prisma.$transaction(async (tx) => {
      const rejected = await tx.pharmacyStockAdjustment.updateMany({
        where: { id: adjustment.id, locationId, status: 'pending', createdByUserId: { not: approverId } },
        data: { status: 'rejected', approvedByUserId: approverId, rejectedAt: getInternetDate(), notes: [adjustment.notes, reason ? `Rejection: ${String(reason).trim()}` : 'Rejected by administrator'].filter(Boolean).join('\n') },
      });
      if (rejected.count !== 1) throw new ConflictException('The stock adjustment was already handled or cannot be self-reviewed');
      await tx.auditLog.create({
        data: { actionType: 'reject', entityType: 'pharmacy_stock_adjustment', entityId: adjustment.id, beforeData: JSON.stringify({ status: 'pending' }), afterData: JSON.stringify({ status: 'rejected', reason: String(reason ?? '').trim() || null }), actorUserId: approverId },
      });
      return tx.pharmacyStockAdjustment.findUniqueOrThrow({ where: { id: adjustment.id } });
    });
  }

  private movementTypeForAdjustment(type: string): string { return ({ damage: 'damage', expiry: 'expiry', loss: 'adjustment_out', correction_out: 'adjustment_out', correction_in: 'adjustment_in' } as Record<string, string>)[type] ?? 'adjustment_out'; }
  private async requireCount(id: string, locationId: string) { const count = await this.prisma.pharmacyStockCount.findFirst({ where: { id, locationId }, include: { lines: true } }); if (!count) throw new NotFoundException('Stock count not found'); return count; }
  private async requireAdjustment(id: string, locationId: string) { const adjustment = await this.prisma.pharmacyStockAdjustment.findFirst({ where: { id, locationId } }); if (!adjustment) throw new NotFoundException('Stock adjustment not found'); return adjustment; }
}

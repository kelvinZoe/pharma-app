import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getInternetDate } from '../common/clock';
import * as crypto from 'crypto';

@Injectable()
export class PharmacyTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSummary(locationId: string) {
    const [outgoing, incoming, inTransit, discrepancies] = await Promise.all([
      this.prisma.pharmacyTransfer.count({ where: { sourceLocationId: locationId, status: { in: ['draft', 'requested', 'approved'] } } }),
      this.prisma.pharmacyTransfer.count({ where: { destinationLocationId: locationId, status: 'dispatched' } }),
      this.prisma.pharmacyTransfer.count({ where: { OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }], status: 'dispatched' } }),
      this.prisma.pharmacyTransfer.count({ where: { OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }], status: 'discrepancy_review' } }),
    ]);
    return { outgoing, incoming, inTransit, discrepancies };
  }

  async listTransfers(locationId: string, query: any = {}) {
    const status = String(query.status ?? '').trim();
    const direction = String(query.direction ?? 'all').trim();
    const locationWhere = direction === 'outgoing'
      ? { sourceLocationId: locationId }
      : direction === 'incoming'
        ? { destinationLocationId: locationId }
        : { OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }] };

    return this.prisma.pharmacyTransfer.findMany({
      where: { ...locationWhere, ...(status ? { status } : {}) },
      include: {
        sourceLocation: { select: { id: true, code: true, name: true } },
        destinationLocation: { select: { id: true, code: true, name: true } },
        requestedBy: { select: { fullName: true, username: true } },
        lines: { include: { product: { select: { name: true, productCode: true, unitOfMeasure: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findTransfer(transferId: string, locationId: string) {
    const transfer = await this.prisma.pharmacyTransfer.findFirst({
      where: { id: transferId, OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }] },
      include: this.detailInclude(),
    });
    if (!transfer) throw new NotFoundException('Stock transfer not found for the active location');
    return transfer;
  }

  async createTransfer(data: any, userId: string, sourceLocationId: string, allowFefoOverride = false) {
    const source = await this.prisma.pharmacyLocation.findUnique({ where: { id: sourceLocationId } });
    if (!source || !source.isActive) throw new NotFoundException('Active source pharmacy location not found');

    const destinationLocationId = String(data.destinationLocationId ?? '').trim();
    if (!destinationLocationId || destinationLocationId === sourceLocationId) {
      throw new BadRequestException('Select a different destination pharmacy location');
    }
    const destination = await this.prisma.pharmacyLocation.findFirst({ where: { id: destinationLocationId, isActive: true } });
    if (!destination) throw new NotFoundException('Active destination pharmacy location not found');

    const reason = String(data.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A clear transfer reason is required');
    const inputLines = Array.isArray(data.lines) ? data.lines : [];
    if (!inputLines.length) throw new BadRequestException('Add at least one stock batch to the transfer');

    const uniqueBatchIds = new Set<string>();
    const lines: any[] = [];
    for (let index = 0; index < inputLines.length; index += 1) {
      const input = inputLines[index];
      const sourceBatchId = String(input.sourceBatchId ?? '').trim();
      const requestedQty = Number(input.requestedQty);
      if (!sourceBatchId || !Number.isFinite(requestedQty) || requestedQty <= 0) {
        throw new BadRequestException(`Transfer line ${index + 1} requires a batch and positive quantity`);
      }
      if (uniqueBatchIds.has(sourceBatchId)) throw new BadRequestException('A batch can appear only once in a transfer');
      uniqueBatchIds.add(sourceBatchId);

      const batch = await this.prisma.pharmacyBatch.findFirst({
        where: { id: sourceBatchId, locationId: sourceLocationId },
        include: { product: true },
      });
      if (!batch) throw new NotFoundException(`Source batch for line ${index + 1} was not found`);
      if (batch.expiryDate <= getInternetDate()) throw new BadRequestException(`${batch.product.name} batch ${batch.batchNumber} is expired and cannot be transferred`);
      const available = this.availableQuantity(batch);
      if (requestedQty > available + 0.000001) {
        throw new BadRequestException(`${batch.product.name} batch ${batch.batchNumber} has only ${available} available for transfer`);
      }
      lines.push({
        tenantId: source.tenantId,
        productId: batch.productId,
        sourceBatchId: batch.id,
        requestedQty,
        unitCost: batch.purchasePrice,
        sellingPrice: batch.sellingPrice,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        storageInstructions: batch.product.storageInstructions,
      });
    }

    let requiresFefoOverride = false;
    for (const productId of [...new Set(lines.map((line) => line.productId))]) {
      const productLines = lines.filter((line) => line.productId === productId);
      let quantityToAllocate = productLines.reduce((sum, line) => sum + Number(line.requestedQty), 0);
      const expectedAllocation = new Map<string, number>();
      const fefoBatches = await this.prisma.pharmacyBatch.findMany({ where: { locationId: sourceLocationId, productId, expiryDate: { gt: getInternetDate() } }, orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] });
      for (const batch of fefoBatches) {
        if (quantityToAllocate <= 0.000001) break;
        const quantity = Math.min(quantityToAllocate, this.availableQuantity(batch));
        if (quantity > 0) expectedAllocation.set(batch.id, quantity);
        quantityToAllocate -= quantity;
      }
      requiresFefoOverride ||= productLines.some((line) => Number(line.requestedQty) > Number(expectedAllocation.get(line.sourceBatchId) ?? 0) + 0.000001);
    }
    const fefoOverrideReason = this.optionalText(data.fefoOverrideReason);
    if (requiresFefoOverride && (!allowFefoOverride || !fefoOverrideReason || fefoOverrideReason.length < 5)) {
      throw new BadRequestException('Transfer batches must follow FEFO. An administrator may provide a documented FEFO override reason.');
    }

    const transferNumber = this.reference('TRF');
    const transfer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pharmacyTransfer.create({
        data: {
          tenantId: source.tenantId,
          sourceLocationId,
          destinationLocationId,
          requestedByUserId: userId,
          transferNumber,
          status: 'draft',
          reason,
          fefoOverrideReason: requiresFefoOverride ? fefoOverrideReason : null,
          notes: this.optionalText(data.notes),
          lines: { create: lines },
        },
        include: this.detailInclude(),
      });
      await tx.auditLog.create({
        data: { actionType: 'create', entityType: 'pharmacy_transfer', entityId: created.id, afterData: JSON.stringify({ transferNumber, sourceLocationId, destinationLocationId, lineCount: lines.length, reason }), actorUserId: userId },
      });
      return created;
    });
    return transfer;
  }

  async submitTransfer(transferId: string, userId: string, locationId: string, isAdmin: boolean) {
    const transfer = await this.requireTransfer(transferId, locationId, 'source');
    if (transfer.status !== 'draft') throw new ConflictException('Only a draft transfer can be submitted');
    if (!isAdmin && transfer.requestedByUserId !== userId) throw new BadRequestException('Only the transfer creator can submit this draft');
    if (!transfer.lines.length) throw new BadRequestException('The transfer has no stock lines');
    const submitted = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, sourceLocationId: locationId, status: 'draft', ...(!isAdmin ? { requestedByUserId: userId } : {}) },
        data: { status: 'requested', requestedAt: getInternetDate() },
      });
      if (claim.count !== 1) throw new ConflictException('The transfer changed. Refresh and try again.');
      await tx.auditLog.create({
        data: { actionType: 'submit', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'draft' }), afterData: JSON.stringify({ status: 'requested' }), actorUserId: userId },
      });
      return tx.pharmacyTransfer.findUniqueOrThrow({ where: { id: transfer.id }, include: this.detailInclude() });
    });
    await this.notificationsService.create({
      title: 'Stock transfer awaiting approval',
      message: `${transfer.transferNumber} requests stock from ${transfer.sourceLocation.name} to ${transfer.destinationLocation.name}.`,
      type: 'warning', module: 'pharmacy', targetRole: 0, entityType: 'pharmacyTransfer', entityId: transfer.id, route: '/pharmacy/transfers',
    });
    return submitted;
  }

  async approveTransfer(transferId: string, data: any, approverId: string, sourceLocationId: string) {
    const transfer = await this.requireTransfer(transferId, sourceLocationId, 'source');
    if (transfer.status !== 'requested') throw new ConflictException('Only a requested transfer can be approved');
    if (transfer.requestedByUserId === approverId) throw new BadRequestException('The transfer requester cannot approve the same transfer');
    const quantities = new Map<string, number>((Array.isArray(data.lines) ? data.lines : []).map((line: any) => [String(line.id), Number(line.approvedQty)]));

    const approved = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, sourceLocationId, status: 'requested', requestedByUserId: { not: approverId } },
        data: { status: 'approving' },
      });
      if (claim.count !== 1) throw new ConflictException('The transfer was already handled or cannot be self-approved');
      let approvedLineCount = 0;
      for (const line of transfer.lines) {
        const approvedQty = quantities.has(line.id) ? Number(quantities.get(line.id)) : Number(line.requestedQty);
        if (!Number.isFinite(approvedQty) || approvedQty < 0 || approvedQty > Number(line.requestedQty) + 0.000001) {
          throw new BadRequestException(`Invalid approved quantity for ${line.product.name}`);
        }
        const batch = await tx.pharmacyBatch.findFirst({ where: { id: line.sourceBatchId, locationId: sourceLocationId } });
        if (!batch) throw new NotFoundException(`Source batch ${line.batchNumber} no longer exists`);
        const available = this.availableQuantity(batch);
        if (approvedQty > available + 0.000001) throw new ConflictException(`${line.product.name} batch ${line.batchNumber} now has only ${available} available`);
        if (approvedQty > 0) {
          const reserved = await tx.pharmacyBatch.updateMany({
            where: { id: batch.id, locationId: sourceLocationId, quantityRemaining: batch.quantityRemaining, quantityReserved: batch.quantityReserved },
            data: { quantityReserved: { increment: approvedQty } },
          });
          if (reserved.count !== 1) throw new ConflictException(`Stock changed for batch ${line.batchNumber}. Review the transfer again.`);
          approvedLineCount += 1;
        }
        await tx.pharmacyTransferLine.update({ where: { id: line.id }, data: { approvedQty } });
      }
      if (!approvedLineCount) throw new BadRequestException('Approve a quantity on at least one transfer line');
      const posted = await tx.pharmacyTransfer.update({
        where: { id: transfer.id },
        data: { status: 'approved', approvedByUserId: approverId, approvedAt: getInternetDate(), notes: this.appendNote(transfer.notes, data.notes) },
        include: this.detailInclude(),
      });
      await tx.auditLog.create({
        data: { actionType: 'approve', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'requested' }), afterData: JSON.stringify({ status: 'approved', approvedLines: approvedLineCount }), actorUserId: approverId },
      });
      return posted;
    });

    await this.notifyLocation(transfer.sourceLocationId, 'Transfer approved and stock reserved', `${transfer.transferNumber} is approved for dispatch to ${transfer.destinationLocation.name}.`, transfer.id);
    return approved;
  }

  async rejectTransfer(transferId: string, reason: string, approverId: string, sourceLocationId: string) {
    const transfer = await this.requireTransfer(transferId, sourceLocationId, 'source');
    if (transfer.status !== 'requested') throw new ConflictException('Only a requested transfer can be rejected');
    if (transfer.requestedByUserId === approverId) throw new BadRequestException('The transfer requester cannot reject the same transfer');
    const rejectionReason = String(reason ?? '').trim();
    if (rejectionReason.length < 3) throw new BadRequestException('Provide a rejection reason');
    return this.prisma.$transaction(async (tx) => {
      const rejected = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, sourceLocationId, status: 'requested', requestedByUserId: { not: approverId } },
        data: { status: 'rejected', approvedByUserId: approverId, rejectedAt: getInternetDate(), notes: this.appendNote(transfer.notes, `Rejection: ${rejectionReason}`) },
      });
      if (rejected.count !== 1) throw new ConflictException('The transfer was already handled or cannot be self-reviewed');
      await tx.auditLog.create({
        data: { actionType: 'reject', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'requested' }), afterData: JSON.stringify({ status: 'rejected', reason: rejectionReason }), actorUserId: approverId },
      });
      return tx.pharmacyTransfer.findUniqueOrThrow({ where: { id: transfer.id }, include: this.detailInclude() });
    });
  }

  async dispatchTransfer(transferId: string, data: any, userId: string, sourceLocationId: string) {
    const transfer = await this.requireTransfer(transferId, sourceLocationId, 'source');
    if (transfer.status !== 'approved') throw new ConflictException('Only an approved transfer can be dispatched');

    const dispatched = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, sourceLocationId, status: 'approved' },
        data: { status: 'dispatching' },
      });
      if (claim.count !== 1) throw new ConflictException('The transfer is already being dispatched or changed');
      for (const line of transfer.lines) {
        const quantity = Number(line.approvedQty ?? 0);
        if (quantity <= 0) continue;
        const batch = await tx.pharmacyBatch.findFirst({ where: { id: line.sourceBatchId, locationId: sourceLocationId } });
        if (!batch) throw new NotFoundException(`Source batch ${line.batchNumber} was not found`);
        if (Number(batch.quantityReserved) + 0.000001 < quantity || Number(batch.quantityRemaining) + 0.000001 < quantity) {
          throw new ConflictException(`Reserved stock for batch ${line.batchNumber} is no longer sufficient`);
        }
        const before = Number(batch.quantityRemaining);
        const after = before - quantity;
        const updated = await tx.pharmacyBatch.updateMany({
          where: { id: batch.id, locationId: sourceLocationId, quantityRemaining: batch.quantityRemaining, quantityReserved: batch.quantityReserved },
          data: { quantityRemaining: { decrement: quantity }, quantityReserved: { decrement: quantity } },
        });
        if (updated.count !== 1) throw new ConflictException(`Stock changed for batch ${line.batchNumber}. Dispatch was not posted.`);
        await tx.pharmacyTransferLine.update({ where: { id: line.id }, data: { dispatchedQty: quantity } });
        await tx.pharmacyStockMovement.create({
          data: { tenantId: transfer.tenantId, locationId: sourceLocationId, productId: line.productId, batchId: line.sourceBatchId, movementType: 'transfer_out', quantity: -quantity, quantityBefore: before, quantityAfter: after, unitCost: line.unitCost, referenceId: transfer.id, referenceType: 'pharmacy_transfer', reason: transfer.reason, createdByUserId: userId },
        });
      }
      const posted = await tx.pharmacyTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'dispatched', dispatchedByUserId: userId, dispatchedAt: getInternetDate(), dispatchNotes: this.optionalText(data.dispatchNotes),
          transporterName: this.optionalText(data.transporterName), transporterPhone: this.optionalText(data.transporterPhone), vehicleReference: this.optionalText(data.vehicleReference),
        },
        include: this.detailInclude(),
      });
      await tx.auditLog.create({
        data: { actionType: 'dispatch', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'approved' }), afterData: JSON.stringify({ status: 'dispatched', destinationLocationId: transfer.destinationLocationId }), actorUserId: userId },
      });
      return posted;
    });

    await this.notifyLocation(transfer.destinationLocationId, 'Stock transfer dispatched', `${transfer.transferNumber} is on the way from ${transfer.sourceLocation.name}.`, transfer.id);
    return dispatched;
  }

  async receiveTransfer(transferId: string, data: any, userId: string, destinationLocationId: string) {
    const transfer = await this.requireTransfer(transferId, destinationLocationId, 'destination');
    if (transfer.status !== 'dispatched') throw new ConflictException('Only a dispatched transfer can be received');
    const receipts = new Map<string, any>((Array.isArray(data.lines) ? data.lines : []).map((line: any) => [String(line.id), line]));

    const received = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, destinationLocationId, status: 'dispatched' },
        data: { status: 'receiving' },
      });
      if (claim.count !== 1) throw new ConflictException('The transfer is already being received or changed');
      let hasDiscrepancy = false;
      for (const line of transfer.lines) {
        const dispatchedQty = Number(line.dispatchedQty ?? 0);
        if (dispatchedQty <= 0) continue;
        const input = receipts.get(line.id) ?? {};
        const receivedQty = input.receivedQty === undefined ? dispatchedQty : Number(input.receivedQty);
        const quarantinedQty = Number(input.quarantinedQty ?? 0);
        const rejectedQty = dispatchedQty - receivedQty;
        if (!Number.isFinite(receivedQty) || receivedQty < 0 || receivedQty > dispatchedQty + 0.000001) {
          throw new BadRequestException(`Invalid received quantity for ${line.product.name}`);
        }
        if (!Number.isFinite(quarantinedQty) || quarantinedQty < 0 || quarantinedQty > receivedQty + 0.000001) {
          throw new BadRequestException(`Quarantined quantity for ${line.product.name} must be within the received quantity`);
        }
        const discrepancyReason = String(input.discrepancyReason ?? '').trim();
        const conditionStatus = String(input.conditionStatus ?? '').trim().toLowerCase();
        if (rejectedQty > 0.000001 && discrepancyReason.length < 3) {
          throw new BadRequestException(`Explain the shortage or rejection for ${line.product.name}`);
        }
        if (quarantinedQty > 0.000001 && !['damaged', 'suspect', 'temperature_affected', 'mismatched', 'recalled'].includes(conditionStatus)) {
          throw new BadRequestException(`Select a quarantine condition for ${line.product.name}`);
        }
        hasDiscrepancy ||= rejectedQty > 0.000001;

        let destinationBatchId: string | null = null;
        if (receivedQty > 0) {
          const destinationPolicy = await tx.pharmacyLocationProduct.findFirst({
            where: { locationId: destinationLocationId, productId: line.productId },
          });
          const destinationSellingPrice = Number(destinationPolicy?.defaultSellingPrice ?? line.sellingPrice);
          const existingBatch = await tx.pharmacyBatch.findFirst({
            where: { locationId: destinationLocationId, productId: line.productId, batchNumber: line.batchNumber },
          });
          const before = Number(existingBatch?.quantityRemaining ?? 0);
          if (existingBatch) {
            if (existingBatch.expiryDate.getTime() !== line.expiryDate.getTime()) {
              throw new ConflictException(`Destination batch ${line.batchNumber} has a different expiry date and must be reviewed before receipt`);
            }
            const weightedUnitCost = before + receivedQty > 0
              ? ((before * Number(existingBatch.purchasePrice)) + (receivedQty * Number(line.unitCost))) / (before + receivedQty)
              : Number(line.unitCost);
            const destinationBatch = await tx.pharmacyBatch.update({
              where: { id: existingBatch.id },
              data: { quantityReceived: { increment: receivedQty }, quantityRemaining: { increment: receivedQty }, quantityQuarantined: { increment: quarantinedQty }, purchasePrice: weightedUnitCost },
            });
            destinationBatchId = destinationBatch.id;
          } else {
            const destinationBatch = await tx.pharmacyBatch.create({
              data: { tenantId: transfer.tenantId, locationId: destinationLocationId, productId: line.productId, batchNumber: line.batchNumber, expiryDate: line.expiryDate, purchasePrice: line.unitCost, sellingPrice: destinationSellingPrice, quantityReceived: receivedQty, quantityRemaining: receivedQty, quantityReserved: 0, quantityQuarantined: quarantinedQty },
            });
            destinationBatchId = destinationBatch.id;
          }
          await tx.pharmacyLocationProduct.upsert({
            where: { locationId_productId: { locationId: destinationLocationId, productId: line.productId } },
            create: { tenantId: transfer.tenantId, locationId: destinationLocationId, productId: line.productId, defaultSellingPrice: destinationSellingPrice, isActive: true },
            update: { isActive: true },
          });
          await tx.pharmacyBatch.updateMany({
            where: { locationId: destinationLocationId, productId: line.productId },
            data: { sellingPrice: destinationSellingPrice },
          });
          await tx.pharmacyStockMovement.create({
            data: { tenantId: transfer.tenantId, locationId: destinationLocationId, productId: line.productId, batchId: destinationBatchId, movementType: 'transfer_in', quantity: receivedQty, quantityBefore: before, quantityAfter: before + receivedQty, unitCost: line.unitCost, referenceId: transfer.id, referenceType: 'pharmacy_transfer', reason: transfer.reason, createdByUserId: userId },
          });
        }
        await tx.pharmacyTransferLine.update({ where: { id: line.id }, data: { receivedQty, rejectedQty, quarantinedQty, discrepancyReason: discrepancyReason || null, conditionStatus: conditionStatus || null, destinationBatchId } });
      }
      const posted = await tx.pharmacyTransfer.update({
        where: { id: transfer.id },
        data: { status: hasDiscrepancy ? 'discrepancy_review' : 'completed', receivedByUserId: userId, receivedAt: getInternetDate(), receiptNotes: this.optionalText(data.receiptNotes) },
        include: this.detailInclude(),
      });
      await tx.auditLog.create({
        data: { actionType: 'receive', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'dispatched' }), afterData: JSON.stringify({ status: posted.status, hasDiscrepancy }), actorUserId: userId },
      });
      return posted;
    });

    if (received.status === 'discrepancy_review') {
      await this.notificationsService.create({ title: 'Transfer discrepancy needs review', message: `${transfer.transferNumber} was received with a shortage or rejected quantity.`, type: 'danger', module: 'pharmacy', targetRole: 0, entityType: 'pharmacyTransfer', entityId: transfer.id, route: '/pharmacy/transfers' });
    } else {
      await this.notifyLocation(transfer.sourceLocationId, 'Stock transfer completed', `${transfer.transferNumber} was received by ${transfer.destinationLocation.name}.`, transfer.id);
    }
    if (received.lines.some((line: any) => Number(line.quarantinedQty ?? 0) > 0)) {
      await this.notificationsService.create({ title: 'Transferred stock quarantined', message: `${transfer.transferNumber} includes stock quarantined at ${transfer.destinationLocation.name}.`, type: 'warning', module: 'pharmacy', targetRole: 0, entityType: 'pharmacyTransfer', entityId: transfer.id, route: '/pharmacy/network-stock' });
    }
    return received;
  }

  async resolveDiscrepancy(transferId: string, data: any, userId: string, locationId: string) {
    const transfer = await this.requireTransfer(transferId, locationId, 'either');
    if (transfer.status !== 'discrepancy_review') throw new ConflictException('This transfer is not awaiting discrepancy review');
    if (transfer.receivedByUserId === userId) throw new BadRequestException('The transfer receiver cannot resolve the same discrepancy');
    const resolution = String(data.resolution ?? '').trim();
    if (!['return_to_source', 'write_off'].includes(resolution)) throw new BadRequestException('Select return_to_source or write_off');
    const notes = String(data.notes ?? '').trim();
    if (notes.length < 5) throw new BadRequestException('Resolution notes are required');

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, status: 'discrepancy_review', receivedByUserId: { not: userId } },
        data: { status: 'resolving' },
      });
      if (claim.count !== 1) throw new ConflictException('The discrepancy was already handled or cannot be self-resolved');
      if (resolution === 'return_to_source') {
        for (const line of transfer.lines) {
          const rejectedQty = Number(line.rejectedQty ?? 0);
          if (rejectedQty <= 0) continue;
          const batch = await tx.pharmacyBatch.findUnique({ where: { id: line.sourceBatchId } });
          if (!batch) throw new NotFoundException(`Original source batch ${line.batchNumber} was not found`);
          const before = Number(batch.quantityRemaining);
          await tx.pharmacyBatch.update({ where: { id: batch.id }, data: { quantityRemaining: { increment: rejectedQty } } });
          await tx.pharmacyStockMovement.create({
            data: { tenantId: transfer.tenantId, locationId: transfer.sourceLocationId, productId: line.productId, batchId: line.sourceBatchId, movementType: 'transfer_return', quantity: rejectedQty, quantityBefore: before, quantityAfter: before + rejectedQty, unitCost: line.unitCost, referenceId: transfer.id, referenceType: 'pharmacy_transfer', reason: notes, createdByUserId: userId },
          });
        }
      }
      const resolved = await tx.pharmacyTransfer.update({ where: { id: transfer.id }, data: { status: 'completed', resolvedByUserId: userId, resolvedAt: getInternetDate(), discrepancyNotes: `${resolution}: ${notes}` }, include: this.detailInclude() });
      await tx.auditLog.create({
        data: { actionType: 'resolve', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: 'discrepancy_review' }), afterData: JSON.stringify({ status: 'completed', resolution, notes }), actorUserId: userId },
      });
      return resolved;
    });
  }

  async cancelTransfer(transferId: string, reason: string, userId: string, sourceLocationId: string, isAdmin: boolean) {
    const transfer = await this.requireTransfer(transferId, sourceLocationId, 'source');
    if (!['draft', 'requested', 'approved'].includes(transfer.status)) throw new ConflictException('This transfer can no longer be cancelled');
    if (transfer.status === 'approved' && !isAdmin) throw new BadRequestException('Only an administrator can cancel an approved transfer');
    if (!isAdmin && transfer.requestedByUserId !== userId) throw new BadRequestException('Only the transfer creator can cancel this transfer');
    const cancellationReason = String(reason ?? '').trim();
    if (cancellationReason.length < 3) throw new BadRequestException('Provide a cancellation reason');
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyTransfer.updateMany({
        where: { id: transfer.id, sourceLocationId, status: transfer.status, ...(!isAdmin ? { requestedByUserId: userId } : {}) },
        data: { status: 'cancelling' },
      });
      if (claim.count !== 1) throw new ConflictException('The transfer changed before it could be cancelled');
      if (transfer.status === 'approved') {
        for (const line of transfer.lines) {
          const quantity = Number(line.approvedQty ?? 0);
          if (quantity <= 0) continue;
          const batch = await tx.pharmacyBatch.findFirst({ where: { id: line.sourceBatchId, locationId: sourceLocationId } });
          if (!batch || Number(batch.quantityReserved) + 0.000001 < quantity) throw new ConflictException(`Reserved stock for batch ${line.batchNumber} could not be released`);
          await tx.pharmacyBatch.update({ where: { id: batch.id }, data: { quantityReserved: { decrement: quantity } } });
        }
      }
      const cancelled = await tx.pharmacyTransfer.update({ where: { id: transfer.id }, data: { status: 'cancelled', cancelledAt: getInternetDate(), notes: this.appendNote(transfer.notes, `Cancelled by ${userId}: ${cancellationReason}`) }, include: this.detailInclude() });
      await tx.auditLog.create({
        data: { actionType: 'cancel', entityType: 'pharmacy_transfer', entityId: transfer.id, beforeData: JSON.stringify({ status: transfer.status }), afterData: JSON.stringify({ status: 'cancelled', reason: cancellationReason }), actorUserId: userId },
      });
      return cancelled;
    });
  }

  private async requireTransfer(id: string, locationId: string, side: 'source' | 'destination' | 'either'): Promise<any> {
    const sideWhere = side === 'source' ? { sourceLocationId: locationId } : side === 'destination' ? { destinationLocationId: locationId } : { OR: [{ sourceLocationId: locationId }, { destinationLocationId: locationId }] };
    const transfer = await this.prisma.pharmacyTransfer.findFirst({ where: { id, ...sideWhere }, include: this.detailInclude() });
    if (!transfer) throw new NotFoundException('Stock transfer not found for this location');
    return transfer;
  }

  private detailInclude(): any {
    return {
      sourceLocation: { select: { id: true, code: true, name: true, address: true } },
      destinationLocation: { select: { id: true, code: true, name: true, address: true } },
      requestedBy: { select: { fullName: true, username: true } }, approvedBy: { select: { fullName: true, username: true } },
      dispatchedBy: { select: { fullName: true, username: true } }, receivedBy: { select: { fullName: true, username: true } }, resolvedBy: { select: { fullName: true, username: true } },
      lines: { include: { product: { select: { name: true, productCode: true, unitOfMeasure: true } }, sourceBatch: { select: { quantityRemaining: true, quantityReserved: true, quantityQuarantined: true } }, destinationBatch: { select: { id: true, quantityRemaining: true, quantityQuarantined: true } } }, orderBy: { createdAt: 'asc' } },
    };
  }

  private availableQuantity(batch: { quantityRemaining: number; quantityReserved: number; quantityQuarantined: number }): number {
    return Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0));
  }

  private reference(prefix: string): string {
    return `${prefix}-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private optionalText(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private appendNote(current: string | null, next: unknown): string | null {
    return [current, this.optionalText(next)].filter(Boolean).join('\n') || null;
  }

  private async notifyLocation(locationId: string, title: string, message: string, transferId: string) {
    const memberships = await this.prisma.userPharmacyLocation.findMany({ where: { locationId, isActive: true }, select: { userId: true } });
    await Promise.allSettled([...new Set(memberships.map((item) => item.userId))].map((targetUserId) => this.notificationsService.create({ title, message, type: 'info', module: 'pharmacy', targetUserId, entityType: 'pharmacyTransfer', entityId: transferId, route: '/pharmacy/transfers' })));
  }
}

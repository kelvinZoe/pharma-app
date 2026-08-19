import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import * as crypto from 'crypto';

@Injectable()
export class PharmacyPurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(locationId: string) {
    const orders = await this.prisma.pharmacyPurchaseOrder.findMany({
      where: { locationId },
      include: {
        supplier: { select: { id: true, supplierCode: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { fullName: true } },
        lines: { select: { orderedUnits: true, receivedUnits: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });

    return orders.map((order) => ({
      ...order,
      orderedUnits: order.lines.reduce((sum, line) => sum + line.orderedUnits, 0),
      receivedUnits: order.lines.reduce((sum, line) => sum + line.receivedUnits, 0),
      outstandingUnits: order.lines.reduce((sum, line) => sum + Math.max(0, line.orderedUnits - line.receivedUnits), 0),
    }));
  }

  async findOrderDetail(orderId: string, locationId: string) {
    const order = await this.prisma.pharmacyPurchaseOrder.findFirst({
      where: { id: orderId, locationId },
      include: {
        supplier: true,
        location: { select: { id: true, code: true, name: true, address: true, phone: true } },
        createdBy: { select: { fullName: true, username: true } },
        submittedBy: { select: { fullName: true, username: true } },
        approvedBy: { select: { fullName: true, username: true } },
        lines: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        goodsReceipts: {
          select: { id: true, receiptNumber: true, supplierInvoiceNumber: true, receivedAt: true, totalCost: true, status: true },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found');

    return {
      ...order,
      orderedUnits: order.lines.reduce((sum, line) => sum + line.orderedUnits, 0),
      receivedUnits: order.lines.reduce((sum, line) => sum + line.receivedUnits, 0),
      outstandingUnits: order.lines.reduce((sum, line) => sum + Math.max(0, line.orderedUnits - line.receivedUnits), 0),
    };
  }

  async createOrder(data: any, userId: string, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const supplier = await this.requireActiveSupplier(data.supplierId);
    const normalized = await this.normalizeOrder(data, location.tenantId);
    const orderNumber = `PO-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.pharmacyPurchaseOrder.create({
        data: {
          tenantId: location.tenantId,
          locationId,
          supplierId: supplier.id,
          createdByUserId: userId,
          orderNumber,
          status: 'draft',
          orderDate: normalized.orderDate,
          expectedDeliveryDate: normalized.expectedDeliveryDate,
          notes: normalized.notes,
          subtotal: normalized.subtotal,
          discountTotal: normalized.discountTotal,
          taxTotal: normalized.taxTotal,
          total: normalized.total,
          lines: { create: normalized.lines.map((line) => ({ ...line, tenantId: location.tenantId })) },
        },
        include: { supplier: true, location: true, lines: { include: { product: true } } },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'create',
          entityType: 'pharmacy_purchase_order',
          entityId: order.id,
          afterData: JSON.stringify({ orderNumber, supplierId: supplier.id, locationId, total: normalized.total }),
          actorUserId: userId,
        },
      });
      return order;
    });
  }

  async updateOrder(orderId: string, data: any, locationId: string, userId: string) {
    const order = await this.requireOrder(orderId, locationId);
    if (order.status !== 'draft') throw new ConflictException('Only draft purchase orders can be edited');
    const supplier = await this.requireActiveSupplier(data.supplierId ?? order.supplierId);
    const normalized = await this.normalizeOrder(data, order.tenantId);

    return this.prisma.$transaction(async (tx) => {
      await tx.pharmacyPurchaseOrderLine.deleteMany({ where: { purchaseOrderId: orderId } });
      const updated = await tx.pharmacyPurchaseOrder.update({
        where: { id: orderId },
        data: {
          supplierId: supplier.id,
          orderDate: normalized.orderDate,
          expectedDeliveryDate: normalized.expectedDeliveryDate,
          notes: normalized.notes,
          subtotal: normalized.subtotal,
          discountTotal: normalized.discountTotal,
          taxTotal: normalized.taxTotal,
          total: normalized.total,
          lines: { create: normalized.lines.map((line) => ({ ...line, tenantId: order.tenantId })) },
        },
        include: { supplier: true, location: true, lines: { include: { product: true } } },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'update',
          entityType: 'pharmacy_purchase_order',
          entityId: orderId,
          beforeData: JSON.stringify({ supplierId: order.supplierId, total: Number(order.total), status: order.status }),
          afterData: JSON.stringify({ supplierId: supplier.id, total: normalized.total, status: 'draft' }),
          actorUserId: userId,
        },
      });
      return updated;
    });
  }

  async submitOrder(orderId: string, userId: string, locationId: string) {
    const order = await this.requireOrder(orderId, locationId, true);
    if (order.status !== 'draft') throw new ConflictException('Only draft purchase orders can be submitted');
    if (order.lines.length === 0) throw new BadRequestException('A purchase order requires at least one medicine line');
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyPurchaseOrder.updateMany({
        where: { id: orderId, locationId, status: 'draft' },
        data: { status: 'submitted', submittedAt: getInternetDate(), submittedByUserId: userId },
      });
      if (claim.count !== 1) throw new ConflictException('The purchase order changed. Refresh and try again.');
      await tx.auditLog.create({
        data: { actionType: 'submit', entityType: 'pharmacy_purchase_order', entityId: orderId, afterData: JSON.stringify({ status: 'submitted' }), actorUserId: userId },
      });
      return tx.pharmacyPurchaseOrder.findUniqueOrThrow({ where: { id: orderId } });
    });
  }

  async approveOrder(orderId: string, userId: string, locationId: string) {
    const order = await this.requireOrder(orderId, locationId);
    if (order.status !== 'submitted') throw new ConflictException('Only submitted purchase orders can be approved');
    if (order.createdByUserId === userId || order.submittedByUserId === userId) {
      throw new BadRequestException('The purchase-order maker cannot approve the same order');
    }
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyPurchaseOrder.updateMany({
        where: { id: orderId, locationId, status: 'submitted', createdByUserId: { not: userId }, submittedByUserId: { not: userId } },
        data: { status: 'approved', approvedAt: getInternetDate(), approvedByUserId: userId },
      });
      if (claim.count !== 1) throw new ConflictException('The purchase order was already handled or cannot be self-approved');
      await tx.auditLog.create({
        data: { actionType: 'approve', entityType: 'pharmacy_purchase_order', entityId: orderId, beforeData: JSON.stringify({ status: order.status }), afterData: JSON.stringify({ status: 'approved' }), actorUserId: userId },
      });
      return tx.pharmacyPurchaseOrder.findUniqueOrThrow({ where: { id: orderId } });
    });
  }

  async cancelOrder(orderId: string, locationId: string, userId: string, isAdmin: boolean) {
    const order = await this.requireOrder(orderId, locationId);
    if (!['draft', 'submitted', 'approved'].includes(order.status)) {
      throw new ConflictException('This purchase order can no longer be cancelled');
    }
    if (order.status === 'approved' && !isAdmin) {
      throw new BadRequestException('Only an administrator can cancel an approved purchase order');
    }
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pharmacyPurchaseOrder.updateMany({
        where: { id: orderId, locationId, status: order.status },
        data: { status: 'cancelled', cancelledAt: getInternetDate() },
      });
      if (claim.count !== 1) throw new ConflictException('The purchase order changed before it could be cancelled');
      await tx.auditLog.create({
        data: { actionType: 'cancel', entityType: 'pharmacy_purchase_order', entityId: orderId, beforeData: JSON.stringify({ status: order.status }), afterData: JSON.stringify({ status: 'cancelled' }), actorUserId: userId },
      });
      return tx.pharmacyPurchaseOrder.findUniqueOrThrow({ where: { id: orderId } });
    });
  }

  private async normalizeOrder(data: any, tenantId: string) {
    const sourceLines = Array.isArray(data.lines) ? data.lines : [];
    if (sourceLines.length === 0) throw new BadRequestException('At least one purchase order line is required');
    const productIds = sourceLines.map((line: any) => String(line.productId ?? '').trim());
    if (productIds.some((id: string) => !id)) throw new BadRequestException('Every order line requires a medicine');
    if (new Set(productIds).size !== productIds.length) throw new BadRequestException('A medicine can appear only once on a purchase order');
    const products = await this.prisma.pharmacyProduct.findMany({ where: { tenantId, id: { in: productIds }, isActive: true }, select: { id: true } });
    if (products.length !== productIds.length) throw new BadRequestException('One or more selected medicines are inactive or unavailable');

    const lines = sourceLines.map((line: any, index: number) => {
      const orderedPacks = Number(line.orderedPacks);
      const unitsPerPack = Number(line.unitsPerPack);
      const unitCostPerPack = Number(line.unitCostPerPack);
      const discountAmount = Number(line.discountAmount ?? 0);
      const taxAmount = Number(line.taxAmount ?? 0);
      if (!Number.isFinite(orderedPacks) || !Number.isFinite(unitsPerPack) || orderedPacks <= 0 || unitsPerPack <= 0) throw new BadRequestException(`Line ${index + 1}: pack quantities must be greater than zero`);
      if (![unitCostPerPack, discountAmount, taxAmount].every(Number.isFinite) || unitCostPerPack <= 0 || discountAmount < 0 || taxAmount < 0) throw new BadRequestException(`Line ${index + 1}: cost must be positive and adjustments cannot be negative`);
      const subtotal = orderedPacks * unitCostPerPack;
      if (discountAmount > subtotal) throw new BadRequestException(`Line ${index + 1}: discount cannot exceed the line subtotal`);
      return {
        productId: productIds[index],
        purchaseUnit: String(line.purchaseUnit ?? 'box').trim().toLowerCase() || 'box',
        orderedPacks,
        unitsPerPack,
        orderedUnits: orderedPacks * unitsPerPack,
        unitCostPerPack,
        discountAmount,
        taxAmount,
        lineTotal: subtotal - discountAmount + taxAmount,
      };
    });
    const orderDate = data.orderDate ? new Date(data.orderDate) : getInternetDate();
    const expectedDeliveryDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;
    if (Number.isNaN(orderDate.getTime()) || (expectedDeliveryDate && Number.isNaN(expectedDeliveryDate.getTime()))) throw new BadRequestException('Order and expected delivery dates must be valid');
    if (expectedDeliveryDate && expectedDeliveryDate < orderDate) throw new BadRequestException('Expected delivery cannot be before the order date');

    return {
      orderDate,
      expectedDeliveryDate,
      notes: data.notes ? String(data.notes).trim() : null,
      lines,
      subtotal: lines.reduce((sum, line) => sum + line.orderedPacks * line.unitCostPerPack, 0),
      discountTotal: lines.reduce((sum, line) => sum + line.discountAmount, 0),
      taxTotal: lines.reduce((sum, line) => sum + line.taxAmount, 0),
      total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    };
  }

  private async requireActiveSupplier(supplierId: unknown) {
    const id = String(supplierId ?? '').trim();
    if (!id) throw new BadRequestException('An active supplier is required');
    const supplier = await this.prisma.pharmacySupplier.findFirst({ where: { id, isActive: true } });
    if (!supplier) throw new BadRequestException('The selected supplier is inactive or unavailable');
    return supplier;
  }

  private async requireOrder(orderId: string, locationId: string, includeLines = false) {
    const order = await this.prisma.pharmacyPurchaseOrder.findFirst({
      where: { id: orderId, locationId },
      ...(includeLines ? { include: { lines: true } } : {}),
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order as any;
  }
}

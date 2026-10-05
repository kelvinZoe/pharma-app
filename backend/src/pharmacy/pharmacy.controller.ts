import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, Query, Headers, } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/authorization/require-permissions.decorator';
import { Permission, Role, hasRole, hasPermission } from '../auth/authorization/permissions';
import { PharmacyLocationService } from './pharmacy-location.service';
import { PharmacySupplierService } from './pharmacy-supplier.service';
import { PharmacyPurchaseOrderService } from './pharmacy-purchase-order.service';
import { PharmacyPayablesService } from './pharmacy-payables.service';
import { PharmacyInventoryControlService } from './pharmacy-inventory-control.service';
import { PharmacyTransferService } from './pharmacy-transfer.service';
import { PharmacyNetworkStockService } from './pharmacy-network-stock.service';
import { IdempotencyService } from '../common/idempotency.service';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PharmacyController {
  constructor(
    private readonly pharmacyService: PharmacyService,
    private readonly pharmacyLocationService: PharmacyLocationService,
    private readonly pharmacySupplierService: PharmacySupplierService,
    private readonly pharmacyPurchaseOrderService: PharmacyPurchaseOrderService,
    private readonly pharmacyPayablesService: PharmacyPayablesService,
    private readonly pharmacyInventoryControlService: PharmacyInventoryControlService,
    private readonly pharmacyTransferService: PharmacyTransferService,
    private readonly pharmacyNetworkStockService: PharmacyNetworkStockService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @RequirePermissions(Permission.PharmacyStockRead)
  @Get('network-stock')
  async getNetworkStock(@Req() req: any, @Query('search') search?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const activeLocation = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    const accessibleLocations = await this.pharmacyLocationService.listAccessibleLocations(req.user);
    return this.pharmacyNetworkStockService.getNetworkStock(activeLocation.id, accessibleLocations.map((location) => location.id), search);
  }

  @RequirePermissions(Permission.PharmacyStockPolicyManage)
  @Patch('locations/:locationId/products/:productId/inventory-policy')
  async updateLocationInventoryPolicy(@Req() req: any, @Param('locationId') locationId: string, @Param('productId') productId: string, @Body() body: any) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, locationId);
    return this.pharmacyNetworkStockService.updatePolicy(location.id, productId, body, req.user.id);
  }

  @RequirePermissions(Permission.PharmacyStockRead)
  @Get('quarantine')
  async getQuarantinedStock(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyNetworkStockService.listQuarantined(location.id);
  }

  @RequirePermissions(Permission.PharmacyQuarantineResolve)
  @Post('quarantine/:batchId/resolve')
  async resolveQuarantine(
    @Req() req: any,
    @Param('batchId') batchId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_quarantine_resolve', req.user.id, { batchId, locationId: location.id, body }, () => this.pharmacyNetworkStockService.resolveQuarantine(batchId, location.id, body, req.user.id));
  }

  @RequirePermissions(Permission.PharmacyTransferRead)
  @Get('transfers/summary')
  async getTransferSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.getSummary(location.id);
  }

  @RequirePermissions(Permission.PharmacyTransferRead)
  @Get('transfers')
  async getTransfers(@Req() req: any, @Query() query: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.listTransfers(location.id, query);
  }

  @RequirePermissions(Permission.PharmacyTransferManage)
  @Post('transfers')
  async createTransfer(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_create', req.user.id, { locationId: location.id, body }, () => this.pharmacyTransferService.createTransfer(body, req.user.id, location.id, hasRole(req.user, Role.Admin)));
  }

  @RequirePermissions(Permission.PharmacyTransferRead)
  @Get('transfers/:id')
  async getTransfer(@Req() req: any, @Param('id') transferId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.findTransfer(transferId, location.id);
  }

  @RequirePermissions(Permission.PharmacyTransferManage)
  @Post('transfers/:id/submit')
  async submitTransfer(@Req() req: any, @Param('id') transferId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_submit', req.user.id, { transferId, locationId: location.id }, () => this.pharmacyTransferService.submitTransfer(transferId, req.user.id, location.id, hasRole(req.user, Role.Admin)));
  }

  @RequirePermissions(Permission.PharmacyTransferApprove)
  @Post('transfers/:id/approve')
  async approveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_approve', req.user.id, { transferId, locationId: location.id, body }, () => this.pharmacyTransferService.approveTransfer(transferId, body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyTransferApprove)
  @Post('transfers/:id/reject')
  async rejectTransfer(@Req() req: any, @Param('id') transferId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_reject', req.user.id, { transferId, locationId: location.id, reason }, () => this.pharmacyTransferService.rejectTransfer(transferId, reason, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyTransferDispatch)
  @Post('transfers/:id/dispatch')
  async dispatchTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_dispatch', req.user.id, { transferId, locationId: location.id, body }, () => this.pharmacyTransferService.dispatchTransfer(transferId, body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyTransferReceive)
  @Post('transfers/:id/receive')
  async receiveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_receive', req.user.id, { transferId, locationId: location.id, body }, () => this.pharmacyTransferService.receiveTransfer(transferId, body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyTransferApprove)
  @Post('transfers/:id/resolve')
  async resolveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_resolve', req.user.id, { transferId, locationId: location.id, body }, () => this.pharmacyTransferService.resolveDiscrepancy(transferId, body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyTransferManage)
  @Post('transfers/:id/cancel')
  async cancelTransfer(@Req() req: any, @Param('id') transferId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_transfer_cancel', req.user.id, { transferId, locationId: location.id, reason }, () => this.pharmacyTransferService.cancelTransfer(transferId, reason, req.user.id, location.id, hasRole(req.user, Role.Admin)));
  }

  @RequirePermissions(Permission.PharmacyCountRead)
  @Get('inventory-control/summary')
  async getInventoryControlSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.getSummary(location.id);
  }

  @RequirePermissions(Permission.PharmacyCountRead)
  @Get('stock-ledger')
  async getStockLedger(@Req() req: any, @Query() query: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listLedger(location.id, query);
  }

  @RequirePermissions(Permission.PharmacyCountRead)
  @Get('stock-counts')
  async getStockCounts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listCounts(location.id);
  }

  @RequirePermissions(Permission.PharmacyCountManage)
  @Post('stock-counts')
  async createStockCount(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_count_create', req.user.id, { locationId: location.id, body }, () => this.pharmacyInventoryControlService.createCount(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyCountRead)
  @Get('stock-counts/:id')
  async getStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.findCount(countId, location.id);
  }

  @RequirePermissions(Permission.PharmacyCountManage)
  @Patch('stock-counts/:id')
  async saveStockCount(@Req() req: any, @Param('id') countId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.saveCount(countId, body, req.user.id, location.id);
  }

  @RequirePermissions(Permission.PharmacyCountManage)
  @Post('stock-counts/:id/submit')
  async submitStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_count_submit', req.user.id, { countId, locationId: location.id }, () => this.pharmacyInventoryControlService.submitCount(countId, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyCountApprove)
  @Post('stock-counts/:id/approve')
  async approveStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_count_approve', req.user.id, { countId, locationId: location.id }, () => this.pharmacyInventoryControlService.approveCount(countId, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyAdjustmentRead)
  @Get('stock-adjustments')
  async getStockAdjustments(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listAdjustments(location.id);
  }

  @RequirePermissions(Permission.PharmacyAdjustmentRequest)
  @Post('stock-adjustments')
  async requestStockAdjustment(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_adjustment_request', req.user.id, { locationId: location.id, body }, () => this.pharmacyInventoryControlService.requestAdjustment(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyAdjustmentApprove)
  @Post('stock-adjustments/:id/approve')
  async approveStockAdjustment(@Req() req: any, @Param('id') adjustmentId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_adjustment_approve', req.user.id, { adjustmentId, locationId: location.id }, () => this.pharmacyInventoryControlService.approveAdjustment(adjustmentId, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyAdjustmentApprove)
  @Post('stock-adjustments/:id/reject')
  async rejectStockAdjustment(@Req() req: any, @Param('id') adjustmentId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_stock_adjustment_reject', req.user.id, { adjustmentId, locationId: location.id, reason }, () => this.pharmacyInventoryControlService.rejectAdjustment(adjustmentId, req.user.id, location.id, reason));
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('payables/summary')
  async getPayablesSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.getSummary(location.id);
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('supplier-invoices')
  async getSupplierInvoices(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('search') search?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listInvoices(location.id, status, supplierId, search);
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('supplier-invoices/:id')
  async getSupplierInvoiceDetail(@Req() req: any, @Param('id') invoiceId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.findInvoiceDetail(invoiceId, location.id);
  }

  @RequirePermissions(Permission.PharmacyInvoiceManage)
  @Patch('supplier-invoices/:id')
  async updateSupplierInvoice(@Req() req: any, @Param('id') invoiceId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.updateInvoice(invoiceId, location.id, body, req.user.id);
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('supplier-payments')
  async getSupplierPayments(@Req() req: any, @Query('supplierId') supplierId?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listPayments(location.id, supplierId);
  }

  @RequirePermissions(Permission.PharmacySupplierPaymentCreate)
  @Post('supplier-payments')
  async recordSupplierPayment(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_supplier_payment', req.user.id, { locationId: location.id, body }, () => this.pharmacyPayablesService.recordPayment(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('purchase-returns')
  async getPurchaseReturns(@Req() req: any, @Query('supplierId') supplierId?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listPurchaseReturns(location.id, supplierId);
  }

  @RequirePermissions(Permission.PharmacySupplierReturnCreate)
  @Post('purchase-returns')
  async recordPurchaseReturn(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_return', req.user.id, { locationId: location.id, body }, () => this.pharmacyPayablesService.recordPurchaseReturn(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyPayablesRead)
  @Get('supplier-statements/:supplierId')
  async getSupplierStatement(@Req() req: any, @Param('supplierId') supplierId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const consolidated = hasPermission(req.user, Permission.PharmacyLocationsReadAll);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.getSupplierStatement(supplierId, startDate, endDate, location?.id);
  }

  @RequirePermissions(Permission.PharmacySupplierRead)
  @Get('suppliers')
  async getSuppliers(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const consolidated = hasPermission(req.user, Permission.PharmacyLocationsReadAll);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacySupplierService.listSuppliers(location?.id);
  }

  @RequirePermissions(Permission.PharmacySupplierRead)
  @Get('suppliers/:id')
  async getSupplierDetail(@Req() req: any, @Param('id') supplierId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const consolidated = hasPermission(req.user, Permission.PharmacyLocationsReadAll);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacySupplierService.findSupplierDetail(supplierId, location?.id);
  }

  @RequirePermissions(Permission.PharmacySupplierManage)
  @Post('suppliers')
  async createSupplier(@Req() req: any, @Body() body: any) {
    return this.pharmacySupplierService.createSupplier(body);
  }

  @RequirePermissions(Permission.PharmacySupplierManage)
  @Patch('suppliers/:id')
  async updateSupplier(@Req() req: any, @Param('id') supplierId: string, @Body() body: any) {
    return this.pharmacySupplierService.updateSupplier(supplierId, body);
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderRead)
  @Get('purchase-orders')
  async getPurchaseOrders(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.listOrders(location.id);
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderRead)
  @Get('purchase-orders/:id')
  async getPurchaseOrderDetail(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.findOrderDetail(orderId, location.id);
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderManage)
  @Post('purchase-orders')
  async createPurchaseOrder(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_order_create', req.user.id, { locationId: location.id, body }, () => this.pharmacyPurchaseOrderService.createOrder(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderManage)
  @Patch('purchase-orders/:id')
  async updatePurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_order_update', req.user.id, { orderId, locationId: location.id, body }, () => this.pharmacyPurchaseOrderService.updateOrder(orderId, body, location.id, req.user.id));
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderManage)
  @Post('purchase-orders/:id/submit')
  async submitPurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_order_submit', req.user.id, { orderId, locationId: location.id }, () => this.pharmacyPurchaseOrderService.submitOrder(orderId, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderApprove)
  @Post('purchase-orders/:id/approve')
  async approvePurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_order_approve', req.user.id, { orderId, locationId: location.id }, () => this.pharmacyPurchaseOrderService.approveOrder(orderId, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyPurchaseOrderManage)
  @Post('purchase-orders/:id/cancel')
  async cancelPurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string, @Headers('idempotency-key') idempotencyKey?: string, @Headers('x-idempotency-key') legacyIdempotencyKey?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_purchase_order_cancel', req.user.id, { orderId, locationId: location.id }, () => this.pharmacyPurchaseOrderService.cancelOrder(orderId, location.id, req.user.id, hasRole(req.user, Role.Admin)));
  }

  @RequirePermissions(Permission.PharmacyLocationsRead)
  @Get('locations')
  async getLocations(@Req() req: any) {
    return this.pharmacyLocationService.listAccessibleLocations(req.user);
  }

  @RequirePermissions(Permission.PharmacyLocationsManage)
  @Post('locations')
  async createLocation(@Req() req: any, @Body() body: any) {
    return this.pharmacyLocationService.createLocation(body, req.user);
  }

  @RequirePermissions(Permission.PharmacyLocationsManage)
  @Get('locations/:locationId/users')
  async getLocationUsers(@Req() req: any, @Param('locationId') locationId: string) {
    return this.pharmacyLocationService.listLocationUsers(locationId, req.user);
  }

  @RequirePermissions(Permission.PharmacyLocationsManage)
  @Post('locations/:locationId/users')
  async assignLocationUser(
    @Req() req: any,
    @Param('locationId') locationId: string,
    @Body() body: any,
  ) {
    return this.pharmacyLocationService.assignUser(locationId, body, req.user);
  }

  @RequirePermissions(Permission.PharmacyPosStockRead)
  @Get('products')
  async getProducts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllProducts(location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueRead)
  @Get('medicines')
  async getMedicines(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllMedicines(location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueManage)
  @Post('medicines')
  async createMedicine(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.createMedicine(body, location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueManage)
  @Patch('medicines/:id')
  async updateMedicine(
    @Req() req: any,
    @Param('id') medicineId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.updateMedicine(medicineId, body, location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueRead)
  @Get('products/:id')
  async getProductDetail(
    @Req() req: any,
    @Param('id') productId: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findProductDetail(productId, location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueManage)
  @Post('products')
  async createProduct(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.createProduct(body, location.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueManage)
  @Patch('products/:id')
  async updateProduct(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.updateProduct(productId, body, location.id, req.user.id);
  }

  @RequirePermissions(Permission.PharmacyCatalogueManage)
  @Post('products/:id/batches')
  async addBatch(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_batch_add', req.user.id, { productId, locationId: location.id, body }, () => this.pharmacyService.addBatch(productId, body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacyGoodsReceiptRead)
  @Get('goods-receipts')
  async getGoodsReceipts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.listGoodsReceipts(location.id);
  }

  @RequirePermissions(Permission.PharmacyGoodsReceiptCreate)
  @Post('goods-receipts')
  async receiveStock(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_goods_receipt', req.user.id, { locationId: location.id, body }, () => this.pharmacyService.receiveStock(body, req.user.id, location.id, hasRole(req.user, Role.Admin)));
  }

  @RequirePermissions(Permission.PharmacySaleCreate)
  @Post('sales')
  async checkout(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_sale_checkout', req.user.id, { locationId: location.id, body }, () => this.pharmacyService.processSale(body, req.user.id, location.id));
  }

  @RequirePermissions(Permission.PharmacySaleRead)
  @Get('sales/recent')
  async getRecentSales(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.listRecentSales(location.id, Number(limit) || 30);
  }

  @RequirePermissions(Permission.PharmacyRegisterRead)
  @Get('sales/unclosed')
  async getUnclosedSales(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.getUnclosedSalesSummary(req.user.id, location.id);
  }

  @RequirePermissions(Permission.PharmacyRegisterManage)
  @Post('sales/close')
  async closeSales(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_sales_close', req.user.id, { locationId: location.id, body }, () => this.pharmacyService.closeSession(req.user.id, body, location.id));
  }

  @RequirePermissions(Permission.PharmacySaleRead)
  @Get('sales/:id')
  async getSale(
    @Req() req: any,
    @Param('id') saleId: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findSaleById(saleId, location.id);
  }

  @RequirePermissions(Permission.PharmacyRegisterRead)
  @Get('sessions/active')
  async getActiveSession(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findActiveSession(req.user.id, location.id);
  }

  @RequirePermissions(Permission.PharmacyRegisterManage)
  @Post('sessions/open')
  async openSession(
    @Req() req: any,
    @Body('openingFloat') openingFloat: number,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') legacyIdempotencyKey?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.runIdempotent(idempotencyKey, legacyIdempotencyKey, 'pharmacy_session_open', req.user.id, { locationId: location.id, openingFloat }, () => this.pharmacyService.openSession(req.user.id, openingFloat, location.id));
  }

  @RequirePermissions(Permission.PharmacyClosureRead)
  @Get('closures')
  async getClosures(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllClosures(location.id, startDate, endDate);
  }

  @RequirePermissions(Permission.PharmacyClosureRead)
  @Get('closures/:id')
  async getClosureById(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findClosureById(id, location.id);
  }

  private runIdempotent<T>(
    key: string | undefined,
    legacyKey: string | undefined,
    operation: string,
    userId: string,
    payload: unknown,
    handler: () => Promise<T>,
  ): Promise<T> {
    return this.idempotency.run(key ?? legacyKey, operation, userId, payload, handler);
  }
}

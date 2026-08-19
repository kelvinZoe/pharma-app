import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, Query, Headers, ForbiddenException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PharmacyLocationService } from './pharmacy-location.service';
import { PharmacySupplierService } from './pharmacy-supplier.service';
import { PharmacyPurchaseOrderService } from './pharmacy-purchase-order.service';
import { PharmacyPayablesService } from './pharmacy-payables.service';
import { PharmacyInventoryControlService } from './pharmacy-inventory-control.service';
import { PharmacyTransferService } from './pharmacy-transfer.service';
import { PharmacyNetworkStockService } from './pharmacy-network-stock.service';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard)
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
  ) {}

  @Get('network-stock')
  async getNetworkStock(@Req() req: any, @Query('search') search?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const activeLocation = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    const accessibleLocations = await this.pharmacyLocationService.listAccessibleLocations(req.user);
    return this.pharmacyNetworkStockService.getNetworkStock(activeLocation.id, accessibleLocations.map((location) => location.id), search);
  }

  @Patch('locations/:locationId/products/:productId/inventory-policy')
  async updateLocationInventoryPolicy(@Req() req: any, @Param('locationId') locationId: string, @Param('productId') productId: string, @Body() body: any) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, locationId);
    return this.pharmacyNetworkStockService.updatePolicy(location.id, productId, body, req.user.id);
  }

  @Get('quarantine')
  async getQuarantinedStock(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyNetworkStockService.listQuarantined(location.id);
  }

  @Post('quarantine/:batchId/resolve')
  async resolveQuarantine(@Req() req: any, @Param('batchId') batchId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyNetworkStockService.resolveQuarantine(batchId, location.id, body, req.user.id);
  }

  @Get('transfers/summary')
  async getTransferSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.getSummary(location.id);
  }

  @Get('transfers')
  async getTransfers(@Req() req: any, @Query() query: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.listTransfers(location.id, query);
  }

  @Post('transfers')
  async createTransfer(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.createTransfer(body, req.user.id, location.id, this.hasRole(req.user, 0));
  }

  @Get('transfers/:id')
  async getTransfer(@Req() req: any, @Param('id') transferId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.findTransfer(transferId, location.id);
  }

  @Post('transfers/:id/submit')
  async submitTransfer(@Req() req: any, @Param('id') transferId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.submitTransfer(transferId, req.user.id, location.id, this.hasRole(req.user, 0));
  }

  @Post('transfers/:id/approve')
  async approveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.approveTransfer(transferId, body, req.user.id, location.id);
  }

  @Post('transfers/:id/reject')
  async rejectTransfer(@Req() req: any, @Param('id') transferId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.rejectTransfer(transferId, reason, req.user.id, location.id);
  }

  @Post('transfers/:id/dispatch')
  async dispatchTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.dispatchTransfer(transferId, body, req.user.id, location.id);
  }

  @Post('transfers/:id/receive')
  async receiveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.receiveTransfer(transferId, body, req.user.id, location.id);
  }

  @Post('transfers/:id/resolve')
  async resolveTransfer(@Req() req: any, @Param('id') transferId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.resolveDiscrepancy(transferId, body, req.user.id, location.id);
  }

  @Post('transfers/:id/cancel')
  async cancelTransfer(@Req() req: any, @Param('id') transferId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyTransferService.cancelTransfer(transferId, reason, req.user.id, location.id, this.hasRole(req.user, 0));
  }

  @Get('inventory-control/summary')
  async getInventoryControlSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.getSummary(location.id);
  }

  @Get('stock-ledger')
  async getStockLedger(@Req() req: any, @Query() query: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listLedger(location.id, query);
  }

  @Get('stock-counts')
  async getStockCounts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listCounts(location.id);
  }

  @Post('stock-counts')
  async createStockCount(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.createCount(body, req.user.id, location.id);
  }

  @Get('stock-counts/:id')
  async getStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.findCount(countId, location.id);
  }

  @Patch('stock-counts/:id')
  async saveStockCount(@Req() req: any, @Param('id') countId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.saveCount(countId, body, req.user.id, location.id);
  }

  @Post('stock-counts/:id/submit')
  async submitStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.submitCount(countId, req.user.id, location.id);
  }

  @Post('stock-counts/:id/approve')
  async approveStockCount(@Req() req: any, @Param('id') countId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.approveCount(countId, req.user.id, location.id);
  }

  @Get('stock-adjustments')
  async getStockAdjustments(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.listAdjustments(location.id);
  }

  @Post('stock-adjustments')
  async requestStockAdjustment(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.requestAdjustment(body, req.user.id, location.id);
  }

  @Post('stock-adjustments/:id/approve')
  async approveStockAdjustment(@Req() req: any, @Param('id') adjustmentId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.approveAdjustment(adjustmentId, req.user.id, location.id);
  }

  @Post('stock-adjustments/:id/reject')
  async rejectStockAdjustment(@Req() req: any, @Param('id') adjustmentId: string, @Body('reason') reason: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyInventoryControlService.rejectAdjustment(adjustmentId, req.user.id, location.id, reason);
  }

  @Get('payables/summary')
  async getPayablesSummary(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.getSummary(location.id);
  }

  @Get('supplier-invoices')
  async getSupplierInvoices(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('search') search?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listInvoices(location.id, status, supplierId, search);
  }

  @Get('supplier-invoices/:id')
  async getSupplierInvoiceDetail(@Req() req: any, @Param('id') invoiceId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.findInvoiceDetail(invoiceId, location.id);
  }

  @Patch('supplier-invoices/:id')
  async updateSupplierInvoice(@Req() req: any, @Param('id') invoiceId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.updateInvoice(invoiceId, location.id, body, req.user.id);
  }

  @Get('supplier-payments')
  async getSupplierPayments(@Req() req: any, @Query('supplierId') supplierId?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listPayments(location.id, supplierId);
  }

  @Post('supplier-payments')
  async recordSupplierPayment(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.recordPayment(body, req.user.id, location.id);
  }

  @Get('purchase-returns')
  async getPurchaseReturns(@Req() req: any, @Query('supplierId') supplierId?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.listPurchaseReturns(location.id, supplierId);
  }

  @Post('purchase-returns')
  async recordPurchaseReturn(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.recordPurchaseReturn(body, req.user.id, location.id);
  }

  @Get('supplier-statements/:supplierId')
  async getSupplierStatement(@Req() req: any, @Param('supplierId') supplierId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const consolidated = this.hasRole(req.user, 0) || this.hasRole(req.user, 5);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPayablesService.getSupplierStatement(supplierId, startDate, endDate, location?.id);
  }

  @Get('suppliers')
  async getSuppliers(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const consolidated = this.hasRole(req.user, 0) || this.hasRole(req.user, 5);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacySupplierService.listSuppliers(location?.id);
  }

  @Get('suppliers/:id')
  async getSupplierDetail(@Req() req: any, @Param('id') supplierId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const consolidated = this.hasRole(req.user, 0) || this.hasRole(req.user, 5);
    const location = consolidated ? null : await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacySupplierService.findSupplierDetail(supplierId, location?.id);
  }

  @Post('suppliers')
  async createSupplier(@Req() req: any, @Body() body: any) {
    this.ensureRoles(req.user, [0]);
    return this.pharmacySupplierService.createSupplier(body);
  }

  @Patch('suppliers/:id')
  async updateSupplier(@Req() req: any, @Param('id') supplierId: string, @Body() body: any) {
    this.ensureRoles(req.user, [0]);
    return this.pharmacySupplierService.updateSupplier(supplierId, body);
  }

  @Get('purchase-orders')
  async getPurchaseOrders(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.listOrders(location.id);
  }

  @Get('purchase-orders/:id')
  async getPurchaseOrderDetail(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.findOrderDetail(orderId, location.id);
  }

  @Post('purchase-orders')
  async createPurchaseOrder(@Req() req: any, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.createOrder(body, req.user.id, location.id);
  }

  @Patch('purchase-orders/:id')
  async updatePurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Body() body: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.updateOrder(orderId, body, location.id, req.user.id);
  }

  @Post('purchase-orders/:id/submit')
  async submitPurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.submitOrder(orderId, req.user.id, location.id);
  }

  @Post('purchase-orders/:id/approve')
  async approvePurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.approveOrder(orderId, req.user.id, location.id);
  }

  @Post('purchase-orders/:id/cancel')
  async cancelPurchaseOrder(@Req() req: any, @Param('id') orderId: string, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyPurchaseOrderService.cancelOrder(orderId, location.id, req.user.id, this.hasRole(req.user, 0));
  }

  @Get('locations')
  async getLocations(@Req() req: any) {
    this.ensureRoles(req.user, [0, 4, 5]);
    return this.pharmacyLocationService.listAccessibleLocations(req.user);
  }

  @Post('locations')
  async createLocation(@Req() req: any, @Body() body: any) {
    this.ensureRoles(req.user, [0]);
    return this.pharmacyLocationService.createLocation(body, req.user);
  }

  @Get('locations/:locationId/users')
  async getLocationUsers(@Req() req: any, @Param('locationId') locationId: string) {
    this.ensureRoles(req.user, [0]);
    return this.pharmacyLocationService.listLocationUsers(locationId, req.user);
  }

  @Post('locations/:locationId/users')
  async assignLocationUser(
    @Req() req: any,
    @Param('locationId') locationId: string,
    @Body() body: any,
  ) {
    this.ensureRoles(req.user, [0]);
    return this.pharmacyLocationService.assignUser(locationId, body, req.user);
  }

  @Get('products')
  async getProducts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllProducts(location.id);
  }

  @Get('medicines')
  async getMedicines(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllMedicines(location.id);
  }

  @Post('medicines')
  async createMedicine(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.createMedicine(body, location.id);
  }

  @Patch('medicines/:id')
  async updateMedicine(
    @Req() req: any,
    @Param('id') medicineId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.updateMedicine(medicineId, body, location.id);
  }

  @Get('products/:id')
  async getProductDetail(
    @Req() req: any,
    @Param('id') productId: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findProductDetail(productId, location.id);
  }

  @Post('products')
  async createProduct(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.createProduct(body, location.id);
  }

  @Patch('products/:id')
  async updateProduct(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.updateProduct(productId, body, location.id, req.user.id);
  }

  @Post('products/:id/batches')
  async addBatch(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.addBatch(productId, body, req.user.id, location.id);
  }

  @Get('goods-receipts')
  async getGoodsReceipts(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.listGoodsReceipts(location.id);
  }

  @Post('goods-receipts')
  async receiveStock(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.receiveStock(body, req.user.id, location.id, this.hasRole(req.user, 0));
  }

  @Post('sales')
  async checkout(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.processSale(body, req.user.id, location.id);
  }

  @Get('sales/recent')
  async getRecentSales(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.listRecentSales(location.id, Number(limit) || 30);
  }

  @Get('sales/unclosed')
  async getUnclosedSales(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.getUnclosedSalesSummary(req.user.id, location.id);
  }

  @Post('sales/close')
  async closeSales(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.closeSession(req.user.id, body, location.id);
  }

  @Get('sales/:id')
  async getSale(
    @Req() req: any,
    @Param('id') saleId: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findSaleById(saleId, location.id);
  }

  @Get('sessions/active')
  async getActiveSession(@Req() req: any, @Headers('x-pharmacy-location-id') requestedLocationId?: string) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findActiveSession(req.user.id, location.id);
  }

  @Post('sessions/open')
  async openSession(
    @Req() req: any,
    @Body('openingFloat') openingFloat: number,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.openSession(req.user.id, openingFloat, location.id);
  }

  @Get('closures')
  async getClosures(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findAllClosures(location.id, startDate, endDate);
  }

  @Get('closures/:id')
  async getClosureById(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('x-pharmacy-location-id') requestedLocationId?: string,
  ) {
    this.ensureRoles(req.user, [0, 4, 5]);
    const location = await this.pharmacyLocationService.resolveAccessibleLocation(req.user, requestedLocationId);
    return this.pharmacyService.findClosureById(id, location.id);
  }

  private ensureRoles(user: any, allowedRoles: number[]) {
    const rawRoles = user?.roles;
    const roles = Array.isArray(rawRoles)
      ? rawRoles.map(Number)
      : rawRoles
        ? String(rawRoles).split(',').map(Number)
        : [Number(user?.role)];
    if (!roles.some((role) => allowedRoles.includes(role))) {
      throw new ForbiddenException('You do not have permission to perform this pharmacy operation');
    }
  }

  private hasRole(user: any, role: number): boolean {
    const rawRoles = user?.roles;
    const roles = Array.isArray(rawRoles) ? rawRoles.map(Number) : rawRoles ? String(rawRoles).split(',').map(Number) : [Number(user?.role)];
    return roles.includes(role);
  }
}

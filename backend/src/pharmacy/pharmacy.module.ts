import { Module } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { PharmacyController } from './pharmacy.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PharmacyLocationService } from './pharmacy-location.service';
import { PharmacySupplierService } from './pharmacy-supplier.service';
import { PharmacyPurchaseOrderService } from './pharmacy-purchase-order.service';
import { PharmacyPayablesService } from './pharmacy-payables.service';
import { PharmacyInventoryControlService } from './pharmacy-inventory-control.service';
import { PharmacyTransferService } from './pharmacy-transfer.service';
import { PharmacyNetworkStockService } from './pharmacy-network-stock.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  providers: [PharmacyService, PharmacyLocationService, PharmacySupplierService, PharmacyPurchaseOrderService, PharmacyPayablesService, PharmacyInventoryControlService, PharmacyTransferService, PharmacyNetworkStockService],
  controllers: [PharmacyController],
  exports: [PharmacyService, PharmacyLocationService, PharmacySupplierService, PharmacyPurchaseOrderService, PharmacyPayablesService, PharmacyInventoryControlService, PharmacyTransferService, PharmacyNetworkStockService],
})
export class PharmacyModule {}

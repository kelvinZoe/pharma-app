import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController, BillingSessionsController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  providers: [BillingService],
  controllers: [BillingController, BillingSessionsController],
  exports: [BillingService],
})
export class BillingModule {}

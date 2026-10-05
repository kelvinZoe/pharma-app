import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController, BillingSessionsController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdempotencyService } from '../common/idempotency.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  providers: [BillingService, IdempotencyService],
  controllers: [BillingController, BillingSessionsController],
  exports: [BillingService],
})
export class BillingModule {}

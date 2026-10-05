import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyService } from '../common/idempotency.service';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [AccountingService, IdempotencyService],
  controllers: [AccountingController],
})
export class AccountingModule {}

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { VisitsModule } from './visits/visits.module';
import { BillingModule } from './billing/billing.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { EmailModule } from './common/email/email.module';
import { TenantMiddleware } from './common/multitenancy/tenant.middleware';
import { ExpensesModule } from './expenses/expenses.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    VisitsModule,
    BillingModule,
    PharmacyModule,
    ReportsModule,
    SettingsModule,
    EmailModule,
    ExpensesModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}

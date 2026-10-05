import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../common/email/email.module';
import { PermissionsGuard } from './guards/permissions.guard';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      global: true,
      secret: jwtSecret ?? 'pharmaflow_local_development_only_secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  providers: [AuthService, PermissionsGuard],
  controllers: [AuthController],
  exports: [AuthService, PermissionsGuard],
})
export class AuthModule {}

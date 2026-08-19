import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { TenantContextService } from '../../common/multitenancy/tenant-context.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    try {
      const user = await this.authService.verifyToken(token);
      if (!user.tenantId) {
        throw new UnauthorizedException('User is not assigned to a tenant');
      }
      const contextTenantId = TenantContextService.getTenantId();
      if (contextTenantId && contextTenantId !== user.tenantId) {
        throw new UnauthorizedException('Token tenant does not match the authenticated user');
      }
      if (!contextTenantId) {
        TenantContextService.enter({ tenantId: user.tenantId, tenantSlug: user.tenant?.slug });
      }
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      throw error;
    }
  }
}

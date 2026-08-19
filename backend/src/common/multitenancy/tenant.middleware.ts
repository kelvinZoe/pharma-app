import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    let tenantId: string | undefined;
    let tenantSlug: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const verified = this.jwtService.verify(token);
        if (verified?.tenantId) {
          tenantId = String(verified.tenantId);
          tenantSlug = verified.tenantSlug ? String(verified.tenantSlug) : undefined;
        }
      } catch {
        // Protected routes are rejected by JwtAuthGuard; public routes continue without tenant context.
      }
    }

    if (tenantId) {
      TenantContextService.run({ tenantId, tenantSlug }, () => next());
    } else {
      next();
    }
  }
}

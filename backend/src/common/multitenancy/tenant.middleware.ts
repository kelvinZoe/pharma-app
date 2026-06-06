import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    let tenantId: string | undefined;
    let tenantSlug: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
          if (decoded && decoded.tenantId) {
            tenantId = decoded.tenantId;
            tenantSlug = decoded.tenantSlug;
          }
        }
      } catch {
        // Ignore invalid token formatting; the JwtAuthGuard will handle actual signature rejection
      }
    }

    // If a tenant context was resolved, run the request inside the AsyncLocalStorage wrapper
    if (tenantId) {
      TenantContextService.run({ tenantId, tenantSlug }, () => next());
    } else {
      next();
    }
  }
}

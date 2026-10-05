import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';

export function authorizeController(
  controller: object,
  method: string,
  request: any,
): boolean {
  const context = {
    getClass: () => controller.constructor,
    getHandler: () => controller[method],
    switchToHttp: () => ({
      getRequest: () => ({
        ...request,
        user: request.user
          ? { id: 'test-user', tenantId: 'test-tenant', ...request.user }
          : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
  return new PermissionsGuard(new Reflector()).canActivate(context);
}

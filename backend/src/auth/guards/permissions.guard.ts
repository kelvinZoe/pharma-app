import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission, Permission } from '../authorization/permissions';
import { PERMISSIONS_METADATA } from '../authorization/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.id || !user.tenantId)
      throw new UnauthorizedException('Authentication is required');
    const permissions = this.reflector.getAllAndMerge<Permission[]>(
      PERMISSIONS_METADATA,
      [context.getClass(), context.getHandler()],
    );
    if (
      !Array.isArray(permissions) ||
      !permissions.length ||
      !permissions.every((permission) => hasPermission(user, permission))
    ) {
      throw new ForbiddenException(
        'You do not have permission to perform this operation',
      );
    }
    return true;
  }
}

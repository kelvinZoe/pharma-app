import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const PERMISSIONS_METADATA = 'pharma.required-permissions';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_METADATA, permissions);

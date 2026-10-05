import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission, Role } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';

class TestController {
  @RequirePermissions(Permission.ClinicPaymentCreate)
  payment() {}

  missingPolicy() {}

  @RequirePermissions(
    Permission.ClinicPaymentCreate,
    Permission.FinancialReportsRead,
  )
  multiplePermissions() {}

  @RequirePermissions()
  emptyPolicy() {}

  @RequirePermissions('unknown.permission' as Permission)
  unknownPolicy() {}
}

@RequirePermissions(Permission.StaffManage)
class RestrictedController {
  @RequirePermissions(Permission.ProfileRead)
  profile() {}
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const activate = (
    method: string,
    user: any,
    controller: any = TestController,
  ) =>
    guard.canActivate({
      getClass: () => controller,
      getHandler: () => controller.prototype[method],
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as ExecutionContext);
  const staff = (role: Role) => ({
    id: 'staff',
    tenantId: 'tenant',
    role,
    roles: [role],
  });

  it.each([
    undefined,
    { roles: [Role.Admin] },
    { id: 'staff', roles: [Role.Admin] },
  ])('requires a verified tenant-associated identity: %j', (user) => {
    expect(() => activate('payment', user)).toThrow(UnauthorizedException);
  });

  it('allows frontdesk payments but blocks pharmacy', () => {
    expect(activate('payment', staff(Role.Frontdesk))).toBe(true);
    expect(() => activate('payment', staff(Role.Pharmacy))).toThrow(
      ForbiddenException,
    );
  });

  it.each(['missingPolicy', 'emptyPolicy', 'unknownPolicy'])(
    'denies unconfigured routes even for admin: %s',
    (method) => {
      expect(() => activate(method, staff(Role.Admin))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('requires every declared permission', () => {
    expect(() =>
      activate('multiplePermissions', staff(Role.Frontdesk)),
    ).toThrow(ForbiddenException);
    expect(activate('multiplePermissions', staff(Role.Accounting))).toBe(true);
  });

  it('does not let method metadata weaken a controller requirement', () => {
    expect(() =>
      activate('profile', staff(Role.Accounting), RestrictedController),
    ).toThrow(ForbiddenException);
    expect(activate('profile', staff(Role.Admin), RestrictedController)).toBe(
      true,
    );
  });
});

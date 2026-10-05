import { readFileSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { AccountingController } from '../../accounting/accounting.controller';
import { AuthController } from '../auth.controller';
import {
  BillingController,
  BillingSessionsController,
} from '../../billing/billing.controller';
import { ExpensesController } from '../../expenses/expenses.controller';
import { NotificationsController } from '../../notifications/notifications.controller';
import { PharmacyController } from '../../pharmacy/pharmacy.controller';
import { ReportsController } from '../../reports/reports.controller';
import { ServicesController } from '../../services/services.controller';
import { SettingsController } from '../../settings/settings.controller';
import { UsersController } from '../../users/users.controller';
import { VisitsController } from '../../visits/visits.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { PERMISSIONS_METADATA } from './require-permissions.decorator';
import { authorizeController } from '../../../test/helpers/authorize-controller';

const controllers = {
  AccountingController,
  AuthController,
  BillingController,
  BillingSessionsController,
  ExpensesController,
  NotificationsController,
  PharmacyController,
  ReportsController,
  ServicesController,
  SettingsController,
  UsersController,
  VisitsController,
};
const baseline: Array<{
  controller: keyof typeof controllers;
  method: string;
  roles: number[];
}> = JSON.parse(
  readFileSync(
    join(__dirname, '../../../test/fixtures/route-permissions.json'),
    'utf8',
  ),
);

describe('Protected route permission coverage', () => {
  it.each(baseline)(
    '$controller.$method preserves the approved six-role access matrix',
    (route) => {
      const controller = controllers[route.controller];
      const handler = controller.prototype[route.method];
      expect(
        Reflect.getMetadata(PERMISSIONS_METADATA, handler)?.length,
      ).toBeGreaterThan(0);
      const guards = [
        ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
        ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
      ];
      expect(guards).toEqual([JwtAuthGuard, PermissionsGuard]);
      for (const role of [0, 1, 2, 3, 4, 5]) {
        const authorize = () =>
          authorizeController(
            { constructor: controller, [route.method]: handler },
            route.method,
            { user: { role, roles: [role] } },
          );
        if (route.roles.includes(role)) expect(authorize()).toBe(true);
        else expect(authorize).toThrow(ForbiddenException);
      }
    },
  );

  it('requires a reviewed policy snapshot for every protected handler', () => {
    const actual: string[] = [];
    for (const controller of Object.values(controllers)) {
      for (const method of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[method];
        if (!Reflect.hasMetadata(METHOD_METADATA, handler)) continue;
        const guards = [
          ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
          ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
        ];
        if (guards.includes(JwtAuthGuard))
          actual.push(`${controller.name}.${method}`);
      }
    }
    expect(actual.sort()).toEqual(
      baseline.map((route) => `${route.controller}.${route.method}`).sort(),
    );
  });
});

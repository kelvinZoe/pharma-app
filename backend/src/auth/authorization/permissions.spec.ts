import {
  getUserRoles,
  hasPermission,
  canAccessModule,
  Permission,
  Role,
} from './permissions';

describe('Central permission policy', () => {
  it.each([
    [{ role: Role.Pharmacy }, [Role.Pharmacy]],
    [
      { role: Role.Admin, roles: [Role.Frontdesk, Role.Accounting] },
      [Role.Frontdesk, Role.Accounting],
    ],
    [{ roles: '1, 5' }, [Role.Frontdesk, Role.Accounting]],
    [{ roles: ['2', '3', '2'] }, [Role.Laboratory, Role.Scanning]],
  ])(
    'normalizes assigned roles without trusting the selected workspace: %j',
    (user, expected) => {
      expect(getUserRoles(user)).toEqual(expected);
    },
  );

  it.each([
    undefined,
    {},
    { role: null },
    { role: '' },
    { role: false },
    { role: 6 },
    { roles: [] },
    { roles: '' },
    { roles: ' ' },
    { roles: '0,,1' },
    { roles: [null] },
    { roles: [false] },
    { roles: [''] },
    { roles: [0, 'invalid'] },
    { roles: '0,99' },
  ])('fails closed for missing or malformed role data: %j', (user) => {
    expect(getUserRoles(user)).toEqual([]);
    expect(hasPermission(user, Permission.StaffManage)).toBe(false);
  });

  it('unions multi-role permissions without granting an unassigned role', () => {
    const user = { roles: [Role.Frontdesk, Role.Accounting] };
    expect(hasPermission(user, Permission.PatientRead)).toBe(true);
    expect(hasPermission(user, Permission.FinancialReportsRead)).toBe(true);
    expect(hasPermission(user, Permission.PharmacySaleCreate)).toBe(false);
    expect(hasPermission(user, Permission.StaffManage)).toBe(false);
  });

  it('grants administrators every defined permission, even in a diagnostic workspace', () => {
    for (const permission of Object.values(Permission)) {
      expect(
        hasPermission({ role: Role.Scanning, roles: [Role.Admin] }, permission),
      ).toBe(true);
    }
  });

  it.each(['unknown.permission', 'toString', '__proto__'])(
    'does not let admin bypass unknown permissions: %s',
    (permission) => {
      expect(
        hasPermission({ roles: [Role.Admin] }, permission as Permission),
      ).toBe(false);
    },
  );

  it('only allows known assigned dashboards', () => {
    expect(canAccessModule({ roles: [Role.Admin] }, 'unknown')).toBe(false);
    expect(canAccessModule({ roles: [Role.Admin] }, 'constructor')).toBe(false);
    expect(canAccessModule({ roles: [Role.Admin] }, 'laboratory')).toBe(true);
    expect(canAccessModule({ roles: [Role.Pharmacy] }, 'accounting')).toBe(
      false,
    );
    expect(
      canAccessModule(
        { roles: [Role.Pharmacy, Role.Accounting] },
        'accounting',
      ),
    ).toBe(true);
  });
});

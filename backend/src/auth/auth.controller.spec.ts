import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { Role } from './authorization/permissions';

describe('Workspace role selection', () => {
  const auth = {
    validateUser: jest.fn(),
    login: jest.fn(() => ({ token: 'test-token' })),
  };
  const controller = new AuthController(auth as any);

  beforeEach(() => {
    jest.clearAllMocks();
    auth.validateUser.mockResolvedValue({
      id: 'staff',
      role: Role.Admin,
      roles: '0',
      module: 'admin',
    });
  });

  it.each([false, true, null, '', ' ', 6, '99', [], [0], {}])(
    'rejects invalid workspace selectors: %j',
    async (role) => {
      await expect(
        controller.login({
          email: 'staff@example.test',
          password: 'test',
          role,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auth.login).not.toHaveBeenCalled();
    },
  );

  it('allows an administrator to choose a valid pharmacy workspace', async () => {
    await controller.login({
      email: 'staff@example.test',
      password: 'test',
      role: '4',
    });
    expect(auth.login).toHaveBeenCalledWith(
      expect.objectContaining({
        role: Role.Pharmacy,
        roles: '0',
        module: 'pharmacy',
      }),
    );
  });

  it('refuses an unassigned workspace even when it is a valid role code', async () => {
    auth.validateUser.mockResolvedValue({
      id: 'staff',
      role: Role.Frontdesk,
      roles: '1,5',
      module: 'frontdesk',
    });
    await expect(
      controller.login({
        email: 'staff@example.test',
        password: 'test',
        role: Role.Pharmacy,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.login).not.toHaveBeenCalled();
  });
});

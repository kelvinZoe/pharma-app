import { ForbiddenException } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { authorizeController } from '../../test/helpers/authorize-controller';

describe('AccountingController authorization', () => {
  const accounting = {
    listPeriods: jest.fn(),
    listReversals: jest.fn(),
  } as any;
  const idempotency = { run: jest.fn() } as any;
  const controller = new AccountingController(accounting, idempotency);

  beforeEach(() => jest.clearAllMocks());

  it.each([1, 2, 3, 4])(
    'rejects role %s for period and reversal commands',
    (role) => {
      const req = { user: { id: 'staff', role, roles: [role] } };
      expect(() => authorizeController(controller, 'listPeriods', req)).toThrow(ForbiddenException);
      expect(() =>
        authorizeController(controller, 'requestReversal', req),
      ).toThrow(ForbiddenException);
      expect(idempotency.run).not.toHaveBeenCalled();
    },
  );

  it.each([0, 5])(
    'allows role %s and applies idempotency to approvals',
    (role) => {
      const req = { user: { id: 'reviewer', role, roles: [role] } };
      authorizeController(controller, 'approveReversal', req);
      controller.approveReversal(req, 'reversal', 'request-key');
      expect(idempotency.run).toHaveBeenCalledWith(
        'request-key',
        'financial_reversal_approve',
        'reviewer',
        { id: 'reversal' },
        expect.any(Function),
      );
    },
  );
});

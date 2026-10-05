import { ForbiddenException } from '@nestjs/common';
import { AccountingController } from './accounting.controller';

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
      expect(() => controller.listPeriods(req)).toThrow(ForbiddenException);
      expect(() =>
        controller.requestReversal(req, { entityId: 'entry' }, 'request-key'),
      ).toThrow(ForbiddenException);
      expect(idempotency.run).not.toHaveBeenCalled();
    },
  );

  it.each([0, 5])(
    'allows role %s and applies idempotency to approvals',
    (role) => {
      const req = { user: { id: 'reviewer', role, roles: [role] } };
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

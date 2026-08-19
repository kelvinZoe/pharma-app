import { ForbiddenException } from '@nestjs/common';
import { ReportsController } from './reports.controller';

describe('ReportsController authorization', () => {
  const service = {
    getCombinedSummary: jest.fn(),
    getAuditLogs: jest.fn(),
  } as any;
  const controller = new ReportsController(service);

  it('blocks non-accounting users from the financial summary', async () => {
    await expect(controller.getSummary({ user: { role: 4, roles: [4] } })).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getCombinedSummary).not.toHaveBeenCalled();
  });

  it('allows accounting users to request the financial summary', async () => {
    service.getCombinedSummary.mockResolvedValueOnce({ combinedTotal: 0 });
    await expect(controller.getSummary({ user: { role: 5, roles: [5] } })).resolves.toEqual({ combinedTotal: 0 });
  });
});

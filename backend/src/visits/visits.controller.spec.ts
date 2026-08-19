import { ForbiddenException } from '@nestjs/common';
import { VisitsController } from './visits.controller';

describe('VisitsController authorization', () => {
  const service = {
    searchPatients: jest.fn(),
    getActiveVisits: jest.fn().mockResolvedValue([]),
    requestServicePriceAdjustment: jest.fn(),
  } as any;
  const controller = new VisitsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('blocks pharmacy users from searching patient records', async () => {
    await expect(controller.search({ user: { role: 4, roles: [4] } }, 'Arthur')).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.searchPatients).not.toHaveBeenCalled();
  });

  it('forces laboratory users onto the laboratory queue', async () => {
    await controller.getActive({ user: { role: 2, roles: [2] } }, 'SCAN', 'true');
    expect(service.getActiveVisits).toHaveBeenCalledWith('LAB', false);
  });

  it('passes the active department role into price adjustment checks', async () => {
    service.requestServicePriceAdjustment.mockResolvedValueOnce({ id: 'line-1' });
    await controller.requestServicePriceAdjustment(
      { user: { id: 'user-1', role: 3, roles: [3] } },
      'visit-1',
      'line-1',
      { requestedLineTotal: 200, reason: 'Complex scan' },
    );
    expect(service.requestServicePriceAdjustment).toHaveBeenCalledWith(
      'visit-1',
      'line-1',
      expect.any(Object),
      'user-1',
      3,
    );
  });
});

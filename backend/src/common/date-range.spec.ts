import { BadRequestException } from '@nestjs/common';
import { buildDateRange } from './date-range';

describe('buildDateRange', () => {
  it('includes the complete selected end date', () => {
    const range = buildDateRange('2026-08-01', '2026-08-17');
    expect(range.gte?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(range.lte?.toISOString()).toBe('2026-08-17T23:59:59.999Z');
  });

  it('rejects reversed date ranges', () => {
    expect(() => buildDateRange('2026-08-18', '2026-08-17')).toThrow(BadRequestException);
  });

  it('defaults bounded reports to a safe rolling window', () => {
    const range = buildDateRange(undefined, undefined, {
      defaultDays: 31,
      maxDays: 366,
      now: new Date('2026-08-19T11:00:00.000Z'),
    });
    expect(range.gte?.toISOString()).toBe('2026-07-20T00:00:00.000Z');
    expect(range.lte?.toISOString()).toBe('2026-08-19T11:00:00.000Z');
  });

  it('rejects report ranges longer than the configured maximum', () => {
    expect(() => buildDateRange('2025-01-01', '2026-08-19', { maxDays: 366 })).toThrow(BadRequestException);
  });
});

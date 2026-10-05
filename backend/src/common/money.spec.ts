import { BadRequestException } from '@nestjs/common';
import { ensureNonNegativeMoney, ensurePositiveMoney, formatMoney, money } from './money';

describe('money helpers', () => {
  it('rounds values to two decimal places with decimal arithmetic', () => {
    expect(formatMoney(money('10.235'))).toBe('10.24');
    expect(formatMoney(money(0.1).plus(money(0.2)))).toBe('0.30');
  });

  it('rejects invalid and negative values for guarded money inputs', () => {
    expect(() => money('not-a-number')).toThrow(BadRequestException);
    expect(() => ensurePositiveMoney(0)).toThrow(BadRequestException);
    expect(() => ensureNonNegativeMoney(-1)).toThrow(BadRequestException);
  });
});

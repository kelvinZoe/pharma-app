import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type MoneyValue = string | number | Prisma.Decimal | null | undefined;

const MONEY_DECIMAL_PLACES = 2;

export function money(value: MoneyValue, fieldName = 'Amount'): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException(`${fieldName} is required`);
  }

  try {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite()) {
      throw new Error('Non-finite decimal');
    }
    return decimal.toDecimalPlaces(MONEY_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid amount`);
  }
}

export function optionalMoney(value: MoneyValue, defaultValue: MoneyValue = 0, fieldName = 'Amount'): Prisma.Decimal {
  return money(value ?? defaultValue, fieldName);
}

export function ensureNonNegativeMoney(value: MoneyValue, fieldName = 'Amount'): Prisma.Decimal {
  const decimal = money(value, fieldName);
  if (decimal.lt(0)) {
    throw new BadRequestException(`${fieldName} cannot be negative`);
  }
  return decimal;
}

export function ensurePositiveMoney(value: MoneyValue, fieldName = 'Amount'): Prisma.Decimal {
  const decimal = money(value, fieldName);
  if (decimal.lte(0)) {
    throw new BadRequestException(`${fieldName} must be greater than zero`);
  }
  return decimal;
}

export function zeroMoney(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

export function moneyToNumber(value: MoneyValue): number {
  return optionalMoney(value).toNumber();
}

export function formatMoney(value: MoneyValue): string {
  return optionalMoney(value).toFixed(MONEY_DECIMAL_PLACES);
}

import { BadRequestException } from '@nestjs/common';

export interface DateRange {
  gte?: Date;
  lte?: Date;
}

export interface DateRangeOptions {
  defaultDays?: number;
  maxDays?: number;
  now?: Date;
}

function parseBoundary(value: string, endOfDay: boolean): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${endOfDay ? 'end' : 'start'} date`);
  }
  if (dateOnly && endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  }
  return parsed;
}

export function buildDateRange(startDate?: string, endDate?: string, options: DateRangeOptions = {}): DateRange {
  const range: DateRange = {};
  if (startDate) range.gte = parseBoundary(startDate, false);
  if (endDate) range.lte = parseBoundary(endDate, true);

  if (options.defaultDays) {
    const defaultDays = Math.max(1, Math.trunc(options.defaultDays));
    if (!range.lte) {
      range.lte = new Date(options.now ?? new Date());
    }
    if (!range.gte) {
      range.gte = new Date(range.lte);
      range.gte.setUTCHours(0, 0, 0, 0);
      range.gte.setUTCDate(range.gte.getUTCDate() - defaultDays + 1);
    }
  }

  if (range.gte && range.lte && range.lte < range.gte) {
    throw new BadRequestException('End date cannot be before start date');
  }

  if (options.maxDays && range.gte && range.lte) {
    const maxDays = Math.max(1, Math.trunc(options.maxDays));
    const requestedDays = Math.floor((range.lte.getTime() - range.gte.getTime()) / 86_400_000) + 1;
    if (requestedDays > maxDays) {
      throw new BadRequestException(`Date range cannot exceed ${maxDays} days`);
    }
  }
  return range;
}

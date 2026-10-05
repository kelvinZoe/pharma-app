import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './multitenancy/tenant-context.service';

type Handler<T> = () => Promise<T>;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    key: string | string[] | undefined,
    operation: string,
    userId: string,
    payload: unknown,
    handler: Handler<T>,
  ): Promise<T> {
    const idempotencyKey = this.normalizeKey(key);
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant context is required');

    const requestHash = this.hashPayload({ operation, payload });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let handlerRejected = false;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockName = JSON.stringify([tenantId, userId, idempotencyKey]);
        const locks = await tx.$queryRaw<
          Array<{ acquired: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtextextended(${lockName}, 0)) AS acquired`;
        if (!locks[0]?.acquired) {
          throw new ConflictException({
            code: 'REQUEST_IN_PROGRESS',
            message:
              'This request is still processing. Recover the result using the same request.',
          });
        }
        const where = { tenantId, userId, idempotencyKey };
        const existing = await tx.idempotencyRecord.findFirst({ where });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message:
                'This request key was already used for different payment details. Recover the original request first.',
            });
          }
          if (existing.status === 'completed')
            return existing.responseJson as T;
          throw new ConflictException({
            code: 'REQUEST_OUTCOME_UNCONFIRMED',
            message:
              'An earlier request has an unconfirmed outcome. Check the transaction register before taking another payment.',
          });
        }
        const record = await tx.idempotencyRecord.create({
          data: {
            ...where,
            operation,
            requestHash,
            status: 'in_progress',
            expiresAt,
          },
        });
        let response: T;
        try {
          response = await handler();
        } catch (error) {
          handlerRejected = true;
          throw error;
        }
        await tx.idempotencyRecord.update({
          where: { id: record.id, tenantId },
          data: {
            status: 'completed',
            responseJson:
              response === undefined || response === null
                ? Prisma.JsonNull
                : JSON.parse(JSON.stringify(response)),
            errorMessage: null,
          },
        });
        return response;
      });
    } catch (error: any) {
      if (
        handlerRejected &&
        error instanceof HttpException &&
        error.getStatus() < 500
      ) {
        const body = error.getResponse();
        throw new HttpException(
          {
            ...(typeof body === 'object' ? body : { message: body }),
            requestOutcome: 'not_committed',
          },
          error.getStatus(),
        );
      }
      throw error;
    }
  }

  private normalizeKey(rawKey: string | string[] | undefined): string {
    const value = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const key = String(value ?? '').trim();
    if (!key)
      throw new BadRequestException(
        'Idempotency-Key header is required for this operation.',
      );
    if (key.length < 8 || key.length > 160) {
      throw new BadRequestException(
        'Idempotency-Key must be between 8 and 160 characters.',
      );
    }
    if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key contains unsupported characters.',
      );
    }
    return key;
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === undefined) return '"__undefined__"';
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value))
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }
}

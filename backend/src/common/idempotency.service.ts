import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
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

    try {
      await (this.prisma as any).idempotencyRecord.deleteMany({
        where: { tenantId, userId, expiresAt: { lt: new Date() } },
      });
      await (this.prisma as any).idempotencyRecord.create({
        data: {
          tenantId,
          userId,
          idempotencyKey,
          operation,
          requestHash,
          status: 'in_progress',
          expiresAt,
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const existing = await (this.prisma as any).idempotencyRecord.findUnique({
        where: { tenantId_userId_idempotencyKey: { tenantId, userId, idempotencyKey } },
      });
      if (!existing) throw new ConflictException('The request is already being processed. Retry shortly.');
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('This idempotency key was already used for a different request.');
      }
      if (existing.status === 'completed') {
        return existing.responseJson as T;
      }
      if (existing.status === 'failed') {
        throw new ConflictException('The previous request with this idempotency key failed. Use a new key to retry.');
      }
      throw new ConflictException('The request is already being processed. Retry shortly.');
    }

    try {
      const response = await handler();
      await (this.prisma as any).idempotencyRecord.update({
        where: { tenantId_userId_idempotencyKey: { tenantId, userId, idempotencyKey } },
        data: {
          status: 'completed',
          responseJson: response === undefined ? null : JSON.parse(JSON.stringify(response)),
          errorMessage: null,
        },
      });
      return response;
    } catch (error: any) {
      await (this.prisma as any).idempotencyRecord.update({
        where: { tenantId_userId_idempotencyKey: { tenantId, userId, idempotencyKey } },
        data: {
          status: 'failed',
          errorMessage: String(error?.message ?? 'Request failed').slice(0, 1000),
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  private normalizeKey(rawKey: string | string[] | undefined): string {
    const value = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const key = String(value ?? '').trim();
    if (!key) throw new BadRequestException('Idempotency-Key header is required for this operation.');
    if (key.length < 8 || key.length > 160) {
      throw new BadRequestException('Idempotency-Key must be between 8 and 160 characters.');
    }
    if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
      throw new BadRequestException('Idempotency-Key contains unsupported characters.');
    }
    return key;
  }

  private hashPayload(payload: unknown): string {
    return createHash('sha256').update(this.stableStringify(payload)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === undefined) return '"__undefined__"';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, shareReplay, tap, throwError } from 'rxjs';
import { SessionService } from '../auth/session.service';

export type PaymentOperation = 'clinic' | 'pharmacy' | 'supplier';

export interface PendingPayment {
  key: string;
  operation: PaymentOperation;
  targetId: string;
  locationId: string;
  createdAt: string;
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class PaymentAttemptService {
  private readonly session = inject(SessionService);
  private readonly version = signal(0);
  private readonly activeRequests = new Map<string, Observable<any>>();

  pending(operation: PaymentOperation, targetId?: string): PendingPayment[] {
    this.version();
    const storageKey = this.storageKey();
    if (!storageKey) return [];
    const locationId =
      operation === 'clinic' ? '' : (this.session.activePharmacyLocationId() ?? '');
    try {
      return Object.values(this.read(storageKey)).filter(
        (attempt) =>
          attempt.operation === operation &&
          attempt.locationId === locationId &&
          (targetId === undefined || attempt.targetId === targetId),
      );
    } catch {
      return [];
    }
  }

  perform<Result>(
    operation: PaymentOperation,
    targetId: string,
    payload: any,
    send: (key: string, payload: any, locationId: string) => Observable<Result>,
    hasReceipt: (response: Result) => boolean,
  ): Observable<Result> {
    return defer(() => {
      const storageKey = this.storageKey();
      if (!storageKey) throw this.error('Sign in before recording a payment.');
      const locationId =
        operation === 'clinic' ? '' : (this.session.activePharmacyLocationId() ?? '');
      if (operation !== 'clinic' && !locationId)
        throw this.error('Select a pharmacy location before recording a payment.');
      const scope = JSON.stringify([operation, targetId, locationId]);
      const pending = this.read(storageKey);
      const snapshot = JSON.parse(JSON.stringify(payload));
      const existing = pending[scope];
      if (existing && this.fingerprint(existing.payload) !== this.fingerprint(snapshot)) {
        throw this.error(
          'A previous payment is still unconfirmed. Recover its original receipt before changing payment details or taking another payment.',
        );
      }
      const attempt = existing ?? {
        key: crypto.randomUUID(),
        operation,
        targetId,
        locationId,
        createdAt: new Date().toISOString(),
        payload: snapshot,
      };
      const activeKey = `${storageKey}:${attempt.key}`;
      const active = this.activeRequests.get(activeKey);
      if (active) return active as Observable<Result>;
      this.write(storageKey, { ...pending, [scope]: attempt });
      const request = send(attempt.key, attempt.payload, locationId).pipe(
        tap((response) => {
          if (!hasReceipt(response))
            throw this.error(
              'The payment response did not contain a receipt. Recover the original payment; do not collect it again.',
            );
          this.clear(storageKey, scope, attempt.key);
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.error?.requestOutcome === 'not_committed')
            this.clear(storageKey, scope, attempt.key);
          return throwError(() => error);
        }),
        finalize(() => this.activeRequests.delete(activeKey)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.activeRequests.set(activeKey, request);
      return request;
    });
  }

  private storageKey(): string | null {
    const user = this.session.currentUser();
    return user?.tenantId ? `pharma.pending-payments.v1.${user.tenantId}.${user.id}` : null;
  }

  private read(storageKey: string): Record<string, PendingPayment> {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return {};
      const records = JSON.parse(raw);
      if (!records || typeof records !== 'object' || Array.isArray(records))
        throw new Error('Invalid pending payments');
      for (const [scope, attempt] of Object.entries(records) as Array<[string, PendingPayment]>) {
        if (
          !attempt ||
          !['clinic', 'pharmacy', 'supplier'].includes(attempt.operation) ||
          typeof attempt.key !== 'string' ||
          typeof attempt.targetId !== 'string' ||
          typeof attempt.locationId !== 'string' ||
          !attempt.payload ||
          scope !== JSON.stringify([attempt.operation, attempt.targetId, attempt.locationId])
        )
          throw new Error('Invalid pending payment');
      }
      return records;
    } catch {
      throw this.error(
        'Previous payment information could not be read. Check the transaction register before recording another payment.',
      );
    }
  }

  private write(storageKey: string, records: Record<string, PendingPayment>): void {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(records));
      this.version.update((version) => version + 1);
    } catch {
      throw this.error(
        'Payment recovery information could not be saved. Allow browser storage before recording payments.',
      );
    }
  }

  private clear(storageKey: string, scope: string, key: string): void {
    const records = this.read(storageKey);
    if (records[scope]?.key !== key) return;
    delete records[scope];
    this.write(storageKey, records);
  }

  private fingerprint(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((entry) => this.fingerprint(entry)).join(',')}]`;
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.fingerprint(value[key])}`)
      .join(',')}}`;
  }

  private error(message: string): HttpErrorResponse {
    return new HttpErrorResponse({
      status: 409,
      error: { code: 'PAYMENT_RECOVERY_REQUIRED', message },
    });
  }
}

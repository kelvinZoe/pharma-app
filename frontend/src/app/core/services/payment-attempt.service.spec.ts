import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentAttemptService } from './payment-attempt.service';
import { SessionService } from '../auth/session.service';

describe('PaymentAttemptService', () => {
  const user = signal({ id: 'test-cashier', tenantId: 'test-tenant' });
  const location = signal('test-location');
  const storageKey = 'pharma.pending-payments.v1.test-tenant.test-cashier';
  const payload = { paymentMethod: 'cash', items: [{ productId: 'medicine', quantity: 2 }] };
  let service: PaymentAttemptService;

  beforeEach(() => {
    user.set({ id: 'test-cashier', tenantId: 'test-tenant' });
    location.set('test-location');
    sessionStorage.removeItem(storageKey);
    TestBed.configureTestingModule({
      providers: [
        PaymentAttemptService,
        {
          provide: SessionService,
          useValue: { currentUser: user, activePharmacyLocationId: location },
        },
      ],
    });
    service = TestBed.inject(PaymentAttemptService);
  });

  const hasReceipt = (response: any) => !!response?.id;
  const interrupted = () => throwError(() => new HttpErrorResponse({ status: 0 }));

  it('reuses the original key and payload after a lost response, including a new service instance', async () => {
    const originalSend = vi.fn(interrupted);
    await expect(
      firstValueFrom(service.perform('pharmacy', '', payload, originalSend, hasReceipt)),
    ).rejects.toBeInstanceOf(HttpErrorResponse);
    const originalKey = service.pending('pharmacy')[0].key;
    const reloaded = TestBed.runInInjectionContext(() => new PaymentAttemptService());
    const retry = vi.fn(() => of({ id: 'original-sale' }));
    await firstValueFrom(reloaded.perform('pharmacy', '', payload, retry, hasReceipt));
    expect(retry).toHaveBeenCalledWith(originalKey, payload, 'test-location');
    expect(reloaded.pending('pharmacy')).toEqual([]);
  });

  it('blocks changed payment details until the original result is recovered', async () => {
    await expect(
      firstValueFrom(service.perform('pharmacy', '', payload, interrupted, hasReceipt)),
    ).rejects.toBeDefined();
    const send = vi.fn(() => of({ id: 'different-sale' }));
    await expect(
      firstValueFrom(service.perform('pharmacy', '', { ...payload, items: [] }, send, hasReceipt)),
    ).rejects.toMatchObject({ error: { code: 'PAYMENT_RECOVERY_REQUIRED' } });
    expect(send).not.toHaveBeenCalled();
    expect(service.pending('pharmacy')).toHaveLength(1);
  });

  it('allows a genuinely new identical sale after receipt confirmation', async () => {
    const keys: string[] = [];
    const send = (key: string) => {
      keys.push(key);
      return of({ id: key });
    };
    await firstValueFrom(service.perform('pharmacy', '', payload, send, hasReceipt));
    await firstValueFrom(service.perform('pharmacy', '', payload, send, hasReceipt));
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('keeps unresolved attempts for server errors and invalid receipts', async () => {
    const serverError = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    await expect(
      firstValueFrom(service.perform('clinic', 'visit', { amount: 10 }, serverError, hasReceipt)),
    ).rejects.toBeDefined();
    const key = service.pending('clinic')[0].key;
    await expect(
      firstValueFrom(
        service.perform('clinic', 'visit', { amount: 10 }, () => of(null), hasReceipt),
      ),
    ).rejects.toBeDefined();
    expect(service.pending('clinic')[0].key).toBe(key);
  });

  it('releases an attempt only when the backend confirms rollback', async () => {
    const rejected = () =>
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { requestOutcome: 'not_committed' } }),
      );
    await expect(
      firstValueFrom(service.perform('supplier', 'invoice', { amount: 10 }, rejected, hasReceipt)),
    ).rejects.toBeDefined();
    expect(service.pending('supplier')).toEqual([]);
    await firstValueFrom(
      service.perform(
        'supplier',
        'invoice',
        { amount: 20 },
        () => of({ id: 'new-payment' }),
        hasReceipt,
      ),
    );
  });

  it('does not release a legacy uncertain request on a 409 response', async () => {
    const rejected = () =>
      throwError(
        () =>
          new HttpErrorResponse({ status: 409, error: { code: 'REQUEST_OUTCOME_UNCONFIRMED' } }),
      );
    await expect(
      firstValueFrom(service.perform('supplier', 'invoice', { amount: 10 }, rejected, hasReceipt)),
    ).rejects.toBeDefined();
    expect(service.pending('supplier')).toHaveLength(1);
  });

  it('shares an in-flight attempt and keeps processing after navigation unsubscribes', () => {
    const response = new Subject<{ id: string }>();
    const send = vi.fn(() => response);
    const first = service.perform('pharmacy', '', payload, send, hasReceipt).subscribe();
    const receipt = vi.fn();
    service.perform('pharmacy', '', payload, send, hasReceipt).subscribe(receipt);
    first.unsubscribe();
    expect(send).toHaveBeenCalledTimes(1);
    response.next({ id: 'sale' });
    response.complete();
    expect(receipt).toHaveBeenCalledWith({ id: 'sale' });
    expect(service.pending('pharmacy')).toEqual([]);
  });

  it('scopes recovery to the original tenant, user and pharmacy location', async () => {
    await expect(
      firstValueFrom(service.perform('pharmacy', '', payload, interrupted, hasReceipt)),
    ).rejects.toBeDefined();
    location.set('another-location');
    expect(service.pending('pharmacy')).toEqual([]);
    location.set('test-location');
    user.set({ id: 'another-cashier', tenantId: 'test-tenant' });
    expect(service.pending('pharmacy')).toEqual([]);
    user.set({ id: 'test-cashier', tenantId: 'another-tenant' });
    expect(service.pending('pharmacy')).toEqual([]);
    user.set({ id: 'test-cashier', tenantId: 'test-tenant' });
    expect(service.pending('pharmacy')).toHaveLength(1);
  });

  it('finishes a request even when navigation removes its last subscriber', () => {
    const response = new Subject<{ id: string }>();
    const subscription = service
      .perform('pharmacy', '', payload, () => response, hasReceipt)
      .subscribe();
    subscription.unsubscribe();
    expect(response.observed).toBe(true);
    response.next({ id: 'sale' });
    response.complete();
    expect(service.pending('pharmacy')).toEqual([]);
  });

  it('never sends a payment if its recovery snapshot cannot be saved', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    const send = vi.fn(() => of({ id: 'sale' }));
    try {
      await expect(
        firstValueFrom(service.perform('pharmacy', '', payload, send, hasReceipt)),
      ).rejects.toMatchObject({ error: { code: 'PAYMENT_RECOVERY_REQUIRED' } });
      expect(send).not.toHaveBeenCalled();
    } finally {
      storage.mockRestore();
    }
  });

  it('fails closed when pending payment storage is corrupted', async () => {
    sessionStorage.setItem(storageKey, 'invalid-json');
    const send = vi.fn(() => of({ id: 'sale' }));
    await expect(
      firstValueFrom(service.perform('pharmacy', '', payload, send, hasReceipt)),
    ).rejects.toMatchObject({ status: 409 });
    expect(send).not.toHaveBeenCalled();
  });
});

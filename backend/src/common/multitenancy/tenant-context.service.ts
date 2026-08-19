import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  readonly tenantId?: string;
  readonly tenantSlug?: string;
  readonly allowUnscoped?: boolean;
}

@Injectable()
export class TenantContextService {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

  static run<T>(store: TenantStore, callback: () => T): T {
    return this.asyncLocalStorage.run(store, callback);
  }

  static enter(store: TenantStore): void {
    this.asyncLocalStorage.enterWith(store);
  }

  static runUnscoped<T>(callback: () => T): T {
    return this.asyncLocalStorage.run({ allowUnscoped: true }, callback);
  }

  static getStore(): TenantStore | undefined {
    return this.asyncLocalStorage.getStore();
  }

  static getTenantId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.tenantId;
  }

  static getTenantSlug(): string | undefined {
    return this.asyncLocalStorage.getStore()?.tenantSlug;
  }

  static isUnscopedAllowed(): boolean {
    return this.asyncLocalStorage.getStore()?.allowUnscoped === true;
  }
}

import { AsyncLocalStorage } from 'async_hooks';
import { Prisma } from '@prisma/client';

type AfterCommit = () => void | Promise<void>;

export interface PrismaTransactionStore {
  owner: object;
  client: Prisma.TransactionClient;
  afterCommit: AfterCommit[];
}

export class PrismaTransactionContext {
  private static readonly storage =
    new AsyncLocalStorage<PrismaTransactionStore>();

  static client(owner: object): Prisma.TransactionClient | undefined {
    const store = this.storage.getStore();
    return store?.owner === owner ? store.client : undefined;
  }

  static run<Result>(
    store: PrismaTransactionStore,
    handler: () => Result,
  ): Result {
    return this.storage.run(store, handler);
  }

  static afterCommit(handler: AfterCommit): boolean {
    const store = this.storage.getStore();
    if (!store) return false;
    store.afterCommit.push(handler);
    return true;
  }
}

import { Injectable } from '@angular/core';
import { OfflineOperation, QueuedRequest } from './offline-operation.model';

const DATABASE_NAME = 'nihil-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'operations';
const LEASE_MS = 60_000;

/** IndexedDB-backed outbox. Every write that changes an operation is one transaction. */
@Injectable({ providedIn: 'root' })
export class OfflineQueueStore {
  async enqueue(request: QueuedRequest, idempotencyKey: string = crypto.randomUUID()): Promise<OfflineOperation> {
    if (!request.path.startsWith('/api/')) {
      throw new Error('Somente requisições da API Nihil podem entrar na fila offline.');
    }

    const operation: OfflineOperation = {
      id: crypto.randomUUID(),
      idempotencyKey,
      path: request.path,
      method: request.method,
      // JSON also prevents callers from retaining a mutable object reference.
      body: request.body === undefined ? null : JSON.parse(JSON.stringify(request.body)),
      contentType: request.contentType ?? 'application/json',
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'queued',
      leaseExpiresAt: null,
      lastError: null,
    };

    const database = await this.open();
    await this.complete(database.transaction(STORE_NAME, 'readwrite'), (store) => store.add(operation));
    return operation;
  }

  /**
   * Atomically leases a bounded batch. A lease is recovered after a crash or
   * power loss, so an interrupted sync cannot leave entries permanently stuck.
   */
  async claimBatch(limit = 20): Promise<OfflineOperation[]> {
    const database = await this.open();
    const now = Date.now();
    const claimed: OfflineOperation[] = [];
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const records = await this.request<OfflineOperation[]>(store.getAll());

    for (const record of records) {
      const leaseExpired = record.status === 'syncing' &&
        record.leaseExpiresAt !== null && Date.parse(record.leaseExpiresAt) <= now;
      if ((record.status !== 'queued' && !leaseExpired) || claimed.length >= limit) continue;

      const leased: OfflineOperation = {
        ...record,
        status: 'syncing',
        leaseExpiresAt: new Date(now + LEASE_MS).toISOString(),
        lastError: null,
      };
      store.put(leased);
      claimed.push(leased);
    }
    await this.complete(transaction);
    return claimed;
  }

  async remove(id: string): Promise<void> {
    const database = await this.open();
    await this.complete(database.transaction(STORE_NAME, 'readwrite'), (store) => store.delete(id));
  }

  async retryLater(operation: OfflineOperation, error: string): Promise<void> {
    await this.update(operation, { status: 'queued', leaseExpiresAt: null, attempts: operation.attempts + 1, lastError: error });
  }

  async needsAttention(operation: OfflineOperation, error: string): Promise<void> {
    await this.update(operation, { status: 'needs-attention', leaseExpiresAt: null, attempts: operation.attempts + 1, lastError: error });
  }

  async countPending(): Promise<number> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const entries = await this.request<OfflineOperation[]>(transaction.objectStore(STORE_NAME).getAll());
    await this.complete(transaction);
    return entries.filter(({ status }) => status !== 'needs-attention').length;
  }

  private async update(operation: OfflineOperation, changes: Partial<OfflineOperation>): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ ...operation, ...changes });
    await this.complete(transaction);
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private complete(transaction: IDBTransaction, operation?: (store: IDBObjectStore) => IDBRequest): Promise<void> {
    if (operation) operation(transaction.objectStore(STORE_NAME));
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Falha na transação offline.'));
    });
  }
}

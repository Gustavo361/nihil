import { Injectable, signal } from '@angular/core';
import { API_BASE_URL } from '../api/api-config';
import { AuthService } from '../auth/auth.service';
import { OfflineOperation } from './offline-operation.model';
import { OfflineQueueStore } from './offline-queue.store';

const LAST_SYNC_ATTEMPT_KEY = 'nihil.offline.last-sync-attempt';
const LAST_SYNC_SUCCESS_KEY = 'nihil.offline.last-sync-success';

/** Replays queued API mutations while an authenticated browser session is active. */
@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  readonly pendingCount = signal(0);
  readonly syncing = signal(false);
  private started = false;

  constructor(
    private readonly queue: OfflineQueueStore,
    private readonly auth: AuthService,
  ) {}

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', () => void this.syncNow());
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'nihil:sync-requested') void this.syncNow();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.syncNow();
    });
    void this.refreshPendingCount();
    void this.syncNow();
  }

  async schedule(): Promise<void> {
    await this.refreshPendingCount();
    const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
    const syncManager = (registration as (ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    }) | undefined)?.sync;
    await syncManager?.register('nihil-sync').catch(() => undefined);
  }

  async syncNow(): Promise<void> {
    if (this.syncing() || !navigator.onLine || !this.auth.token()) return;
    this.syncing.set(true);
    localStorage.setItem(LAST_SYNC_ATTEMPT_KEY, new Date().toISOString());
    try {
      while (true) {
        const batch = await this.queue.claimBatch();
        if (!batch.length) break;
        for (const operation of batch) {
          const result = await this.send(operation);
          if (result === 'network-error' || result === 'unauthorized') return;
        }
      }
      localStorage.setItem(LAST_SYNC_SUCCESS_KEY, new Date().toISOString());
    } finally {
      this.syncing.set(false);
      await this.refreshPendingCount();
    }
  }

  private async send(operation: OfflineOperation): Promise<'sent' | 'network-error' | 'unauthorized'> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Basic ${this.auth.token()}`,
        'Idempotency-Key': operation.idempotencyKey,
      };
      if (operation.contentType) headers['Content-Type'] = operation.contentType;
      const response = await fetch(`${API_BASE_URL}${operation.path}`, {
        method: operation.method,
        headers,
        body: operation.body === null ? undefined : JSON.stringify(operation.body),
      });

      if (response.ok) {
        await this.queue.remove(operation.id);
        return 'sent';
      }
      if (response.status === 401 || response.status === 403) {
        await this.queue.retryLater(operation, 'Sessão expirada; entre novamente para sincronizar.');
        return 'unauthorized';
      }
      if (response.status >= 500) {
        await this.queue.retryLater(operation, `Servidor indisponível (${response.status}).`);
        return 'network-error';
      }
      await this.queue.needsAttention(operation, `A API recusou a operação (${response.status}).`);
      return 'sent';
    } catch {
      await this.queue.retryLater(operation, 'Sem conexão com a API.');
      return 'network-error';
    }
  }

  private async refreshPendingCount(): Promise<void> {
    this.pendingCount.set(await this.queue.countPending());
  }
}

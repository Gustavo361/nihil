import { Injectable } from '@angular/core';
import { OfflineQueueStore } from './offline-queue.store';
import { API_BASE_URL } from '../api/api-config';
import { ToastService } from '../toast/toast.service';

const KEYS = [
  'nihil.stock.v2', 'nihil.menu-catalog.v1', 'nihil.sales.v1', 'nihil.cash-register.v1',
  'nihil.purchases.v1', 'nihil.expenses.v1', 'nihil.employees.v1',
  'nihil.employee-access.v1', 'nihil.suppliers.v1', 'nihil.payroll.v1',
];

/** Adapts legacy synchronous catalogues to Neon without retaining browser data. */
@Injectable({ providedIn: 'root' })
export class RemoteStorageBridgeService {
  private readonly values = new Map<string, string>();
  private installed = false;

  constructor(private readonly queue: OfflineQueueStore, private readonly toast: ToastService) {}

  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const nativeGet = Storage.prototype.getItem;
    const nativeSet = Storage.prototype.setItem;
    const nativeRemove = Storage.prototype.removeItem;
    const manages = (key: string) => KEYS.includes(key);
    const bridge = this;
    Storage.prototype.getItem = function(key: string): string | null {
      return manages(key) ? bridge.values.get(key) ?? null : nativeGet.call(this, key);
    };
    Storage.prototype.setItem = function(key: string, value: string): void {
      if (!manages(key)) return nativeSet.call(this, key, value);
      bridge.values.set(key, value);
      void bridge.save(key, value);
    };
    Storage.prototype.removeItem = function(key: string): void {
      if (!manages(key)) return nativeRemove.call(this, key);
      bridge.values.delete(key);
    };
    // The current browser records are confirmed fake; do not let them become a source of truth.
    for (const key of KEYS) nativeRemove.call(localStorage, key);
  }

  async hydrate(): Promise<void> {
    // The app starts before login. Workspace is protected by the API, so do not
    // make an unauthenticated request during Angular's initializers.
    const token = sessionStorage.getItem('nihil.auth.basic');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/workspace`, {
        headers: { Authorization: `Basic ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Falha ao carregar estado remoto.');
      const states = await response.json() as Record<string, unknown>;
      for (const key of KEYS) {
        if (states[key] !== undefined) this.values.set(key, JSON.stringify(states[key]));
      }
    } catch {
      // Offline start is intentionally empty; queued writes will be retried when online.
    }
  }

  clear(): void {
    this.values.clear();
  }

  private async save(key: string, value: string): Promise<void> {
    let payload: unknown;
    try { payload = JSON.parse(value); } catch { return; }
    const token = sessionStorage.getItem('nihil.auth.basic');
    if (navigator.onLine && token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/workspace/${key}`, {
          method: 'PUT', headers: { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (response.ok) return;
      } catch { /* queue below */ }
    }
    await this.queue.enqueue({ path: `/api/workspace/${key}`, method: 'PUT', body: payload });
    this.toast.info('Sem internet: alteração salva neste dispositivo e aguardando sincronização.');
    const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
    await (registration as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined)
      ?.sync?.register('nihil-sync').catch(() => undefined);
  }
}

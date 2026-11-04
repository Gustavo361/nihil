import { Injectable } from '@angular/core';
import { API_BASE_URL } from '../api/api-config';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from './offline-operation.model';
import { OfflineQueueStore } from './offline-queue.store';
import { OfflineSyncService } from './offline-sync.service';

export type OfflineRequestResult = Response | { queued: true };

/** Use this for future API mutations that are safe to retry with an idempotency key. */
@Injectable({ providedIn: 'root' })
export class OfflineRequestService {
  constructor(
    private readonly auth: AuthService,
    private readonly queue: OfflineQueueStore,
    private readonly sync: OfflineSyncService,
  ) {}

  async send(request: QueuedRequest): Promise<OfflineRequestResult> {
    const idempotencyKey = crypto.randomUUID();
    if (!navigator.onLine) return this.enqueue(request, idempotencyKey);
    try {
      const response = await fetch(`${API_BASE_URL}${request.path}`, {
        method: request.method,
        headers: {
          ...(this.auth.token() ? { Authorization: `Basic ${this.auth.token()}` } : {}),
          ...(request.contentType ?? 'application/json' ? { 'Content-Type': request.contentType ?? 'application/json' } : {}),
          'Idempotency-Key': idempotencyKey,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      if (response.status >= 500) return this.enqueue(request, idempotencyKey);
      return response;
    } catch {
      return this.enqueue(request, idempotencyKey);
    }
  }

  private async enqueue(request: QueuedRequest, idempotencyKey: string): Promise<{ queued: true }> {
    await this.queue.enqueue(request, idempotencyKey);
    await this.sync.schedule();
    return { queued: true };
  }
}

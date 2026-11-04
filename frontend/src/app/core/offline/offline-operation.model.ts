export type OfflineOperationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type OfflineOperationStatus = 'queued' | 'syncing' | 'needs-attention';

/**
 * A mutation waiting to reach the API. It intentionally contains neither the
 * Authorization header nor a password: credentials remain in sessionStorage.
 */
export interface OfflineOperation {
  id: string;
  idempotencyKey: string;
  path: string;
  method: OfflineOperationMethod;
  body: unknown;
  contentType: string | null;
  createdAt: string;
  attempts: number;
  status: OfflineOperationStatus;
  leaseExpiresAt: string | null;
  lastError: string | null;
}

export interface QueuedRequest {
  path: string;
  method: OfflineOperationMethod;
  body?: unknown;
  contentType?: string;
}

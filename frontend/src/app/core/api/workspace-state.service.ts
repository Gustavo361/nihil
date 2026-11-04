import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { OfflineRequestService } from '../offline/offline-request.service';

/** Persists UI state through the published API; the browser holds no business snapshot. */
@Injectable({ providedIn: 'root' })
export class WorkspaceStateService {
  constructor(
    private readonly http: HttpClient,
    private readonly offline: OfflineRequestService,
  ) {}

  async read<T>(key: string): Promise<T | null> {
    const response = await firstValueFrom(this.http.get<T>(`${API_BASE_URL}/api/workspace/${key}`, {
      observe: 'response',
    }));
    return response.status === 204 ? null : response.body;
  }

  async write(key: string, payload: unknown): Promise<'saved' | 'queued'> {
    const result = await this.offline.send({ path: `/api/workspace/${key}`, method: 'PUT', body: payload });
    return 'queued' in result ? 'queued' : 'saved';
  }
}

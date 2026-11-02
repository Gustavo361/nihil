import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';

export interface HealthResponse {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${API_BASE_URL}/actuator/health`);
  }
}

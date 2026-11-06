import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { RemoteStorageBridgeService } from '../offline/remote-storage-bridge.service';

const AUTH_KEY = 'nihil.auth.basic';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly stored = sessionStorage.getItem(AUTH_KEY);
  readonly token = signal(this.stored);
  readonly username = signal(this.decodeUsername(this.stored));

  constructor(private readonly http: HttpClient, private readonly remoteStorage: RemoteStorageBridgeService) {}

  async login(username: string, password: string): Promise<void> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) throw new Error('Informe o usuário.');
    if (!password) throw new Error('Informe a senha.');

    let token: string;
    try {
      token = btoa(`${normalizedUsername}:${password}`);
    } catch {
      throw new Error('Usuário ou senha inválidos.');
    }
    try {
      await firstValueFrom(this.http.get(`${API_BASE_URL}/api/suppliers`, {
        headers: { Authorization: `Basic ${token}` },
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        throw new Error('Usuário ou senha incorretos.');
      }
      if (error instanceof HttpErrorResponse && error.status === 403) {
        throw new Error('Este usuário não tem acesso ao sistema.');
      }
      throw new Error('Não foi possível conectar à API. Confira se o backend está ativo.');
    }
    sessionStorage.setItem(AUTH_KEY, token);
    this.token.set(token);
    this.username.set(normalizedUsername);
    // Do not block navigation on the workspace hydration. Render may need to
    // wake the API from sleep; the authenticated shell can open while data
    // continues loading in the background.
    void this.remoteStorage.hydrate();
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_KEY);
    this.token.set(null);
    this.username.set(null);
    this.remoteStorage.clear();
  }

  private decodeUsername(token: string | null): string | null {
    if (!token) return null;
    try { return atob(token).split(':', 1)[0] || null; } catch { return null; }
  }
}

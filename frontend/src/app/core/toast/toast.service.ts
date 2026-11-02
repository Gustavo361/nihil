import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastOptions {
  /** Marked fragment (e.g. “Caixa fechado…”) shown as a red pill. */
  highlight?: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
  highlight?: string;
}

const TOAST_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, number>();

  readonly toasts = signal<ToastMessage[]>([]);

  success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', options);
  }

  info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', options);
  }

  danger(message: string, options?: ToastOptions): void {
    this.show(message, 'danger', options);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(message: string, tone: ToastTone, options?: ToastOptions): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [
      ...list,
      { id, message, tone, highlight: options?.highlight },
    ]);
    const timer = window.setTimeout(() => this.dismiss(id), TOAST_DURATION_MS);
    this.timers.set(id, timer);
  }
}

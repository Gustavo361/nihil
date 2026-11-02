import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, number>();

  readonly toasts = signal<ToastMessage[]>([]);

  success(message: string): void {
    this.show(message, 'success');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  danger(message: string): void {
    this.show(message, 'danger');
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, message, tone }]);
    const timer = window.setTimeout(() => this.dismiss(id), 3400);
    this.timers.set(id, timer);
  }
}

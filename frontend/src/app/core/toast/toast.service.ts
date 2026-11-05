import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'danger';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  /** Marked fragment (e.g. “Caixa fechado…”) shown as a red pill. */
  highlight?: string;
  /** Optional CTA button inside the toast. */
  action?: ToastAction;
  /** Override auto-dismiss delay (ms). */
  durationMs?: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
  highlight?: string;
  action?: ToastAction;
}

const TOAST_DURATION_MS = 5000;
const TOAST_WITH_ACTION_MS = 25_000;
const MAX_VISIBLE_TOASTS = 3;

interface QueuedToast {
  message: string;
  tone: ToastTone;
  options?: ToastOptions;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly timers = new Map<number, number>();
  private readonly pending: QueuedToast[] = [];

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
    this.presentNext();
  }

  runAction(toast: ToastMessage): void {
    toast.action?.run();
    this.dismiss(toast.id);
  }

  private show(message: string, tone: ToastTone, options?: ToastOptions): void {
    const queued = { message, tone, options };
    if (this.toasts().length >= MAX_VISIBLE_TOASTS) {
      this.pending.push(queued);
      return;
    }
    this.present(queued);
  }

  private present(queued: QueuedToast): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [
      ...list,
      {
        id,
        message: queued.message,
        tone: queued.tone,
        highlight: queued.options?.highlight,
        action: queued.options?.action,
      },
    ]);
    const duration =
      queued.options?.durationMs ??
      (queued.options?.action ? TOAST_WITH_ACTION_MS : TOAST_DURATION_MS);
    const timer = window.setTimeout(() => this.dismiss(id), duration);
    this.timers.set(id, timer);
  }

  private presentNext(): void {
    const next = this.pending.shift();
    if (next) this.present(next);
  }
}

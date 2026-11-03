import { Injectable, computed, signal } from '@angular/core';
import { SALES_MOCK } from '../../features/vendas/sales.mock';
import { Sale, SaleCancellation } from '../../features/vendas/sales.models';
import { roundMoney } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.sales.v1';

/**
 * Shared sales catalog until sales API exists.
 * Persists in localStorage. Vendas↔Caixa stays in the page (post/reverse receipts).
 */
@Injectable({ providedIn: 'root' })
export class SaleCatalogService {
  readonly sales = signal<Sale[]>([]);

  readonly confirmedCount = computed(
    () => this.sales().filter((s) => s.status === 'confirmed').length,
  );

  constructor() {
    const stored = readSales();
    if (stored) {
      this.sales.set(stored);
    } else {
      this.sales.set([...SALES_MOCK]);
      this.persist();
    }
  }

  findById(id: string): Sale | undefined {
    return this.sales().find((s) => s.id === id);
  }

  add(sale: Sale): Sale {
    this.sales.update((list) => [sale, ...list]);
    this.persist();
    return sale;
  }

  cancel(saleId: string, cancellation: SaleCancellation): Sale | null {
    const existing = this.findById(saleId);
    if (!existing || existing.status !== 'confirmed') return null;

    const updated: Sale = {
      ...existing,
      status: 'cancelled',
      cancellation,
    };
    this.sales.update((list) => list.map((s) => (s.id === saleId ? updated : s)));
    this.persist();
    return updated;
  }

  /** Confirmed sales whose local calendar day falls in [fromDay, toDay] inclusive (yyyy-MM-dd). */
  confirmedInDayRange(fromDay: string, toDay: string): Sale[] {
    return this.sales().filter((s) => {
      if (s.status !== 'confirmed') return false;
      const day = localDayKey(s.at);
      return day >= fromDay && day <= toDay;
    });
  }

  confirmedRevenueInDayRange(fromDay: string, toDay: string): number {
    return roundMoney(
      this.confirmedInDayRange(fromDay, toDay).reduce((sum, s) => sum + s.total, 0),
    );
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sales()));
    } catch {
      /* ignore quota */
    }
  }
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readSales(): Sale[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Sale[]) : null;
  } catch {
    return null;
  }
}

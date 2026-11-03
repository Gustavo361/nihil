import { Injectable, computed, signal } from '@angular/core';
import {
  Expense,
  ExpenseSeries,
  ExpenseUpsertInput,
} from '../../features/despesas/expenses.models';
import { roundMoney } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.expenses.v1';

interface ExpenseStore {
  expenses: Expense[];
  series: ExpenseSeries[];
}

/**
 * Operational expenses catalog (localStorage) until finance API exists.
 * Recurring fixed costs materialise one occurrence per period key (no duplicates).
 */
@Injectable({ providedIn: 'root' })
export class ExpenseCatalogService {
  readonly expenses = signal<Expense[]>([]);
  readonly series = signal<ExpenseSeries[]>([]);

  readonly activeCount = computed(
    () => this.expenses().filter((e) => e.status !== 'cancelled').length,
  );

  constructor() {
    const stored = readStore();
    this.expenses.set(stored?.expenses ?? []);
    this.series.set(stored?.series ?? []);
  }

  findById(id: string): Expense | undefined {
    return this.expenses().find((e) => e.id === id);
  }

  /**
   * Ensure recurring occurrences exist for every calendar month overlapping [fromDay, toDay].
   */
  ensureOccurrences(fromDay: string, toDay: string): void {
    const months = monthsOverlapping(fromDay, toDay);
    let changed = false;
    const existingKeys = new Set(
      this.expenses()
        .filter((e) => e.occurrenceKey)
        .map((e) => e.occurrenceKey!),
    );

    for (const s of this.series()) {
      if (!s.active) continue;
      for (const month of months) {
        const key = occurrenceKeyFor(s, month);
        if (!key || existingKeys.has(key)) continue;
        if (!seriesAppliesToMonth(s, month)) continue;

        const dueDate = dueDateForMonth(month, s.dueDay);
        const now = new Date().toISOString();
        const expense: Expense = {
          id: nextId('exp'),
          description: s.description,
          category: 'fixed',
          amount: roundMoney(s.defaultAmount),
          dueDate,
          status: 'pending',
          notes: s.notes,
          seriesId: s.id,
          occurrenceKey: key,
          createdAt: now,
          updatedAt: now,
        };
        this.expenses.update((list) => [expense, ...list]);
        existingKeys.add(key);
        changed = true;
      }
    }

    if (changed) this.persist();
  }

  /** Non-cancelled expenses with dueDate in [fromDay, toDay]. */
  commitmentsInRange(fromDay: string, toDay: string): Expense[] {
    this.ensureOccurrences(fromDay, toDay);
    return this.expenses()
      .filter((e) => e.status !== 'cancelled' && e.dueDate >= fromDay && e.dueDate <= toDay)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt));
  }

  upsert(input: ExpenseUpsertInput): Expense {
    const description = input.description.trim();
    if (!description) throw new Error('Informe a descrição.');
    if (!(input.amount > 0)) throw new Error('Informe um valor maior que zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      throw new Error('Informe a data de vencimento.');
    }

    const now = new Date().toISOString();
    const status = input.status;
    const paidAt =
      status === 'paid' ? input.paidAt?.trim() || now : undefined;

    if (input.id) {
      const existing = this.findById(input.id);
      if (!existing) throw new Error('Despesa não encontrada.');
      if (existing.status === 'cancelled') {
        throw new Error('Despesa cancelada não pode ser editada.');
      }
      const updated: Expense = {
        ...existing,
        description,
        category: input.category,
        amount: roundMoney(input.amount),
        dueDate: input.dueDate,
        status,
        paidAt,
        notes: input.notes?.trim() || undefined,
        updatedAt: now,
      };
      this.expenses.update((list) => list.map((e) => (e.id === input.id ? updated : e)));
      this.persist();
      return updated;
    }

    const recurrence = input.recurrence ?? 'none';
    let seriesId: string | undefined;
    let occurrenceKey: string | undefined;

    if (input.category === 'fixed' && recurrence !== 'none') {
      const dueDay = Math.min(28, Math.max(1, Number(input.dueDate.slice(8, 10)) || 1));
      const series: ExpenseSeries = {
        id: nextId('ser'),
        description,
        category: 'fixed',
        recurrence,
        dueDay,
        defaultAmount: roundMoney(input.amount),
        notes: input.notes?.trim() || undefined,
        active: true,
        createdAt: now,
      };
      this.series.update((list) => [series, ...list]);
      seriesId = series.id;
      const month = input.dueDate.slice(0, 7);
      occurrenceKey = occurrenceKeyFor(series, month) ?? undefined;
    }

    const expense: Expense = {
      id: nextId('exp'),
      description,
      category: input.category,
      amount: roundMoney(input.amount),
      dueDate: input.dueDate,
      status,
      paidAt,
      notes: input.notes?.trim() || undefined,
      seriesId,
      occurrenceKey,
      createdAt: now,
      updatedAt: now,
    };
    this.expenses.update((list) => [expense, ...list]);
    this.persist();
    return expense;
  }

  markPaid(id: string, paidAt?: string): Expense {
    const existing = this.findById(id);
    if (!existing) throw new Error('Despesa não encontrada.');
    if (existing.status === 'cancelled') throw new Error('Despesa cancelada.');
    const now = new Date().toISOString();
    const updated: Expense = {
      ...existing,
      status: 'paid',
      paidAt: paidAt?.trim() || now,
      updatedAt: now,
    };
    this.expenses.update((list) => list.map((e) => (e.id === id ? updated : e)));
    this.persist();
    return updated;
  }

  /** Paid → pending (vai e vem). */
  markPending(id: string): Expense {
    const existing = this.findById(id);
    if (!existing) throw new Error('Despesa não encontrada.');
    if (existing.status === 'cancelled') {
      throw new Error('Reabra o lançamento cancelado antes de alterar o pagamento.');
    }
    const now = new Date().toISOString();
    const updated: Expense = {
      ...existing,
      status: 'pending',
      paidAt: undefined,
      updatedAt: now,
    };
    this.expenses.update((list) => list.map((e) => (e.id === id ? updated : e)));
    this.persist();
    return updated;
  }

  /**
   * Soft-cancel: keeps history, excludes from commitments.
   * Clears occurrenceKey so a recurring series can generate a new launch for the period.
   */
  cancel(id: string): Expense {
    const existing = this.findById(id);
    if (!existing) throw new Error('Despesa não encontrada.');
    if (existing.status === 'cancelled') return existing;
    const now = new Date().toISOString();
    const updated: Expense = {
      ...existing,
      status: 'cancelled',
      paidAt: undefined,
      occurrenceKey: undefined,
      updatedAt: now,
    };
    this.expenses.update((list) => list.map((e) => (e.id === id ? updated : e)));
    this.persist();
    return updated;
  }

  /** Cancelled → pending (reabre o mesmo lançamento). */
  reopen(id: string): Expense {
    const existing = this.findById(id);
    if (!existing) throw new Error('Despesa não encontrada.');
    if (existing.status !== 'cancelled') return existing;

    let occurrenceKey = existing.occurrenceKey;
    if (existing.seriesId) {
      const series = this.series().find((s) => s.id === existing.seriesId);
      if (series) {
        const month = existing.dueDate.slice(0, 7);
        const key = occurrenceKeyFor(series, month);
        if (key) {
          const clash = this.expenses().some(
            (e) => e.id !== id && e.occurrenceKey === key && e.status !== 'cancelled',
          );
          if (clash) {
            throw new Error(
              'Já existe um lançamento ativo deste recorrente no período. Use esse ou cancele-o antes.',
            );
          }
          occurrenceKey = key;
        }
      }
    }

    const now = new Date().toISOString();
    const updated: Expense = {
      ...existing,
      status: 'pending',
      paidAt: undefined,
      occurrenceKey,
      updatedAt: now,
    };
    this.expenses.update((list) => list.map((e) => (e.id === id ? updated : e)));
    this.persist();
    return updated;
  }

  private persist(): void {
    try {
      const store: ExpenseStore = {
        expenses: this.expenses(),
        series: this.series(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore quota */
    }
  }
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function monthsOverlapping(fromDay: string, toDay: string): string[] {
  const start = fromDay.slice(0, 7);
  const end = toDay.slice(0, 7);
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function seriesAppliesToMonth(series: ExpenseSeries, month: string): boolean {
  const m = Number(month.slice(5, 7));
  if (series.recurrence === 'monthly') return true;
  if (series.recurrence === 'semiannual') return m === 1 || m === 7;
  if (series.recurrence === 'annual') return m === 1;
  return false;
}

function occurrenceKeyFor(series: ExpenseSeries, month: string): string | null {
  const year = month.slice(0, 4);
  const m = Number(month.slice(5, 7));
  if (series.recurrence === 'monthly') return `${series.id}:${month}`;
  if (series.recurrence === 'semiannual') {
    if (m !== 1 && m !== 7) return null;
    const half = m <= 6 ? 'H1' : 'H2';
    return `${series.id}:${year}-${half}`;
  }
  if (series.recurrence === 'annual') {
    if (m !== 1) return null;
    return `${series.id}:${year}`;
  }
  return null;
}

function dueDateForMonth(month: string, dueDay: number): string {
  const day = String(Math.min(28, Math.max(1, dueDay))).padStart(2, '0');
  return `${month}-${day}`;
}

function readStore(): ExpenseStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExpenseStore>;
    return {
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      series: Array.isArray(parsed.series) ? parsed.series : [],
    };
  } catch {
    return null;
  }
}

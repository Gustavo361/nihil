import { Injectable, computed, signal } from '@angular/core';
import { CASH_MOVEMENTS_MOCK, CASH_SESSIONS_MOCK } from '../../features/caixa/cash.mock';
import {
  CashDrawerTotals,
  CashMovement,
  CashPaymentMethod,
  CashSession,
  PendingSaleReceipt,
} from '../../features/caixa/cash.models';

export type SaleReceiptResult = 'posted' | 'queued' | 'duplicate';
export type SaleReversalResult = 'reversed' | 'removed_pending' | 'already_reversed' | 'noop';

const STORAGE_KEY = 'nihil.cash-register.v1';

interface CashStoreSnapshot {
  sessions: CashSession[];
  movements: CashMovement[];
  pendingReceipts: PendingSaleReceipt[];
}

/**
 * Sales↔Caixa bridge until finance API exists.
 * Persists open/closed sessions, movements and pending queue in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  readonly sessions = signal<CashSession[]>([]);
  readonly movements = signal<CashMovement[]>([]);
  readonly pendingReceipts = signal<PendingSaleReceipt[]>([]);

  readonly openSession = computed(
    () => this.sessions().find((s) => s.status === 'open') ?? null,
  );

  readonly isOpen = computed(() => this.openSession() != null);

  readonly pendingCount = computed(() => this.pendingReceipts().length);

  readonly openSessionMovements = computed(() => {
    const session = this.openSession();
    if (!session) return [] as CashMovement[];
    return this.movements()
      .filter((m) => m.sessionId === session.id)
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly openDrawer = computed((): CashDrawerTotals => {
    const session = this.openSession();
    if (!session) {
      return emptyTotals();
    }
    return computeDrawerTotals(session, this.openSessionMovements());
  });

  constructor() {
    const stored = readStore();
    if (stored) {
      this.sessions.set(stored.sessions);
      this.movements.set(stored.movements);
      this.pendingReceipts.set(stored.pendingReceipts);
    } else {
      this.sessions.set([...CASH_SESSIONS_MOCK]);
      this.movements.set([...CASH_MOVEMENTS_MOCK]);
      this.pendingReceipts.set([]);
      this.persist();
    }
  }

  movementsFor(sessionId: string): CashMovement[] {
    return this.movements()
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  drawerFor(session: CashSession): CashDrawerTotals {
    return computeDrawerTotals(session, this.movementsFor(session.id));
  }

  postSaleReceipt(input: {
    saleId: string;
    amount: number;
    paymentMethod: CashPaymentMethod;
    summary: string;
    at?: string;
    user?: string;
  }): SaleReceiptResult {
    this.pullPendingFromStorage();

    if (this.hasActiveSaleReceipt(input.saleId)) return 'duplicate';

    const at = input.at ?? new Date().toISOString();
    const user = input.user ?? 'Administrador';
    const open = this.openSession();

    if (!open) {
      this.pendingReceipts.update((list) => [
        {
          saleId: input.saleId,
          at,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          summary: input.summary,
          user,
        },
        ...list.filter((p) => p.saleId !== input.saleId),
      ]);
      this.persist();
      return 'queued';
    }

    this.movements.update((list) => [
      {
        id: this.nextMovementId(),
        sessionId: open.id,
        at,
        type: 'sale_receipt',
        description: `Venda ${input.saleId} · ${input.summary}`,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        user,
        saleId: input.saleId,
      },
      ...list,
    ]);
    this.persist();
    return 'posted';
  }

  reverseSaleReceipt(saleId: string, reason: string): SaleReversalResult {
    const pending = this.pendingReceipts().find((p) => p.saleId === saleId);
    if (pending) {
      this.pendingReceipts.update((list) => list.filter((p) => p.saleId !== saleId));
      this.persist();
      return 'removed_pending';
    }

    if (this.hasSaleReversal(saleId)) return 'already_reversed';

    const receipt = this.movements().find(
      (m) => m.type === 'sale_receipt' && m.saleId === saleId,
    );
    if (!receipt) return 'noop';

    const session = this.sessions().find((s) => s.id === receipt.sessionId);
    if (!session || session.status !== 'open') {
      return 'noop';
    }

    this.movements.update((list) => [
      {
        id: this.nextMovementId(),
        sessionId: receipt.sessionId,
        at: new Date().toISOString(),
        type: 'sale_reversal',
        description: `Estorno venda ${saleId} · ${reason}`,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        user: 'Administrador',
        saleId,
      },
      ...list,
    ]);
    this.persist();
    return 'reversed';
  }

  openCash(input: {
    openingAmount: number;
    note?: string;
    openedBy?: string;
  }): { session: CashSession; flushed: number } {
    if (this.openSession()) {
      throw new Error('Já existe uma sessão de caixa aberta.');
    }

    // Ensure pending queue is current (localStorage may be ahead after sales / HMR).
    this.pullPendingFromStorage();

    const now = new Date();
    const openedBy = input.openedBy ?? 'Administrador';
    const session: CashSession = {
      id: this.nextSessionId(now),
      status: 'open',
      openedAt: now.toISOString(),
      openingAmount: input.openingAmount,
      openingNote: input.note,
      openedBy,
    };

    const openingMove: CashMovement = {
      id: this.nextMovementId(),
      sessionId: session.id,
      at: session.openedAt,
      type: 'opening',
      description: 'Saldo inicial',
      amount: input.openingAmount,
      paymentMethod: 'cash',
      user: openedBy,
    };

    const pending = [...this.pendingReceipts()].sort((a, b) => a.at.localeCompare(b.at));
    const flushedMoves: CashMovement[] = pending.map((p, index) => ({
      id: this.nextMovementId(index),
      sessionId: session.id,
      at: p.at,
      type: 'sale_receipt' as const,
      description: `Venda ${p.saleId} · ${p.summary} (fila → abertura)`,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      user: p.user,
      saleId: p.saleId,
    }));

    this.sessions.update((list) => [session, ...list]);
    this.movements.update((list) => [...flushedMoves, openingMove, ...list]);
    this.pendingReceipts.set([]);
    this.persist();

    return { session, flushed: flushedMoves.length };
  }

  closeCash(input: {
    countedAmount: number;
    note?: string;
    closedBy?: string;
  }): CashSession {
    const session = this.openSession();
    if (!session) throw new Error('Não há sessão aberta.');

    const expected = this.openDrawer().expectedCash;
    const difference = Math.round((input.countedAmount - expected) * 100) / 100;
    const now = new Date().toISOString();
    const closedBy = input.closedBy ?? 'Administrador';

    const closed: CashSession = {
      ...session,
      status: 'closed',
      closedAt: now,
      countedAmount: input.countedAmount,
      expectedCashAtClose: expected,
      difference,
      closingNote: input.note,
      closedBy,
    };

    this.sessions.update((list) => list.map((s) => (s.id === session.id ? closed : s)));
    this.movements.update((list) => [
      {
        id: this.nextMovementId(),
        sessionId: session.id,
        at: now,
        type: 'closing',
        description: 'Fechamento da sessão',
        amount: input.countedAmount,
        paymentMethod: 'cash',
        user: closedBy,
      },
      ...list,
    ]);
    this.persist();
    return closed;
  }

  registerCashMove(input: {
    type: 'bleed' | 'supply';
    amount: number;
    reason: string;
    user?: string;
  }): CashMovement {
    const session = this.openSession();
    if (!session) throw new Error('Não há sessão aberta.');
    if (input.amount <= 0) throw new Error('Valor deve ser maior que zero.');
    if (input.type === 'bleed' && input.amount > this.openDrawer().expectedCash) {
      throw new Error(
        'Sangria maior que o saldo em espécie disponível na gaveta. Pix e cartão não entram na gaveta.',
      );
    }

    const move: CashMovement = {
      id: this.nextMovementId(),
      sessionId: session.id,
      at: new Date().toISOString(),
      type: input.type,
      description: input.reason,
      amount: input.amount,
      paymentMethod: 'cash',
      user: input.user ?? 'Administrador',
    };
    this.movements.update((list) => [move, ...list]);
    this.persist();
    return move;
  }

  private persist(): void {
    const snapshot: CashStoreSnapshot = {
      sessions: this.sessions(),
      movements: this.movements(),
      pendingReceipts: this.pendingReceipts(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota / private mode — keep in-memory state only.
    }
  }

  /** Duplicate only if already pending or on the current open session (not closed history). */
  private hasActiveSaleReceipt(saleId: string): boolean {
    if (this.pendingReceipts().some((p) => p.saleId === saleId)) return true;
    const open = this.openSession();
    if (!open) return false;
    const hasReceipt = this.movements().some(
      (m) => m.sessionId === open.id && m.type === 'sale_receipt' && m.saleId === saleId,
    );
    if (!hasReceipt) return false;
    return !this.hasSaleReversal(saleId);
  }

  private hasSaleReversal(saleId: string): boolean {
    return this.movements().some((m) => m.type === 'sale_reversal' && m.saleId === saleId);
  }

  private pullPendingFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CashStoreSnapshot>;
      if (!Array.isArray(parsed.pendingReceipts)) return;
      this.pendingReceipts.set(parsed.pendingReceipts);
    } catch {
      // ignore
    }
  }

  private nextSessionId(now: Date): string {
    const y = now.getFullYear();
    const seq = String(this.sessions().length + 1).padStart(4, '0');
    return `CX-${y}-${seq}`;
  }

  private nextMovementId(salt = 0): string {
    return `CM-local-${Date.now()}-${salt}-${Math.floor(Math.random() * 10000)}`;
  }
}

function readStore(): CashStoreSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CashStoreSnapshot>;
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.movements)) return null;
    return {
      sessions: parsed.sessions,
      movements: parsed.movements,
      pendingReceipts: Array.isArray(parsed.pendingReceipts) ? parsed.pendingReceipts : [],
    };
  } catch {
    return null;
  }
}

function emptyTotals(): CashDrawerTotals {
  return {
    openingAmount: 0,
    cashIn: 0,
    cashOut: 0,
    expectedCash: 0,
    payments: { cash: 0, pix: 0, debit: 0, credit: 0 },
  };
}

export function computeDrawerTotals(
  session: CashSession,
  moves: CashMovement[],
): CashDrawerTotals {
  const payments = { cash: 0, pix: 0, debit: 0, credit: 0 };
  let cashIn = 0;
  let cashOut = 0;

  for (const move of moves) {
    if (move.type === 'sale_receipt' && move.paymentMethod) {
      payments[move.paymentMethod] += move.amount;
      if (move.paymentMethod === 'cash') cashIn += move.amount;
    }
    if (move.type === 'sale_reversal' && move.paymentMethod) {
      payments[move.paymentMethod] -= move.amount;
      if (move.paymentMethod === 'cash') cashOut += move.amount;
    }
    if (move.type === 'supply') cashIn += move.amount;
    if (move.type === 'bleed') cashOut += move.amount;
  }

  const openingAmount = session.openingAmount;
  const expectedCash = Math.round((openingAmount + cashIn - cashOut) * 100) / 100;
  return {
    openingAmount,
    cashIn: Math.round(cashIn * 100) / 100,
    cashOut: Math.round(cashOut * 100) / 100,
    expectedCash,
    payments: {
      cash: Math.round(payments.cash * 100) / 100,
      pix: Math.round(payments.pix * 100) / 100,
      debit: Math.round(payments.debit * 100) / 100,
      credit: Math.round(payments.credit * 100) / 100,
    },
  };
}

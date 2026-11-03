/** Session and cash-drawer movements. Backend finance/cash API does not exist yet. */

export type CashSessionStatus = 'open' | 'closed';

/**
 * Movement kinds on a cash session.
 * `sale_receipt` / `sale_reversal` come from Vendas via CashRegisterService
 * (unique saleId, no double-count). Only `cash` affects physical drawer balance.
 */
export type CashMovementType =
  | 'opening'
  | 'supply'
  | 'bleed'
  | 'sale_receipt'
  | 'sale_reversal'
  | 'closing';

export type CashPaymentMethod = 'cash' | 'pix' | 'debit' | 'credit';

export interface CashMovement {
  id: string;
  sessionId: string;
  at: string;
  type: CashMovementType;
  description: string;
  amount: number;
  /** Present for sale receipts/reversals; only `cash` affects physical drawer balance. */
  paymentMethod?: CashPaymentMethod;
  user: string;
  /** Dedup key for Sales↔Caixa (prevents double post / double reverse). */
  saleId?: string;
}

/** Sale receipt waiting for an open cash session (UI queue until caixa opens). */
export interface PendingSaleReceipt {
  saleId: string;
  at: string;
  amount: number;
  paymentMethod: CashPaymentMethod;
  summary: string;
  user: string;
}

export interface CashSession {
  id: string;
  status: CashSessionStatus;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  openingNote?: string;
  openedBy: string;
  countedAmount?: number;
  expectedCashAtClose?: number;
  difference?: number;
  closingNote?: string;
  closedBy?: string;
}

export interface CashPaymentBreakdown {
  cash: number;
  pix: number;
  debit: number;
  credit: number;
}

export interface CashDrawerTotals {
  openingAmount: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  payments: CashPaymentBreakdown;
}

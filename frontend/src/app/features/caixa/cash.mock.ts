import { CashMovement, CashSession } from './cash.models';

/**
 * Seed data for CashRegisterService (in-memory only).
 * Open session starts without sale receipts — those come from Vendas.
 */

function atToday(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function atDaysAgo(daysAgo: number, hours: number, minutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const CASH_SESSIONS_MOCK: CashSession[] = [
  {
    id: 'CX-2026-0001',
    status: 'closed',
    openedAt: atDaysAgo(1, 10, 0),
    closedAt: atDaysAgo(1, 22, 15),
    openingAmount: 200,
    openingNote: 'Troco do dia anterior.',
    openedBy: 'Administrador',
    countedAmount: 485.5,
    expectedCashAtClose: 480,
    difference: 5.5,
    closingNote: 'Sobra de R$ 5,50 conferida.',
    closedBy: 'Administrador',
  },
  {
    id: 'CX-2026-0002',
    status: 'open',
    openedAt: atToday(9, 30),
    openingAmount: 150,
    openingNote: 'Abertura do dia.',
    openedBy: 'Administrador',
  },
];

export const CASH_MOVEMENTS_MOCK: CashMovement[] = [
  {
    id: 'CM-0001',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 10, 0),
    type: 'opening',
    description: 'Saldo inicial',
    amount: 200,
    paymentMethod: 'cash',
    user: 'Administrador',
  },
  {
    id: 'CM-0002',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 12, 40),
    type: 'sale_receipt',
    description: 'Venda histórica (seed) · Buffet',
    amount: 120,
    paymentMethod: 'cash',
    user: 'Sistema',
    saleId: 'seed-sale-a',
  },
  {
    id: 'CM-0003',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 14, 10),
    type: 'sale_receipt',
    description: 'Venda histórica (seed) · Pix',
    amount: 85,
    paymentMethod: 'pix',
    user: 'Sistema',
    saleId: 'seed-sale-b',
  },
  {
    id: 'CM-0004',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 16, 0),
    type: 'bleed',
    description: 'Sangria para cofre',
    amount: 50,
    paymentMethod: 'cash',
    user: 'Administrador',
  },
  {
    id: 'CM-0005',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 18, 20),
    type: 'supply',
    description: 'Suprimento de troco',
    amount: 30,
    paymentMethod: 'cash',
    user: 'Administrador',
  },
  {
    id: 'CM-0006',
    sessionId: 'CX-2026-0001',
    at: atDaysAgo(1, 22, 15),
    type: 'closing',
    description: 'Fechamento da sessão',
    amount: 480,
    paymentMethod: 'cash',
    user: 'Administrador',
  },
  {
    id: 'CM-0010',
    sessionId: 'CX-2026-0002',
    at: atToday(9, 30),
    type: 'opening',
    description: 'Saldo inicial',
    amount: 150,
    paymentMethod: 'cash',
    user: 'Administrador',
  },
];

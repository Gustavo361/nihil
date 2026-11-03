/** Operational expenses — UI/localStorage until finance API exists. */

export type ExpenseCategory = 'fixed' | 'variable';

export type ExpenseStatus = 'pending' | 'paid' | 'cancelled';

export type ExpenseRecurrence = 'none' | 'monthly' | 'semiannual' | 'annual';

export type ExpensePeriodKind = 'month' | 'semester' | 'year';

/** Recurring template (fixed costs). Occurrences are materialised without duplicates. */
export interface ExpenseSeries {
  id: string;
  description: string;
  category: 'fixed';
  recurrence: 'monthly' | 'semiannual' | 'annual';
  /** Day of month (1–28) used when generating due dates. */
  dueDay: number;
  defaultAmount: number;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  /** Local calendar due date yyyy-MM-dd */
  dueDate: string;
  /** ISO timestamp when marked paid */
  paidAt?: string;
  status: ExpenseStatus;
  notes?: string;
  /** Links to series when generated from recurrence */
  seriesId?: string;
  /** Dedup key e.g. seriesId:2026-11 or seriesId:2026-H1 */
  occurrenceKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseUpsertInput {
  id?: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid';
  paidAt?: string;
  notes?: string;
  recurrence?: ExpenseRecurrence;
}

export function expenseCategoryLabel(category: ExpenseCategory): string {
  return category === 'fixed' ? 'Fixa' : 'Variável';
}

export function expenseStatusLabel(status: ExpenseStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'paid':
      return 'Paga';
    case 'cancelled':
      return 'Cancelada';
  }
}

export function expenseRecurrenceLabel(recurrence: ExpenseRecurrence): string {
  switch (recurrence) {
    case 'none':
      return 'Sem recorrência';
    case 'monthly':
      return 'Mensal';
    case 'semiannual':
      return 'Semestral';
    case 'annual':
      return 'Anual';
  }
}

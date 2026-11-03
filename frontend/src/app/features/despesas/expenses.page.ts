import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconBuildingBank,
  IconCash,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconUsers,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ExpenseCatalogService } from '../../core/expenses/expense-catalog.service';
import { PayrollCatalogService } from '../../core/payroll/payroll-catalog.service';
import { SaleCatalogService } from '../../core/sales/sale-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import {
  formatMoneyInput,
  moneyToInputText,
  parseMoneyTyping,
  restoreMoneyCaret,
} from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { roundMoney } from '../estoque/stock.models';
import {
  Expense,
  ExpenseCategory,
  ExpensePeriodKind,
  ExpenseRecurrence,
  ExpenseStatus,
  expenseCategoryLabel,
  expenseRecurrenceLabel,
  expenseStatusLabel,
} from './expenses.models';

type ModalKind =
  | null
  | 'create'
  | 'edit'
  | 'detail'
  | 'confirm-paid'
  | 'confirm-pending'
  | 'confirm-cancel';

@Component({
  selector: 'app-expenses-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent, NihilSelectComponent],
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage {
  private readonly expenses = inject(ExpenseCatalogService);
  private readonly payroll = inject(PayrollCatalogService);
  private readonly sales = inject(SaleCatalogService);
  private readonly inventory = inject(StockInventoryService);
  private readonly toast = inject(ToastService);

  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconClose = IconX;
  readonly iconReceipt = IconReceipt;
  readonly iconCash = IconCash;
  readonly iconUsers = IconUsers;
  readonly iconBank = IconBuildingBank;

  readonly categoryLabel = expenseCategoryLabel;
  readonly statusLabel = expenseStatusLabel;
  readonly recurrenceLabel = expenseRecurrenceLabel;

  readonly periodKind = signal<ExpensePeriodKind>('month');
  readonly periodRef = signal(currentMonthRef());

  readonly search = signal('');
  readonly categoryFilter = signal<'' | ExpenseCategory>('');
  readonly statusFilter = signal<'' | ExpenseStatus>('');

  readonly modal = signal<ModalKind>(null);
  readonly editingId = signal<string | null>(null);
  readonly detailId = signal<string | null>(null);
  readonly confirmExpenseId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly formDescription = signal('');
  readonly formCategory = signal<ExpenseCategory>('fixed');
  readonly formAmountText = signal('');
  readonly formAmount = signal<number | null>(null);
  readonly formDueDate = signal('');
  readonly formPaidAt = signal('');
  readonly formStatus = signal<'pending' | 'paid'>('pending');
  readonly formNotes = signal('');
  readonly formRecurrence = signal<ExpenseRecurrence>('none');

  readonly periodKindOptions: NihilSelectOption[] = [
    { value: 'month', label: 'Mensal' },
    { value: 'semester', label: 'Semestral' },
    { value: 'year', label: 'Anual' },
  ];

  readonly categoryFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as categorias' },
    { value: 'fixed', label: 'Fixas' },
    { value: 'variable', label: 'Variáveis' },
  ];

  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'paid', label: 'Pagas' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  readonly formCategoryOptions: NihilSelectOption[] = [
    { value: 'fixed', label: 'Fixa' },
    { value: 'variable', label: 'Variável' },
  ];

  readonly formStatusOptions: NihilSelectOption[] = [
    { value: 'pending', label: 'Pendente' },
    { value: 'paid', label: 'Paga' },
  ];

  readonly formRecurrenceOptions: NihilSelectOption[] = [
    { value: 'none', label: 'Sem recorrência' },
    { value: 'monthly', label: 'Mensal' },
    { value: 'semiannual', label: 'Semestral' },
    { value: 'annual', label: 'Anual' },
  ];

  readonly periodBounds = computed(() => resolvePeriod(this.periodKind(), this.periodRef()));

  constructor() {
    effect(() => {
      const { from, to } = this.periodBounds();
      this.expenses.ensureOccurrences(from, to);
    });
  }

  readonly periodRefOptions = computed((): NihilSelectOption[] => {
    const kind = this.periodKind();
    const now = new Date();
    const opts: NihilSelectOption[] = [];
    if (kind === 'month') {
      for (let i = 0; i < 18; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        opts.push({ value, label: monthLabel(value) });
      }
    } else if (kind === 'semester') {
      for (let i = 0; i < 6; i++) {
        const y = now.getFullYear();
        const half = now.getMonth() < 6 ? 1 : 2;
        let h = half - i;
        let year = y;
        while (h <= 0) {
          h += 2;
          year -= 1;
        }
        const value = `${year}-H${h}`;
        opts.push({ value, label: semesterLabel(value) });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const y = String(now.getFullYear() - i);
        opts.push({ value: y, label: y });
      }
    }
    return opts;
  });

  readonly commitments = computed(() => {
    const { from, to } = this.periodBounds();
    return this.expenses.commitmentsInRange(from, to);
  });

  readonly fixedCommitments = computed(() =>
    this.commitments().filter((e) => e.category === 'fixed'),
  );
  readonly variableCommitments = computed(() =>
    this.commitments().filter((e) => e.category === 'variable'),
  );

  readonly fixedTotal = computed(() =>
    roundMoney(this.fixedCommitments().reduce((s, e) => s + e.amount, 0)),
  );
  readonly variableTotal = computed(() =>
    roundMoney(this.variableCommitments().reduce((s, e) => s + e.amount, 0)),
  );
  readonly fixedPaid = computed(() =>
    roundMoney(
      this.fixedCommitments()
        .filter((e) => e.status === 'paid')
        .reduce((s, e) => s + e.amount, 0),
    ),
  );
  readonly variablePaid = computed(() =>
    roundMoney(
      this.variableCommitments()
        .filter((e) => e.status === 'paid')
        .reduce((s, e) => s + e.amount, 0),
    ),
  );
  readonly pendingTotal = computed(() =>
    roundMoney(
      this.commitments()
        .filter((e) => e.status === 'pending')
        .reduce((s, e) => s + e.amount, 0),
    ),
  );
  readonly paidTotal = computed(() =>
    roundMoney(
      this.commitments()
        .filter((e) => e.status === 'paid')
        .reduce((s, e) => s + e.amount, 0),
    ),
  );

  readonly salariesTotal = computed(() => {
    const { from, to } = this.periodBounds();
    return this.payroll.confirmedTotalInDayRange(from, to);
  });

  readonly revenue = computed(() => {
    const { from, to } = this.periodBounds();
    return this.sales.confirmedRevenueInDayRange(from, to);
  });

  readonly cogs = computed(() => {
    const { from, to } = this.periodBounds();
    return this.inventory.cogsInDayRange(from, to);
  });

  readonly expensesKnownTotal = computed(() =>
    roundMoney(this.fixedTotal() + this.variableTotal() + this.salariesTotal()),
  );

  readonly consideredOutflow = computed(() => {
    const cogs = this.cogs();
    const cogsPart = cogs.withCostCount > 0 ? cogs.amount : 0;
    return roundMoney(this.expensesKnownTotal() + cogsPart);
  });

  readonly difference = computed(() => roundMoney(this.revenue() - this.consideredOutflow()));

  readonly situation = computed(() => {
    const revenue = this.revenue();
    const hasExpenseData =
      this.commitments().length > 0 ||
      this.cogs().withCostCount > 0 ||
      this.salariesTotal() > 0;
    const hasRevenue = revenue > 0;
    if (!hasRevenue && !hasExpenseData) {
      return {
        tone: 'neutral' as const,
        title: 'Sem dados suficientes',
        message: 'Registre vendas e despesas no período para avaliar a cobertura.',
        amountLabel: null as string | null,
      };
    }
    const diff = this.difference();
    const abs = Math.abs(diff);
    if (diff >= 0) {
      return {
        tone: 'ok' as const,
        title: 'Situação confortável',
        message: null as string | null,
        amountLabel: `${formatBrl(abs)} disponíveis após os gastos considerados`,
      };
    }
    return {
      tone: 'warn' as const,
      title: 'Atenção',
      message: 'Os gastos estão acima das receitas neste período.',
      amountLabel: `${formatBrl(abs)} acima das receitas do período`,
    };
  });

  readonly monthlyEvolution = computed(() => {
    const { from, to, kind } = this.periodBounds();
    if (kind === 'month') return [] as { key: string; label: string; revenue: number; expenses: number }[];
    const months = monthsBetween(from, to);
    return months.map((key) => {
      const mFrom = `${key}-01`;
      const mTo = lastDayOfMonth(key);
      const revenue = this.sales.confirmedRevenueInDayRange(mFrom, mTo);
      const expenses = roundMoney(
        this.expenses.commitmentsInRange(mFrom, mTo).reduce((s, e) => s + e.amount, 0) +
          this.payroll.confirmedTotalInDayRange(mFrom, mTo),
      );
      return { key, label: shortMonthLabel(key), revenue, expenses };
    });
  });

  readonly evolutionMax = computed(() => {
    const rows = this.monthlyEvolution();
    let max = 0;
    for (const r of rows) {
      max = Math.max(max, r.revenue, r.expenses);
    }
    return max || 1;
  });

  readonly filteredList = computed(() => {
    const { from, to } = this.periodBounds();
    const q = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const st = this.statusFilter();
    return this.expenses
      .expenses()
      .filter((e) => e.dueDate >= from && e.dueDate <= to)
      .filter((e) => {
        if (cat && e.category !== cat) return false;
        if (st && e.status !== st) return false;
        if (q) {
          const hay = `${e.description} ${e.notes ?? ''} ${expenseCategoryLabel(e.category)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt));
  });

  readonly detailExpense = computed(() => {
    const id = this.detailId();
    return id ? (this.expenses.findById(id) ?? null) : null;
  });

  readonly confirmExpense = computed(() => {
    const id = this.confirmExpenseId();
    return id ? (this.expenses.findById(id) ?? null) : null;
  });

  setPeriodKind(value: string): void {
    const kind = value as ExpensePeriodKind;
    this.periodKind.set(kind);
    const opts = this.periodRefOptions();
    if (!opts.some((o) => o.value === this.periodRef())) {
      this.periodRef.set(opts[0]?.value ?? currentMonthRef());
    }
  }

  setPeriodRef(value: string): void {
    this.periodRef.set(value);
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  setCategoryFilter(value: string): void {
    this.categoryFilter.set(value as '' | ExpenseCategory);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as '' | ExpenseStatus);
  }

  openCreate(): void {
    this.resetForm();
    this.formDueDate.set(todayInput());
    this.editingId.set(null);
    this.modal.set('create');
  }

  openEdit(expense: Expense): void {
    if (expense.status === 'cancelled') return;
    this.editingId.set(expense.id);
    this.formDescription.set(expense.description);
    this.formCategory.set(expense.category);
    this.formAmount.set(expense.amount);
    this.formAmountText.set(moneyToInputText(expense.amount));
    this.formDueDate.set(expense.dueDate);
    this.formStatus.set(expense.status === 'paid' ? 'paid' : 'pending');
    this.formPaidAt.set(expense.paidAt ? expense.paidAt.slice(0, 10) : '');
    this.formNotes.set(expense.notes ?? '');
    this.formRecurrence.set('none');
    this.formError.set('');
    this.modal.set('edit');
  }

  openDetail(expense: Expense): void {
    this.detailId.set(expense.id);
    this.modal.set('detail');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.editingId.set(null);
    this.detailId.set(null);
    this.confirmExpenseId.set(null);
    this.formError.set('');
  }

  /** Return to detail after dismissing a confirm dialog. */
  backToDetail(): void {
    if (this.saving()) return;
    const id = this.confirmExpenseId() ?? this.detailId();
    this.confirmExpenseId.set(null);
    this.formError.set('');
    if (id) {
      this.detailId.set(id);
      this.modal.set('detail');
    } else {
      this.modal.set(null);
    }
  }

  onAmountInput(raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.formAmountText.set(text);
    this.formAmount.set(value);
    restoreMoneyCaret(input, raw, text, caret);
  }

  onAmountBlur(): void {
    const formatted = formatMoneyInput(this.formAmountText());
    this.formAmountText.set(formatted.text);
    this.formAmount.set(formatted.value);
  }

  setFormCategory(value: string): void {
    this.formCategory.set(value as ExpenseCategory);
    if (value !== 'fixed') this.formRecurrence.set('none');
  }

  setFormStatus(value: string): void {
    this.formStatus.set(value as 'pending' | 'paid');
  }

  setFormRecurrence(value: string): void {
    this.formRecurrence.set(value as ExpenseRecurrence);
  }

  saveForm(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const amount = this.formAmount();
      if (amount == null) throw new Error('Informe o valor.');
      const id = this.editingId() ?? undefined;
      this.expenses.upsert({
        id,
        description: this.formDescription(),
        category: this.formCategory(),
        amount,
        dueDate: this.formDueDate(),
        status: this.formStatus(),
        paidAt: this.formStatus() === 'paid' ? paidAtFromDate(this.formPaidAt()) : undefined,
        notes: this.formNotes(),
        recurrence: id ? 'none' : this.formRecurrence(),
      });
      this.toast.success(id ? 'Despesa atualizada.' : 'Despesa registrada.');
      this.saving.set(false);
      this.closeModal();
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível salvar.');
      this.saving.set(false);
    }
  }

  askMarkPaid(expense: Expense): void {
    this.confirmExpenseId.set(expense.id);
    this.detailId.set(expense.id);
    this.modal.set('confirm-paid');
  }

  askCancel(expense: Expense): void {
    this.confirmExpenseId.set(expense.id);
    this.detailId.set(expense.id);
    this.modal.set('confirm-cancel');
  }

  askMarkPending(expense: Expense): void {
    this.confirmExpenseId.set(expense.id);
    this.detailId.set(expense.id);
    this.modal.set('confirm-pending');
  }

  confirmMarkPaid(): void {
    const expense = this.confirmExpense();
    if (!expense || this.saving()) return;
    this.saving.set(true);
    try {
      this.expenses.markPaid(expense.id);
      this.toast.success('Despesa marcada como paga.');
      this.saving.set(false);
      this.confirmExpenseId.set(null);
      this.detailId.set(expense.id);
      this.modal.set('detail');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível marcar como paga.');
      this.saving.set(false);
    }
  }

  confirmCancelExpense(): void {
    const expense = this.confirmExpense();
    if (!expense || this.saving()) return;
    this.saving.set(true);
    try {
      this.expenses.cancel(expense.id);
      this.toast.info('Lançamento cancelado. Você pode reabrir ou gerar de novo se for recorrente.');
      this.saving.set(false);
      this.confirmExpenseId.set(null);
      this.detailId.set(expense.id);
      this.modal.set('detail');
      const { from, to } = this.periodBounds();
      this.expenses.ensureOccurrences(from, to);
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível cancelar.');
      this.saving.set(false);
    }
  }

  confirmMarkPending(): void {
    const expense = this.confirmExpense();
    if (!expense || this.saving()) return;
    this.saving.set(true);
    try {
      this.expenses.markPending(expense.id);
      this.toast.success('Despesa voltou para pendente.');
      this.saving.set(false);
      this.confirmExpenseId.set(null);
      this.detailId.set(expense.id);
      this.modal.set('detail');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível alterar.');
      this.saving.set(false);
    }
  }

  reopenExpense(expense: Expense): void {
    try {
      this.expenses.reopen(expense.id);
      this.toast.success('Lançamento reaberto como pendente.');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível reabrir.');
    }
  }

  private resetForm(): void {
    this.formDescription.set('');
    this.formCategory.set('fixed');
    this.formAmountText.set('');
    this.formAmount.set(null);
    this.formDueDate.set('');
    this.formPaidAt.set('');
    this.formStatus.set('pending');
    this.formNotes.set('');
    this.formRecurrence.set('none');
    this.formError.set('');
  }
}

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function paidAtFromDate(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T12:00:00`).toISOString();
  }
  return new Date().toISOString();
}

function resolvePeriod(
  kind: ExpensePeriodKind,
  ref: string,
): { kind: ExpensePeriodKind; from: string; to: string; label: string } {
  if (kind === 'month') {
    const key = /^\d{4}-\d{2}$/.test(ref) ? ref : currentMonthRef();
    return {
      kind,
      from: `${key}-01`,
      to: lastDayOfMonth(key),
      label: monthLabel(key),
    };
  }
  if (kind === 'semester') {
    const m = /^(\d{4})-H([12])$/.exec(ref);
    const year = m ? m[1] : String(new Date().getFullYear());
    const half = m ? Number(m[2]) : new Date().getMonth() < 6 ? 1 : 2;
    const from = half === 1 ? `${year}-01-01` : `${year}-07-01`;
    const to = half === 1 ? `${year}-06-30` : `${year}-12-31`;
    return { kind, from, to, label: semesterLabel(`${year}-H${half}`) };
  }
  const year = /^\d{4}$/.test(ref) ? ref : String(new Date().getFullYear());
  return {
    kind,
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    label: year,
  };
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

function monthsBetween(fromDay: string, toDay: string): string[] {
  const out: string[] = [];
  let [y, m] = fromDay.slice(0, 7).split('-').map(Number);
  const [ey, em] = toDay.slice(0, 7).split('-').map(Number);
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

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function semesterLabel(ref: string): string {
  const m = /^(\d{4})-H([12])$/.exec(ref);
  if (!m) return ref;
  return m[2] === '1' ? `1º semestre ${m[1]}` : `2º semestre ${m[1]}`;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

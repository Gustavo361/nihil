import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IconCheck,
  IconPlus,
  IconWallet,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { EmployeeCatalogService } from '../../core/employees/employee-catalog.service';
import { PayrollCatalogService } from '../../core/payroll/payroll-catalog.service';
import { ToastService } from '../../core/toast/toast.service';
import {
  formatMoneyInput,
  moneyToInputText,
  parseMoneyTyping,
  restoreMoneyCaret,
} from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { TablePagerComponent } from '../../shared/table-pager/table-pager.component';
import { pageItems } from '../../shared/table-pager/table-pagination';
import { PayrollRun, payrollStatusLabel } from './payroll.models';

@Component({
  selector: 'app-payroll-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent, NihilSelectComponent, TablePagerComponent, RouterLink],
  templateUrl: './payroll.page.html',
  styleUrl: './payroll.page.scss',
})
export class PayrollPage {
  private readonly payroll = inject(PayrollCatalogService);
  private readonly employees = inject(EmployeeCatalogService);
  private readonly toast = inject(ToastService);

  readonly iconPlus = IconPlus;
  readonly iconWallet = IconWallet;
  readonly iconCheck = IconCheck;
  readonly iconClose = IconX;
  readonly statusLabel = payrollStatusLabel;

  readonly monthRef = signal(currentMonthRef());
  readonly page = signal(1);
  readonly linesPage = signal(1);
  readonly selectedId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly lineDrafts = signal<Record<string, string>>({});

  readonly monthOptions = computed((): NihilSelectOption[] => {
    const now = new Date();
    const opts: NihilSelectOption[] = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value, label: monthLabel(value) });
    }
    return opts;
  });

  readonly activeEmployeeCount = this.employees.activeCount;
  readonly confirmedCount = this.payroll.confirmedCount;

  readonly runs = computed(() =>
    this.payroll
      .runs()
      .slice()
      .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)),
  );
  readonly pagedRuns = computed(() => pageItems(this.runs(), this.page()));

  readonly selectedRun = computed(() => {
    const id = this.selectedId();
    if (id) return this.payroll.findById(id) ?? null;
    return this.payroll.findByMonth(this.monthRef()) ?? null;
  });
  readonly pagedLines = computed(() => pageItems(this.selectedRun()?.lines ?? [], this.linesPage()));

  setMonth(value: string): void {
    this.monthRef.set(value);
    const run = this.payroll.findByMonth(value);
    this.selectedId.set(run?.id ?? null);
    this.syncLineDrafts(run);
    this.formError.set('');
  }

  selectRun(run: PayrollRun): void {
    this.selectedId.set(run.id);
    this.monthRef.set(run.periodMonth);
    this.syncLineDrafts(run);
    this.formError.set('');
  }

  openDraft(): void {
    this.formError.set('');
    try {
      const run = this.payroll.openOrCreateDraft(this.monthRef());
      this.selectedId.set(run.id);
      this.syncLineDrafts(run);
      this.toast.success(
        run.status === 'confirmed'
          ? 'Folha já confirmada neste mês.'
          : 'Rascunho da folha pronto para revisão.',
      );
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível montar a folha.');
    }
  }

  onLineAmount(employeeId: string, raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.lineDrafts.update((m) => ({ ...m, [employeeId]: text }));
    restoreMoneyCaret(input, raw, text, caret);
    const run = this.selectedRun();
    if (!run || run.status !== 'draft' || value == null) return;
    try {
      const updated = this.payroll.updateLineAmount(run.id, employeeId, value);
      this.selectedId.set(updated.id);
    } catch {
      /* keep draft text */
    }
  }

  onLineAmountBlur(employeeId: string): void {
    const raw = this.lineDrafts()[employeeId] ?? '';
    const formatted = formatMoneyInput(raw);
    this.lineDrafts.update((m) => ({ ...m, [employeeId]: formatted.text }));
    const run = this.selectedRun();
    if (!run || run.status !== 'draft' || formatted.value == null) return;
    try {
      const updated = this.payroll.updateLineAmount(run.id, employeeId, formatted.value);
      this.selectedId.set(updated.id);
    } catch {
      /* keep draft text */
    }
  }

  confirm(): void {
    const run = this.selectedRun();
    if (!run || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const updated = this.payroll.confirm(run.id);
      this.selectedId.set(updated.id);
      this.toast.success('Folha confirmada — total disponível em Despesas.');
      this.saving.set(false);
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível confirmar.');
      this.saving.set(false);
    }
  }

  cancelRun(): void {
    const run = this.selectedRun();
    if (!run) return;
    try {
      const updated = this.payroll.cancel(run.id);
      this.selectedId.set(updated.id);
      this.toast.info('Folha cancelada — removida dos totais de Despesas.');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Falha ao cancelar.');
    }
  }

  private syncLineDrafts(run: PayrollRun | null | undefined): void {
    if (!run) {
      this.lineDrafts.set({});
      return;
    }
    const map: Record<string, string> = {};
    for (const line of run.lines) {
      map[line.employeeId] = moneyToInputText(line.amount);
    }
    this.lineDrafts.set(map);
  }
}

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

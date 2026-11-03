import { Injectable, computed, inject, signal } from '@angular/core';
import { EmployeeCatalogService } from '../employees/employee-catalog.service';
import { PayrollLine, PayrollRun } from '../../features/folha/payroll.models';
import { roundMoney } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.payroll.v1';

/**
 * Registered payroll runs for management views.
 * Does not invent FGTS/INSS/legal deductions — only amounts the user records.
 */
@Injectable({ providedIn: 'root' })
export class PayrollCatalogService {
  private readonly employees = inject(EmployeeCatalogService);

  readonly runs = signal<PayrollRun[]>([]);

  readonly confirmedCount = computed(
    () => this.runs().filter((r) => r.status === 'confirmed').length,
  );

  constructor() {
    this.runs.set(readRuns() ?? []);
  }

  findById(id: string): PayrollRun | undefined {
    return this.runs().find((r) => r.id === id);
  }

  findByMonth(periodMonth: string): PayrollRun | undefined {
    return this.runs().find(
      (r) => r.periodMonth === periodMonth && r.status !== 'cancelled',
    );
  }

  /** Create or refresh draft from active employees (preserves edited amounts when same employee). */
  openOrCreateDraft(periodMonth: string): PayrollRun {
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new Error('Informe o mês da folha (aaaa-mm).');
    }

    const existing = this.findByMonth(periodMonth);
    if (existing?.status === 'confirmed') {
      return existing;
    }

    const active = this.employees.active();
    if (!active.length) {
      throw new Error('Cadastre ao menos um funcionário ativo antes de montar a folha.');
    }

    const prevByEmp = new Map(
      (existing?.lines ?? []).map((l) => [l.employeeId, l] as const),
    );
    const lines: PayrollLine[] = active.map((emp) => {
      const prev = prevByEmp.get(emp.id);
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        amount: roundMoney(prev?.amount ?? emp.monthlyCost),
        note: prev?.note,
      };
    });

    const now = new Date().toISOString();
    if (existing) {
      const updated: PayrollRun = {
        ...existing,
        lines,
        total: sumLines(lines),
        updatedAt: now,
      };
      this.runs.update((list) => list.map((r) => (r.id === existing.id ? updated : r)));
      this.persist();
      return updated;
    }

    const run: PayrollRun = {
      id: nextId('pay'),
      periodMonth,
      status: 'draft',
      lines,
      total: sumLines(lines),
      createdAt: now,
      updatedAt: now,
    };
    this.runs.update((list) => [run, ...list]);
    this.persist();
    return run;
  }

  updateLineAmount(runId: string, employeeId: string, amount: number): PayrollRun {
    if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
    const run = this.findById(runId);
    if (!run) throw new Error('Folha não encontrada.');
    if (run.status !== 'draft') throw new Error('Só rascunhos podem ser editados.');

    const lines = run.lines.map((l) =>
      l.employeeId === employeeId ? { ...l, amount: roundMoney(amount) } : l,
    );
    const updated: PayrollRun = {
      ...run,
      lines,
      total: sumLines(lines),
      updatedAt: new Date().toISOString(),
    };
    this.runs.update((list) => list.map((r) => (r.id === runId ? updated : r)));
    this.persist();
    return updated;
  }

  confirm(runId: string): PayrollRun {
    const run = this.findById(runId);
    if (!run) throw new Error('Folha não encontrada.');
    if (run.status !== 'draft') throw new Error('Esta folha não está em rascunho.');
    if (!run.lines.length) throw new Error('Folha sem linhas.');

    const now = new Date().toISOString();
    const updated: PayrollRun = {
      ...run,
      status: 'confirmed',
      total: sumLines(run.lines),
      confirmedAt: now,
      updatedAt: now,
    };
    this.runs.update((list) => list.map((r) => (r.id === runId ? updated : r)));
    this.persist();
    return updated;
  }

  cancel(runId: string): PayrollRun {
    const run = this.findById(runId);
    if (!run) throw new Error('Folha não encontrada.');
    if (run.status === 'cancelled') return run;
    const updated: PayrollRun = {
      ...run,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    this.runs.update((list) => list.map((r) => (r.id === runId ? updated : r)));
    this.persist();
    return updated;
  }

  /** Sum of confirmed payroll totals for months overlapping [fromDay, toDay]. */
  confirmedTotalInDayRange(fromDay: string, toDay: string): number {
    const fromMonth = fromDay.slice(0, 7);
    const toMonth = toDay.slice(0, 7);
    return roundMoney(
      this.runs()
        .filter(
          (r) =>
            r.status === 'confirmed' &&
            r.periodMonth >= fromMonth &&
            r.periodMonth <= toMonth,
        )
        .reduce((sum, r) => sum + r.total, 0),
    );
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.runs()));
    } catch {
      /* ignore */
    }
  }
}

function sumLines(lines: PayrollLine[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.amount, 0));
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readRuns(): PayrollRun[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PayrollRun[]) : null;
  } catch {
    return null;
  }
}

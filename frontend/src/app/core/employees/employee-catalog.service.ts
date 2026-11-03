import { Injectable, computed, signal } from '@angular/core';
import {
  Employee,
  EmployeeUpsertInput,
} from '../../features/funcionarios/employees.models';
import { roundMoney } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.employees.v1';

@Injectable({ providedIn: 'root' })
export class EmployeeCatalogService {
  readonly employees = signal<Employee[]>([]);

  readonly active = computed(() => this.employees().filter((e) => e.status === 'active'));
  readonly activeCount = computed(() => this.active().length);

  constructor() {
    this.employees.set(readEmployees() ?? []);
  }

  findById(id: string): Employee | undefined {
    return this.employees().find((e) => e.id === id);
  }

  upsert(input: EmployeeUpsertInput): Employee {
    const name = input.name.trim();
    const role = input.role.trim();
    if (!name) throw new Error('Informe o nome.');
    if (!role) throw new Error('Informe o cargo.');
    if (!(input.monthlyCost > 0)) throw new Error('Informe o custo mensal registrado.');

    const now = new Date().toISOString();
    if (input.id) {
      const existing = this.findById(input.id);
      if (!existing) throw new Error('Funcionário não encontrado.');
      const updated: Employee = {
        ...existing,
        name,
        role,
        monthlyCost: roundMoney(input.monthlyCost),
        status: input.status,
        notes: input.notes?.trim() || undefined,
        updatedAt: now,
      };
      this.employees.update((list) => list.map((e) => (e.id === input.id ? updated : e)));
      this.persist();
      return updated;
    }

    const employee: Employee = {
      id: nextId('emp'),
      name,
      role,
      monthlyCost: roundMoney(input.monthlyCost),
      status: input.status,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.employees.update((list) => [employee, ...list]);
    this.persist();
    return employee;
  }

  setStatus(id: string, status: Employee['status']): Employee {
    const existing = this.findById(id);
    if (!existing) throw new Error('Funcionário não encontrado.');
    const updated: Employee = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.employees.update((list) => list.map((e) => (e.id === id ? updated : e)));
    this.persist();
    return updated;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.employees()));
    } catch {
      /* ignore */
    }
  }
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readEmployees(): Employee[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Employee[]) : null;
  } catch {
    return null;
  }
}

import { Injectable, signal } from '@angular/core';

export type EmployeePermission =
  | 'dashboard'
  | 'sales'
  | 'cash'
  | 'stock'
  | 'purchases'
  | 'suppliers'
  | 'menu'
  | 'expenses'
  | 'financial-reports'
  | 'employees'
  | 'payroll'
  | 'access-management'
  | 'settings';

export interface EmployeeAccess {
  employeeId: string;
  username: string;
  enabled: boolean;
  permissions: EmployeePermission[];
  updatedAt: string;
}

export const employeePermissionOptions: ReadonlyArray<{ value: EmployeePermission; label: string }> = [
  { value: 'dashboard', label: 'Visão geral' },
  { value: 'sales', label: 'Vendas' },
  { value: 'cash', label: 'Caixa' },
  { value: 'stock', label: 'Estoque' },
  { value: 'purchases', label: 'Compras' },
  { value: 'suppliers', label: 'Fornecedores' },
  { value: 'menu', label: 'Pratos e receitas' },
  { value: 'expenses', label: 'Despesas' },
  { value: 'financial-reports', label: 'Relatórios financeiros' },
  { value: 'employees', label: 'Funcionários' },
  { value: 'payroll', label: 'Folha de pagamento' },
  { value: 'access-management', label: 'Cargos e permissões' },
  { value: 'settings', label: 'Configurações' },
];

const STORAGE_KEY = 'nihil.employee-access.v1';

@Injectable({ providedIn: 'root' })
export class EmployeeAccessService {
  readonly accessList = signal<EmployeeAccess[]>(readAccessList());

  findByEmployeeId(employeeId: string): EmployeeAccess | undefined {
    return this.accessList().find((access) => access.employeeId === employeeId);
  }

  upsert(employeeId: string, username: string, enabled: boolean): EmployeeAccess {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) throw new Error('Informe o usuário de acesso.');
    if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      throw new Error('Use apenas letras, números, ponto, hífen ou sublinhado no usuário.');
    }
    const existing = this.findByEmployeeId(employeeId);
    const duplicate = this.accessList().find(
      (access) => access.employeeId !== employeeId && access.username === normalizedUsername,
    );
    if (duplicate) throw new Error('Este usuário de acesso já está em uso.');

    const next: EmployeeAccess = {
      employeeId,
      username: normalizedUsername,
      enabled,
      permissions: existing?.permissions ?? [],
      updatedAt: new Date().toISOString(),
    };
    this.accessList.update((list) => [
      ...list.filter((access) => access.employeeId !== employeeId),
      next,
    ]);
    this.persist();
    return next;
  }

  setPermission(employeeId: string, permission: EmployeePermission, allowed: boolean): EmployeeAccess {
    const existing = this.findByEmployeeId(employeeId);
    if (!existing) throw new Error('Crie o acesso do funcionário antes de definir permissões.');
    const permissions = allowed
      ? [...new Set([...existing.permissions, permission])]
      : existing.permissions.filter((item) => item !== permission);
    const next = { ...existing, permissions, updatedAt: new Date().toISOString() };
    this.accessList.update((list) => list.map((access) => (access.employeeId === employeeId ? next : access)));
    this.persist();
    return next;
  }

  setEnabled(employeeId: string, enabled: boolean): EmployeeAccess | undefined {
    const existing = this.findByEmployeeId(employeeId);
    if (!existing) return undefined;
    const next = { ...existing, enabled, updatedAt: new Date().toISOString() };
    this.accessList.update((list) => list.map((access) => (access.employeeId === employeeId ? next : access)));
    this.persist();
    return next;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.accessList()));
    } catch {
      /* local storage unavailable */
    }
  }
}

function readAccessList(): EmployeeAccess[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as EmployeeAccess[]) : [];
  } catch {
    return [];
  }
}

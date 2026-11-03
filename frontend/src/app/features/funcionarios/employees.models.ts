/** Employee registry — UI/localStorage until HR API exists. Not official eSocial data. */

export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  role: string;
  /**
   * Registered monthly labor cost for management views.
   * Not a validated legal/tax calculation.
   */
  monthlyCost: number;
  status: EmployeeStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeUpsertInput {
  id?: string;
  name: string;
  role: string;
  monthlyCost: number;
  status: EmployeeStatus;
  notes?: string;
}

export function employeeStatusLabel(status: EmployeeStatus): string {
  return status === 'active' ? 'Ativo' : 'Inativo';
}

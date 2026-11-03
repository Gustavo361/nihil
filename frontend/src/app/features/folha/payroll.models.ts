/** Payroll runs — registered costs only until labor rules are validated. */

export type PayrollRunStatus = 'draft' | 'confirmed' | 'cancelled';

export interface PayrollLine {
  employeeId: string;
  employeeName: string;
  role: string;
  amount: number;
  note?: string;
}

export interface PayrollRun {
  id: string;
  /** Calendar month yyyy-MM */
  periodMonth: string;
  status: PayrollRunStatus;
  lines: PayrollLine[];
  total: number;
  notes?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function payrollStatusLabel(status: PayrollRunStatus): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'confirmed':
      return 'Confirmada';
    case 'cancelled':
      return 'Cancelada';
  }
}

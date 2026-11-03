import { TestBed } from '@angular/core/testing';
import { EmployeeCatalogService } from '../employees/employee-catalog.service';
import { PayrollCatalogService } from './payroll-catalog.service';

describe('PayrollCatalogService', () => {
  beforeEach(() => {
    localStorage.removeItem('nihil.employees.v1');
    localStorage.removeItem('nihil.payroll.v1');
    TestBed.configureTestingModule({});
  });

  it('includes confirmed payroll in period totals for Despesas', () => {
    const employees = TestBed.inject(EmployeeCatalogService);
    const payroll = TestBed.inject(PayrollCatalogService);

    employees.upsert({
      name: 'Ana',
      role: 'Cozinha',
      monthlyCost: 2000,
      status: 'active',
    });

    const draft = payroll.openOrCreateDraft('2026-11');
    payroll.confirm(draft.id);

    expect(payroll.confirmedTotalInDayRange('2026-11-01', '2026-11-30')).toBe(2000);
    expect(payroll.confirmedTotalInDayRange('2026-10-01', '2026-10-31')).toBe(0);

    payroll.cancel(draft.id);
    expect(payroll.confirmedTotalInDayRange('2026-11-01', '2026-11-30')).toBe(0);
  });
});

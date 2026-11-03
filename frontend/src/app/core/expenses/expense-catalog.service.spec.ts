import { TestBed } from '@angular/core/testing';
import { ExpenseCatalogService } from './expense-catalog.service';

describe('ExpenseCatalogService', () => {
  beforeEach(() => {
    localStorage.removeItem('nihil.expenses.v1');
    TestBed.configureTestingModule({});
  });

  it('creates a variable expense without series', () => {
    const svc = TestBed.inject(ExpenseCatalogService);
    const expense = svc.upsert({
      description: 'Reparo freezer',
      category: 'variable',
      amount: 350,
      dueDate: '2026-11-10',
      status: 'pending',
      recurrence: 'none',
    });
    expect(expense.seriesId).toBeUndefined();
    expect(svc.expenses().length).toBe(1);
  });

  it('does not duplicate monthly recurrence for the same period', () => {
    const svc = TestBed.inject(ExpenseCatalogService);
    svc.upsert({
      description: 'Aluguel',
      category: 'fixed',
      amount: 5000,
      dueDate: '2026-11-05',
      status: 'pending',
      recurrence: 'monthly',
    });
    expect(svc.series().length).toBe(1);
    expect(svc.expenses().length).toBe(1);

    svc.ensureOccurrences('2026-11-01', '2026-11-30');
    expect(svc.expenses().length).toBe(1);

    svc.ensureOccurrences('2026-11-01', '2026-12-31');
    expect(svc.expenses().length).toBe(2);

    svc.ensureOccurrences('2026-11-01', '2026-12-31');
    expect(svc.expenses().length).toBe(2);
  });

  it('keeps cancelled expenses out of commitments and allows reopen', () => {
    const svc = TestBed.inject(ExpenseCatalogService);
    const expense = svc.upsert({
      description: 'Internet',
      category: 'fixed',
      amount: 120,
      dueDate: '2026-11-01',
      status: 'pending',
    });
    svc.cancel(expense.id);
    const list = svc.commitmentsInRange('2026-11-01', '2026-11-30');
    expect(list.find((e) => e.id === expense.id)).toBeUndefined();
    expect(svc.findById(expense.id)?.status).toBe('cancelled');

    svc.reopen(expense.id);
    expect(svc.findById(expense.id)?.status).toBe('pending');
    expect(
      svc.commitmentsInRange('2026-11-01', '2026-11-30').some((e) => e.id === expense.id),
    ).toBe(true);
  });

  it('allows paid ↔ pending round trip', () => {
    const svc = TestBed.inject(ExpenseCatalogService);
    const expense = svc.upsert({
      description: 'Aluguel',
      category: 'fixed',
      amount: 5000,
      dueDate: '2026-11-05',
      status: 'pending',
    });
    svc.markPaid(expense.id);
    expect(svc.findById(expense.id)?.status).toBe('paid');
    svc.markPending(expense.id);
    expect(svc.findById(expense.id)?.status).toBe('pending');
    expect(svc.findById(expense.id)?.paidAt).toBeUndefined();
  });
});

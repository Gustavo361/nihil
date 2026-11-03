import { TestBed } from '@angular/core/testing';
import { SaleCatalogService } from './sale-catalog.service';
import { Sale } from '../../features/vendas/sales.models';

describe('SaleCatalogService', () => {
  beforeEach(() => {
    localStorage.removeItem('nihil.sales.v1');
    TestBed.configureTestingModule({});
  });

  it('excludes cancelled sales from revenue', () => {
    const svc = TestBed.inject(SaleCatalogService);
    svc.sales.set([]);
    const day = localDay();
    const confirmed: Sale = {
      id: 'V-TEST-1',
      at: `${day}T12:00:00.000Z`,
      modality: 'buffet',
      summary: 'Teste',
      total: 100,
      payment: 'pix',
      status: 'confirmed',
    };
    svc.add(confirmed);
    svc.add({
      ...confirmed,
      id: 'V-TEST-2',
      total: 50,
      status: 'cancelled',
      cancellation: { at: confirmed.at, reason: 'teste', user: 't' },
    });

    expect(svc.confirmedRevenueInDayRange(day, day)).toBe(100);

    svc.cancel('V-TEST-1', { at: new Date().toISOString(), reason: 'x', user: 't' });
    expect(svc.confirmedRevenueInDayRange(day, day)).toBe(0);
  });
});

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

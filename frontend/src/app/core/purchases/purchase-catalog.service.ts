import { Injectable, computed, inject, signal } from '@angular/core';
import { StockInventoryService } from '../stock/stock-inventory.service';
import { Purchase } from '../../features/compras/purchases.models';
import { roundMoney } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.purchases.v1';

export interface ReceivePurchaseForm {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  minQuantity: number;
  packageWeightKg?: number;
  at?: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseCatalogService {
  private readonly inventory = inject(StockInventoryService);
  readonly purchases = signal<Purchase[]>([]);

  readonly count = computed(() => this.purchases().length);
  readonly totalSpent = computed(() =>
    roundMoney(this.purchases().reduce((sum, p) => sum + p.totalCost, 0)),
  );

  constructor() {
    this.purchases.set(readPurchases() ?? []);
  }

  receive(form: ReceivePurchaseForm): Purchase {
    const purchaseId = `C${Date.now()}`;
    const at = form.at ?? new Date().toISOString();
    const { item, created } = this.inventory.applyPurchase({
      purchaseId,
      name: form.name,
      category: form.category,
      unit: form.unit,
      quantity: form.quantity,
      unitCost: form.unitCost,
      minQuantity: form.minQuantity,
      packageWeightKg: form.packageWeightKg,
      at,
      note: form.note,
    });

    const purchase: Purchase = {
      id: purchaseId,
      at,
      summary: `${form.quantity} ${item.unit} · ${item.name}`,
      totalCost: roundMoney(form.quantity * form.unitCost),
      line: {
        stockItemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: form.quantity,
        unitCost: form.unitCost,
        packageWeightKg: item.packageWeightKg,
        createdItem: created,
      },
    };

    this.purchases.update((list) => [purchase, ...list]);
    this.persist();
    return purchase;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.purchases()));
    } catch {
      // ignore
    }
  }
}

function readPurchases(): Purchase[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Purchase[]) : null;
  } catch {
    return null;
  }
}

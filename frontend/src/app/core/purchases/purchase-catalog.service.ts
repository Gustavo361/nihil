import { Injectable, computed, inject, signal } from '@angular/core';
import { MenuCatalogService } from '../menu/menu-catalog.service';
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
  private readonly menu = inject(MenuCatalogService);
  readonly purchases = signal<Purchase[]>([]);

  readonly count = computed(() => this.purchases().length);
  readonly totalSpent = computed(() =>
    roundMoney(this.purchases().reduce((sum, p) => sum + p.totalCost, 0)),
  );

  constructor() {
    this.purchases.set(readPurchases() ?? []);
  }

  findById(id: string): Purchase | undefined {
    return this.purchases().find((p) => p.id === id);
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

    const purchase = toPurchase(purchaseId, at, form, item.unit, item.id, item.packageWeightKg, created);
    this.purchases.update((list) => [purchase, ...list]);
    this.persist();
    return purchase;
  }

  /** Replace qty/cost/meta of an existing purchase and re-apply stock movement. */
  update(purchaseId: string, form: ReceivePurchaseForm): Purchase {
    const existing = this.findById(purchaseId);
    if (!existing) throw new Error('Compra não encontrada.');

    const at = form.at ?? existing.at;
    const { reversed } = this.inventory.reversePurchase(purchaseId);
    if (!reversed) {
      throw new Error('Não foi possível reverter a entrada no estoque desta compra.');
    }
    const { item } = this.inventory.applyPurchase({
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
      stockItemId: existing.line.stockItemId,
    });

    const purchase = toPurchase(
      purchaseId,
      at,
      form,
      item.unit,
      item.id,
      item.packageWeightKg,
      existing.line.createdItem,
    );
    // Keep other purchase snapshots aligned with the renamed/updated SKU.
    this.purchases.update((list) =>
      list.map((p) => {
        if (p.id === purchaseId) return purchase;
        if (p.line.stockItemId !== item.id) return p;
        return {
          ...p,
          summary: `${p.line.quantity} ${item.unit} · ${item.name}`,
          line: {
            ...p.line,
            name: item.name,
            unit: item.unit,
            packageWeightKg: item.packageWeightKg,
          },
        };
      }),
    );
    this.persist();
    return purchase;
  }

  /**
   * Remove purchase line, reverse stock entry, and drop orphan product if this
   * purchase created it and nothing else (movements / recipes) still uses it.
   */
  remove(purchaseId: string): void {
    const existing = this.findById(purchaseId);
    if (!existing) throw new Error('Compra não encontrada.');

    this.inventory.reversePurchase(purchaseId);

    if (existing.line.createdItem) {
      const itemId = existing.line.stockItemId;
      const usedInRecipe = this.menu
        .dishes()
        .some((d) => d.recipe.some((line) => line.stockItemId === itemId));
      if (!usedInRecipe) {
        this.inventory.removeItemIfUnused(itemId);
      }
    }

    this.purchases.update((list) => list.filter((p) => p.id !== purchaseId));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.purchases()));
    } catch {
      // ignore
    }
  }
}

function toPurchase(
  purchaseId: string,
  at: string,
  form: ReceivePurchaseForm,
  unit: string,
  stockItemId: string,
  packageWeightKg: number | undefined,
  createdItem: boolean,
): Purchase {
  const note = form.note?.trim();
  return {
    id: purchaseId,
    at,
    summary: `${form.quantity} ${unit} · ${form.name.trim()}`,
    totalCost: roundMoney(form.quantity * form.unitCost),
    line: {
      stockItemId,
      name: form.name.trim(),
      unit,
      quantity: form.quantity,
      unitCost: form.unitCost,
      packageWeightKg,
      createdItem,
    },
    ...(note ? { note } : {}),
  };
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

import { recipeLineCost, recipeQtyToStockUnit } from '../estoque/stock-units';
import type { RecipeMassUnit, StockItem } from '../estoque/stock.models';

/** Internal menu catalog. Backend menu API does not exist yet. */

export type DishStatus = 'available' | 'unavailable';

export type { RecipeMassUnit };

/** Ingredient line on a dish recipe (mass qty + stock snapshots). */
export interface DishRecipeLine {
  stockItemId: string;
  name: string;
  /** Quantity per portion in `qtyUnit` (g or kg). */
  qtyValue: number;
  qtyUnit: RecipeMassUnit;
  /** Stock unit of the ingredient at save time (display). */
  stockUnit: string;
  /** Unit cost per stock unit, snapshotted. */
  unitCost: number;
}

export interface MenuDish {
  id: string;
  name: string;
  description?: string;
  salePrice: number;
  status: DishStatus;
  recipe: DishRecipeLine[];
  createdAt: string;
  updatedAt: string;
}

/** Shape consumed by Sales “Pratos prontos” picker. */
export interface SaleMenuDish {
  id: string;
  name: string;
  unitPrice: number;
}

export function estimatedRecipeCost(
  recipe: DishRecipeLine[],
  resolveItem?: (id: string) => StockItem | undefined,
): number | null {
  if (!recipe.length) return null;
  let total = 0;
  let any = false;
  for (const line of recipe) {
    const item = resolveItem?.(line.stockItemId);
    if (item) {
      const cost = recipeLineCost(item, line.qtyValue, line.qtyUnit);
      if (cost == null) return null;
      total += cost;
      any = true;
      continue;
    }
    const stockQty = recipeQtyToStockUnit(
      {
        id: line.stockItemId,
        name: line.name,
        category: '',
        quantity: 0,
        unit: line.stockUnit,
        unitCost: line.unitCost,
        minQuantity: 0,
        status: 'ok',
      },
      line.qtyValue,
      line.qtyUnit,
    );
    if (stockQty == null) {
      // Fallback: treat qty as already in stock units (legacy) if stockUnit matches qtyUnit path fails
      total += line.qtyValue * line.unitCost;
      any = true;
      continue;
    }
    total += stockQty * line.unitCost;
    any = true;
  }
  return any ? Math.round(total * 100) / 100 : null;
}

/** Migrate legacy recipe lines that used quantity/unit. */
export function normalizeRecipeLine(raw: unknown): DishRecipeLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as Record<string, unknown>;
  const stockItemId = String(line['stockItemId'] ?? '');
  const name = String(line['name'] ?? '');
  if (!stockItemId || !name) return null;

  if (typeof line['qtyValue'] === 'number' && (line['qtyUnit'] === 'g' || line['qtyUnit'] === 'kg')) {
    return {
      stockItemId,
      name,
      qtyValue: line['qtyValue'],
      qtyUnit: line['qtyUnit'],
      stockUnit: String(line['stockUnit'] ?? line['unit'] ?? 'kg'),
      unitCost: Number(line['unitCost'] ?? 0),
    };
  }

  // Legacy: quantity in stock unit
  const quantity = Number(line['quantity'] ?? 0);
  const unit = String(line['unit'] ?? 'kg');
  let qtyValue = quantity;
  let qtyUnit: RecipeMassUnit = 'kg';
  if (unit === 'g') {
    qtyValue = quantity;
    qtyUnit = 'g';
  } else if (unit === 'kg') {
    qtyValue = quantity;
    qtyUnit = 'kg';
  } else {
    // discrete legacy: keep as kg of unknown package — skip if zero
    qtyValue = quantity;
    qtyUnit = 'kg';
  }

  return {
    stockItemId,
    name,
    qtyValue,
    qtyUnit,
    stockUnit: unit,
    unitCost: Number(line['unitCost'] ?? 0),
  };
}

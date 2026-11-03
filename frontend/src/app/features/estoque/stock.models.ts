export type StockStatus = 'ok' | 'low' | 'out';

/** Mass units usable on dish recipes. */
export type RecipeMassUnit = 'g' | 'kg';

export type StockMovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'count_adjust'
  | 'manual_out';

export type StockMovementRefType = 'purchase' | 'sale' | 'count';

export interface StockItem {
  id: string;
  name: string;
  category: string;
  /** Canonical on-hand quantity in `unit` (estimated or last count). */
  quantity: number;
  unit: string;
  unitCost: number;
  minQuantity: number;
  status: StockStatus;
  /**
   * Net weight of one stock unit in kg when `unit` is discrete (un/cx/pct).
   * Used to convert recipe g/kg into stock units.
   */
  packageWeightKg?: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  /** Always in the item's stock unit. */
  quantity: number;
  unit: string;
  note: string;
  at: string;
  user: string;
  refType?: StockMovementRefType;
  refId?: string;
  /**
   * Unit cost captured at movement time (for CMV / history).
   * Absent on legacy movements — do not invent from current item.unitCost.
   */
  unitCostAt?: number;
}

export interface StockDayLine {
  itemId: string;
  openingQty: number;
  purchasedQty: number;
  estimatedOutQty: number;
  countedQty?: number;
  countedAt?: string;
}

export interface StockDay {
  date: string;
  lines: StockDayLine[];
}

export function dayEstimatedQty(line: StockDayLine): number {
  return roundQty(line.openingQty + line.purchasedQty - line.estimatedOutQty);
}

export function deriveStockStatus(quantity: number, minQuantity: number): StockStatus {
  if (quantity <= 0) return 'out';
  if (quantity <= minQuantity) return 'low';
  return 'ok';
}

export function roundQty(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

import { RecipeMassUnit, StockItem, roundMoney, roundQty } from './stock.models';

const MASS_UNITS = new Set(['kg', 'g']);
const DISCRETE_UNITS = new Set(['un', 'cx', 'pct']);

export function isMassUnit(unit: string): boolean {
  return MASS_UNITS.has(unit);
}

export function isDiscreteUnit(unit: string): boolean {
  return DISCRETE_UNITS.has(unit);
}

export function recipeCompatible(item: StockItem): boolean {
  if (isMassUnit(item.unit)) return true;
  if (isDiscreteUnit(item.unit) && item.packageWeightKg != null && item.packageWeightKg > 0) {
    return true;
  }
  return false;
}

export function toKg(value: number, unit: RecipeMassUnit): number {
  return unit === 'g' ? value / 1000 : value;
}

/**
 * Convert a recipe mass quantity into the item's stock unit.
 * Returns null when conversion is impossible.
 */
export function recipeQtyToStockUnit(
  item: StockItem,
  qtyValue: number,
  qtyUnit: RecipeMassUnit,
): number | null {
  if (!(qtyValue > 0)) return null;
  const kg = toKg(qtyValue, qtyUnit);

  if (item.unit === 'kg') return roundQty(kg);
  if (item.unit === 'g') return roundQty(kg * 1000);

  if (isDiscreteUnit(item.unit)) {
    const pack = item.packageWeightKg;
    if (pack == null || !(pack > 0)) return null;
    return roundQty(kg / pack);
  }

  return null;
}

export function recipeLineCost(
  item: StockItem,
  qtyValue: number,
  qtyUnit: RecipeMassUnit,
): number | null {
  const stockQty = recipeQtyToStockUnit(item, qtyValue, qtyUnit);
  if (stockQty == null) return null;
  return roundMoney(stockQty * item.unitCost);
}

export function formatStockQty(value: number, unit: string): string {
  const n = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  return `${n} ${unit}`;
}

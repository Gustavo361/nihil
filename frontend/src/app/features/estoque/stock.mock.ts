import { StockItem, deriveStockStatus, roundMoney } from './stock.models';

/** Shared option lists for Compras / Estoque UI. */

export const STOCK_CATEGORIES = ['Insumos', 'Hortifruti', 'Bebidas', 'Limpeza', 'Descartáveis'] as const;

export const STOCK_UNITS = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'] as const;

/**
 * Demo insumos for local UI — enough to build a full dish recipe (g/kg).
 * Used only when stock storage is empty. Not a business source of truth.
 */
export const STOCK_DEMO_ITEMS: Omit<StockItem, 'status'>[] = [
  {
    id: 'demo-arroz',
    name: 'Arroz tipo 1',
    category: 'Insumos',
    quantity: 25,
    unit: 'kg',
    unitCost: 5.9,
    minQuantity: 5,
  },
  {
    id: 'demo-feijao',
    name: 'Feijão carioca',
    category: 'Insumos',
    quantity: 12,
    unit: 'kg',
    unitCost: 8.4,
    minQuantity: 3,
  },
  {
    id: 'demo-oleo',
    name: 'Óleo de soja',
    category: 'Insumos',
    quantity: 8,
    unit: 'un',
    unitCost: 7.2,
    minQuantity: 2,
    packageWeightKg: 0.9,
  },
  {
    id: 'demo-frango',
    name: 'Peito de frango',
    category: 'Insumos',
    quantity: 10,
    unit: 'kg',
    unitCost: 18.5,
    minQuantity: 2,
  },
  {
    id: 'demo-carne',
    name: 'Carne bovina (patinho)',
    category: 'Insumos',
    quantity: 8,
    unit: 'kg',
    unitCost: 36.9,
    minQuantity: 2,
  },
  {
    id: 'demo-ovo',
    name: 'Ovo',
    category: 'Insumos',
    quantity: 60,
    unit: 'un',
    unitCost: 0.85,
    minQuantity: 12,
    packageWeightKg: 0.05,
  },
  {
    id: 'demo-tomate',
    name: 'Tomate',
    category: 'Hortifruti',
    quantity: 6,
    unit: 'kg',
    unitCost: 6.8,
    minQuantity: 2,
  },
  {
    id: 'demo-cebola',
    name: 'Cebola',
    category: 'Hortifruti',
    quantity: 5,
    unit: 'kg',
    unitCost: 4.5,
    minQuantity: 1,
  },
  {
    id: 'demo-alho',
    name: 'Alho',
    category: 'Hortifruti',
    quantity: 2,
    unit: 'kg',
    unitCost: 22,
    minQuantity: 0.5,
  },
  {
    id: 'demo-batata',
    name: 'Batata',
    category: 'Hortifruti',
    quantity: 15,
    unit: 'kg',
    unitCost: 3.9,
    minQuantity: 3,
  },
  {
    id: 'demo-alface',
    name: 'Alface americana',
    category: 'Hortifruti',
    quantity: 20,
    unit: 'un',
    unitCost: 3.5,
    minQuantity: 5,
    packageWeightKg: 0.3,
  },
  {
    id: 'demo-farinha',
    name: 'Farinha de trigo',
    category: 'Insumos',
    quantity: 10,
    unit: 'kg',
    unitCost: 4.2,
    minQuantity: 2,
  },
];

export function buildDemoStockItems(): StockItem[] {
  return STOCK_DEMO_ITEMS.map((item) => ({
    ...item,
    unitCost: roundMoney(item.unitCost),
    status: deriveStockStatus(item.quantity, item.minQuantity),
  }));
}

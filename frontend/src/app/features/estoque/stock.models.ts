export type StockStatus = 'ok' | 'low' | 'out';

export type StockMovementType = 'in' | 'out';

export interface StockItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  minQuantity: number;
  status: StockStatus;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  quantity: number;
  unit: string;
  note: string;
  at: string;
  user: string;
}

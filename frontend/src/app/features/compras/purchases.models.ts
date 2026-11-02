/** Purchase receipts — UI/localStorage until purchasing API exists. */

export interface PurchaseLineSnapshot {
  stockItemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  packageWeightKg?: number;
  createdItem: boolean;
}

export interface Purchase {
  id: string;
  at: string;
  summary: string;
  totalCost: number;
  line: PurchaseLineSnapshot;
}

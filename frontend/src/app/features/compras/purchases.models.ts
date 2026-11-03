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
  /** Optional observation saved with the receipt. */
  note?: string;
  /** Link to supplier delivery receipt (when created from Fornecedores). */
  supplierId?: string;
  deliveryOccurrenceId?: string;
  deliveryReceiptId?: string;
}

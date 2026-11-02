export type SaleModality = 'buffet' | 'kg' | 'dishes';

export type SaleStatus = 'confirmed' | 'cancelled';

export type PaymentMethod = 'cash' | 'pix' | 'debit' | 'credit';

export interface SaleDishLine {
  dishId: string;
  dishName: string;
  unitPrice: number;
  quantity: number;
}

export interface SaleCancellation {
  at: string;
  reason: string;
  user: string;
}

export interface Sale {
  id: string;
  at: string;
  modality: SaleModality;
  summary: string;
  total: number;
  payment: PaymentMethod;
  status: SaleStatus;
  peopleCount?: number;
  pricePerPerson?: number;
  weightKg?: number;
  pricePerKg?: number;
  lines?: SaleDishLine[];
  cancellation?: SaleCancellation;
}

/** Catalog entry when menu API exists. Empty until dishes are persisted. */
export interface MenuDish {
  id: string;
  name: string;
  unitPrice: number;
}

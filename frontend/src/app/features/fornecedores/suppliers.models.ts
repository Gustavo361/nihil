/** Suppliers / deliveries — UI/localStorage until purchasing API exists. */

export type SupplierStatus = 'active' | 'inactive';

export type OccurrenceStatus =
  | 'planned'
  | 'awaiting'
  | 'received'
  | 'partial'
  | 'missed'
  | 'annulled';

export type ReceiptStatus = 'confirmed' | 'annulled';

/** 0 = Sunday … 6 = Saturday (Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HabitualProduct {
  id: string;
  stockItemId: string;
  expectedQty: number;
  unit: string;
  unitCost?: number;
  note?: string;
}

export interface ScheduleProductSnapshot {
  stockItemId: string;
  name: string;
  expectedQty: number;
  unit: string;
  unitCost?: number;
  note?: string;
}

export interface DeliverySchedule {
  id: string;
  weekdays: Weekday[];
  time: string; // HH:mm local
  productIds: string[]; // habitual product ids; empty = all habituais at generate time
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  /** Optional Brazilian postal code (digits or formatted). */
  cep?: string;
  street?: string;
  neighborhood?: string;
  number?: string;
  city?: string;
  state?: string;
  notes?: string;
  status: SupplierStatus;
  habituais: HabitualProduct[];
  schedules: DeliverySchedule[];
  createdAt: string;
  updatedAt: string;
}

export function formatSupplierAddress(s: Pick<
  Supplier,
  'street' | 'number' | 'neighborhood' | 'city' | 'state' | 'cep'
>): string {
  const line1 = [s.street, s.number].filter(Boolean).join(', ');
  const line2 = [s.neighborhood, s.city && s.state ? `${s.city}/${s.state}` : s.city || s.state]
    .filter(Boolean)
    .join(' · ');
  const cep = s.cep ? `CEP ${s.cep}` : '';
  return [line1, line2, cep].filter(Boolean).join(' — ') || '—';
}

export interface OccurrenceExpectedItem {
  stockItemId: string;
  name: string;
  expectedQty: number;
  unit: string;
  unitCost?: number;
  note?: string;
}

export interface DeliveryOccurrence {
  id: string; // `${scheduleId}:${yyyy-MM-dd}`
  supplierId: string;
  scheduleId: string;
  date: string; // yyyy-MM-dd
  plannedAt: string; // ISO
  status: OccurrenceStatus;
  expectedItems: OccurrenceExpectedItem[];
  snoozeUntil?: string;
  receiptId?: string;
  missedAt?: string;
  missedNote?: string;
}

export interface ReceiptReceivedItem {
  stockItemId: string;
  name: string;
  unit: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
  received: boolean;
  note?: string;
  purchaseId?: string;
}

export interface ReceiptAuditEntry {
  id: string;
  at: string;
  user: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export interface DeliveryReceipt {
  id: string;
  supplierId: string;
  occurrenceId: string;
  at: string;
  status: ReceiptStatus;
  expectedItems: OccurrenceExpectedItem[];
  receivedItems: ReceiptReceivedItem[];
  purchaseIds: string[];
  notes?: string;
  annulReason?: string;
  annulledAt?: string;
  auditLog: ReceiptAuditEntry[];
}

export interface DeliveryReminder {
  occurrenceId: string;
  supplierId: string;
  supplierName: string;
  plannedAt: string;
  status: OccurrenceStatus;
}

export interface SupplierStoreV1 {
  version: 1;
  suppliers: Supplier[];
  occurrences: DeliveryOccurrence[];
  receipts: DeliveryReceipt[];
}

export function occurrenceStatusLabel(status: OccurrenceStatus): string {
  switch (status) {
    case 'planned':
      return 'Prevista';
    case 'awaiting':
      return 'Aguardando recebimento';
    case 'received':
      return 'Recebida';
    case 'partial':
      return 'Parcialmente recebida';
    case 'missed':
      return 'Não entregue';
    case 'annulled':
      return 'Anulada';
    default:
      return status;
  }
}

export function weekdayLabel(day: Weekday): string {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day] ?? String(day);
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PurchaseCatalogService } from '../purchases/purchase-catalog.service';
import { StockInventoryService } from '../stock/stock-inventory.service';
import { ToastService } from '../toast/toast.service';
import {
  DeliveryOccurrence,
  DeliveryReceipt,
  DeliveryReminder,
  DeliverySchedule,
  HabitualProduct,
  OccurrenceExpectedItem,
  OccurrenceStatus,
  ReceiptAuditEntry,
  ReceiptReceivedItem,
  Supplier,
  SupplierStatus,
  SupplierStoreV1,
  Weekday,
} from '../../features/fornecedores/suppliers.models';
import { roundMoney, roundQty } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.suppliers.v1';
const OCCURRENCE_HORIZON_DAYS = 14;
const AUDIT_USER = 'Administrador';

export interface UpsertSupplierInput {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
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
}

export interface ConfirmReceiveItemInput {
  stockItemId: string;
  name: string;
  unit: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
  received: boolean;
  note?: string;
  /** Existing purchase id when editing. */
  purchaseId?: string;
}

@Injectable({ providedIn: 'root' })
export class SupplierCatalogService {
  private readonly inventory = inject(StockInventoryService);
  private readonly purchases = inject(PurchaseCatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly suppliers = signal<Supplier[]>([]);
  readonly occurrences = signal<DeliveryOccurrence[]>([]);
  readonly receipts = signal<DeliveryReceipt[]>([]);

  /** Toast dedupe for due reminders in this browser session. */
  private readonly toastedDue = new Set<string>();

  readonly activeCount = computed(
    () => this.suppliers().filter((s) => s.status === 'active').length,
  );

  readonly plannedTodayCount = computed(() => {
    const today = todayKey();
    const createdBy = new Map(this.suppliers().map((s) => [s.id, localDayKey(s.createdAt)]));
    return this.occurrences().filter((o) => {
      const from = createdBy.get(o.supplierId);
      if (from && o.date < from) return false;
      return o.date === today && (o.status === 'planned' || o.status === 'awaiting');
    }).length;
  });

  readonly awaitingCount = computed(() => {
    const createdBy = new Map(this.suppliers().map((s) => [s.id, localDayKey(s.createdAt)]));
    return this.occurrences().filter((o) => {
      const from = createdBy.get(o.supplierId);
      if (from && o.date < from) return false;
      return o.status === 'awaiting' || (o.status === 'planned' && isDue(o));
    }).length;
  });

  readonly receiptsTodayCount = computed(() => {
    const today = todayKey();
    return this.receipts().filter(
      (r) => r.status === 'confirmed' && localDayKey(r.at) === today,
    ).length;
  });

  readonly dueReminders = computed((): DeliveryReminder[] => {
    const byId = new Map(this.suppliers().map((s) => [s.id, s]));
    return this.occurrences()
      .filter((o) => {
        const supplier = byId.get(o.supplierId);
        if (!supplier) return false;
        if (o.date < localDayKey(supplier.createdAt)) return false;
        return isReminderDue(o);
      })
      .map((o) => ({
        occurrenceId: o.id,
        supplierId: o.supplierId,
        supplierName: byId.get(o.supplierId)?.name ?? 'Fornecedor',
        plannedAt: o.plannedAt,
        status: o.status,
      }))
      .sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
  });

  constructor() {
    const store = readStore();
    this.suppliers.set(store?.suppliers ?? []);
    this.occurrences.set(store?.occurrences ?? []);
    this.receipts.set(store?.receipts ?? []);
    this.materializeOccurrences();
    this.refreshAwaitingStatuses();
    this.emitDueToasts();
  }

  findSupplier(id: string): Supplier | undefined {
    return this.suppliers().find((s) => s.id === id);
  }

  findOccurrence(id: string): DeliveryOccurrence | undefined {
    return this.occurrences().find((o) => o.id === id);
  }

  findReceipt(id: string): DeliveryReceipt | undefined {
    return this.receipts().find((r) => r.id === id);
  }

  receiptForOccurrence(occurrenceId: string): DeliveryReceipt | undefined {
    return this.receipts().find(
      (r) => r.occurrenceId === occurrenceId && r.status === 'confirmed',
    );
  }

  nextOccurrenceFor(supplierId: string): DeliveryOccurrence | undefined {
    const supplier = this.findSupplier(supplierId);
    const fromDay = supplier ? localDayKey(supplier.createdAt) : '';
    const now = Date.now();
    return this.occurrences()
      .filter(
        (o) =>
          o.supplierId === supplierId &&
          (!fromDay || o.date >= fromDay) &&
          (o.status === 'planned' || o.status === 'awaiting') &&
          new Date(o.plannedAt).getTime() >= now - 60_000,
      )
      .sort((a, b) => a.plannedAt.localeCompare(b.plannedAt))[0];
  }

  /** Occurrences visible in history: from supplier registration day onward. */
  occurrencesForSupplier(supplierId: string): DeliveryOccurrence[] {
    const supplier = this.findSupplier(supplierId);
    const fromDay = supplier ? localDayKey(supplier.createdAt) : '';
    return this.occurrences()
      .filter((o) => o.supplierId === supplierId && (!fromDay || o.date >= fromDay))
      .slice()
      .sort((a, b) => b.plannedAt.localeCompare(a.plannedAt));
  }

  upsertSupplier(input: UpsertSupplierInput): Supplier {
    const name = input.name.trim();
    if (!name) throw new Error('Informe o nome do fornecedor.');

    const now = new Date().toISOString();
    if (input.id) {
      const existing = this.findSupplier(input.id);
      if (!existing) throw new Error('Fornecedor não encontrado.');
      const updated: Supplier = {
        ...existing,
        name,
        contactName: emptyToUndef(input.contactName),
        phone: emptyToUndef(input.phone),
        email: emptyToUndef(input.email),
        cep: emptyToUndef(input.cep),
        street: emptyToUndef(input.street),
        neighborhood: emptyToUndef(input.neighborhood),
        number: emptyToUndef(input.number),
        city: emptyToUndef(input.city),
        state: emptyToUndef(input.state),
        notes: emptyToUndef(input.notes),
        status: input.status,
        habituais: normalizeHabituais(input.habituais),
        schedules: normalizeSchedules(input.schedules),
        updatedAt: now,
      };
      this.suppliers.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      this.persist();
      this.materializeOccurrences();
      return updated;
    }

    const created: Supplier = {
      id: nextId('sup'),
      name,
      contactName: emptyToUndef(input.contactName),
      phone: emptyToUndef(input.phone),
      email: emptyToUndef(input.email),
      cep: emptyToUndef(input.cep),
      street: emptyToUndef(input.street),
      neighborhood: emptyToUndef(input.neighborhood),
      number: emptyToUndef(input.number),
      city: emptyToUndef(input.city),
      state: emptyToUndef(input.state),
      notes: emptyToUndef(input.notes),
      status: input.status,
      habituais: normalizeHabituais(input.habituais),
      schedules: normalizeSchedules(input.schedules),
      createdAt: now,
      updatedAt: now,
    };
    this.suppliers.update((list) => [created, ...list]);
    this.persist();
    this.materializeOccurrences();
    return created;
  }

  /**
   * Soft-deactivate preferred. Hard delete only when no linked history.
   */
  deactivateOrDelete(supplierId: string): { action: 'deleted' | 'deactivated' } {
    const supplier = this.findSupplier(supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');

    const hasHistory =
      this.occurrences().some((o) => o.supplierId === supplierId) ||
      this.receipts().some((r) => r.supplierId === supplierId) ||
      this.purchases.purchases().some((p) => p.supplierId === supplierId);

    if (hasHistory) {
      this.suppliers.update((list) =>
        list.map((s) =>
          s.id === supplierId
            ? { ...s, status: 'inactive' as const, updatedAt: new Date().toISOString() }
            : s,
        ),
      );
      this.persist();
      return { action: 'deactivated' };
    }

    this.suppliers.update((list) => list.filter((s) => s.id !== supplierId));
    this.persist();
    return { action: 'deleted' };
  }

  refreshAwaitingStatuses(): void {
    const now = Date.now();
    let changed = false;
    this.occurrences.update((list) =>
      list.map((o) => {
        if (o.status !== 'planned') return o;
        if (new Date(o.plannedAt).getTime() > now) return o;
        changed = true;
        return { ...o, status: 'awaiting' as const };
      }),
    );
    if (changed) this.persist();
  }

  materializeOccurrences(): void {
    const bySupplierCreated = new Map(
      this.suppliers().map((s) => [s.id, localDayKey(s.createdAt)]),
    );
    const schedulesById = new Map<string, { supplier: Supplier; schedule: DeliverySchedule }>();
    for (const supplier of this.suppliers()) {
      for (const schedule of supplier.schedules) {
        schedulesById.set(schedule.id, { supplier, schedule });
      }
    }

    // Drop open occurrences dated before the supplier was registered.
    let list = this.occurrences().filter((o) => {
      const fromDay = bySupplierCreated.get(o.supplierId);
      if (!fromDay) return true;
      if (o.date >= fromDay) return true;
      return o.status === 'received' || o.status === 'partial' || o.status === 'annulled';
    });

    // Sync open occurrences when schedule time changes (otherwise reminders keep the old hour).
    const now = Date.now();
    list = list.map((o) => {
      if (o.status !== 'planned' && o.status !== 'awaiting') return o;
      const found = schedulesById.get(o.scheduleId);
      if (!found?.schedule.active) return o;
      const [y, m, d] = o.date.split('-').map(Number);
      const day = new Date(y, (m ?? 1) - 1, d ?? 1);
      const plannedAt = combineDateAndTime(day, found.schedule.time);
      const iso = plannedAt.toISOString();
      if (iso === o.plannedAt) return o;
      this.toastedDue.delete(o.id);
      return {
        ...o,
        plannedAt: iso,
        status: (plannedAt.getTime() <= now ? 'awaiting' : 'planned') as OccurrenceStatus,
        snoozeUntil: undefined,
      };
    });

    const existing = new Map(list.map((o) => [o.id, o]));
    const additions: DeliveryOccurrence[] = [];
    const today = startOfLocalDay(new Date());
    const todayKeyStr = formatDayKey(today);

    for (const supplier of this.suppliers()) {
      if (supplier.status !== 'active') continue;
      const createdDay = localDayKey(supplier.createdAt);
      // Never invent days before registration; also never backfill past calendar days.
      const startDay = createdDay > todayKeyStr ? createdDay : todayKeyStr;

      for (const schedule of supplier.schedules) {
        if (!schedule.active || !schedule.weekdays.length) continue;
        for (let offset = 0; offset <= OCCURRENCE_HORIZON_DAYS; offset++) {
          const day = addDays(today, offset);
          const date = formatDayKey(day);
          if (date < startDay) continue;
          const weekday = day.getDay() as Weekday;
          if (!schedule.weekdays.includes(weekday)) continue;
          const id = `${schedule.id}:${date}`;
          if (existing.has(id)) continue;
          const plannedAt = combineDateAndTime(day, schedule.time);
          additions.push({
            id,
            supplierId: supplier.id,
            scheduleId: schedule.id,
            date,
            plannedAt: plannedAt.toISOString(),
            status: plannedAt.getTime() <= Date.now() ? 'awaiting' : 'planned',
            expectedItems: this.snapshotExpected(supplier, schedule),
          });
        }
      }
    }

    const next = [...list, ...additions].sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
    const before = JSON.stringify(this.occurrences());
    const after = JSON.stringify(next);
    if (before === after) return;
    this.occurrences.set(next);
    this.persist();
  }

  private snapshotExpected(
    supplier: Supplier,
    schedule: DeliverySchedule,
  ): OccurrenceExpectedItem[] {
    const selected =
      schedule.productIds.length > 0
        ? supplier.habituais.filter((h) => schedule.productIds.includes(h.id))
        : supplier.habituais;

    return selected.map((h) => {
      const stock = this.inventory.findById(h.stockItemId);
      return {
        stockItemId: h.stockItemId,
        name: stock?.name ?? h.stockItemId,
        expectedQty: h.expectedQty,
        unit: stock?.unit ?? h.unit,
        unitCost: h.unitCost ?? stock?.unitCost,
        note: h.note,
      };
    });
  }

  snoozeOccurrence(occurrenceId: string, untilIso: string): void {
    const occ = this.findOccurrence(occurrenceId);
    if (!occ) throw new Error('Entrega não encontrada.');
    if (isTerminal(occ.status)) {
      throw new Error('Esta entrega já foi encerrada e não pode ser adiada.');
    }
    const until = new Date(untilIso);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      throw new Error('Informe um horário futuro para adiar o lembrete.');
    }
    this.occurrences.update((list) =>
      list.map((o) =>
        o.id === occurrenceId
          ? { ...o, snoozeUntil: until.toISOString(), status: o.status === 'awaiting' ? o.status : 'planned' }
          : o,
      ),
    );
    this.persist();
  }

  markMissed(occurrenceId: string, note?: string): void {
    const occ = this.findOccurrence(occurrenceId);
    if (!occ) throw new Error('Entrega não encontrada.');
    if (isTerminal(occ.status)) {
      throw new Error('Esta entrega já foi encerrada.');
    }
    this.occurrences.update((list) =>
      list.map((o) =>
        o.id === occurrenceId
          ? {
              ...o,
              status: 'missed' as const,
              missedAt: new Date().toISOString(),
              missedNote: emptyToUndef(note),
              snoozeUntil: undefined,
            }
          : o,
      ),
    );
    this.persist();
  }

  confirmReceive(
    occurrenceId: string,
    items: ConfirmReceiveItemInput[],
    notes?: string,
  ): DeliveryReceipt {
    const occ = this.findOccurrence(occurrenceId);
    if (!occ) throw new Error('Entrega não encontrada.');
    if (occ.status === 'received' || occ.status === 'partial') {
      throw new Error('Esta entrega já possui recebimento confirmado.');
    }
    if (occ.status === 'annulled') {
      throw new Error('Esta entrega foi anulada e não pode ser confirmada novamente.');
    }
    if (occ.status === 'missed') {
      throw new Error('Esta entrega foi marcada como não entregue.');
    }
    if (this.receiptForOccurrence(occurrenceId)) {
      throw new Error('Já existe um recebimento ativo para esta entrega.');
    }

    const received = items.filter((i) => i.received && i.receivedQty > 0);
    if (!received.length) {
      throw new Error('Informe ao menos um produto efetivamente recebido.');
    }

    const supplier = this.findSupplier(occ.supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');

    const receiptId = nextId('recv');
    const at = new Date().toISOString();
    const purchaseIds: string[] = [];
    const receivedItems: ReceiptReceivedItem[] = [];

    for (const item of items) {
      let purchaseId: string | undefined;
      if (item.received && item.receivedQty > 0) {
        const stock = this.inventory.findById(item.stockItemId);
        if (!stock) throw new Error(`Produto “${item.name}” não encontrado no estoque.`);
        const purchase = this.purchases.receive({
          name: stock.name,
          category: stock.category,
          unit: stock.unit,
          quantity: item.receivedQty,
          unitCost: item.unitCost,
          minQuantity: stock.minQuantity,
          packageWeightKg: stock.packageWeightKg,
          at,
          note: item.note || `Recebimento ${supplier.name}`,
          supplierId: occ.supplierId,
          deliveryOccurrenceId: occurrenceId,
          deliveryReceiptId: receiptId,
        });
        purchaseId = purchase.id;
        purchaseIds.push(purchase.id);
      }
      receivedItems.push({
        stockItemId: item.stockItemId,
        name: item.name,
        unit: item.unit,
        expectedQty: item.expectedQty,
        receivedQty: item.received ? item.receivedQty : 0,
        unitCost: item.unitCost,
        received: !!(item.received && item.receivedQty > 0),
        note: emptyToUndef(item.note),
        purchaseId,
      });
    }

    const status = deriveOccurrenceStatus(occ.expectedItems, receivedItems);
    const audit: ReceiptAuditEntry = {
      id: nextId('aud'),
      at,
      user: AUDIT_USER,
      action: 'confirm',
      after: { items: receivedItems, status },
    };

    const receipt: DeliveryReceipt = {
      id: receiptId,
      supplierId: occ.supplierId,
      occurrenceId,
      at,
      status: 'confirmed',
      expectedItems: occ.expectedItems.map((e) => ({ ...e })),
      receivedItems,
      purchaseIds,
      notes: emptyToUndef(notes),
      auditLog: [audit],
    };

    this.receipts.update((list) => [receipt, ...list]);
    this.occurrences.update((list) =>
      list.map((o) =>
        o.id === occurrenceId
          ? { ...o, status, receiptId, snoozeUntil: undefined }
          : o,
      ),
    );
    this.persist();
    return receipt;
  }

  updateReceipt(
    receiptId: string,
    items: ConfirmReceiveItemInput[],
    notes?: string,
  ): DeliveryReceipt {
    const receipt = this.findReceipt(receiptId);
    if (!receipt) throw new Error('Recebimento não encontrado.');
    if (receipt.status === 'annulled') {
      throw new Error('Recebimento anulado não pode ser editado.');
    }

    const occ = this.findOccurrence(receipt.occurrenceId);
    if (!occ) throw new Error('Ocorrência vinculada não encontrada.');

    const before = structuredClone(receipt.receivedItems);
    const nextReceived: ReceiptReceivedItem[] = [];
    const purchaseIds: string[] = [];
    const at = new Date().toISOString();
    const supplier = this.findSupplier(receipt.supplierId);

    const previousByStock = new Map(
      receipt.receivedItems.filter((i) => i.purchaseId).map((i) => [i.stockItemId, i]),
    );
    const incomingIds = new Set(items.map((i) => i.stockItemId));

    // Remove purchases for items no longer present / not received
    for (const prev of receipt.receivedItems) {
      if (!prev.purchaseId) continue;
      const next = items.find((i) => i.stockItemId === prev.stockItemId);
      if (!next || !next.received || !(next.receivedQty > 0)) {
        this.purchases.remove(prev.purchaseId);
      }
    }

    for (const item of items) {
      const prev = previousByStock.get(item.stockItemId);
      let purchaseId: string | undefined;

      if (item.received && item.receivedQty > 0) {
        const stock = this.inventory.findById(item.stockItemId);
        if (!stock) throw new Error(`Produto “${item.name}” não encontrado no estoque.`);
        const form = {
          name: stock.name,
          category: stock.category,
          unit: stock.unit,
          quantity: item.receivedQty,
          unitCost: item.unitCost,
          minQuantity: stock.minQuantity,
          packageWeightKg: stock.packageWeightKg,
          at: prev?.purchaseId
            ? (this.purchases.findById(prev.purchaseId)?.at ?? at)
            : at,
          note: item.note || `Recebimento ${supplier?.name ?? ''}`.trim(),
          supplierId: receipt.supplierId,
          deliveryOccurrenceId: receipt.occurrenceId,
          deliveryReceiptId: receipt.id,
        };

        if (prev?.purchaseId && this.purchases.findById(prev.purchaseId)) {
          const updated = this.purchases.update(prev.purchaseId, form);
          purchaseId = updated.id;
        } else {
          const created = this.purchases.receive(form);
          purchaseId = created.id;
        }
        purchaseIds.push(purchaseId);
      }

      nextReceived.push({
        stockItemId: item.stockItemId,
        name: item.name,
        unit: item.unit,
        expectedQty: item.expectedQty,
        receivedQty: item.received ? item.receivedQty : 0,
        unitCost: item.unitCost,
        received: !!(item.received && item.receivedQty > 0),
        note: emptyToUndef(item.note),
        purchaseId,
      });
    }

    void incomingIds;
    const status = deriveOccurrenceStatus(receipt.expectedItems, nextReceived);
    const audit: ReceiptAuditEntry = {
      id: nextId('aud'),
      at,
      user: AUDIT_USER,
      action: 'edit',
      before,
      after: { items: nextReceived, status },
    };

    const updated: DeliveryReceipt = {
      ...receipt,
      receivedItems: nextReceived,
      purchaseIds,
      notes: emptyToUndef(notes),
      auditLog: [...receipt.auditLog, audit],
    };

    this.receipts.update((list) => list.map((r) => (r.id === receiptId ? updated : r)));
    this.occurrences.update((list) =>
      list.map((o) => (o.id === receipt.occurrenceId ? { ...o, status, receiptId: receipt.id } : o)),
    );
    this.persist();
    return updated;
  }

  annulReceipt(receiptId: string, reason: string): DeliveryReceipt {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error('Informe a justificativa da anulação.');

    const receipt = this.findReceipt(receiptId);
    if (!receipt) throw new Error('Recebimento não encontrado.');
    if (receipt.status === 'annulled') {
      throw new Error('Este recebimento já foi anulado.');
    }

    for (const purchaseId of receipt.purchaseIds) {
      if (this.purchases.findById(purchaseId)) {
        this.purchases.remove(purchaseId);
      }
    }

    const at = new Date().toISOString();
    const audit: ReceiptAuditEntry = {
      id: nextId('aud'),
      at,
      user: AUDIT_USER,
      action: 'annul',
      before: { status: receipt.status, purchaseIds: receipt.purchaseIds },
      after: { status: 'annulled', reason: trimmed },
    };

    const updated: DeliveryReceipt = {
      ...receipt,
      status: 'annulled',
      annulReason: trimmed,
      annulledAt: at,
      purchaseIds: [],
      receivedItems: receipt.receivedItems.map((i) => ({ ...i, purchaseId: undefined })),
      auditLog: [...receipt.auditLog, audit],
    };

    this.receipts.update((list) => list.map((r) => (r.id === receiptId ? updated : r)));
    this.occurrences.update((list) =>
      list.map((o) =>
        o.id === receipt.occurrenceId
          ? { ...o, status: 'annulled' as const, receiptId: receipt.id }
          : o,
      ),
    );
    this.persist();
    return updated;
  }

  /** Call periodically / on shell open to toast new due reminders. */
  emitDueToasts(): void {
    for (const rem of this.dueReminders()) {
      if (this.toastedDue.has(rem.occurrenceId)) continue;
      this.toastedDue.add(rem.occurrenceId);
      const when = new Date(rem.plannedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const occurrenceId = rem.occurrenceId;
      this.toast.info(`Entrega de “${rem.supplierName}” prevista às ${when}.`, {
        action: {
          label: 'Registrar no estoque',
          run: () => {
            void this.router.navigate(['/fornecedores'], {
              queryParams: { occurrenceId, action: 'receive' },
            });
          },
        },
      });
    }
  }

  private persist(): void {
    const store: SupplierStoreV1 = {
      version: 1,
      suppliers: this.suppliers(),
      occurrences: this.occurrences(),
      receipts: this.receipts(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
}

function isTerminal(status: OccurrenceStatus): boolean {
  return status === 'received' || status === 'partial' || status === 'missed' || status === 'annulled';
}

function isDue(o: DeliveryOccurrence): boolean {
  if (o.snoozeUntil && new Date(o.snoozeUntil).getTime() > Date.now()) return false;
  return new Date(o.plannedAt).getTime() <= Date.now();
}

function isReminderDue(o: DeliveryOccurrence): boolean {
  if (o.status !== 'planned' && o.status !== 'awaiting') return false;
  return isDue(o);
}

function deriveOccurrenceStatus(
  expected: OccurrenceExpectedItem[],
  received: ReceiptReceivedItem[],
): OccurrenceStatus {
  const receivedMap = new Map(received.map((r) => [r.stockItemId, r]));
  let anyReceived = false;
  let allFull = expected.length > 0;

  if (!expected.length) {
    return received.some((r) => r.received && r.receivedQty > 0) ? 'received' : 'partial';
  }

  for (const exp of expected) {
    const rec = receivedMap.get(exp.stockItemId);
    if (!rec || !rec.received || !(rec.receivedQty > 0)) {
      allFull = false;
      continue;
    }
    anyReceived = true;
    if (rec.receivedQty + 1e-9 < exp.expectedQty) allFull = false;
  }

  // Extra items beyond expected count as received activity
  for (const rec of received) {
    if (rec.received && rec.receivedQty > 0) anyReceived = true;
  }

  if (!anyReceived) return 'partial';
  return allFull ? 'received' : 'partial';
}

function normalizeHabituais(list: HabitualProduct[]): HabitualProduct[] {
  return list
    .filter((h) => h.stockItemId && h.expectedQty > 0)
    .map((h) => ({
      id: h.id || nextId('hab'),
      stockItemId: h.stockItemId,
      expectedQty: roundQty(h.expectedQty),
      unit: h.unit,
      unitCost: h.unitCost != null ? roundMoney(h.unitCost) : undefined,
      note: emptyToUndef(h.note),
    }));
}

function normalizeSchedules(list: DeliverySchedule[]): DeliverySchedule[] {
  return list.map((s) => ({
    id: s.id || nextId('sch'),
    weekdays: [...new Set(s.weekdays)].sort((a, b) => a - b) as Weekday[],
    time: normalizeTime(s.time),
    productIds: [...s.productIds],
    active: !!s.active,
  }));
}

function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return '08:00';
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function emptyToUndef(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayKey(): string {
  return formatDayKey(new Date());
}

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function combineDateAndTime(day: Date, time: string): Date {
  const [hh, mm] = normalizeTime(time).split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0);
}

function localDayKey(iso: string): string {
  return formatDayKey(new Date(iso));
}

/** Older drafts stored a free-text `address` — map into street when needed. */
function migrateSupplier(raw: Supplier & { address?: string }): Supplier {
  const { address, ...rest } = raw;
  if (!rest.street && address?.trim()) {
    return { ...rest, street: address.trim() };
  }
  return rest;
}

function readStore(): SupplierStoreV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupplierStoreV1;
    if (!parsed || parsed.version !== 1) return null;
    return {
      version: 1,
      suppliers: Array.isArray(parsed.suppliers)
        ? parsed.suppliers.map(migrateSupplier)
        : [],
      occurrences: Array.isArray(parsed.occurrences) ? parsed.occurrences : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
    };
  } catch {
    return null;
  }
}

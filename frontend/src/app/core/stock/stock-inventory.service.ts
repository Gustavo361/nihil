import { Injectable, computed, signal } from '@angular/core';
import {
  StockDay,
  StockDayLine,
  StockItem,
  StockMovement,
  StockStatus,
  dayEstimatedQty,
  deriveStockStatus,
  roundMoney,
  roundQty,
} from '../../features/estoque/stock.models';
import { buildDemoStockItems } from '../../features/estoque/stock.mock';
import { recipeQtyToStockUnit } from '../../features/estoque/stock-units';
import type { RecipeMassUnit } from '../../features/estoque/stock.models';

const STORAGE_KEY = 'nihil.stock.v2';

interface StockStoreV2 {
  version: 2;
  items: StockItem[];
  movements: StockMovement[];
  days: StockDay[];
}

export interface PurchaseReceiveInput {
  purchaseId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  minQuantity: number;
  packageWeightKg?: number;
  at?: string;
  note?: string;
}

export interface SaleOutLineInput {
  stockItemId: string;
  /** Already converted to stock unit. */
  quantity: number;
  note?: string;
}

export interface RecipeSaleLineInput {
  stockItemId: string;
  qtyValue: number;
  qtyUnit: RecipeMassUnit;
  portions: number;
}

/**
 * Shared inventory: items, movements, daily ledger.
 * localStorage only until inventory API exists.
 * Seeds demo insumos when storage is empty so Pratos can mount a full recipe.
 */
@Injectable({ providedIn: 'root' })
export class StockInventoryService {
  readonly items = signal<StockItem[]>([]);
  readonly movements = signal<StockMovement[]>([]);
  readonly days = signal<StockDay[]>([]);

  readonly itemCount = computed(() => this.items().length);
  readonly lowOrOutCount = computed(
    () => this.items().filter((i) => i.status === 'low' || i.status === 'out').length,
  );
  readonly estimatedValue = computed(() =>
    roundMoney(this.items().reduce((sum, i) => sum + i.quantity * i.unitCost, 0)),
  );

  constructor() {
    const store = readStore();
    if (store && store.items.length > 0) {
      this.items.set(store.items);
      this.movements.set(store.movements);
      this.days.set(store.days);
    } else {
      this.seedDemoInventory();
    }
    this.ensureDay(todayKey());
  }

  /** Demo seed for empty storage — temporary until purchases/API are the only source. */
  private seedDemoInventory(): void {
    const items = buildDemoStockItems();
    const dayKey = todayKey();
    const at = new Date().toISOString();
    const movements: StockMovement[] = items.map((item, index) => ({
      id: `demo-mov-${index + 1}`,
      itemId: item.id,
      type: 'purchase_in',
      quantity: item.quantity,
      unit: item.unit,
      note: 'Entrada inicial (dados de demonstração)',
      at,
      user: 'Administrador',
      refType: 'purchase',
      refId: 'demo-seed',
    }));
    const day: StockDay = {
      date: dayKey,
      lines: items.map((item) => ({
        itemId: item.id,
        openingQty: 0,
        purchasedQty: item.quantity,
        estimatedOutQty: 0,
      })),
    };
    this.items.set(items);
    this.movements.set(movements);
    this.days.set([day]);
    this.persist();
  }

  list(): StockItem[] {
    return this.items();
  }

  findById(id: string): StockItem | undefined {
    return this.items().find((item) => item.id === id);
  }

  findByName(name: string): StockItem | undefined {
    const n = name.trim().toLowerCase();
    return this.items().find((item) => item.name.toLowerCase() === n);
  }

  movementsFor(itemId: string): StockMovement[] {
    return this.movements()
      .filter((m) => m.itemId === itemId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  ensureDay(date: string): StockDay {
    const existing = this.days().find((d) => d.date === date);
    if (existing) {
      this.syncDayLines(date);
      return this.days().find((d) => d.date === date)!;
    }

    const prev = this.previousDay(date);
    const lines: StockDayLine[] = this.items().map((item) => ({
      itemId: item.id,
      openingQty: openingFromPrevious(prev, item),
      purchasedQty: 0,
      estimatedOutQty: 0,
    }));

    const day: StockDay = { date, lines };
    this.days.update((list) => [...list, day].sort((a, b) => a.date.localeCompare(b.date)));
    this.recomputeItemQuantities(date);
    this.persist();
    return day;
  }

  dayView(date: string): StockDay {
    return this.ensureDay(date);
  }

  dayLine(date: string, itemId: string): StockDayLine | undefined {
    return this.ensureDay(date).lines.find((l) => l.itemId === itemId);
  }

  estimatedBalance(date: string, itemId: string): number {
    const line = this.dayLine(date, itemId);
    if (!line) return this.findById(itemId)?.quantity ?? 0;
    if (line.countedQty != null) return line.countedQty;
    return dayEstimatedQty(line);
  }

  /**
   * Create or update product and post a purchase_in for the day of `at`.
   */
  applyPurchase(input: PurchaseReceiveInput): { item: StockItem; created: boolean } {
    const name = input.name.trim();
    if (!name) throw new Error('Informe o nome do produto.');
    if (!(input.quantity > 0)) throw new Error('Informe uma quantidade maior que zero.');
    if (input.unitCost < 0) throw new Error('Informe um custo unitário válido.');
    if (input.minQuantity < 0) throw new Error('Informe um estoque mínimo válido.');

    const needsWeight = !['kg', 'g'].includes(input.unit);
    if (needsWeight && (input.packageWeightKg == null || !(input.packageWeightKg > 0))) {
      throw new Error('Informe o peso do pacote em kg para converter receitas em gramas.');
    }

    const at = input.at ?? new Date().toISOString();
    const dayKey = localDayKey(at);
    this.ensureDay(dayKey);

    let created = false;
    let item = this.findByName(name);
    if (!item) {
      created = true;
      item = {
        id: nextId('item'),
        name,
        category: input.category,
        quantity: 0,
        unit: input.unit,
        unitCost: roundMoney(input.unitCost),
        minQuantity: input.minQuantity,
        status: 'out',
        packageWeightKg: needsWeight ? input.packageWeightKg : undefined,
      };
      this.items.update((list) => [item!, ...list]);
      this.addItemToDay(dayKey, item.id, 0);
    } else {
      item = {
        ...item,
        category: input.category || item.category,
        unitCost: roundMoney(input.unitCost),
        minQuantity: input.minQuantity,
        packageWeightKg: needsWeight
          ? input.packageWeightKg
          : item.unit === input.unit
            ? item.packageWeightKg
            : undefined,
        unit: item.unit, // unit locked after create
      };
      this.items.update((list) => list.map((i) => (i.id === item!.id ? item! : i)));
    }

    const qty = roundQty(input.quantity);
    const movement: StockMovement = {
      id: nextId('mov'),
      itemId: item.id,
      type: 'purchase_in',
      quantity: qty,
      unit: item.unit,
      note: input.note || `Compra ${input.purchaseId}`,
      at,
      user: 'Administrador',
      refType: 'purchase',
      refId: input.purchaseId,
    };
    this.movements.update((list) => [movement, ...list]);
    this.bumpDayPurchased(dayKey, item.id, qty);
    this.recomputeItemQuantities(dayKey);
    this.persist();
    return { item, created };
  }

  /** Apply estimated outs already converted to stock units (one sale). */
  applySaleOut(saleId: string, lines: SaleOutLineInput[], at = new Date().toISOString()): void {
    if (!lines.length) return;
    const dayKey = localDayKey(at);
    this.ensureDay(dayKey);

    for (const line of lines) {
      const item = this.findById(line.stockItemId);
      if (!item || !(line.quantity > 0)) continue;
      const qty = roundQty(line.quantity);
      const movement: StockMovement = {
        id: nextId('mov'),
        itemId: item.id,
        type: 'sale_out',
        quantity: qty,
        unit: item.unit,
        note: line.note || `Baixa estimada venda ${saleId}`,
        at,
        user: 'Administrador',
        refType: 'sale',
        refId: saleId,
      };
      this.movements.update((list) => [movement, ...list]);
      this.bumpDayEstimatedOut(dayKey, item.id, qty);
    }
    this.recomputeItemQuantities(dayKey);
    this.persist();
  }

  /** Expand recipe mass lines × portions into stock-unit outs. */
  applyRecipeSaleOut(
    saleId: string,
    recipeLines: RecipeSaleLineInput[],
    at = new Date().toISOString(),
  ): void {
    const outs: SaleOutLineInput[] = [];
    for (const line of recipeLines) {
      const item = this.findById(line.stockItemId);
      if (!item) continue;
      const perPortion = recipeQtyToStockUnit(item, line.qtyValue, line.qtyUnit);
      if (perPortion == null) continue;
      const total = roundQty(perPortion * line.portions);
      if (!(total > 0)) continue;
      outs.push({
        stockItemId: item.id,
        quantity: total,
        note: `Baixa estimada venda ${saleId}`,
      });
    }
    this.applySaleOut(saleId, outs, at);
  }

  reverseSaleOut(saleId: string): boolean {
    const related = this.movements().filter(
      (m) => m.type === 'sale_out' && m.refType === 'sale' && m.refId === saleId,
    );
    if (!related.length) return false;

    const remaining = this.movements().filter(
      (m) => !(m.type === 'sale_out' && m.refType === 'sale' && m.refId === saleId),
    );
    this.movements.set(remaining);

    const byDay = new Map<string, Map<string, number>>();
    for (const m of related) {
      const dayKey = localDayKey(m.at);
      if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
      const map = byDay.get(dayKey)!;
      map.set(m.itemId, roundQty((map.get(m.itemId) ?? 0) + m.quantity));
    }

    for (const [dayKey, map] of byDay) {
      this.ensureDay(dayKey);
      this.days.update((days) =>
        days.map((d) => {
          if (d.date !== dayKey) return d;
          return {
            ...d,
            lines: d.lines.map((line) => {
              const delta = map.get(line.itemId);
              if (!delta) return line;
              return {
                ...line,
                estimatedOutQty: roundQty(Math.max(0, line.estimatedOutQty - delta)),
                // count no longer valid after reversing sales
                countedQty: undefined,
                countedAt: undefined,
              };
            }),
          };
        }),
      );
      this.recomputeItemQuantities(dayKey);
    }

    this.persist();
    return true;
  }

  submitCount(date: string, itemId: string, countedQty: number): void {
    if (Number.isNaN(countedQty) || countedQty < 0) {
      throw new Error('Informe uma quantidade de conferência válida (0 ou maior).');
    }
    this.ensureDay(date);
    const item = this.findById(itemId);
    if (!item) throw new Error('Produto não encontrado.');

    const line = this.dayLine(date, itemId);
    const estimated = line ? dayEstimatedQty(line) : item.quantity;
    const counted = roundQty(countedQty);
    const delta = roundQty(counted - estimated);
    const at = new Date().toISOString();

    this.days.update((days) =>
      days.map((d) => {
        if (d.date !== date) return d;
        return {
          ...d,
          lines: d.lines.map((l) =>
            l.itemId === itemId ? { ...l, countedQty: counted, countedAt: at } : l,
          ),
        };
      }),
    );

    if (delta !== 0) {
      const movement: StockMovement = {
        id: nextId('mov'),
        itemId,
        type: 'count_adjust',
        quantity: Math.abs(delta),
        unit: item.unit,
        note:
          delta > 0
            ? `Conferência: +${Math.abs(delta)} ${item.unit} (saldo estimado ${estimated})`
            : `Conferência: −${Math.abs(delta)} ${item.unit} (saldo estimado ${estimated})`,
        at,
        user: 'Administrador',
        refType: 'count',
        refId: `${date}:${itemId}`,
      };
      this.movements.update((list) => [movement, ...list]);
    }

    this.recomputeItemQuantities(date);
    this.persist();
  }

  private previousDay(date: string): StockDay | undefined {
    const prior = this.days()
      .filter((d) => d.date < date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return prior[0];
  }

  private syncDayLines(date: string): void {
    const day = this.days().find((d) => d.date === date);
    if (!day) return;
    const known = new Set(day.lines.map((l) => l.itemId));
    const missing = this.items().filter((i) => !known.has(i.id));
    if (!missing.length) return;

    const prev = this.previousDay(date);
    this.days.update((days) =>
      days.map((d) => {
        if (d.date !== date) return d;
        return {
          ...d,
          lines: [
            ...d.lines,
            ...missing.map((item) => ({
              itemId: item.id,
              openingQty: openingFromPrevious(prev, item),
              purchasedQty: 0,
              estimatedOutQty: 0,
            })),
          ],
        };
      }),
    );
  }

  private addItemToDay(date: string, itemId: string, openingQty: number): void {
    this.days.update((days) =>
      days.map((d) => {
        if (d.date !== date) return d;
        if (d.lines.some((l) => l.itemId === itemId)) return d;
        return {
          ...d,
          lines: [...d.lines, { itemId, openingQty, purchasedQty: 0, estimatedOutQty: 0 }],
        };
      }),
    );
  }

  private bumpDayPurchased(date: string, itemId: string, qty: number): void {
    this.syncDayLines(date);
    this.days.update((days) =>
      days.map((d) => {
        if (d.date !== date) return d;
        return {
          ...d,
          lines: d.lines.map((l) =>
            l.itemId === itemId
              ? {
                  ...l,
                  purchasedQty: roundQty(l.purchasedQty + qty),
                  countedQty: undefined,
                  countedAt: undefined,
                }
              : l,
          ),
        };
      }),
    );
  }

  private bumpDayEstimatedOut(date: string, itemId: string, qty: number): void {
    this.syncDayLines(date);
    this.addItemToDay(date, itemId, this.findById(itemId)?.quantity ?? 0);
    this.days.update((days) =>
      days.map((d) => {
        if (d.date !== date) return d;
        return {
          ...d,
          lines: d.lines.map((l) =>
            l.itemId === itemId
              ? {
                  ...l,
                  estimatedOutQty: roundQty(l.estimatedOutQty + qty),
                  countedQty: undefined,
                  countedAt: undefined,
                }
              : l,
          ),
        };
      }),
    );
  }

  /** Sync StockItem.quantity/status from the given day's estimated or counted balance. */
  private recomputeItemQuantities(date: string): void {
    const day = this.days().find((d) => d.date === date);
    if (!day) return;
    const today = todayKey();
    // Only push balances onto items when recomputing "today" or the latest day.
    const latest = [...this.days()].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
    if (date !== today && date !== latest) return;

    const byId = new Map(day.lines.map((l) => [l.itemId, l]));
    this.items.update((list) =>
      list.map((item) => {
        const line = byId.get(item.id);
        if (!line) return item;
        const qty = line.countedQty != null ? line.countedQty : dayEstimatedQty(line);
        return {
          ...item,
          quantity: qty,
          status: deriveStockStatus(qty, item.minQuantity),
        };
      }),
    );
  }

  private persist(): void {
    const store: StockStoreV2 = {
      version: 2,
      items: this.items(),
      movements: this.movements(),
      days: this.days(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
}

function openingFromPrevious(prev: StockDay | undefined, item: StockItem): number {
  if (!prev) return roundQty(item.quantity);
  const line = prev.lines.find((l) => l.itemId === item.id);
  if (!line) return roundQty(item.quantity);
  if (line.countedQty != null) return line.countedQty;
  return dayEstimatedQty(line);
}

function todayKey(): string {
  return localDayKey(new Date().toISOString());
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function readStore(): StockStoreV2 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockStoreV2;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.items)) return null;
    return {
      version: 2,
      items: parsed.items,
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      days: Array.isArray(parsed.days) ? parsed.days : [],
    };
  } catch {
    return null;
  }
}

export type { StockStatus };

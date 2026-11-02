import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconAlertTriangle,
  IconCash,
  IconPackage,
  IconSearch,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { STOCK_CATEGORIES } from './stock.mock';
import {
  StockItem,
  StockMovement,
  StockStatus,
  dayEstimatedQty,
} from './stock.models';

interface DayRow {
  item: StockItem;
  openingQty: number;
  purchasedQty: number;
  estimatedOutQty: number;
  estimatedQty: number;
  countedQty?: number;
  displayQty: number;
}

@Component({
  selector: 'app-stock-page',
  imports: [FormsModule, CurrencyPipe, DecimalPipe, TablerIconComponent, NihilSelectComponent],
  templateUrl: './stock.page.html',
  styleUrl: './stock.page.scss',
})
export class StockPage {
  private readonly toast = inject(ToastService);
  private readonly inventory = inject(StockInventoryService);

  readonly iconSearch = IconSearch;
  readonly iconPackage = IconPackage;
  readonly iconAlert = IconAlertTriangle;
  readonly iconMoney = IconCash;
  readonly iconClose = IconX;

  readonly items = this.inventory.items;
  readonly movements = this.inventory.movements;

  readonly day = signal(this.todayInputValue());
  readonly search = signal('');
  readonly category = signal('');
  readonly status = signal<'' | StockStatus>('');
  readonly selectedId = signal<string | null>(null);

  readonly countDrafts = signal<Record<string, string>>({});
  readonly countError = signal('');

  constructor() {
    this.inventory.ensureDay(this.day());
  }

  readonly categoryFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as categorias' },
    ...STOCK_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
  ];
  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'ok', label: 'Normal' },
    { value: 'low', label: 'Baixo' },
    { value: 'out', label: 'Sem estoque' },
  ];

  readonly dayRows = computed((): DayRow[] => {
    const date = this.day();
    // Read-only: day is ensured in constructor / setDay — do not mutate inside computed.
    const stockDay = this.inventory.days().find((d) => d.date === date);
    const q = this.search().trim().toLowerCase();
    const cat = this.category();
    const st = this.status();

    return this.items()
      .map((item) => {
        const line = stockDay?.lines.find((l) => l.itemId === item.id);
        const openingQty = line?.openingQty ?? item.quantity;
        const purchasedQty = line?.purchasedQty ?? 0;
        const estimatedOutQty = line?.estimatedOutQty ?? 0;
        const estimatedQty = line
          ? dayEstimatedQty(line)
          : openingQty + purchasedQty - estimatedOutQty;
        const countedQty = line?.countedQty;
        const displayQty = countedQty != null ? countedQty : estimatedQty;
        return {
          item,
          openingQty,
          purchasedQty,
          estimatedOutQty,
          estimatedQty,
          countedQty,
          displayQty,
        };
      })
      .filter((row) => {
        if (q && !row.item.name.toLowerCase().includes(q)) return false;
        if (cat && row.item.category !== cat) return false;
        if (st && row.item.status !== st) return false;
        return true;
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));
  });

  readonly indicators = computed(() => {
    const all = this.items();
    const low = all.filter((i) => i.status === 'low' || i.status === 'out').length;
    const estimated = all.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    return { total: all.length, low, estimated };
  });

  readonly selectedItem = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.items().find((i) => i.id === id) ?? null;
  });

  readonly selectedMovements = computed((): StockMovement[] => {
    const id = this.selectedId();
    if (!id) return [];
    return this.inventory.movementsFor(id);
  });

  readonly selectedRow = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.dayRows().find((r) => r.item.id === id) ?? null;
  });

  setDay(value: string): void {
    this.day.set(value || this.todayInputValue());
    this.inventory.ensureDay(this.day());
    this.countError.set('');
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  setCategory(value: string): void {
    this.category.set(value);
  }

  setStatus(value: string): void {
    this.status.set(value as '' | StockStatus);
  }

  selectItem(item: StockItem): void {
    this.selectedId.set(item.id);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  countText(itemId: string, fallback: number): string {
    const draft = this.countDrafts()[itemId];
    if (draft != null) return draft;
    return this.formatQty(fallback);
  }

  onCountInput(itemId: string, raw: string): void {
    this.countDrafts.update((map) => ({ ...map, [itemId]: raw }));
  }

  saveCount(itemId: string): void {
    const raw = this.countDrafts()[itemId];
    const row = this.dayRows().find((r) => r.item.id === itemId);
    const source = raw != null && raw.trim() !== '' ? raw : String(row?.estimatedQty ?? 0);
    const cleaned = source.replace(/[^\d.,-]/g, '').replace(',', '.');
    const value = Number(cleaned);
    this.countError.set('');
    try {
      this.inventory.submitCount(this.day(), itemId, value);
      this.countDrafts.update((map) => {
        const next = { ...map };
        delete next[itemId];
        return next;
      });
      const item = this.inventory.findById(itemId);
      this.toast.success(
        item
          ? `Conferência de “${item.name}” salva (${this.formatQty(value)} ${item.unit}).`
          : 'Conferência salva.',
      );
    } catch (err) {
      this.countError.set(err instanceof Error ? err.message : 'Não foi possível salvar a conferência.');
    }
  }

  statusLabel(status: StockStatus): string {
    switch (status) {
      case 'ok':
        return 'Normal';
      case 'low':
        return 'Baixo';
      case 'out':
        return 'Sem estoque';
    }
  }

  movementLabel(type: StockMovement['type']): string {
    switch (type) {
      case 'purchase_in':
        return 'Compra';
      case 'sale_out':
        return 'Baixa venda';
      case 'count_adjust':
        return 'Conferência';
      case 'manual_out':
        return 'Saída';
    }
  }

  formatQty(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  }

  private todayInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

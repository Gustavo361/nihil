import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconCash,
  IconClipboardCheck,
  IconPackage,
  IconPlus,
  IconSearch,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { PurchaseCatalogService } from '../../core/purchases/purchase-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import { formatMoneyInput, parseMoneyTyping, restoreMoneyCaret } from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { isMassUnit } from './stock-units';
import { STOCK_CATEGORIES, STOCK_UNITS } from './stock.mock';
import {
  StockItem,
  StockMovement,
  StockStatus,
  dayEstimatedQty,
} from './stock.models';

type StockModal = 'conference' | 'receive' | null;

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
  private readonly purchases = inject(PurchaseCatalogService);

  readonly iconSearch = IconSearch;
  readonly iconPackage = IconPackage;
  readonly iconAlert = IconAlertTriangle;
  readonly iconMoney = IconCash;
  readonly iconClose = IconX;
  readonly iconPlus = IconPlus;
  readonly iconCheck = IconClipboardCheck;
  readonly iconExchange = IconArrowsExchange;

  readonly items = this.inventory.items;
  readonly movements = this.inventory.movements;

  readonly day = signal(this.todayInputValue());
  readonly search = signal('');
  readonly category = signal('');
  readonly status = signal<'' | StockStatus>('');
  readonly selectedId = signal<string | null>(null);

  readonly modal = signal<StockModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  /** Conference count drafts by item id. */
  readonly confDrafts = signal<Record<string, string>>({});
  readonly confNewOpen = signal(false);

  // Shared product form (receive + conference new product)
  readonly name = signal('');
  readonly formCategory = signal<string>(STOCK_CATEGORIES[0]);
  readonly unit = signal<string>('kg');
  readonly quantityText = signal('');
  readonly quantity = signal<number | null>(null);
  readonly unitCostText = signal('');
  readonly unitCost = signal<number | null>(null);
  readonly minQtyText = signal('0');
  readonly minQty = signal<number | null>(0);
  readonly packageWeightText = signal('');
  readonly packageWeightKg = signal<number | null>(null);
  readonly note = signal('');
  readonly countedText = signal('');
  readonly countedQty = signal<number | null>(null);

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
  readonly categoryOptions: NihilSelectOption[] = STOCK_CATEGORIES.map((c) => ({
    value: c,
    label: c,
  }));
  readonly unitOptions: NihilSelectOption[] = STOCK_UNITS.map((u) => ({ value: u, label: u }));

  readonly needsPackageWeight = computed(() => !isMassUnit(this.unit()));

  readonly dayRows = computed((): DayRow[] => {
    const date = this.day();
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

  /** All products for conference modal (unfiltered by search). */
  readonly conferenceRows = computed((): DayRow[] => {
    const date = this.day();
    const stockDay = this.inventory.days().find((d) => d.date === date);
    return this.items()
      .map((item) => {
        const line = stockDay?.lines.find((l) => l.itemId === item.id);
        const openingQty = line?.openingQty ?? item.quantity;
        const purchasedQty = line?.purchasedQty ?? 0;
        const estimatedOutQty = line?.estimatedOutQty ?? 0;
        const estimatedQty = line
          ? dayEstimatedQty(line)
          : openingQty + purchasedQty - estimatedOutQty;
        return {
          item,
          openingQty,
          purchasedQty,
          estimatedOutQty,
          estimatedQty,
          countedQty: line?.countedQty,
          displayQty: line?.countedQty != null ? line.countedQty : estimatedQty,
        };
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'pt-BR'));
  });

  readonly indicators = computed(() => {
    const all = this.items();
    const low = all.filter((i) => i.status === 'low' || i.status === 'out').length;
    const estimated = all.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

    // Conferência do dia selecionado (agregado), não só a última sessão salva.
    const countedRows = this.conferenceRows().filter((r) => r.countedQty != null);
    let entered = 0;
    let exited = 0;
    for (const row of countedRows) {
      const delta = (row.countedQty ?? row.estimatedQty) - row.estimatedQty;
      if (delta > 0) entered += 1;
      else if (delta < 0) exited += 1;
    }

    return {
      total: all.length,
      low,
      estimated,
      conference:
        countedRows.length > 0
          ? { entered, exited, counted: countedRows.length }
          : null,
    };
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

  readonly existingHint = computed(() => {
    const n = this.name().trim();
    if (!n) return null;
    return this.inventory.findByName(n) ?? null;
  });

  setDay(value: string): void {
    this.day.set(value || this.todayInputValue());
    this.inventory.ensureDay(this.day());
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

  openConference(): void {
    this.inventory.ensureDay(this.day());
    const drafts: Record<string, string> = {};
    for (const row of this.conferenceRows()) {
      drafts[row.item.id] = this.formatQty(row.countedQty ?? row.estimatedQty);
    }
    this.confDrafts.set(drafts);
    this.confNewOpen.set(false);
    this.resetProductForm();
    this.formError.set('');
    this.modal.set('conference');
  }

  openReceive(): void {
    this.resetProductForm();
    this.formError.set('');
    this.modal.set('receive');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.confNewOpen.set(false);
    this.resetProductForm();
    this.formError.set('');
  }

  confText(itemId: string): string {
    return this.confDrafts()[itemId] ?? '';
  }

  onConfInput(itemId: string, raw: string): void {
    this.confDrafts.update((map) => ({ ...map, [itemId]: raw }));
  }

  toggleConfNew(): void {
    this.confNewOpen.update((v) => !v);
    this.formError.set('');
    if (!this.confNewOpen()) {
      this.resetProductForm();
    }
  }

  setFormCategory(value: string): void {
    this.formCategory.set(value);
  }

  setUnit(value: string): void {
    this.unit.set(value);
    if (isMassUnit(value)) {
      this.packageWeightText.set('');
      this.packageWeightKg.set(null);
    }
  }

  onQtyInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`;
    this.quantityText.set(normalized.replace('.', ','));
    const value = Number(normalized);
    this.quantity.set(normalized && !Number.isNaN(value) ? value : null);
  }

  onCountedInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`;
    this.countedText.set(normalized.replace('.', ','));
    const value = Number(normalized);
    this.countedQty.set(normalized && !Number.isNaN(value) ? value : null);
  }

  onMoneyInput(raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.unitCostText.set(text);
    this.unitCost.set(value);
    restoreMoneyCaret(input, raw, text, caret);
  }

  onMoneyBlur(raw: string): void {
    const { text, value } = formatMoneyInput(raw);
    this.unitCostText.set(text);
    this.unitCost.set(value);
  }

  onMinQtyInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    this.minQtyText.set(cleaned.replace('.', ','));
    const value = Number(cleaned);
    this.minQty.set(cleaned && !Number.isNaN(value) ? value : null);
  }

  onMinQtyFocus(): void {
    if (this.minQtyText() === '0') {
      this.minQtyText.set('');
      this.minQty.set(null);
    }
  }

  onMinQtyBlur(): void {
    if (!this.minQtyText().trim()) {
      this.minQtyText.set('0');
      this.minQty.set(0);
    }
  }

  onPackageWeightInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`;
    this.packageWeightText.set(normalized.replace('.', ','));
    const value = Number(normalized);
    this.packageWeightKg.set(normalized && !Number.isNaN(value) ? value : null);
  }

  saveConference(): void {
    if (this.saving()) return;
    this.formError.set('');
    const rows = this.conferenceRows();
    if (!rows.length && !this.confNewOpen()) {
      this.formError.set('Não há produtos para conferir. Cadastre um produto ou registre uma entrada.');
      return;
    }

    this.saving.set(true);
    try {
      let saved = 0;
      let entered = 0;
      let exited = 0;
      let unchanged = 0;
      for (const row of rows) {
        const raw = this.confDrafts()[row.item.id];
        const source = raw != null && raw.trim() !== '' ? raw : String(row.estimatedQty);
        const cleaned = source.replace(/[^\d.,-]/g, '').replace(',', '.');
        const value = Number(cleaned);
        if (Number.isNaN(value) || value < 0) {
          throw new Error(`Quantidade inválida para “${row.item.name}”.`);
        }
        const delta = value - row.estimatedQty;
        if (delta > 0) entered += 1;
        else if (delta < 0) exited += 1;
        else unchanged += 1;
        this.inventory.submitCount(this.day(), row.item.id, value);
        saved += 1;
      }
      this.inventory.setLastConference({
        at: new Date().toISOString(),
        day: this.day(),
        entered,
        exited,
        unchanged,
      });
      this.saving.set(false);
      this.closeModal();
      this.toast.success(
        saved === 1
          ? 'Conferência salva para 1 produto.'
          : `Conferência salva para ${saved} produtos.`,
      );
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível salvar a conferência.');
    }
  }

  addProductInConference(): void {
    if (this.saving()) return;
    const counted = this.countedQty();
    const cost = this.unitCost();
    const min = this.minQty();
    this.formError.set('');

    if (!this.name().trim()) {
      this.formError.set('Informe o nome do produto.');
      return;
    }
    if (counted == null || counted < 0) {
      this.formError.set('Informe a quantidade contada (0 ou maior).');
      return;
    }
    if (cost == null || cost < 0) {
      this.formError.set('Informe o custo unitário.');
      return;
    }
    if (min == null || min < 0) {
      this.formError.set('Informe o estoque mínimo (0 ou maior).');
      return;
    }
    if (this.needsPackageWeight()) {
      const w = this.packageWeightKg();
      if (w == null || !(w > 0)) {
        this.formError.set('Informe o peso líquido do pacote em kg.');
        return;
      }
    }
    if (this.inventory.findByName(this.name())) {
      this.formError.set('Já existe um produto com esse nome — use a lista de conferência.');
      return;
    }

    // applyPurchase exige qty > 0: usa max(counted, mínimo simbólico) se contado for 0
    const receiveQty = counted > 0 ? counted : 0.0001;

    this.saving.set(true);
    try {
      const purchase = this.purchases.receive({
        name: this.name(),
        category: this.formCategory(),
        unit: this.unit(),
        quantity: receiveQty,
        unitCost: cost,
        minQuantity: min,
        packageWeightKg: this.needsPackageWeight()
          ? (this.packageWeightKg() ?? undefined)
          : undefined,
        note: 'Produto criado na conferência de estoque',
        at: this.dayIsoNoon(),
      });
      this.inventory.submitCount(this.day(), purchase.line.stockItemId, counted);
      this.confDrafts.update((map) => ({
        ...map,
        [purchase.line.stockItemId]: this.formatQty(counted),
      }));
      this.saving.set(false);
      this.confNewOpen.set(false);
      this.resetProductForm();
      this.toast.success(`Produto “${purchase.line.name}” incluído na conferência.`);
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível criar o produto.');
    }
  }

  saveReceive(): void {
    if (this.saving()) return;
    const qty = this.quantity();
    const cost = this.unitCost();
    const min = this.minQty();
    this.formError.set('');

    if (!this.name().trim()) {
      this.formError.set('Informe o nome do produto.');
      return;
    }
    if (qty == null || !(qty > 0)) {
      this.formError.set('Informe a quantidade recebida (maior que zero).');
      return;
    }
    if (cost == null || cost < 0) {
      this.formError.set('Informe o custo unitário.');
      return;
    }
    if (min == null || min < 0) {
      this.formError.set('Informe o estoque mínimo (0 ou maior).');
      return;
    }
    if (this.needsPackageWeight()) {
      const w = this.packageWeightKg();
      if (w == null || !(w > 0)) {
        this.formError.set('Informe o peso líquido do pacote em kg.');
        return;
      }
    }

    const existing = this.existingHint();

    this.saving.set(true);
    try {
      const purchase = this.purchases.receive({
        name: this.name(),
        category: this.formCategory(),
        unit: existing?.unit ?? this.unit(),
        quantity: qty,
        unitCost: cost,
        minQuantity: min,
        packageWeightKg: this.needsPackageWeight()
          ? (this.packageWeightKg() ?? undefined)
          : undefined,
        note: this.note().trim() || undefined,
        at: this.dayIsoNoon(),
      });
      this.inventory.ensureDay(this.day());
      this.saving.set(false);
      this.closeModal();
      this.toast.success(
        purchase.line.createdItem
          ? `Produto “${purchase.line.name}” cadastrado e entrada registrada.`
          : `Entrada de ${purchase.line.quantity} ${purchase.line.unit} em “${purchase.line.name}”.`,
      );
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível registrar a entrada.');
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

  private dayIsoNoon(): string {
    const [y, m, d] = this.day().split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
    return dt.toISOString();
  }

  private resetProductForm(): void {
    this.name.set('');
    this.formCategory.set(STOCK_CATEGORIES[0]);
    this.unit.set('kg');
    this.quantityText.set('');
    this.quantity.set(null);
    this.unitCostText.set('');
    this.unitCost.set(null);
    this.minQtyText.set('0');
    this.minQty.set(0);
    this.packageWeightText.set('');
    this.packageWeightKg.set(null);
    this.note.set('');
    this.countedText.set('');
    this.countedQty.set(null);
  }

  private todayInputValue(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

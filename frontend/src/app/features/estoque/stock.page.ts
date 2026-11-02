import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCash,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconPackage,
  IconPlus,
  IconSearch,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { ToastService } from '../../core/toast/toast.service';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { STOCK_CATEGORIES, STOCK_ITEMS_MOCK, STOCK_MOVEMENTS_MOCK, STOCK_UNITS } from './stock.mock';
import { StockItem, StockMovement, StockMovementType, StockStatus } from './stock.models';

const PAGE_SIZE = 20;

type MovementStep = 'movement' | 'create-item';

@Component({
  selector: 'app-stock-page',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    TablerIconComponent,
    NihilSelectComponent,
  ],
  templateUrl: './stock.page.html',
  styleUrl: './stock.page.scss',
})
export class StockPage {
  private readonly toast = inject(ToastService);

  readonly pageSize = PAGE_SIZE;
  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconPackage = IconPackage;
  readonly iconAlert = IconAlertTriangle;
  readonly iconMoney = IconCash;
  readonly iconClose = IconX;
  readonly iconPrev = IconChevronLeft;
  readonly iconNext = IconChevronRight;
  readonly iconChevronUp = IconChevronUp;
  readonly iconChevronDown = IconChevronDown;
  readonly iconBack = IconArrowLeft;
  readonly iconTrendUp = IconTrendingUp;
  readonly iconTrendDown = IconTrendingDown;
  readonly iconMoveIn = IconArrowDown;
  readonly iconMoveOut = IconArrowUp;

  readonly categories = STOCK_CATEGORIES;
  readonly units = STOCK_UNITS;
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
  readonly categoryFormOptions: NihilSelectOption[] = STOCK_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));
  readonly unitFormOptions: NihilSelectOption[] = STOCK_UNITS.map((unit) => ({
    value: unit,
    label: unit,
  }));
  readonly items = signal<StockItem[]>([...STOCK_ITEMS_MOCK]);
  readonly movements = signal<StockMovement[]>([...STOCK_MOVEMENTS_MOCK]);

  readonly search = signal('');
  readonly category = signal('');
  readonly status = signal<'' | StockStatus>('');
  readonly page = signal(1);
  readonly selectedId = signal<string | null>(null);
  readonly movementOpen = signal(false);
  readonly movementStep = signal<MovementStep>('movement');

  readonly productQuery = signal('');
  readonly selectedProductId = signal<string | null>(null);
  readonly movementType = signal<StockMovementType>('in');
  readonly movementQty = signal<number | null>(null);
  readonly movementQtyText = signal('');
  readonly movementNote = signal('');
  readonly movementError = signal('');
  readonly productListOpen = signal(false);
  readonly productHighlightIndex = signal(-1);

  readonly createName = signal('');
  readonly createCategory = signal<string>(STOCK_CATEGORIES[0]);
  readonly createUnit = signal<string>(STOCK_UNITS[0]);
  readonly createUnitCost = signal<number | null>(null);
  readonly createUnitCostText = signal('');
  readonly createMinQty = signal<number | null>(null);
  readonly createMinQtyText = signal('');
  readonly createError = signal('');

  readonly filteredItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.category();
    const st = this.status();
    return this.items().filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (cat && item.category !== cat) return false;
      if (st && item.status !== st) return false;
      return true;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize)),
  );

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly pagedItems = computed(() => {
    const list = this.filteredItems();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  readonly pageSummary = computed(() => {
    const total = this.filteredItems().length;
    if (total === 0) {
      return { from: 0, to: 0, total: 0 };
    }
    const from = (this.currentPage() - 1) * this.pageSize + 1;
    const to = Math.min(this.currentPage() * this.pageSize, total);
    return { from, to, total };
  });

  readonly indicators = computed(() => {
    const all = this.items();
    const low = all.filter((i) => i.status === 'low' || i.status === 'out').length;
    const estimated = all.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    // UI demo deltas until inventory history API exists.
    return {
      total: { value: all.length, changePct: 4.2, up: true, positive: true },
      low: { value: low, changePct: 12.5, up: false, positive: true },
      estimated: { value: estimated, changePct: 8.76, up: true, positive: true },
    };
  });

  readonly selectedItem = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.items().find((i) => i.id === id) ?? null;
  });

  readonly selectedMovements = computed(() => {
    const id = this.selectedId();
    if (!id) return [];
    return this.movements()
      .filter((m) => m.itemId === id)
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly productSuggestions = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    if (!q) return this.items().slice(0, 8);
    return this.items()
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 8);
  });

  readonly selectedProduct = computed(() => {
    const id = this.selectedProductId();
    if (!id) return null;
    return this.items().find((i) => i.id === id) ?? null;
  });

  readonly noProductMatch = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    if (!q || this.selectedProductId()) return false;
    return !this.items().some((item) => item.name.toLowerCase().includes(q));
  });

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  clearSearch(): void {
    this.setSearch('');
  }

  clearProductQuery(): void {
    this.onProductQueryChange('');
  }

  setCategory(value: string): void {
    this.category.set(value);
    this.page.set(1);
  }

  setStatus(value: string): void {
    this.status.set(value as '' | StockStatus);
    this.page.set(1);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.page.set(next);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  selectItem(item: StockItem): void {
    this.selectedId.set(item.id);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  openMovement(): void {
    this.resetMovementForm();
    const selected = this.selectedItem();
    if (selected) {
      this.selectedProductId.set(selected.id);
      this.productQuery.set(selected.name);
    }
    this.movementStep.set('movement');
    this.movementOpen.set(true);
  }

  closeMovement(): void {
    this.movementOpen.set(false);
    this.resetMovementForm();
  }

  onProductQueryChange(value: string): void {
    this.productQuery.set(value);
    this.selectedProductId.set(null);
    this.productListOpen.set(true);
    this.movementError.set('');
    this.productHighlightIndex.set(this.productSuggestions().length > 0 ? 0 : -1);
  }

  openProductList(): void {
    this.productListOpen.set(true);
    if (this.productHighlightIndex() < 0 && this.productSuggestions().length > 0) {
      this.productHighlightIndex.set(0);
    }
  }

  closeProductListSoon(): void {
    window.setTimeout(() => {
      this.productListOpen.set(false);
      this.productHighlightIndex.set(-1);
    }, 150);
  }

  onProductKeydown(event: KeyboardEvent): void {
    const list = this.productSuggestions();
    const key = event.key;

    if (key === 'ArrowDown') {
      event.preventDefault();
      if (!list.length) return;
      this.productListOpen.set(true);
      this.productHighlightIndex.update((index) => {
        if (index < 0) return 0;
        return Math.min(index + 1, list.length - 1);
      });
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      if (!list.length) return;
      this.productListOpen.set(true);
      this.productHighlightIndex.update((index) => {
        if (index < 0) return list.length - 1;
        return Math.max(index - 1, 0);
      });
      return;
    }

    if (key === 'Enter') {
      const index = this.productHighlightIndex();
      if (this.productListOpen() && index >= 0 && list[index]) {
        event.preventDefault();
        this.pickProduct(list[index]);
      }
      return;
    }

    if (key === 'Escape' && this.productListOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.productListOpen.set(false);
      this.productHighlightIndex.set(-1);
    }
  }

  pickProduct(item: StockItem): void {
    this.selectedProductId.set(item.id);
    this.productQuery.set(item.name);
    this.productListOpen.set(false);
    this.productHighlightIndex.set(-1);
    this.movementError.set('');
  }

  blockNonDigitKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const allowed = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]);
    if (allowed.has(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onMovementQtyInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    this.movementQtyText.set(digits);
    this.movementQty.set(digits ? Number(digits) : null);
  }

  onCreateMinQtyInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    this.createMinQtyText.set(digits);
    this.createMinQty.set(digits ? Number(digits) : null);
  }

  bumpCreateMinQty(delta: number): void {
    const current = this.createMinQty() ?? 0;
    const next = Math.max(0, current + delta);
    this.createMinQty.set(next);
    this.createMinQtyText.set(String(next));
  }

  onCreateMinQtyKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.bumpCreateMinQty(1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.bumpCreateMinQty(-1);
      return;
    }
    this.blockNonDigitKey(event);
  }

  goToCreateItem(): void {
    const name = this.productQuery().trim();
    this.createName.set(name);
    this.createCategory.set(STOCK_CATEGORIES[0]);
    this.createUnit.set(STOCK_UNITS[0]);
    this.createUnitCost.set(null);
    this.createUnitCostText.set('');
    this.createMinQty.set(null);
    this.createMinQtyText.set('');
    this.createError.set('');
    this.movementStep.set('create-item');
  }

  onCreateUnitCostInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      this.createUnitCostText.set('');
      this.createUnitCost.set(null);
      return;
    }
    const cents = Number(digits);
    const value = cents / 100;
    this.createUnitCost.set(value);
    this.createUnitCostText.set(
      value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }

  backToMovement(): void {
    this.createError.set('');
    this.movementStep.set('movement');
  }

  saveQuickItem(): void {
    const name = this.createName().trim();
    const category = this.createCategory();
    const unit = this.createUnit();
    const unitCost = this.createUnitCost();
    const minQuantity = this.createMinQty();

    if (!name) {
      this.createError.set('Informe o nome do item.');
      return;
    }
    if (!category) {
      this.createError.set('Escolha uma categoria.');
      return;
    }
    if (!unit) {
      this.createError.set('Escolha a unidade.');
      return;
    }
    if (unitCost == null || Number.isNaN(unitCost) || unitCost < 0) {
      this.createError.set('Informe o custo unitário (0 ou maior).');
      return;
    }
    if (minQuantity == null || Number.isNaN(minQuantity) || minQuantity < 0) {
      this.createError.set('Informe o estoque mínimo (0 ou maior).');
      return;
    }

    const duplicate = this.items().some((i) => i.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      this.createError.set('Já existe um item com esse nome.');
      return;
    }

    const id = `local-${Date.now()}`;
    const item: StockItem = {
      id,
      name,
      category,
      quantity: 0,
      unit,
      unitCost,
      minQuantity,
      status: this.deriveStatus(0, minQuantity),
    };

    this.items.update((list) => [item, ...list]);
    this.selectedProductId.set(id);
    this.productQuery.set(name);
    this.productListOpen.set(false);
    this.createError.set('');
    this.movementStep.set('movement');
    this.movementType.set('in');
    this.movementError.set('');
    this.toast.success(`Item “${name}” cadastrado.`);
  }

  submitMovement(): void {
    const product = this.selectedProduct();
    const qty = this.movementQty();
    const type = this.movementType();
    const note = this.movementNote().trim();

    if (!product) {
      this.movementError.set('Selecione um item da lista ou cadastre um novo.');
      return;
    }
    if (qty == null || Number.isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
      this.movementError.set('Informe uma quantidade inteira maior que zero.');
      return;
    }
    if (type === 'out' && qty > product.quantity) {
      this.movementError.set(
        `Quantidade maior que o disponível (${product.quantity} ${product.unit}).`,
      );
      return;
    }

    const nextQty =
      type === 'in' ? product.quantity + qty : Math.max(0, product.quantity - qty);

    this.items.update((list) =>
      list.map((item) =>
        item.id === product.id
          ? {
              ...item,
              quantity: nextQty,
              status: this.deriveStatus(nextQty, item.minQuantity),
            }
          : item,
      ),
    );

    const movement: StockMovement = {
      id: `m-local-${Date.now()}`,
      itemId: product.id,
      type,
      quantity: qty,
      unit: product.unit,
      note: note || (type === 'in' ? 'Entrada registrada' : 'Saída registrada'),
      at: new Date().toISOString(),
      user: 'Administrador',
    };

    this.movements.update((list) => [movement, ...list]);
    this.selectedId.set(product.id);
    this.closeMovement();
    this.toast.success(
      type === 'in'
        ? `Entrada de ${qty} ${product.unit} em “${product.name}”.`
        : `Saída de ${qty} ${product.unit} de “${product.name}”.`,
    );
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

  private resetMovementForm(): void {
    this.movementStep.set('movement');
    this.productQuery.set('');
    this.selectedProductId.set(null);
    this.movementType.set('in');
    this.movementQty.set(null);
    this.movementQtyText.set('');
    this.movementNote.set('');
    this.movementError.set('');
    this.productListOpen.set(false);
    this.productHighlightIndex.set(-1);
    this.createName.set('');
    this.createCategory.set(STOCK_CATEGORIES[0]);
    this.createUnit.set(STOCK_UNITS[0]);
    this.createUnitCost.set(null);
    this.createUnitCostText.set('');
    this.createMinQty.set(null);
    this.createMinQtyText.set('');
    this.createError.set('');
  }

  private deriveStatus(quantity: number, minQuantity: number): StockStatus {
    if (quantity <= 0) return 'out';
    if (quantity < minQuantity) return 'low';
    return 'ok';
  }
}

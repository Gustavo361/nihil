import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCheck,
  IconChefHat,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { MenuCatalogService } from '../../core/menu/menu-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { formatStockQty, recipeCompatible, recipeLineCost, recipeQtyToStockUnit } from '../estoque/stock-units';
import {
  DishRecipeLine,
  DishStatus,
  MenuDish,
  estimatedRecipeCost,
} from './menu.models';

type MenuModal = 'form' | 'detail' | null;

@Component({
  selector: 'app-menu-page',
  imports: [FormsModule, CurrencyPipe, TablerIconComponent, NihilSelectComponent],
  templateUrl: './menu.page.html',
  styleUrl: './menu.page.scss',
})
export class MenuPage {
  private readonly toast = inject(ToastService);
  private readonly catalog = inject(MenuCatalogService);
  private readonly inventory = inject(StockInventoryService);

  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconChef = IconChefHat;
  readonly iconCheck = IconCheck;
  readonly iconClose = IconX;
  readonly iconTrash = IconTrash;

  readonly dishes = this.catalog.dishes;
  readonly totalCount = this.catalog.totalCount;
  readonly availableCount = this.catalog.availableCount;
  readonly unavailableCount = this.catalog.unavailableCount;
  readonly stockItems = this.inventory.items;

  readonly search = signal('');
  readonly statusFilter = signal<'' | DishStatus>('');
  readonly selectedId = signal<string | null>(null);

  readonly modal = signal<MenuModal>(null);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly name = signal('');
  readonly description = signal('');
  readonly salePriceText = signal('');
  readonly salePrice = signal<number | null>(null);
  readonly status = signal<DishStatus>('unavailable');
  readonly recipe = signal<DishRecipeLine[]>([]);
  /** Free-text drafts so quantity fields stay editable while typing. */
  readonly qtyDrafts = signal<Record<string, string>>({});
  readonly ingredientPickId = signal('');

  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'available', label: 'Disponível' },
    { value: 'unavailable', label: 'Indisponível' },
  ];

  readonly statusFormOptions = computed((): NihilSelectOption[] => {
    if (this.recipe().length === 0) {
      return [{ value: 'unavailable', label: 'Indisponível (sem ingredientes)' }];
    }
    return [
      { value: 'available', label: 'Disponível' },
      { value: 'unavailable', label: 'Indisponível' },
    ];
  });

  readonly filteredDishes = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.statusFilter();
    return this.dishes()
      .filter((dish) => {
        if (st && dish.status !== st) return false;
        if (q && !`${dish.name} ${dish.description ?? ''}`.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  readonly selectedDish = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.dishes().find((d) => d.id === id) ?? null;
  });

  readonly formRecipeCost = computed(() =>
    estimatedRecipeCost(this.recipe(), (id) => this.inventory.findById(id)),
  );

  readonly ingredientOptions = computed((): NihilSelectOption[] => {
    const used = new Set(this.recipe().map((l) => l.stockItemId));
    return [
      { value: '', label: 'Selecionar ingrediente do estoque' },
      ...this.stockItems()
        .filter((item) => !used.has(item.id))
        .map((item) => ({
          value: item.id,
          label: recipeCompatible(item)
            ? `${item.name} (${item.unit})`
            : `${item.name} (${item.unit}) — sem peso p/ receita`,
        })),
    ];
  });

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as '' | DishStatus);
  }

  selectDish(dish: MenuDish): void {
    this.selectedId.set(dish.id);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  openCreate(): void {
    this.resetForm();
    this.editingId.set(null);
    this.modal.set('form');
  }

  openEdit(dish: MenuDish): void {
    this.editingId.set(dish.id);
    this.name.set(dish.name);
    this.description.set(dish.description ?? '');
    this.salePrice.set(dish.salePrice);
    this.salePriceText.set(
      dish.salePrice.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
    this.status.set(dish.status);
    const nextRecipe = dish.recipe.map((line) => {
      const item = this.inventory.findById(line.stockItemId);
      return {
        ...line,
        name: item?.name ?? line.name,
        stockUnit: item?.unit ?? line.stockUnit,
        unitCost: item?.unitCost ?? line.unitCost,
      };
    });
    this.recipe.set(nextRecipe);
    this.qtyDrafts.set(
      Object.fromEntries(
        nextRecipe.map((line) => [line.stockItemId, this.formatQtyDraft(line.qtyValue)]),
      ),
    );
    this.ingredientPickId.set('');
    this.formError.set('');
    this.modal.set('form');
  }

  openDetail(dish: MenuDish): void {
    this.selectedId.set(dish.id);
    this.modal.set('detail');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.editingId.set(null);
    this.resetForm();
  }

  onSalePriceInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      this.salePriceText.set('');
      this.salePrice.set(null);
      return;
    }
    const value = Number(digits) / 100;
    this.salePrice.set(value);
    this.salePriceText.set(
      value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  }

  setFormStatus(value: string): void {
    if (this.recipe().length === 0 && value === 'available') {
      this.status.set('unavailable');
      this.formError.set('Cadastre pelo menos um ingrediente para disponibilizar o prato.');
      return;
    }
    this.status.set(value as DishStatus);
  }

  addIngredient(stockItemId: string): void {
    this.ingredientPickId.set(stockItemId);
    if (!stockItemId) return;
    const item = this.inventory.findById(stockItemId);
    if (!item) return;
    if (this.recipe().some((l) => l.stockItemId === item.id)) return;

    if (!recipeCompatible(item)) {
      this.formError.set(
        `“${item.name}” não tem peso de pacote nem unidade de massa (kg/g). Ajuste em Compras.`,
      );
      this.ingredientPickId.set('');
      return;
    }

    this.formError.set('');
    this.recipe.update((list) => [
      ...list,
      {
        stockItemId: item.id,
        name: item.name,
        qtyValue: 100,
        qtyUnit: 'g',
        stockUnit: item.unit,
        unitCost: item.unitCost,
      },
    ]);
    this.qtyDrafts.update((map) => ({ ...map, [item.id]: '100' }));
    this.ingredientPickId.set('');
    if (this.status() === 'unavailable' && this.recipe().length === 1) {
      // First ingredient unlocked availability — leave choice to the user (default available).
      this.status.set('available');
    }
  }

  qtyDraft(stockItemId: string): string {
    const draft = this.qtyDrafts()[stockItemId];
    if (draft != null) return draft;
    const line = this.recipe().find((l) => l.stockItemId === stockItemId);
    return line ? this.formatQtyDraft(line.qtyValue) : '';
  }

  updateIngredientQty(stockItemId: string, raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '');
    this.qtyDrafts.update((map) => ({ ...map, [stockItemId]: cleaned }));
    const normalized = cleaned.replace(',', '.');
    const value = Number(normalized);
    const qty = normalized && !Number.isNaN(value) && value > 0 ? value : 0;
    this.recipe.update((list) =>
      list.map((line) => (line.stockItemId === stockItemId ? { ...line, qtyValue: qty } : line)),
    );
  }

  setIngredientUnit(stockItemId: string, unit: string): void {
    const qtyUnit = unit === 'kg' ? 'kg' : 'g';
    this.recipe.update((list) =>
      list.map((line) => (line.stockItemId === stockItemId ? { ...line, qtyUnit } : line)),
    );
  }

  removeIngredient(stockItemId: string): void {
    this.recipe.update((list) => list.filter((l) => l.stockItemId !== stockItemId));
    this.qtyDrafts.update((map) => {
      const next = { ...map };
      delete next[stockItemId];
      return next;
    });
    if (this.recipe().length === 0) {
      this.status.set('unavailable');
    }
  }

  saveDish(): void {
    if (this.saving()) return;
    const price = this.salePrice();
    const invalidQty = this.recipe().some((l) => !(l.qtyValue > 0));
    if (invalidQty) {
      this.formError.set('Informe quantidades maiores que zero para todos os ingredientes.');
      return;
    }

    for (const line of this.recipe()) {
      const item = this.inventory.findById(line.stockItemId);
      if (!item || !recipeCompatible(item)) {
        this.formError.set(
          `Ingrediente “${line.name}” incompatível com receita em g/kg. Cadastre peso em Compras.`,
        );
        return;
      }
      if (recipeQtyToStockUnit(item, line.qtyValue, line.qtyUnit) == null) {
        this.formError.set(`Não foi possível converter “${line.name}” para a unidade de estoque.`);
        return;
      }
    }

    const recipe = this.recipe();
    const status: DishStatus = recipe.length === 0 ? 'unavailable' : this.status();
    if (recipe.length === 0) {
      this.status.set('unavailable');
    }

    this.saving.set(true);
    this.formError.set('');
    const wasEdit = this.editingId() != null;
    try {
      const dish = this.catalog.upsert({
        id: this.editingId() ?? undefined,
        name: this.name(),
        description: this.description(),
        salePrice: price ?? 0,
        status,
        recipe,
      });
      this.selectedId.set(dish.id);
      this.editingId.set(null);
      this.saving.set(false);
      this.closeModal();
      const base = wasEdit ? `Prato “${dish.name}” atualizado.` : `Prato “${dish.name}” cadastrado.`;
      this.toast.success(
        dish.recipe.length === 0
          ? `${base} Indisponível até cadastrar ingredientes.`
          : base,
      );
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível salvar o prato.');
    }
  }

  statusLabel(status: DishStatus): string {
    return status === 'available' ? 'Disponível' : 'Indisponível';
  }

  recipeCost(dish: MenuDish): number | null {
    return estimatedRecipeCost(dish.recipe, (id) => this.inventory.findById(id));
  }

  lineCost(line: DishRecipeLine): number | null {
    const item = this.inventory.findById(line.stockItemId);
    if (item) return recipeLineCost(item, line.qtyValue, line.qtyUnit);
    return estimatedRecipeCost([line]);
  }

  lineStockEquiv(line: DishRecipeLine): string {
    const item = this.inventory.findById(line.stockItemId);
    if (!item) return `${line.qtyValue} ${line.qtyUnit}`;
    const qty = recipeQtyToStockUnit(item, line.qtyValue, line.qtyUnit);
    if (qty == null) return '—';
    return `≈ ${formatStockQty(qty, item.unit)}`;
  }

  formatRecipeQty(line: DishRecipeLine): string {
    return `${line.qtyValue} ${line.qtyUnit}`;
  }

  private formatQtyDraft(value: number): string {
    if (!value || Number.isNaN(value)) return '';
    return Number.isInteger(value)
      ? String(value)
      : String(value).replace('.', ',');
  }

  private resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.salePriceText.set('');
    this.salePrice.set(null);
    this.status.set('unavailable');
    this.recipe.set([]);
    this.qtyDrafts.set({});
    this.ingredientPickId.set('');
    this.formError.set('');
  }
}

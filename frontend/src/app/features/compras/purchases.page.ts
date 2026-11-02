import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconPackage,
  IconPlus,
  IconSearch,
  IconShoppingCart,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { PurchaseCatalogService } from '../../core/purchases/purchase-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { isMassUnit } from '../estoque/stock-units';
import { STOCK_CATEGORIES, STOCK_UNITS } from '../estoque/stock.mock';
import { Purchase } from './purchases.models';

@Component({
  selector: 'app-purchases-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent, NihilSelectComponent],
  templateUrl: './purchases.page.html',
  styleUrl: './purchases.page.scss',
})
export class PurchasesPage {
  private readonly toast = inject(ToastService);
  private readonly purchasesSvc = inject(PurchaseCatalogService);
  private readonly inventory = inject(StockInventoryService);

  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconCart = IconShoppingCart;
  readonly iconPackage = IconPackage;
  readonly iconClose = IconX;

  readonly purchases = this.purchasesSvc.purchases;
  readonly purchaseCount = this.purchasesSvc.count;
  readonly totalSpent = this.purchasesSvc.totalSpent;
  readonly productCount = this.inventory.itemCount;

  readonly search = signal('');
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly name = signal('');
  readonly category = signal<string>(STOCK_CATEGORIES[0]);
  readonly unit = signal<string>('kg');
  readonly quantityText = signal('');
  readonly quantity = signal<number | null>(null);
  readonly unitCostText = signal('');
  readonly unitCost = signal<number | null>(null);
  readonly minQtyText = signal('');
  readonly minQty = signal<number | null>(null);
  readonly packageWeightText = signal('');
  readonly packageWeightKg = signal<number | null>(null);
  readonly note = signal('');

  readonly categoryOptions: NihilSelectOption[] = STOCK_CATEGORIES.map((c) => ({
    value: c,
    label: c,
  }));
  readonly unitOptions: NihilSelectOption[] = STOCK_UNITS.map((u) => ({ value: u, label: u }));

  readonly needsPackageWeight = computed(() => !isMassUnit(this.unit()));

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.purchases().filter((p) => {
      if (!q) return true;
      return `${p.id} ${p.summary} ${p.line.name}`.toLowerCase().includes(q);
    });
  });

  readonly existingHint = computed(() => {
    const n = this.name().trim();
    if (!n) return null;
    const item = this.inventory.findByName(n);
    if (!item) return null;
    return item;
  });

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  openCreate(): void {
    this.resetForm();
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modalOpen.set(false);
    this.resetForm();
  }

  setCategory(value: string): void {
    this.category.set(value);
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

  onMoneyInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      this.unitCostText.set('');
      this.unitCost.set(null);
      return;
    }
    const value = Number(digits) / 100;
    this.unitCost.set(value);
    this.unitCostText.set(
      value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  }

  onMinQtyInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    this.minQtyText.set(cleaned.replace('.', ','));
    const value = Number(cleaned);
    this.minQty.set(cleaned && !Number.isNaN(value) ? value : null);
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

  save(): void {
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
        this.formError.set('Informe o peso líquido do pacote em kg (ex.: 1 para 1 kg).');
        return;
      }
    }

    const existing = this.existingHint();
    if (existing && existing.unit !== this.unit()) {
      this.formError.set(
        `Já existe “${existing.name}” com unidade ${existing.unit}. Use a mesma unidade para novas entradas.`,
      );
      return;
    }

    this.saving.set(true);
    try {
      const purchase = this.purchasesSvc.receive({
        name: this.name(),
        category: this.category(),
        unit: existing?.unit ?? this.unit(),
        quantity: qty,
        unitCost: cost,
        minQuantity: min,
        packageWeightKg: this.needsPackageWeight()
          ? (this.packageWeightKg() ?? undefined)
          : undefined,
        note: this.note().trim() || undefined,
      });
      this.saving.set(false);
      this.closeModal();
      this.toast.success(
        purchase.line.createdItem
          ? `Produto “${purchase.line.name}” cadastrado e entrada registrada.`
          : `Entrada de ${purchase.line.quantity} ${purchase.line.unit} em “${purchase.line.name}”.`,
      );
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível registrar a compra.');
    }
  }

  trackPurchase(_index: number, p: Purchase): string {
    return p.id;
  }

  private resetForm(): void {
    this.name.set('');
    this.category.set(STOCK_CATEGORIES[0]);
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
    this.formError.set('');
  }
}

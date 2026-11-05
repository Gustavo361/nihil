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
import { formatMoneyInput, moneyToInputText, parseMoneyTyping, restoreMoneyCaret } from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { TablePagerComponent } from '../../shared/table-pager/table-pager.component';
import { pageItems } from '../../shared/table-pager/table-pagination';
import { isMassUnit } from '../estoque/stock-units';
import { STOCK_CATEGORIES, STOCK_UNITS } from '../estoque/stock.mock';
import { Purchase } from './purchases.models';

@Component({
  selector: 'app-purchases-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent, NihilSelectComponent, TablePagerComponent],
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
  readonly page = signal(1);
  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
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

  readonly isEditing = computed(() => this.editingId() != null);
  readonly needsPackageWeight = computed(() => !isMassUnit(this.unit()));

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.purchases().filter((p) => {
      if (!q) return true;
      return `${p.id} ${p.summary} ${p.line.name}`.toLowerCase().includes(q);
    });
  });
  readonly paged = computed(() => pageItems(this.filtered(), this.page()));

  readonly existingHint = computed(() => {
    if (this.isEditing()) return null;
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
    this.editingId.set(null);
    this.modalOpen.set(true);
  }

  openEdit(purchase: Purchase): void {
    this.resetForm();
    this.editingId.set(purchase.id);
    const item = this.inventory.findById(purchase.line.stockItemId);
    this.name.set(purchase.line.name);
    this.category.set(item?.category ?? STOCK_CATEGORIES[0]);
    this.unit.set(purchase.line.unit);
    this.onQtyInput(String(purchase.line.quantity).replace('.', ','));
    this.unitCost.set(purchase.line.unitCost);
    this.unitCostText.set(moneyToInputText(purchase.line.unitCost));
    const min = item?.minQuantity ?? 0;
    this.onMinQtyInput(String(min).replace('.', ','));
    if (purchase.line.packageWeightKg != null) {
      this.onPackageWeightInput(String(purchase.line.packageWeightKg).replace('.', ','));
    } else if (item?.packageWeightKg != null) {
      this.onPackageWeightInput(String(item.packageWeightKg).replace('.', ','));
    }
    this.note.set(purchase.note?.trim() || this.legacyNoteFromMovement(purchase) || '');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modalOpen.set(false);
    this.resetForm();
    this.editingId.set(null);
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

  removePurchase(purchase: Purchase): void {
    const ok = window.confirm(
      `Excluir a compra ${purchase.id} (“${purchase.line.name}”, ${purchase.line.quantity} ${purchase.line.unit})?\n\nA entrada correspondente será removida do estoque.`,
    );
    if (!ok) return;
    try {
      this.purchasesSvc.remove(purchase.id);
      this.toast.success(`Compra ${purchase.id} excluída e estoque atualizado.`);
    } catch (err) {
      this.toast.danger(err instanceof Error ? err.message : 'Não foi possível excluir a compra.');
    }
  }

  save(): void {
    if (this.saving()) return;
    const qty = this.quantity();
    const cost = this.unitCost();
    const min = this.minQty();
    this.formError.set('');

    if (!this.name().trim()) {
      this.failForm('Informe o nome do produto.');
      return;
    }
    if (qty == null || !(qty > 0)) {
      this.failForm('Informe a quantidade recebida (maior que zero).');
      return;
    }
    if (cost == null || cost < 0) {
      this.failForm('Informe o custo unitário.');
      return;
    }
    if (min == null || min < 0) {
      this.failForm('Informe o estoque mínimo (0 ou maior).');
      return;
    }
    if (this.needsPackageWeight()) {
      const w = this.packageWeightKg();
      if (w == null || !(w > 0)) {
        this.failForm('Informe o peso líquido do pacote em kg (ex.: 1 para 1 kg).');
        return;
      }
    }

    const editingId = this.editingId();
    const existing = this.existingHint();
    if (!editingId && existing && existing.unit !== this.unit()) {
      this.failForm(
        `Já existe “${existing.name}” com unidade ${existing.unit}. Use a mesma unidade para novas entradas.`,
      );
      return;
    }

    const form = {
      name: this.name(),
      category: this.category(),
      unit: editingId
        ? this.unit()
        : (existing?.unit ?? this.unit()),
      quantity: qty,
      unitCost: cost,
      minQuantity: min,
      packageWeightKg: this.needsPackageWeight()
        ? (this.packageWeightKg() ?? undefined)
        : undefined,
      note: this.note().trim() || undefined,
    };

    this.saving.set(true);
    try {
      if (editingId) {
        const purchase = this.purchasesSvc.update(editingId, {
          ...form,
          at: this.purchasesSvc.findById(editingId)?.at,
        });
        this.saving.set(false);
        this.toast.success(
          `Compra ${purchase.id} atualizada (${purchase.line.quantity} ${purchase.line.unit} · ${purchase.line.name}).`,
        );
        this.closeModal();
      } else {
        const purchase = this.purchasesSvc.receive(form);
        this.saving.set(false);
        this.toast.success(
          purchase.line.createdItem
            ? `Produto “${purchase.line.name}” cadastrado e entrada registrada.`
            : `Entrada de ${purchase.line.quantity} ${purchase.line.unit} em “${purchase.line.name}”.`,
        );
        this.closeModal();
      }
    } catch (err) {
      this.saving.set(false);
      this.failForm(
        err instanceof Error
          ? err.message
          : editingId
            ? 'Não foi possível atualizar a compra.'
            : 'Não foi possível registrar a compra.',
      );
    }
  }

  trackPurchase(_index: number, p: Purchase): string {
    return p.id;
  }

  private failForm(message: string): void {
    this.formError.set(message);
    this.toast.danger(message);
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

  /** Recover note from stock movement when older purchases lacked `note` on the receipt. */
  private legacyNoteFromMovement(purchase: Purchase): string {
    const mov = this.inventory
      .movements()
      .find(
        (m) =>
          m.type === 'purchase_in' &&
          m.refType === 'purchase' &&
          m.refId === purchase.id,
      );
    if (!mov?.note) return '';
    const auto = `Compra ${purchase.id}`;
    return mov.note === auto ? '' : mov.note;
  }
}

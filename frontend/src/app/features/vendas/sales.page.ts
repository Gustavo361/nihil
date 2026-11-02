import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconShoppingCart,
  IconTicket,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { CashRegisterService } from '../../core/cash/cash-register.service';
import { MenuCatalogService } from '../../core/menu/menu-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import type { RecipeSaleLineInput } from '../../core/stock/stock-inventory.service';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import type { CashPaymentMethod } from '../caixa/cash.models';
import type { SaleMenuDish } from '../pratos-receitas/menu.models';
import { DEFAULT_BUFFET_PRICE, DEFAULT_KG_PRICE, SALES_MOCK } from './sales.mock';
import { PaymentMethod, Sale, SaleDishLine, SaleModality, SaleStatus } from './sales.models';

const PAGE_SIZE = 20;
/** Sales older than this window are hidden from the UI (inclusive of today). */
const SALES_VISIBLE_DAYS = 7;

type SaleWizardStep = 'modality' | 'details' | 'payment';

@Component({
  selector: 'app-sales-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent, NihilSelectComponent],
  templateUrl: './sales.page.html',
  styleUrl: './sales.page.scss',
})
export class SalesPage implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly cashRegister = inject(CashRegisterService);
  private readonly menuCatalog = inject(MenuCatalogService);
  private readonly inventory = inject(StockInventoryService);
  private readonly dishSuggestAnchor = viewChild<ElementRef<HTMLElement>>('dishSuggestAnchor');
  private readonly dishSuggestScrollParents: HTMLElement[] = [];
  private readonly onDishSuggestReposition = () => this.syncDishSuggestPanel();

  readonly pageSize = PAGE_SIZE;
  readonly salesVisibleDays = SALES_VISIBLE_DAYS;
  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconCart = IconShoppingCart;
  readonly iconMoney = IconCash;
  readonly iconTicket = IconTicket;
  readonly iconReceipt = IconReceipt;
  readonly iconClose = IconX;
  readonly iconPrev = IconChevronLeft;
  readonly iconNext = IconChevronRight;

  readonly modalityFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as modalidades' },
    { value: 'buffet', label: 'Buffet livre' },
    { value: 'kg', label: 'Marmita por kg' },
    { value: 'dishes', label: 'Pratos prontos' },
  ];
  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'cancelled', label: 'Cancelada' },
  ];

  /** UI-only mock until sales API exists. */
  readonly sales = signal<Sale[]>([...SALES_MOCK]);
  /** Shared with Pratos e receitas — only available dishes. */
  readonly dishes = this.menuCatalog.availableForSale;

  readonly search = signal('');
  readonly modalityFilter = signal<'' | SaleModality>('');
  readonly statusFilter = signal<'' | SaleStatus>('');
  readonly period = signal(this.todayInputValue());
  readonly page = signal(1);
  readonly selectedId = signal<string | null>(null);

  readonly wizardOpen = signal(false);
  readonly wizardStep = signal<SaleWizardStep>('modality');
  readonly modality = signal<SaleModality | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly peopleCountText = signal('');
  readonly peopleCount = signal<number | null>(null);
  readonly buffetPriceText = signal('');
  readonly buffetPrice = signal<number | null>(null);

  readonly weightText = signal('');
  readonly weightKg = signal<number | null>(null);
  readonly kgPriceText = signal('');
  readonly kgPrice = signal<number | null>(null);

  readonly dishQuery = signal('');
  readonly dishListOpen = signal(false);
  readonly dishSuggestPanel = signal<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  readonly cart = signal<SaleDishLine[]>([]);

  readonly payment = signal<PaymentMethod | null>(null);

  readonly cancelOpen = signal(false);
  readonly cancelReason = signal('');
  readonly cancelError = signal('');

  readonly periodMin = computed(() => this.dayOffsetInputValue(-(SALES_VISIBLE_DAYS - 1)));
  readonly periodMax = computed(() => this.todayInputValue());

  readonly filteredSales = computed(() => {
    const q = this.search().trim().toLowerCase();
    const mod = this.modalityFilter();
    const st = this.statusFilter();
    const day = this.period();
    return this.sales()
      .filter((sale) => {
        if (!this.isWithinSalesWindow(sale.at)) return false;
        if (day && this.localDayKey(sale.at) !== day) return false;
        if (mod && sale.modality !== mod) return false;
        if (st && sale.status !== st) return false;
        if (q) {
          const hay = `${sale.id} ${sale.summary} ${this.modalityLabel(sale.modality)} ${this.paymentLabel(sale.payment)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredSales().length / this.pageSize)),
  );

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly pagedSales = computed(() => {
    const list = this.filteredSales();
    const start = (this.currentPage() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  readonly pageSummary = computed(() => {
    const total = this.filteredSales().length;
    if (total === 0) return { from: 0, to: 0, total: 0 };
    const from = (this.currentPage() - 1) * this.pageSize + 1;
    const to = Math.min(this.currentPage() * this.pageSize, total);
    return { from, to, total };
  });

  readonly dayIndicators = computed(() => {
    const day = this.period();
    const ofDay = this.sales().filter(
      (s) => this.isWithinSalesWindow(s.at) && this.localDayKey(s.at) === day,
    );
    const confirmed = ofDay.filter((s) => s.status === 'confirmed');
    const count = confirmed.length;
    const revenue = confirmed.reduce((sum, s) => sum + s.total, 0);
    const ticket = count > 0 ? revenue / count : 0;
    return { count, revenue, ticket };
  });

  readonly selectedSale = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.sales().find((s) => s.id === id) ?? null;
  });

  readonly dishSuggestions = computed(() => {
    const q = this.dishQuery().trim().toLowerCase();
    const all = this.dishes();
    if (!q) return all.slice(0, 8);
    return all.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 8);
  });

  readonly draftTotal = computed(() => {
    const mod = this.modality();
    if (mod === 'buffet') {
      const people = this.peopleCount();
      const price = this.buffetPrice();
      if (people == null || price == null) return 0;
      return people * price;
    }
    if (mod === 'kg') {
      const weight = this.weightKg();
      const price = this.kgPrice();
      if (weight == null || price == null) return 0;
      return Math.round(weight * price * 100) / 100;
    }
    if (mod === 'dishes') {
      return this.cart().reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    }
    return 0;
  });

  readonly draftSummary = computed(() => {
    const mod = this.modality();
    if (mod === 'buffet') {
      const n = this.peopleCount();
      return n != null ? `Buffet · ${n} pessoa(s)` : 'Buffet livre';
    }
    if (mod === 'kg') {
      const w = this.weightKg();
      return w != null ? `Marmita · ${w.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : 'Marmita por kg';
    }
    if (mod === 'dishes') {
      const lines = this.cart();
      if (!lines.length) return 'Pratos prontos';
      return lines.map((l) => `${l.quantity}× ${l.dishName}`).join(', ');
    }
    return '';
  });

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  clearSearch(): void {
    this.setSearch('');
  }

  setModalityFilter(value: string): void {
    this.modalityFilter.set(value as '' | SaleModality);
    this.page.set(1);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as '' | SaleStatus);
    this.page.set(1);
  }

  setPeriod(value: string): void {
    const next = value || this.todayInputValue();
    const min = this.periodMin();
    const max = this.periodMax();
    if (next < min) {
      this.period.set(min);
    } else if (next > max) {
      this.period.set(max);
    } else {
      this.period.set(next);
    }
    this.page.set(1);
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  selectSale(sale: Sale): void {
    this.selectedId.set(sale.id);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  openWizard(): void {
    this.resetWizard();
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    if (this.saving()) return;
    this.wizardOpen.set(false);
    this.resetWizard();
  }

  chooseModality(mod: SaleModality): void {
    this.modality.set(mod);
    this.formError.set('');
    if (mod === 'buffet' && this.buffetPrice() == null) {
      this.applyMoneyInput(
        String(Math.round(DEFAULT_BUFFET_PRICE * 100)),
        this.buffetPriceText,
        this.buffetPrice,
      );
    }
    if (mod === 'kg' && this.kgPrice() == null) {
      this.applyMoneyInput(
        String(Math.round(DEFAULT_KG_PRICE * 100)),
        this.kgPriceText,
        this.kgPrice,
      );
    }
    this.wizardStep.set('details');
  }

  backToModality(): void {
    this.wizardStep.set('modality');
    this.formError.set('');
  }

  goToPayment(): void {
    const err = this.validateDetails();
    if (err) {
      this.formError.set(err);
      return;
    }
    this.formError.set('');
    this.wizardStep.set('payment');
  }

  backToDetails(): void {
    this.wizardStep.set('details');
    this.formError.set('');
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
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  onPeopleCountInput(raw: string): void {
    const digits = raw.replace(/\D/g, '');
    this.peopleCountText.set(digits);
    this.peopleCount.set(digits ? Number(digits) : null);
  }

  onBuffetPriceInput(raw: string): void {
    this.applyMoneyInput(raw, this.buffetPriceText, this.buffetPrice);
  }

  onWeightInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 3)}`;
    this.weightText.set(normalized.replace('.', ','));
    const value = Number(normalized);
    this.weightKg.set(normalized && !Number.isNaN(value) ? value : null);
  }

  onKgPriceInput(raw: string): void {
    this.applyMoneyInput(raw, this.kgPriceText, this.kgPrice);
  }

  ngOnDestroy(): void {
    this.teardownDishSuggestListeners();
  }

  onDishQueryChange(value: string): void {
    this.dishQuery.set(value);
    this.openDishList();
  }

  openDishList(): void {
    this.dishListOpen.set(true);
    this.syncDishSuggestPanel();
    this.setupDishSuggestListeners();
  }

  closeDishListSoon(): void {
    window.setTimeout(() => this.closeDishList(), 150);
  }

  addDish(dish: SaleMenuDish): void {
    this.cart.update((lines) => {
      const existing = lines.find((l) => l.dishId === dish.id);
      if (existing) {
        return lines.map((l) =>
          l.dishId === dish.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      // Snapshot name/price at add time — later catalog edits must not rewrite sale lines.
      return [
        ...lines,
        { dishId: dish.id, dishName: dish.name, unitPrice: dish.unitPrice, quantity: 1 },
      ];
    });
    this.dishQuery.set('');
    this.closeDishList();
  }

  bumpDishQty(dishId: string, delta: number): void {
    this.cart.update((lines) =>
      lines
        .map((l) =>
          l.dishId === dishId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  removeDish(dishId: string): void {
    this.cart.update((lines) => lines.filter((l) => l.dishId !== dishId));
  }

  setPayment(method: PaymentMethod): void {
    this.payment.set(method);
    this.formError.set('');
  }

  confirmSale(): void {
    if (this.saving()) return;
    const detailsErr = this.validateDetails();
    if (detailsErr) {
      this.formError.set(detailsErr);
      this.wizardStep.set('details');
      return;
    }
    const pay = this.payment();
    if (!pay) {
      this.formError.set('Selecione a forma de pagamento.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const mod = this.modality()!;
    const now = new Date();
    const sale: Sale = {
      id: this.nextSaleId(now),
      at: now.toISOString(),
      modality: mod,
      summary: this.draftSummary(),
      total: this.draftTotal(),
      payment: pay,
      status: 'confirmed',
      peopleCount: mod === 'buffet' ? (this.peopleCount() ?? undefined) : undefined,
      pricePerPerson: mod === 'buffet' ? (this.buffetPrice() ?? undefined) : undefined,
      weightKg: mod === 'kg' ? (this.weightKg() ?? undefined) : undefined,
      pricePerKg: mod === 'kg' ? (this.kgPrice() ?? undefined) : undefined,
      lines: mod === 'dishes' ? this.cart().map((l) => ({ ...l })) : undefined,
    };

    // Session-only until sales API exists.
    this.sales.update((list) => [sale, ...list]);
    this.selectedId.set(sale.id);
    this.period.set(this.todayInputValue());

    if (mod === 'dishes' && sale.lines?.length) {
      this.applyDishStockOut(sale.id, sale.lines, sale.at);
    }

    this.saving.set(false);
    this.closeWizard();

    const cashResult = this.cashRegister.postSaleReceipt({
      saleId: sale.id,
      amount: sale.total,
      paymentMethod: sale.payment as CashPaymentMethod,
      summary: sale.summary,
      at: sale.at,
    });
    if (cashResult === 'posted') {
      this.toast.success(`Venda ${sale.id} registrada e lançada no caixa.`);
    } else if (cashResult === 'queued') {
      this.toast.success(`Venda ${sale.id} registrada.`, {
        highlight: 'Caixa fechado — recebimento na fila até a abertura.',
      });
    } else {
      this.toast.success(`Venda ${sale.id} registrada.`);
    }
  }

  openCancel(): void {
    this.cancelReason.set('');
    this.cancelError.set('');
    this.cancelOpen.set(true);
  }

  closeCancel(): void {
    this.cancelOpen.set(false);
    this.cancelReason.set('');
    this.cancelError.set('');
  }

  confirmCancel(): void {
    const sale = this.selectedSale();
    const reason = this.cancelReason().trim();
    if (!sale || sale.status !== 'confirmed') return;
    if (!reason) {
      this.cancelError.set('Informe a justificativa do cancelamento.');
      return;
    }

    this.sales.update((list) =>
      list.map((s) =>
        s.id === sale.id
          ? {
              ...s,
              status: 'cancelled' as const,
              cancellation: {
                at: new Date().toISOString(),
                reason,
                user: 'Administrador',
              },
            }
          : s,
      ),
    );

    const stockReversed = this.inventory.reverseSaleOut(sale.id);
    const reverse = this.cashRegister.reverseSaleReceipt(sale.id, reason);
    this.closeCancel();
    if (reverse === 'reversed') {
      this.toast.info(
        stockReversed
          ? `Venda ${sale.id} cancelada — estorno no caixa e nas baixas de estoque.`
          : `Venda ${sale.id} cancelada e estornada no caixa.`,
      );
    } else if (reverse === 'removed_pending') {
      this.toast.info(`Venda ${sale.id} cancelada — removida da fila do caixa.`);
    } else {
      this.toast.info(
        stockReversed
          ? `Venda ${sale.id} cancelada — baixas de estoque revertidas.`
          : `Venda ${sale.id} cancelada.`,
      );
    }
  }

  private applyDishStockOut(saleId: string, lines: SaleDishLine[], at: string): void {
    const recipeLines: RecipeSaleLineInput[] = [];
    for (const line of lines) {
      const dish = this.menuCatalog.findById(line.dishId);
      if (!dish?.recipe?.length) continue;
      for (const ing of dish.recipe) {
        recipeLines.push({
          stockItemId: ing.stockItemId,
          qtyValue: ing.qtyValue,
          qtyUnit: ing.qtyUnit,
          portions: line.quantity,
        });
      }
    }
    if (recipeLines.length) {
      this.inventory.applyRecipeSaleOut(saleId, recipeLines, at);
    }
  }

  modalityLabel(mod: SaleModality): string {
    switch (mod) {
      case 'buffet':
        return 'Buffet livre';
      case 'kg':
        return 'Marmita por kg';
      case 'dishes':
        return 'Pratos prontos';
    }
  }

  paymentLabel(method: PaymentMethod): string {
    switch (method) {
      case 'cash':
        return 'Dinheiro';
      case 'pix':
        return 'Pix';
      case 'debit':
        return 'Cartão de débito';
      case 'credit':
        return 'Cartão de crédito';
    }
  }

  statusLabel(status: SaleStatus): string {
    return status === 'confirmed' ? 'Confirmada' : 'Cancelada';
  }

  private validateDetails(): string | null {
    const mod = this.modality();
    if (!mod) return 'Escolha a modalidade.';

    if (mod === 'buffet') {
      const people = this.peopleCount();
      const price = this.buffetPrice();
      if (people == null || !Number.isInteger(people) || people <= 0) {
        return 'Informe a quantidade de pessoas (inteiro maior que zero).';
      }
      if (price == null || price < 0) {
        return 'Informe o preço por pessoa.';
      }
      return null;
    }

    if (mod === 'kg') {
      const weight = this.weightKg();
      const price = this.kgPrice();
      if (weight == null || weight <= 0) {
        return 'Informe o peso em kg (maior que zero).';
      }
      if (price == null || price < 0) {
        return 'Informe o preço por kg.';
      }
      return null;
    }

    if (!this.cart().length) {
      return 'Adicione ao menos um prato à venda.';
    }
    return null;
  }

  private applyMoneyInput(
    raw: string,
    textSignal: { set(v: string): void },
    valueSignal: { set(v: number | null): void },
  ): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      textSignal.set('');
      valueSignal.set(null);
      return;
    }
    const value = Number(digits) / 100;
    valueSignal.set(value);
    textSignal.set(
      value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  }

  private closeDishList(): void {
    this.dishListOpen.set(false);
    this.dishSuggestPanel.set(null);
    this.teardownDishSuggestListeners();
  }

  private syncDishSuggestPanel(): void {
    if (!this.dishListOpen()) {
      this.dishSuggestPanel.set(null);
      return;
    }
    const anchor = this.dishSuggestAnchor()?.nativeElement;
    if (!anchor) return;

    const margin = 8;
    const gap = 4;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const openBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(96, openBelow ? spaceBelow : spaceAbove);
    const top = openBelow
      ? rect.bottom + gap
      : Math.max(margin, rect.top - gap - maxHeight);
    const maxLeft = Math.max(margin, window.innerWidth - margin - rect.width);
    const left = Math.min(Math.max(margin, rect.left), maxLeft);

    this.dishSuggestPanel.set({
      top,
      left,
      width: rect.width,
      maxHeight,
    });
  }

  private setupDishSuggestListeners(): void {
    this.teardownDishSuggestListeners();
    window.addEventListener('resize', this.onDishSuggestReposition);
    let node: HTMLElement | null = this.dishSuggestAnchor()?.nativeElement ?? null;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`)) {
        node.addEventListener('scroll', this.onDishSuggestReposition, { passive: true });
        this.dishSuggestScrollParents.push(node);
      }
      node = node.parentElement;
    }
  }

  private teardownDishSuggestListeners(): void {
    window.removeEventListener('resize', this.onDishSuggestReposition);
    for (const node of this.dishSuggestScrollParents) {
      node.removeEventListener('scroll', this.onDishSuggestReposition);
    }
    this.dishSuggestScrollParents.length = 0;
  }

  private resetWizard(): void {
    this.wizardStep.set('modality');
    this.modality.set(null);
    this.saving.set(false);
    this.formError.set('');
    this.peopleCountText.set('');
    this.peopleCount.set(null);
    this.buffetPriceText.set('');
    this.buffetPrice.set(null);
    this.weightText.set('');
    this.weightKg.set(null);
    this.kgPriceText.set('');
    this.kgPrice.set(null);
    this.dishQuery.set('');
    this.closeDishList();
    this.cart.set([]);
    this.payment.set(null);
  }

  private todayInputValue(): string {
    return this.localDayKey(new Date().toISOString());
  }

  private dayOffsetInputValue(offsetDays: number): string {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return this.localDayKey(d.toISOString());
  }

  private localDayKey(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private isWithinSalesWindow(iso: string): boolean {
    const key = this.localDayKey(iso);
    return key >= this.periodMin() && key <= this.periodMax();
  }

  private nextSaleId(now: Date): string {
    const y = now.getFullYear();
    const stamp = now.getTime().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `V${y}-${stamp}-${rand}`;
  }
}

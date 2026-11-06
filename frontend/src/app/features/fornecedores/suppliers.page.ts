import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IconClipboardCheck,
  IconPackage,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import {
  ConfirmReceiveItemInput,
  SupplierCatalogService,
} from '../../core/suppliers/supplier-catalog.service';
import { StockInventoryService } from '../../core/stock/stock-inventory.service';
import { ToastService } from '../../core/toast/toast.service';
import { moneyToInputText, parseMoneyTyping, restoreMoneyCaret } from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { TablePagerComponent } from '../../shared/table-pager/table-pager.component';
import { pageItems } from '../../shared/table-pager/table-pagination';
import {
  DeliveryOccurrence,
  DeliveryReceipt,
  DeliverySchedule,
  HabitualProduct,
  Supplier,
  SupplierStatus,
  Weekday,
  formatSupplierAddress,
  occurrenceStatusLabel,
  weekdayLabel,
} from './suppliers.models';

type ModalKind =
  | 'supplier'
  | 'detail'
  | 'receive'
  | 'receive-summary'
  | 'edit-receipt'
  | 'annul'
  | 'snooze'
  | null;

interface ReceiveDraftRow {
  stockItemId: string;
  name: string;
  unit: string;
  expectedQty: number;
  received: boolean;
  qtyText: string;
  qty: number | null;
  costText: string;
  cost: number | null;
  note: string;
  purchaseId?: string;
}

@Component({
  selector: 'app-suppliers-page',
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TablerIconComponent,
    NihilSelectComponent,
    TablePagerComponent,
  ],
  templateUrl: './suppliers.page.html',
  styleUrl: './suppliers.page.scss',
})
export class SuppliersPage {
  private readonly toast = inject(ToastService);
  private readonly suppliersSvc = inject(SupplierCatalogService);
  private readonly inventory = inject(StockInventoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconTruck = IconTruck;
  readonly iconPackage = IconPackage;
  readonly iconCheck = IconClipboardCheck;
  readonly iconClose = IconX;
  readonly iconTrash = IconTrash;

  readonly suppliers = this.suppliersSvc.suppliers;
  readonly occurrences = this.suppliersSvc.occurrences;
  readonly activeCount = this.suppliersSvc.activeCount;
  readonly plannedTodayCount = this.suppliersSvc.plannedTodayCount;
  readonly awaitingCount = this.suppliersSvc.awaitingCount;
  readonly receiptsTodayCount = this.suppliersSvc.receiptsTodayCount;

  readonly search = signal('');
  readonly page = signal(1);
  readonly detailPage = signal(1);
  readonly receivePage = signal(1);
  readonly statusFilter = signal<'all' | SupplierStatus>('all');
  readonly modal = signal<ModalKind>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly editingId = signal<string | null>(null);
  readonly detailId = signal<string | null>(null);
  readonly receiveOccurrenceId = signal<string | null>(null);
  readonly editReceiptId = signal<string | null>(null);
  readonly snoozeOccurrenceId = signal<string | null>(null);
  readonly annulReceiptId = signal<string | null>(null);

  readonly name = signal('');
  readonly contactName = signal('');
  readonly phone = signal('');
  readonly email = signal('');
  readonly cep = signal('');
  readonly street = signal('');
  readonly neighborhood = signal('');
  readonly number = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly cepLoading = signal(false);
  readonly cepHint = signal('');
  readonly notes = signal('');
  readonly status = signal<SupplierStatus>('active');
  readonly habituais = signal<HabitualProduct[]>([]);
  readonly schedules = signal<DeliverySchedule[]>([]);

  readonly receiveRows = signal<ReceiveDraftRow[]>([]);
  readonly pagedReceiveRows = computed(() => {
    const rows = this.receiveRows().map((row, index) => ({ row, index }));
    return pageItems(rows, this.receivePage());
  });
  readonly receiveNotes = signal('');
  readonly annulReason = signal('');
  readonly snoozeAtLocal = signal('');

  readonly addHabitualItemId = signal('');
  readonly addHabitualQtyText = signal('1');
  readonly addHabitualCostText = signal('');

  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ];

  readonly supplierStatusOptions: NihilSelectOption[] = [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
  ];

  readonly weekdayOptions: { value: Weekday; label: string }[] = (
    [0, 1, 2, 3, 4, 5, 6] as Weekday[]
  ).map((d) => ({ value: d, label: weekdayLabel(d) }));

  readonly stockOptions = computed((): NihilSelectOption[] =>
    this.inventory
      .items()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` })),
  );

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.statusFilter();
    return this.suppliers().filter((s) => {
      if (st !== 'all' && s.status !== st) return false;
      if (!q) return true;
      return `${s.name} ${s.contactName ?? ''} ${s.phone ?? ''} ${s.email ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  });
  readonly paged = computed(() => pageItems(this.filtered(), this.page()));

  readonly detailSupplier = computed(() => {
    const id = this.detailId();
    return id ? this.suppliersSvc.findSupplier(id) : undefined;
  });

  readonly detailOccurrences = computed(() => {
    const id = this.detailId();
    if (!id) return [];
    return this.suppliersSvc.occurrencesForSupplier(id);
  });
  readonly pagedDetailOccurrences = computed(() => pageItems(this.detailOccurrences(), this.detailPage()));

  readonly receiveSummaryTotal = computed(() => {
    let total = 0;
    for (const row of this.receiveRows()) {
      if (!row.received || row.qty == null || row.cost == null) continue;
      total += row.qty * row.cost;
    }
    return total;
  });

  constructor() {
    this.suppliersSvc.refreshAwaitingStatuses();
    this.suppliersSvc.materializeOccurrences();
    this.suppliersSvc.emitDueToasts();

    this.route.queryParamMap.subscribe((params) => {
      const occurrenceId = params.get('occurrenceId');
      const action = params.get('action');
      if (!occurrenceId || !action) return;
      // Defer so navigation settles before opening the receive modal.
      queueMicrotask(() => {
        if (action === 'receive') {
          this.openReceive(occurrenceId);
        } else if (action === 'snooze') {
          this.openSnooze(occurrenceId);
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      });
    });
  }

  statusLabel = occurrenceStatusLabel;
  dayLabel = weekdayLabel;
  addressLabel = formatSupplierAddress;

  setSearch(value: string): void {
    this.search.set(value);
  }

  onPhoneInput(raw: string): void {
    this.phone.set(formatPhoneBr(raw));
  }

  onPhoneKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const nav = new Set([
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
    if (nav.has(event.key)) return;
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const digits = this.phone().replace(/\D/g, '');
    const input = event.target as HTMLInputElement | null;
    const selected = (input?.selectionEnd ?? 0) - (input?.selectionStart ?? 0);
    if (digits.length >= 11 && selected <= 0) {
      event.preventDefault();
    }
  }

  onEmailInput(raw: string): void {
    this.email.set(formatEmail(raw));
  }

  onHabitualCostInput(raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.addHabitualCostText.set(text);
    void value;
    restoreMoneyCaret(input, raw, text, caret);
  }

  onCepInput(raw: string): void {
    const formatted = formatCep(raw);
    this.cep.set(formatted);
    this.cepHint.set('');
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      void this.lookupCep(digits);
    }
  }

  async lookupCep(digits?: string): Promise<void> {
    const cepDigits = (digits ?? this.cep().replace(/\D/g, '')).slice(0, 8);
    if (cepDigits.length !== 8) {
      this.cepHint.set('Informe um CEP com 8 dígitos para buscar.');
      return;
    }
    if (this.cepLoading()) return;
    this.cepLoading.set(true);
    this.cepHint.set('Buscando CEP…');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      if (!res.ok) throw new Error('Falha na consulta do CEP.');
      const data = (await res.json()) as ViaCepResponse;
      if (data.erro) {
        this.cepHint.set('CEP não encontrado.');
        return;
      }
      this.street.set(data.logradouro?.trim() || this.street());
      this.neighborhood.set(data.bairro?.trim() || this.neighborhood());
      this.city.set(data.localidade?.trim() || '');
      this.state.set(data.uf?.trim() || '');
      this.cep.set(formatCep(cepDigits));
      this.cepHint.set(
        data.localidade && data.uf
          ? `Preenchido via ViaCEP · ${data.localidade}/${data.uf}`
          : 'Endereço preenchido via ViaCEP.',
      );
    } catch {
      this.cepHint.set('Não foi possível consultar o CEP. Preencha manualmente.');
    } finally {
      this.cepLoading.set(false);
    }
  }

  clearSearch(): void {
    this.search.set('');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as 'all' | SupplierStatus);
  }

  stockName(stockItemId: string): string {
    return this.inventory.findById(stockItemId)?.name ?? stockItemId;
  }

  nextDelivery(supplier: Supplier): DeliveryOccurrence | undefined {
    return this.suppliersSvc.nextOccurrenceFor(supplier.id);
  }

  habituaisSummary(supplier: Supplier): string {
    if (!supplier.habituais.length) return '—';
    const names = supplier.habituais
      .slice(0, 3)
      .map((h) => this.stockName(h.stockItemId));
    const extra = supplier.habituais.length - names.length;
    return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ');
  }

  openCreate(): void {
    this.resetSupplierForm();
    this.editingId.set(null);
    this.modal.set('supplier');
  }

  openEdit(supplier: Supplier): void {
    this.resetSupplierForm();
    this.editingId.set(supplier.id);
    this.name.set(supplier.name);
    this.contactName.set(supplier.contactName ?? '');
    this.phone.set(formatPhoneBr(supplier.phone ?? ''));
    this.email.set(formatEmail(supplier.email ?? ''));
    this.cep.set(formatCep(supplier.cep ?? ''));
    this.street.set(supplier.street ?? '');
    this.neighborhood.set(supplier.neighborhood ?? '');
    this.number.set(supplier.number ?? '');
    this.city.set(supplier.city ?? '');
    this.state.set(supplier.state ?? '');
    this.cepHint.set('');
    this.notes.set(supplier.notes ?? '');
    this.status.set(supplier.status);
    this.habituais.set(supplier.habituais.map((h) => ({ ...h })));
    this.schedules.set(supplier.schedules.map((s) => ({ ...s, weekdays: [...s.weekdays] })));
    this.modal.set('supplier');
  }

  openDetail(supplier: Supplier): void {
    this.detailId.set(supplier.id);
    this.modal.set('detail');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.formError.set('');
    this.receiveOccurrenceId.set(null);
    this.editReceiptId.set(null);
    this.snoozeOccurrenceId.set(null);
    this.annulReceiptId.set(null);
    this.annulReason.set('');
  }

  addHabitual(): void {
    const stockItemId = this.addHabitualItemId();
    if (!stockItemId) {
      this.formError.set('Selecione um produto do estoque.');
      return;
    }
    if (this.habituais().some((h) => h.stockItemId === stockItemId)) {
      this.formError.set('Este produto já está nos habituais.');
      return;
    }
    const stock = this.inventory.findById(stockItemId);
    if (!stock) {
      this.formError.set('Produto não encontrado. Cadastre-o em Compras.');
      return;
    }
    const quantity = Number(String(this.addHabitualQtyText()).replace(',', '.'));
    if (!(quantity > 0)) {
      this.formError.set('Informe a quantidade esperada.');
      return;
    }
    let unitCost: number | undefined;
    if (this.addHabitualCostText().trim()) {
      const { value } = parseMoneyTyping(this.addHabitualCostText());
      if (value == null || value < 0) {
        this.formError.set('Custo previsto inválido.');
        return;
      }
      unitCost = value;
    }
    this.habituais.update((list) => [
      ...list,
      {
        id: `hab_${Date.now()}`,
        stockItemId,
        expectedQty: quantity,
        unit: stock.unit,
        unitCost,
      },
    ]);
    this.addHabitualItemId.set('');
    this.addHabitualQtyText.set('1');
    this.addHabitualCostText.set('');
    this.formError.set('');
  }

  removeHabitual(id: string): void {
    this.habituais.update((list) => list.filter((h) => h.id !== id));
    this.schedules.update((list) =>
      list.map((s) => ({ ...s, productIds: s.productIds.filter((pid) => pid !== id) })),
    );
  }

  addSchedule(): void {
    this.schedules.update((list) => [
      ...list,
      {
        id: `sch_${Date.now()}`,
        weekdays: [1, 2, 3, 4, 5],
        time: '08:00',
        productIds: [],
        active: true,
      },
    ]);
  }

  removeSchedule(id: string): void {
    this.schedules.update((list) => list.filter((s) => s.id !== id));
  }

  toggleWeekday(scheduleId: string, day: Weekday): void {
    this.schedules.update((list) =>
      list.map((s) => {
        if (s.id !== scheduleId) return s;
        const has = s.weekdays.includes(day);
        return {
          ...s,
          weekdays: has ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day].sort(),
        };
      }),
    );
  }

  setScheduleTime(scheduleId: string, time: string): void {
    this.schedules.update((list) =>
      list.map((s) => (s.id === scheduleId ? { ...s, time } : s)),
    );
  }

  toggleScheduleActive(scheduleId: string): void {
    this.schedules.update((list) =>
      list.map((s) => (s.id === scheduleId ? { ...s, active: !s.active } : s)),
    );
  }

  saveSupplier(): void {
    if (this.saving()) return;
    this.formError.set('');
    if (!this.name().trim()) {
      this.fail('Informe o nome do fornecedor.');
      return;
    }
    const emailValue = this.email().trim();
    if (emailValue && !isValidEmail(emailValue)) {
      this.fail('Informe um e-mail válido (ex.: contato@empresa.com).');
      return;
    }
    for (const sch of this.schedules()) {
      if (sch.active && !sch.weekdays.length) {
        this.fail('Cada programação ativa precisa de ao menos um dia da semana.');
        return;
      }
    }

    this.saving.set(true);
    try {
      const saved = this.suppliersSvc.upsertSupplier({
        id: this.editingId() ?? undefined,
        name: this.name(),
        contactName: this.contactName(),
        phone: this.phone(),
        email: this.email(),
        cep: this.cep(),
        street: this.street(),
        neighborhood: this.neighborhood(),
        number: this.number(),
        city: this.city(),
        state: this.state(),
        notes: this.notes(),
        status: this.status(),
        habituais: this.habituais(),
        schedules: this.schedules(),
      });
      this.saving.set(false);
      this.toast.success(
        this.editingId()
          ? `Fornecedor “${saved.name}” atualizado.`
          : `Fornecedor “${saved.name}” cadastrado.`,
      );
      this.closeModal();
    } catch (err) {
      this.saving.set(false);
      this.fail(err instanceof Error ? err.message : 'Não foi possível salvar o fornecedor.');
    }
  }

  deactivateSupplier(supplier: Supplier): void {
    const ok = window.confirm(
      `Desativar ou remover “${supplier.name}”? Fornecedores com histórico só podem ser desativados.`,
    );
    if (!ok) return;
    try {
      const result = this.suppliersSvc.deactivateOrDelete(supplier.id);
      this.toast.success(
        result.action === 'deleted'
          ? `Fornecedor “${supplier.name}” removido.`
          : `Fornecedor “${supplier.name}” desativado (histórico preservado).`,
      );
      if (this.detailId() === supplier.id) this.closeModal();
    } catch (err) {
      this.toast.danger(err instanceof Error ? err.message : 'Não foi possível alterar o fornecedor.');
    }
  }

  openReceive(occurrenceId: string): void {
    const occ = this.suppliersSvc.findOccurrence(occurrenceId);
    if (!occ) {
      this.toast.danger('Entrega não encontrada.');
      return;
    }
    if (occ.status === 'received' || occ.status === 'partial') {
      const receipt = this.suppliersSvc.receiptForOccurrence(occurrenceId);
      if (receipt) {
        this.openEditReceipt(receipt.id);
        return;
      }
    }
    if (occ.status === 'annulled' || occ.status === 'missed') {
      this.toast.danger('Esta entrega não pode mais ser recebida.');
      return;
    }

    this.receiveOccurrenceId.set(occurrenceId);
    this.editReceiptId.set(null);
    this.receiveNotes.set('');
    this.receiveRows.set(
      occ.expectedItems.map((item) => ({
        stockItemId: item.stockItemId,
        name: item.name,
        unit: item.unit,
        expectedQty: item.expectedQty,
        received: true,
        qtyText: String(item.expectedQty).replace('.', ','),
        qty: item.expectedQty,
        costText: moneyToInputText(item.unitCost ?? 0),
        cost: item.unitCost ?? 0,
        note: item.note ?? '',
      })),
    );
    this.modal.set('receive');
  }

  openEditReceipt(receiptId: string): void {
    const receipt = this.suppliersSvc.findReceipt(receiptId);
    if (!receipt || receipt.status === 'annulled') {
      this.toast.danger('Recebimento não disponível para edição.');
      return;
    }
    this.editReceiptId.set(receiptId);
    this.receiveOccurrenceId.set(receipt.occurrenceId);
    this.receiveNotes.set(receipt.notes ?? '');
    this.receiveRows.set(
      receipt.receivedItems.map((item) => ({
        stockItemId: item.stockItemId,
        name: item.name,
        unit: item.unit,
        expectedQty: item.expectedQty,
        received: item.received,
        qtyText: String(item.receivedQty).replace('.', ','),
        qty: item.receivedQty,
        costText: moneyToInputText(item.unitCost),
        cost: item.unitCost,
        note: item.note ?? '',
        purchaseId: item.purchaseId,
      })),
    );
    this.modal.set('edit-receipt');
  }

  addReceiveExtraProduct(stockItemId: string): void {
    if (!stockItemId) return;
    if (this.receiveRows().some((r) => r.stockItemId === stockItemId)) {
      this.toast.danger('Produto já está na conferência.');
      return;
    }
    const stock = this.inventory.findById(stockItemId);
    if (!stock) return;
    this.receiveRows.update((rows) => [
      ...rows,
      {
        stockItemId: stock.id,
        name: stock.name,
        unit: stock.unit,
        expectedQty: 0,
        received: true,
        qtyText: '1',
        qty: 1,
        costText: moneyToInputText(stock.unitCost),
        cost: stock.unitCost,
        note: '',
      },
    ]);
  }

  onReceiveQty(index: number, raw: string): void {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`;
    const value = Number(normalized);
    this.receiveRows.update((rows) =>
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              qtyText: normalized.replace('.', ','),
              qty: normalized && !Number.isNaN(value) ? value : null,
            }
          : r,
      ),
    );
  }

  onReceiveCost(index: number, raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.receiveRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, costText: text, cost: value } : r)),
    );
    restoreMoneyCaret(input, raw, text, caret);
  }

  toggleReceiveRow(index: number, received: boolean): void {
    this.receiveRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, received } : r)),
    );
  }

  setReceiveNote(index: number, note: string): void {
    this.receiveRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, note } : r)),
    );
  }

  goReceiveSummary(): void {
    this.formError.set('');
    const rows = this.receiveRows();
    if (!rows.some((r) => r.received && r.qty != null && r.qty > 0)) {
      this.fail('Marque ao menos um produto recebido com quantidade.');
      return;
    }
    for (const row of rows) {
      if (!row.received) continue;
      if (row.qty == null || !(row.qty > 0)) {
        this.fail(`Quantidade inválida para “${row.name}”.`);
        return;
      }
      if (row.cost == null || row.cost < 0) {
        this.fail(`Custo inválido para “${row.name}”.`);
        return;
      }
    }
    this.modal.set('receive-summary');
  }

  backToReceiveForm(): void {
    this.modal.set(this.editReceiptId() ? 'edit-receipt' : 'receive');
  }

  confirmReceive(): void {
    if (this.saving()) return;
    const occurrenceId = this.receiveOccurrenceId();
    if (!occurrenceId) return;

    const items: ConfirmReceiveItemInput[] = this.receiveRows().map((r) => ({
      stockItemId: r.stockItemId,
      name: r.name,
      unit: r.unit,
      expectedQty: r.expectedQty,
      receivedQty: r.qty ?? 0,
      unitCost: r.cost ?? 0,
      received: r.received,
      note: r.note.trim() || undefined,
      purchaseId: r.purchaseId,
    }));

    this.saving.set(true);
    try {
      const editId = this.editReceiptId();
      if (editId) {
        const receipt = this.suppliersSvc.updateReceipt(editId, items, this.receiveNotes());
        this.saving.set(false);
        this.toast.success(`Recebimento ${receipt.id} atualizado (compra e estoque corrigidos).`);
      } else {
        const receipt = this.suppliersSvc.confirmReceive(
          occurrenceId,
          items,
          this.receiveNotes(),
        );
        this.saving.set(false);
        this.toast.success(
          `Recebimento confirmado · ${receipt.purchaseIds.length} compra(s) no estoque.`,
        );
      }
      this.closeModal();
    } catch (err) {
      this.saving.set(false);
      this.fail(err instanceof Error ? err.message : 'Não foi possível confirmar o recebimento.');
      this.modal.set(this.editReceiptId() ? 'edit-receipt' : 'receive');
    }
  }

  openSnooze(occurrenceId: string): void {
    const occ = this.suppliersSvc.findOccurrence(occurrenceId);
    if (!occ) return;
    this.snoozeOccurrenceId.set(occurrenceId);
    const base = new Date(Math.max(Date.now() + 30 * 60_000, new Date(occ.plannedAt).getTime()));
    this.snoozeAtLocal.set(toLocalInput(base));
    this.modal.set('snooze');
  }

  confirmSnooze(): void {
    const id = this.snoozeOccurrenceId();
    if (!id) return;
    try {
      const iso = new Date(this.snoozeAtLocal()).toISOString();
      this.suppliersSvc.snoozeOccurrence(id, iso);
      this.toast.success('Lembrete adiado.');
      this.closeModal();
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Não foi possível adiar.');
    }
  }

  markMissed(occurrenceId: string): void {
    const ok = window.confirm(
      'Marcar esta entrega como não entregue? Não haverá compra nem entrada no estoque.',
    );
    if (!ok) return;
    try {
      this.suppliersSvc.markMissed(occurrenceId);
      this.toast.success('Entrega marcada como não entregue.');
      if (this.modal() === 'detail') {
        // stay on detail
      } else {
        this.closeModal();
      }
    } catch (err) {
      this.toast.danger(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    }
  }

  openAnnul(receiptId: string): void {
    this.annulReceiptId.set(receiptId);
    this.annulReason.set('');
    this.modal.set('annul');
  }

  confirmAnnul(): void {
    const id = this.annulReceiptId();
    if (!id) return;
    this.saving.set(true);
    try {
      this.suppliersSvc.annulReceipt(id, this.annulReason());
      this.saving.set(false);
      this.toast.success('Recebimento anulado. Compras e estoque revertidos.');
      this.closeModal();
    } catch (err) {
      this.saving.set(false);
      this.fail(err instanceof Error ? err.message : 'Não foi possível anular.');
    }
  }

  receiptOf(occurrence: DeliveryOccurrence): DeliveryReceipt | undefined {
    return occurrence.receiptId
      ? this.suppliersSvc.findReceipt(occurrence.receiptId)
      : undefined;
  }

  private fail(message: string): void {
    this.formError.set(message);
    this.toast.danger(message);
  }

  private resetSupplierForm(): void {
    this.name.set('');
    this.contactName.set('');
    this.phone.set('');
    this.email.set('');
    this.cep.set('');
    this.street.set('');
    this.neighborhood.set('');
    this.number.set('');
    this.city.set('');
    this.state.set('');
    this.cepHint.set('');
    this.cepLoading.set(false);
    this.notes.set('');
    this.status.set('active');
    this.habituais.set([]);
    this.schedules.set([]);
    this.addHabitualItemId.set('');
    this.addHabitualQtyText.set('1');
    this.addHabitualCostText.set('');
    this.formError.set('');
  }
}

interface ViaCepResponse {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function toLocalInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Lowercase, trim, strip spaces — keeps typing usable mid-value. */
function formatEmail(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** BR landline/mobile: (11) 3456-7890 or (11) 98765-4321 */
function formatPhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

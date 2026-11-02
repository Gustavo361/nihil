import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCash,
  IconCashBanknote,
  IconLock,
  IconLockOpen,
  IconMinus,
  IconPlus,
  IconReceipt,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { CashRegisterService } from '../../core/cash/cash-register.service';
import { ToastService } from '../../core/toast/toast.service';
import {
  CashMovement,
  CashMovementType,
  CashPaymentMethod,
  CashSession,
  CashSessionStatus,
} from './cash.models';

type CashTab = 'movements' | 'sessions';
type CashModal = 'open' | 'bleed' | 'supply' | 'close' | 'session-detail' | null;

@Component({
  selector: 'app-cash-page',
  imports: [FormsModule, CurrencyPipe, DatePipe, TablerIconComponent],
  templateUrl: './cash.page.html',
  styleUrl: './cash.page.scss',
})
export class CashPage {
  private readonly toast = inject(ToastService);
  private readonly cashRegister = inject(CashRegisterService);

  readonly iconCash = IconCash;
  readonly iconBanknote = IconCashBanknote;
  readonly iconReceipt = IconReceipt;
  readonly iconPlus = IconPlus;
  readonly iconMinus = IconMinus;
  readonly iconLock = IconLock;
  readonly iconLockOpen = IconLockOpen;
  readonly iconClose = IconX;

  readonly sessions = this.cashRegister.sessions;
  readonly pendingReceipts = this.cashRegister.pendingReceipts;
  readonly pendingCount = this.cashRegister.pendingCount;
  readonly openSession = this.cashRegister.openSession;
  readonly isOpen = this.cashRegister.isOpen;
  readonly sessionMovements = this.cashRegister.openSessionMovements;
  readonly drawer = this.cashRegister.openDrawer;

  readonly tab = signal<CashTab>('movements');
  readonly modal = signal<CashModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly openAmountText = signal('');
  readonly openAmount = signal<number | null>(null);
  readonly openNote = signal('');

  readonly moveAmountText = signal('');
  readonly moveAmount = signal<number | null>(null);
  readonly moveReason = signal('');

  readonly countedText = signal('');
  readonly countedAmount = signal<number | null>(null);
  readonly closeNote = signal('');

  readonly detailSessionId = signal<string | null>(null);
  readonly modalAt = signal(new Date().toISOString());

  readonly activeSession = computed(() => {
    const detailId = this.detailSessionId();
    if (detailId) {
      return this.sessions().find((s) => s.id === detailId) ?? this.openSession();
    }
    return this.openSession();
  });

  readonly detailMovements = computed(() => {
    const session = this.activeSession();
    if (!session) return [] as CashMovement[];
    return this.cashRegister.movementsFor(session.id);
  });

  readonly closedSessions = computed(() =>
    this.sessions()
      .filter((s) => s.status === 'closed')
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
  );

  readonly referenceDate = computed(() => {
    const open = this.openSession();
    return open ? open.openedAt : new Date().toISOString();
  });

  setTab(tab: CashTab): void {
    this.tab.set(tab);
  }

  openModal(kind: Exclude<CashModal, null | 'session-detail'>): void {
    if (kind === 'open' && this.isOpen()) {
      this.toast.danger('Já existe uma sessão de caixa aberta.');
      return;
    }
    if ((kind === 'bleed' || kind === 'supply' || kind === 'close') && !this.isOpen()) {
      this.toast.danger('Abra o caixa antes de registrar movimentações.');
      return;
    }
    this.resetForm();
    if (kind === 'open') {
      this.openAmount.set(0);
      this.openAmountText.set('0,00');
    }
    this.modalAt.set(new Date().toISOString());
    this.modal.set(kind);
  }

  openSessionDetail(session: CashSession): void {
    this.detailSessionId.set(session.id);
    this.modal.set('session-detail');
  }

  closeModal(force = false): void {
    if (this.saving() && !force) return;
    this.saving.set(false);
    this.modal.set(null);
    this.detailSessionId.set(null);
    this.resetForm();
  }

  onMoneyInput(
    raw: string,
    text: { set(v: string): void },
    value: { set(v: number | null): void },
  ): void {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      text.set('');
      value.set(null);
      return;
    }
    const amount = Number(digits) / 100;
    value.set(amount);
    text.set(
      amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  }

  onOpenAmountInput(raw: string): void {
    this.onMoneyInput(raw, this.openAmountText, this.openAmount);
  }

  onMoveAmountInput(raw: string): void {
    this.onMoneyInput(raw, this.moveAmountText, this.moveAmount);
  }

  onCountedInput(raw: string): void {
    this.onMoneyInput(raw, this.countedText, this.countedAmount);
  }

  confirmOpen(): void {
    if (this.saving()) return;
    if (this.isOpen()) {
      this.formError.set('Já existe uma sessão aberta. Feche-a antes de abrir outra.');
      return;
    }
    const amount = this.openAmount();
    if (amount == null || amount < 0) {
      this.formError.set('Informe o valor inicial (0 ou maior).');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    try {
      const { session, flushed } = this.cashRegister.openCash({
        openingAmount: amount,
        note: this.openNote().trim() || undefined,
      });
      this.tab.set('movements');
      this.closeModal(true);
      if (flushed > 0) {
        this.toast.success(
          `Caixa ${session.id} aberto. ${flushed} recebimento(s) da fila lançados na sessão.`,
        );
      } else {
        this.toast.success(`Caixa ${session.id} aberto.`);
      }
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível abrir o caixa.');
    }
  }

  confirmMovement(type: 'bleed' | 'supply'): void {
    if (this.saving()) return;
    const amount = this.moveAmount();
    const reason = this.moveReason().trim();
    if (amount == null || amount <= 0) {
      this.formError.set('Informe um valor maior que zero.');
      return;
    }
    if (!reason) {
      this.formError.set('Informe o motivo da movimentação.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    try {
      this.cashRegister.registerCashMove({ type, amount, reason });
      this.closeModal(true);
      this.toast.success(type === 'bleed' ? 'Sangria registrada.' : 'Suprimento registrado.');
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível registrar.');
    }
  }

  confirmClose(): void {
    if (this.saving()) return;
    const counted = this.countedAmount();
    if (counted == null || counted < 0) {
      this.formError.set('Informe o dinheiro contado (0 ou maior).');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    try {
      const closed = this.cashRegister.closeCash({
        countedAmount: counted,
        note: this.closeNote().trim() || undefined,
      });
      this.closeModal(true);
      this.tab.set('sessions');
      this.toast.success(`Caixa ${closed.id} fechado.`);
    } catch (err) {
      this.saving.set(false);
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível fechar o caixa.');
    }
  }

  statusLabel(status: CashSessionStatus): string {
    return status === 'open' ? 'Aberto' : 'Fechado';
  }

  movementTypeLabel(type: CashMovementType): string {
    switch (type) {
      case 'opening':
        return 'Abertura';
      case 'supply':
        return 'Suprimento';
      case 'bleed':
        return 'Sangria';
      case 'sale_receipt':
        return 'Recebimento (venda)';
      case 'sale_reversal':
        return 'Estorno (venda)';
      case 'closing':
        return 'Fechamento';
    }
  }

  paymentLabel(method?: CashPaymentMethod): string {
    if (!method) return '—';
    switch (method) {
      case 'cash':
        return 'Dinheiro';
      case 'pix':
        return 'Pix';
      case 'debit':
        return 'Débito';
      case 'credit':
        return 'Crédito';
    }
  }

  movementSignedAmount(move: CashMovement): number {
    if (move.type === 'bleed' || move.type === 'sale_reversal') return -move.amount;
    if (move.type === 'closing') return move.amount;
    return move.amount;
  }

  /** Green for money in (venda/suprimento/abertura), red for out (sangria/estorno). */
  movementAmountTone(move: CashMovement): 'in' | 'out' | 'neutral' {
    switch (move.type) {
      case 'bleed':
      case 'sale_reversal':
        return 'out';
      case 'sale_receipt':
      case 'supply':
      case 'opening':
        return 'in';
      default:
        return 'neutral';
    }
  }

  differenceLabel(diff: number | null | undefined): string {
    if (diff == null) return '—';
    if (diff === 0) return 'Caixa conferido';
    if (diff > 0) return 'Sobra de caixa';
    return 'Falta de caixa';
  }

  private resetForm(): void {
    this.formError.set('');
    this.openAmountText.set('');
    this.openAmount.set(null);
    this.openNote.set('');
    this.moveAmountText.set('');
    this.moveAmount.set(null);
    this.moveReason.set('');
    this.countedText.set('');
    this.countedAmount.set(null);
    this.closeNote.set('');
  }
}

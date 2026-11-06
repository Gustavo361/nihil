import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconUsers,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { EmployeeCatalogService } from '../../core/employees/employee-catalog.service';
import { EmployeeAccessService } from '../../core/employees/employee-access.service';
import { ToastService } from '../../core/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { API_BASE_URL } from '../../core/api/api-config';
import {
  formatMoneyInput,
  moneyToInputText,
  parseMoneyTyping,
  restoreMoneyCaret,
} from '../../shared/money-input';
import { NihilSelectComponent, NihilSelectOption } from '../../shared/nihil-select/nihil-select.component';
import { TablePagerComponent } from '../../shared/table-pager/table-pager.component';
import { pageItems } from '../../shared/table-pager/table-pagination';
import {
  Employee,
  EmployeeStatus,
  employeeStatusLabel,
} from './employees.models';

@Component({
  selector: 'app-employees-page',
  imports: [FormsModule, CurrencyPipe, TablerIconComponent, NihilSelectComponent, TablePagerComponent],
  templateUrl: './employees.page.html',
  styleUrl: './employees.page.scss',
})
export class EmployeesPage {
  private readonly catalog = inject(EmployeeCatalogService);
  private readonly access = inject(EmployeeAccessService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly iconPlus = IconPlus;
  readonly iconSearch = IconSearch;
  readonly iconUsers = IconUsers;
  readonly iconClose = IconX;
  readonly iconEye = IconEye;
  readonly iconEyeOff = IconEyeOff;
  readonly statusLabel = employeeStatusLabel;

  readonly search = signal('');
  readonly statusFilter = signal<'' | EmployeeStatus>('');
  readonly page = signal(1);
  readonly modal = signal<'form' | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly formName = signal('');
  readonly formRole = signal('');
  readonly formCostText = signal('');
  readonly formCost = signal<number | null>(null);
  readonly formStatus = signal<EmployeeStatus>('active');
  readonly formNotes = signal('');
  readonly formAccessEnabled = signal(false);
  readonly formUsername = signal('');
  readonly formEmail = signal('');
  readonly formPassword = signal('');
  readonly passwordVisible = signal(false);

  readonly statusFilterOptions: NihilSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ];

  readonly formStatusOptions: NihilSelectOption[] = [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' },
  ];

  readonly activeCount = this.catalog.activeCount;

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.statusFilter();
    return this.catalog
      .employees()
      .filter((e) => {
        if (st && e.status !== st) return false;
        if (q) {
          const hay = `${e.name} ${e.role} ${e.notes ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });
  readonly paged = computed(() => pageItems(this.filtered(), this.page()));

  setSearch(value: string): void {
    this.search.set(value);
  }

  clearSearch(): void {
    this.search.set('');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as '' | EmployeeStatus);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formRole.set('');
    this.formCostText.set('');
    this.formCost.set(null);
    this.formStatus.set('active');
    this.formNotes.set('');
    this.formAccessEnabled.set(false);
    this.formUsername.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.passwordVisible.set(false);
    this.formError.set('');
    this.modal.set('form');
  }

  openEdit(emp: Employee): void {
    this.editingId.set(emp.id);
    this.formName.set(emp.name);
    this.formRole.set(emp.role);
    this.formCost.set(emp.monthlyCost);
    this.formCostText.set(moneyToInputText(emp.monthlyCost));
    this.formStatus.set(emp.status);
    this.formNotes.set(emp.notes ?? '');
    const access = this.access.findByEmployeeId(emp.id);
    this.formAccessEnabled.set(access?.enabled ?? false);
    this.formUsername.set(access?.username ?? '');
    this.formEmail.set('');
    this.formPassword.set('');
    this.passwordVisible.set(false);
    this.formError.set('');
    this.modal.set('form');
  }

  closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.editingId.set(null);
  }

  onCostInput(raw: string, input?: HTMLInputElement): void {
    const caret = input?.selectionStart ?? null;
    const { text, value } = parseMoneyTyping(raw);
    this.formCostText.set(text);
    this.formCost.set(value);
    restoreMoneyCaret(input, raw, text, caret);
  }

  onCostBlur(): void {
    const formatted = formatMoneyInput(this.formCostText());
    this.formCostText.set(formatted.text);
    this.formCost.set(formatted.value);
  }

  setFormStatus(value: string): void {
    this.formStatus.set(value as EmployeeStatus);
  }

  setFormAccessEnabled(enabled: boolean): void {
    this.formAccessEnabled.set(enabled);
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    try {
      const cost = this.formCost();
      if (cost == null) throw new Error('Informe o custo mensal registrado.');
      const employee = this.catalog.upsert({
        id: this.editingId() ?? undefined,
        name: this.formName(),
        role: this.formRole(),
        monthlyCost: cost,
        status: this.formStatus(),
        notes: this.formNotes(),
      });
      const existingAccess = this.access.findByEmployeeId(employee.id);
      if (this.formAccessEnabled() || this.formUsername().trim()) {
        if (!existingAccess && this.formAccessEnabled()) {
          await this.createLogin(employee.name);
        }
        this.access.upsert(employee.id, this.formUsername(), this.formAccessEnabled());
      }
      this.toast.success(this.editingId() ? 'Funcionário atualizado.' : 'Funcionário cadastrado.');
      this.saving.set(false);
      this.closeModal();
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Não foi possível salvar.');
      this.saving.set(false);
    }
  }

  private async createLogin(displayName: string): Promise<void> {
    const username = this.formUsername().trim();
    const email = this.formEmail().trim();
    const password = this.formPassword();
    if (!username || !email || !password) throw new Error('Informe usuário, e-mail e senha para liberar o acesso.');
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: { Authorization: `Basic ${this.auth.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, displayName }),
    });
    if (!response.ok) {
      if (response.status === 409) throw new Error('Usuário ou e-mail já está em uso.');
      if (response.status === 400) throw new Error('Confira os dados do acesso e tente novamente.');
      throw new Error('Não foi possível criar o login agora. Tente novamente.');
    }
  }

  deactivate(emp: Employee): void {
    try {
      this.catalog.setStatus(emp.id, 'inactive');
      this.access.setEnabled(emp.id, false);
      this.toast.info(`${emp.name} marcado como inativo.`);
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Falha ao desativar.');
    }
  }
}

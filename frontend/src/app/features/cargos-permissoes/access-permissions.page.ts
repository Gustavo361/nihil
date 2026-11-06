import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmployeeAccessService, EmployeePermission, employeePermissionOptions } from '../../core/employees/employee-access.service';
import { EmployeeCatalogService } from '../../core/employees/employee-catalog.service';
import { ToastService } from '../../core/toast/toast.service';
import { TablePagerComponent } from '../../shared/table-pager/table-pager.component';
import { pageItems } from '../../shared/table-pager/table-pagination';

@Component({
  selector: 'app-access-permissions-page',
  imports: [RouterLink, TablePagerComponent],
  templateUrl: './access-permissions.page.html',
  styleUrl: './access-permissions.page.scss',
})
export class AccessPermissionsPage {
  private readonly employees = inject(EmployeeCatalogService);
  private readonly access = inject(EmployeeAccessService);
  private readonly toast = inject(ToastService);

  readonly permissionOptions = employeePermissionOptions;
  readonly selectionByEmployee = signal<Record<string, string>>({});
  readonly page = signal(1);

  readonly rows = computed(() =>
    this.employees
      .employees()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((employee) => ({ employee, access: this.access.findByEmployeeId(employee.id) })),
  );
  readonly pagedRows = computed(() => pageItems(this.rows(), this.page()));

  permissionLabel(permission: EmployeePermission): string {
    return this.permissionOptions.find((option) => option.value === permission)?.label ?? permission;
  }

  setSelection(employeeId: string, permission: string): void {
    this.selectionByEmployee.update((current) => ({ ...current, [employeeId]: permission }));
  }

  addPermission(employeeId: string): void {
    const permission = this.selectionByEmployee()[employeeId] as EmployeePermission | undefined;
    if (!permission) return;
    try {
      this.access.setPermission(employeeId, permission, true);
      this.setSelection(employeeId, '');
      this.toast.success('Permissão adicionada.');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível alterar a permissão.');
    }
  }

  removePermission(employeeId: string, permission: EmployeePermission): void {
    try {
      this.access.setPermission(employeeId, permission, false);
      this.toast.info('Permissão removida.');
    } catch (err) {
      this.toast.info(err instanceof Error ? err.message : 'Não foi possível alterar a permissão.');
    }
  }
}

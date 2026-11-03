import { Routes } from '@angular/router';
import { ShellLayout } from './core/layout/shell-layout';
import { StockPage } from './features/estoque/stock.page';
import { HomePage } from './features/home/home.page';
import { ComingSoonPage } from './shared/coming-soon/coming-soon.page';
import { CashPage } from './features/caixa/cash.page';
import { PurchasesPage } from './features/compras/purchases.page';
import { SuppliersPage } from './features/fornecedores/suppliers.page';
import { MenuPage } from './features/pratos-receitas/menu.page';
import { SalesPage } from './features/vendas/sales.page';
import { ExpensesPage } from './features/despesas/expenses.page';
import { EmployeesPage } from './features/funcionarios/employees.page';
import { PayrollPage } from './features/folha/payroll.page';
import { AccessPermissionsPage } from './features/cargos-permissoes/access-permissions.page';
import { LoginPage } from './features/login/login.page';
import { authGuard } from './core/auth/auth.guard';

const comingSoon = (title: string) => ({
  component: ComingSoonPage,
  data: { title },
});

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: '',
    component: ShellLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomePage },
      { path: 'vendas', component: SalesPage },
      { path: 'pratos-receitas', component: MenuPage },
      { path: 'estoque', component: StockPage },
      { path: 'compras', component: PurchasesPage },
      { path: 'fornecedores', component: SuppliersPage },
      { path: 'caixa', component: CashPage },
      { path: 'despesas', component: ExpensesPage },
      { path: 'relatorios-financeiros', ...comingSoon('Relatórios financeiros') },
      { path: 'funcionarios', component: EmployeesPage },
      { path: 'folha', component: PayrollPage },
      { path: 'cargos-permissoes', component: AccessPermissionsPage },
      { path: 'configuracoes', ...comingSoon('Configurações') },
    ],
  },
  { path: '**', redirectTo: '' },
];

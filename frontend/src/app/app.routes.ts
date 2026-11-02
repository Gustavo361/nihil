import { Routes } from '@angular/router';
import { ShellLayout } from './core/layout/shell-layout';
import { StockPage } from './features/estoque/stock.page';
import { HomePage } from './features/home/home.page';
import { ComingSoonPage } from './shared/coming-soon/coming-soon.page';

const comingSoon = (title: string) => ({
  component: ComingSoonPage,
  data: { title },
});

export const routes: Routes = [
  {
    path: '',
    component: ShellLayout,
    children: [
      { path: '', component: HomePage },
      { path: 'vendas', ...comingSoon('Vendas') },
      { path: 'pratos-receitas', ...comingSoon('Pratos e receitas') },
      { path: 'estoque', component: StockPage },
      { path: 'compras', ...comingSoon('Compras') },
      { path: 'fornecedores', ...comingSoon('Fornecedores') },
      { path: 'caixa', ...comingSoon('Caixa') },
      { path: 'despesas', ...comingSoon('Despesas') },
      { path: 'relatorios-financeiros', ...comingSoon('Relatórios financeiros') },
      { path: 'funcionarios', ...comingSoon('Funcionários') },
      { path: 'folha', ...comingSoon('Folha de pagamento') },
      { path: 'cargos-permissoes', ...comingSoon('Cargos e permissões') },
      { path: 'configuracoes', ...comingSoon('Configurações') },
    ],
  },
  { path: '**', redirectTo: '' },
];

import {
  IconCash,
  IconChefHat,
  IconClipboardList,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt,
  IconReportMoney,
  IconSettings,
  IconShoppingCart,
  IconTruck,
  IconUsers,
  IconUserShield,
  IconWallet,
  type TablerIcon,
} from '@tabler/icons-angular';

export interface NavItem {
  label: string;
  path: string;
  icon: TablerIcon;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NIHIL_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [{ label: 'Visão geral', path: '/', icon: IconLayoutDashboard, exact: true }],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Vendas', path: '/vendas', icon: IconShoppingCart },
      { label: 'Pratos e receitas', path: '/pratos-receitas', icon: IconChefHat },
      { label: 'Estoque', path: '/estoque', icon: IconPackage },
      { label: 'Compras', path: '/compras', icon: IconClipboardList },
      { label: 'Fornecedores', path: '/fornecedores', icon: IconTruck },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Caixa', path: '/caixa', icon: IconCash },
      { label: 'Despesas', path: '/despesas', icon: IconReceipt },
      { label: 'Relatórios financeiros', path: '/relatorios-financeiros', icon: IconReportMoney },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Funcionários', path: '/funcionarios', icon: IconUsers },
      { label: 'Folha de pagamento', path: '/folha', icon: IconWallet },
      { label: 'Cargos e permissões', path: '/cargos-permissoes', icon: IconUserShield },
    ],
  },
  {
    label: 'Sistema',
    items: [{ label: 'Configurações', path: '/configuracoes', icon: IconSettings }],
  },
];

import type { UserRole } from '@/types/auth';

export interface MenuSection {
  title: string;
  items: MenuItemConfig[];
}

export interface MenuItemConfig {
  label: string;
  iconName: string;
  path: string;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = ['admin', 'financeiro', 'operador_balanca', 'conferente', 'contador'];

export const menuSections: MenuSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Painel', iconName: 'LayoutDashboard', path: '/', roles: ALL_ROLES },
      { label: 'Chat da Equipe', iconName: 'MessageSquare', path: '/chat', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Operação',
    items: [
      { label: 'Balança / Pesagem', iconName: 'Scale', path: '/balanca', roles: ['admin', 'operador_balanca'] },
      { label: 'Estoque Físico', iconName: 'Warehouse', path: '/estoque-fisico', roles: ['admin', 'conferente', 'operador_balanca'] },
      { label: 'Estoque Fiscal', iconName: 'FileText', path: '/estoque-fiscal', roles: ['admin', 'contador', 'financeiro'] },
      { label: 'Central NF-e / MTR', iconName: 'FileSpreadsheet', path: '/central-emissao', roles: ['admin', 'financeiro'] },
    ],
  },
  {
    title: 'Clientes & Financeiro',
    items: [
      { label: 'Clientes', iconName: 'Users', path: '/clientes', roles: ['admin', 'financeiro', 'operador_balanca'] },
      { label: 'Conta Corrente', iconName: 'Wallet', path: '/conta-corrente', roles: ['admin', 'financeiro'] },
      { label: 'Contas a Pagar', iconName: 'Wallet', path: '/contas-pagar', roles: ['admin', 'financeiro'] },
    ],
  },
  {
    title: 'Compliance & RH',
    items: [
      { label: 'Documentos da Empresa', iconName: 'FileText', path: '/documentos', roles: ['admin', 'financeiro'] },
      { label: 'Funcionários e NRs', iconName: 'Users', path: '/funcionarios', roles: ['admin', 'financeiro'] },
      { label: 'EPIs', iconName: 'Shield', path: '/epis', roles: ['admin', 'financeiro', 'conferente'] },
      { label: 'Máquinas e Laudos', iconName: 'Settings', path: '/maquinas', roles: ['admin', 'financeiro', 'conferente'] },
      { label: 'DDS', iconName: 'ScrollText', path: '/dds', roles: ['admin', 'financeiro', 'conferente', 'operador_balanca'] },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { label: 'Relatórios & BI', iconName: 'BarChart3', path: '/relatorios', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Usuários', iconName: 'Shield', path: '/usuarios', roles: ['admin'] },
      { label: 'Auditoria', iconName: 'ScrollText', path: '/auditoria', roles: ['admin'] },
      { label: 'Configurações', iconName: 'Settings', path: '/configuracoes', roles: ['admin'] },
    ],
  },
];

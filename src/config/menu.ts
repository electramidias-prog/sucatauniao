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
const ADMIN_ONLY: UserRole[] = ['admin'];

export const menuSections: MenuSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Painel', iconName: 'LayoutDashboard', path: '/', roles: ALL_ROLES },
      { label: 'Calendário', iconName: 'Calendar', path: '/calendario', roles: ALL_ROLES },
      { label: 'Chat da Equipe', iconName: 'MessageSquare', path: '/chat', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Operação',
    items: [
      { label: 'Balança / Pesagem', iconName: 'Scale', path: '/balanca', roles: ALL_ROLES },
      { label: 'Estoque Físico', iconName: 'Warehouse', path: '/estoque-fisico', roles: ALL_ROLES },
      { label: 'Estoque Fiscal', iconName: 'FileText', path: '/estoque-fiscal', roles: ALL_ROLES },
      { label: 'Central NF-e / MTR', iconName: 'FileSpreadsheet', path: '/central-emissao', roles: ALL_ROLES },
      { label: 'Calculadora MTR', iconName: 'Calculator', path: '/calculadora-mtr', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Clientes & Financeiro',
    items: [
      { label: 'Clientes', iconName: 'Users', path: '/clientes', roles: ALL_ROLES },
      { label: 'Conta Corrente', iconName: 'Wallet', path: '/conta-corrente', roles: ALL_ROLES },
      { label: 'Transferências', iconName: 'ArrowLeftRight', path: '/transferencias', roles: ALL_ROLES },
      { label: 'Contas a Pagar', iconName: 'Wallet', path: '/contas-pagar', roles: ALL_ROLES },
      { label: 'Faturamento', iconName: 'FileText', path: '/faturamento', roles: ALL_ROLES },
    ],
  },
  {
    title: 'Compliance & RH',
    items: [
      { label: 'Documentos da Empresa', iconName: 'FileText', path: '/documentos', roles: ALL_ROLES },
      { label: 'Funcionários e NRs', iconName: 'Users', path: '/funcionarios', roles: ALL_ROLES },
      { label: 'EPIs', iconName: 'Shield', path: '/epis', roles: ALL_ROLES },
      { label: 'Máquinas e Laudos', iconName: 'Settings', path: '/maquinas', roles: ALL_ROLES },
      { label: 'DDS', iconName: 'ScrollText', path: '/dds', roles: ALL_ROLES },
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
      { label: 'Usuários', iconName: 'Shield', path: '/usuarios', roles: ADMIN_ONLY },
      { label: 'Auditoria', iconName: 'ScrollText', path: '/auditoria', roles: ADMIN_ONLY },
      { label: 'Configurações', iconName: 'Settings', path: '/configuracoes', roles: ADMIN_ONLY },
    ],
  },
];

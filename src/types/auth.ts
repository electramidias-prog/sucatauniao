export type UserRole = 'admin' | 'financeiro' | 'operador_balanca' | 'conferente' | 'contador';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  operador_balanca: 'Operador de Balança',
  conferente: 'Conferente',
  contador: 'Contador',
};

export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  roles: UserRole[];
}

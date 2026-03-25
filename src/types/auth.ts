export type { UserRole, UserProfile } from '@/hooks/useAuth';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  operador_balanca: 'Operador de Balança',
  conferente: 'Conferente',
  contador: 'Contador',
};

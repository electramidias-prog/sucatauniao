import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserProfile, UserRole } from '@/types/auth';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo user for development - will be replaced with Supabase auth
const DEMO_USER: UserProfile = {
  id: '1',
  email: 'admin@sucatauniao.com',
  full_name: 'Administrador',
  role: 'admin',
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for session
    const stored = localStorage.getItem('su_session');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('su_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate login - replace with Supabase auth
    await new Promise((r) => setTimeout(r, 600));
    const u = { ...DEMO_USER, email };
    setUser(u);
    localStorage.setItem('su_session', JSON.stringify(u));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('su_session');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useHasRole(roles: UserRole[]) {
  const { user } = useAuth();
  if (!user) return false;
  return roles.includes(user.role);
}

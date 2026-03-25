import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { menuSections } from '@/config/menu';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, MessageSquare, Scale, Warehouse, FileText,
  Users, Wallet, Calculator, BarChart3, Shield, ScrollText, Settings,
  Recycle, ChevronLeft, ChevronRight, LogOut, Bot, HardHat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, MessageSquare, Scale, Warehouse, FileText,
  Users, Wallet, Calculator, BarChart3, Shield, ScrollText, Settings,
};

interface AppSidebarProps {
  onOpenAna: () => void;
  onOpenCarlinhos: () => void;
}

export function AppSidebar({ onOpenAna, onOpenCarlinhos }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const userRole = user?.role || 'admin';

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border sidebar-transition fixed left-0 top-0 z-30',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="flex items-center h-12 px-3 border-b border-sidebar-border shrink-0">
        <Recycle className="h-5 w-5 text-sidebar-primary shrink-0" />
        {!collapsed && <span className="ml-2 font-bold text-sm truncate">Sucata União</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/60"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              {!collapsed && (
                <p className="text-[10px] uppercase font-semibold text-sidebar-foreground/40 px-2 mb-1 tracking-wider">
                  {section.title}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = iconMap[item.iconName] || LayoutDashboard;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* AI Assistants */}
      <div className="px-1.5 pb-1 space-y-1">
        <button
          onClick={onOpenAna}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
          title="A.N.A. - Assistente"
        >
          <Bot className="h-4 w-4 shrink-0 text-info" />
          {!collapsed && <span>A.N.A.</span>}
        </button>
        <button
          onClick={onOpenCarlinhos}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
          title="Carlinhos - Consultor"
        >
          <HardHat className="h-4 w-4 shrink-0 text-warning" />
          {!collapsed && <span>Carlinhos</span>}
        </button>
      </div>

      {/* User & Logout */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-primary shrink-0">
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.role}</p>
            </div>
          )}
          <button onClick={logout} className="p-1 rounded hover:bg-sidebar-accent" title="Sair">
            <LogOut className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          </button>
        </div>
      </div>
    </aside>
  );
}

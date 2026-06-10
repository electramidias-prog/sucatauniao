import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Shield, Trash2, UserCog, Users, Search, Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  operador_balanca: 'Operador de Balança',
  conferente: 'Conferente',
  contador: 'Contador',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary text-primary-foreground',
  financeiro: 'bg-accent text-accent-foreground',
  operador_balanca: 'bg-info text-info-foreground',
  conferente: 'bg-warning text-warning-foreground',
  contador: 'bg-muted text-muted-foreground',
};

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'operador_balanca', is_admin: false });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    // Get profiles + roles joined
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    if (profiles && roles) {
      const roleMap = new Map(roles.map(r => [r.user_id, r.role]));
      const mapped: UserRow[] = profiles.map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: '', // will be filled if available
        role: roleMap.get(p.user_id) || 'operador_balanca',
        avatar_url: p.avatar_url,
        created_at: p.created_at,
      }));
      setUsers(mapped);
    }
    setLoading(false);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchUsers);

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    return !search || u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const finalRole = form.is_admin ? 'admin' : form.role;
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: form.email, password: form.password, full_name: form.full_name, role: finalRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${form.full_name} criado com sucesso!`);
      setDialogOpen(false);
      setForm({ email: '', password: '', full_name: '', role: 'operador_balanca', is_admin: false });
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message || 'Falha ao criar'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
    if (error) { toast.error('Erro ao alterar cargo'); return; }
    toast.success('Cargo atualizado!');
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) { toast.error('Você não pode remover a si mesmo'); return; }
    if (!confirm('Deseja realmente remover este usuário? Esta ação é irreversível.')) return;
    // Delete via edge function would be needed for auth.users, but we can remove role + profile
    const { error: rErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error: pErr } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (rErr || pErr) { toast.error('Erro ao remover'); return; }
    toast.success('Usuário removido');
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Usuário
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(ROLE_LABELS).map(([key, label]) => (
          <Card key={key}>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{users.filter(u => u.role === key).length}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="pl-8 h-8 text-xs" />
      </div>

      {/* Table */}
      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead>
            <tr className="border-b bg-secondary">
              <th className="text-left text-muted-foreground font-medium">Usuário</th>
              <th className="text-left text-muted-foreground font-medium">Cargo</th>
              <th className="text-left text-muted-foreground font-medium">Criado em</th>
              <th className="text-right text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</td></tr>
            ) : filtered.map(u => (
              <tr key={u.user_id} className="border-b border-border/50">
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{u.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email || '—'}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <Select value={u.role} onValueChange={v => handleChangeRole(u.user_id, v)} disabled={u.user_id === user?.id}>
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="text-right">
                  {u.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteUser(u.user_id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setForm({ email: '', password: '', full_name: '', role: 'operador_balanca', is_admin: false }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs">Nome Completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Senha *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="h-8 text-xs pr-8"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Cargo (descritivo)</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))} disabled={form.is_admin}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Apenas descritivo — não altera permissões.</p>
            </div>
            <div className="flex items-center justify-between rounded border p-2">
              <div>
                <Label className="text-xs">Acesso de Administrador</Label>
                <p className="text-[10px] text-muted-foreground">Pode excluir registros, alterar preços e gerenciar usuários.</p>
              </div>
              <Switch checked={form.is_admin} onCheckedChange={(v) => setForm(p => ({ ...p, is_admin: v }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? 'Criando...' : 'Criar Usuário'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

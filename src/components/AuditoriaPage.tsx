import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, Search, Shield, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  user_name?: string;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  created_at: string;
}

export function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('todos');
  const [filterTable, setFilterTable] = useState('todos');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) {
      const userIds = [...new Set(data.map(l => l.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        (profiles || []).forEach(p => { nameMap[p.user_id] = p.full_name; });
      }
      setLogs(data.map(l => ({ ...l, user_name: l.user_id ? nameMap[l.user_id] || 'Sistema' : 'Sistema' })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const tables = [...new Set(logs.map(l => l.table_name).filter(Boolean))] as string[];
  const actions = [...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l => {
    const s = search.toLowerCase();
    const matchSearch = !search || l.action.toLowerCase().includes(s) || (l.user_name || '').toLowerCase().includes(s) || (l.table_name || '').toLowerCase().includes(s);
    const matchAction = filterAction === 'todos' || l.action === filterAction;
    const matchTable = filterTable === 'todos' || l.table_name === filterTable;
    return matchSearch && matchAction && matchTable;
  });

  const actionBadge = (action: string) => {
    if (action.includes('create') || action.includes('insert')) return <Badge className="badge-finalizado text-[10px]">{action}</Badge>;
    if (action.includes('update')) return <Badge className="badge-pendente text-[10px]">{action}</Badge>;
    if (action.includes('delete')) return <Badge className="badge-bloqueado text-[10px]">{action}</Badge>;
    return <Badge className="badge-aberto text-[10px]">{action}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Registro de todas as ações do sistema</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <ScrollText className="h-8 w-8 text-primary" />
          <div><p className="text-lg font-bold">{logs.length}</p><p className="text-[10px] text-muted-foreground">Total de Registros</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Shield className="h-8 w-8 text-accent" />
          <div><p className="text-lg font-bold">{tables.length}</p><p className="text-[10px] text-muted-foreground">Tabelas Auditadas</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Clock className="h-8 w-8 text-info" />
          <div><p className="text-lg font-bold">{logs.length > 0 ? new Date(logs[0].created_at).toLocaleDateString('pt-BR') : '—'}</p><p className="text-[10px] text-muted-foreground">Último Registro</p></div>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Ações</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Tabelas</SelectItem>
            {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded border overflow-auto">
        <table className="w-full table-dense">
          <thead><tr className="border-b bg-secondary">
            <th className="text-left text-muted-foreground font-medium">Data/Hora</th>
            <th className="text-left text-muted-foreground font-medium">Usuário</th>
            <th className="text-left text-muted-foreground font-medium">Ação</th>
            <th className="text-left text-muted-foreground font-medium">Tabela</th>
            <th className="text-left text-muted-foreground font-medium">ID Registro</th>
            <th className="text-left text-muted-foreground font-medium">IP</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                <td className="font-medium">{l.user_name}</td>
                <td>{actionBadge(l.action)}</td>
                <td className="font-mono text-muted-foreground">{l.table_name || '—'}</td>
                <td className="font-mono text-[10px] text-muted-foreground">{l.record_id ? l.record_id.slice(0, 8) + '...' : '—'}</td>
                <td className="text-muted-foreground">{l.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

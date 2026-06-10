import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, ShieldAlert, ShieldCheck, Users, CalendarDays, FileText, Search, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Mode = { id: string; mode: string; reason: string | null; description: string | null; start_date: string; expected_end_date: string | null; ended_at: string | null; created_at: string };
type Theme = { id: string; title: string; category: string; description: string | null; last_addressed_at: string | null };
type Session = { id: string; session_date: string; session_time: string | null; frequency_type: string; theme_id: string | null; theme_title: string; category: string | null; supervisor_id: string | null; location: string | null; duration_minutes: number | null; summary: string | null; attendance_photo_url: string | null; ata_pdf_url: string | null; created_at: string };
type Employee = { id: string; full_name: string; status: string };

const CATEGORIES = ['Ergonomia','EPI','Manuseio de máquinas','Trabalho em altura','Espaços confinados','Higiene pessoal','Saúde mental','Prevenção de incêndio','Primeiros socorros','Riscos químicos','Trânsito interno','Pós-incidente','Outros'];
const LOCATIONS = ['Pátio','Escritório','Balança','Frota','Geral'];
const REASONS = ['Incidente','Mudança Operacional','Novo Equipamento','Alerta de Risco','Outro'];

export function DDSPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManage = !!user;

  const [mode, setMode] = useState<Mode | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState('');
  const [filterFreq, setFilterFreq] = useState<string>('all');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterSup, setFilterSup] = useState<string>('all');

  // modals
  const [modeOpen, setModeOpen] = useState(false);
  const [modeReason, setModeReason] = useState(REASONS[0]);
  const [modeDesc, setModeDesc] = useState('');
  const [modeEndDate, setModeEndDate] = useState('');

  const [sessionOpen, setSessionOpen] = useState(false);
  const [s_date, setSDate] = useState(format(new Date(),'yyyy-MM-dd'));
  const [s_time, setSTime] = useState('08:00');
  const [s_freq, setSFreq] = useState<'semanal'|'diario'>('semanal');
  const [s_themeId, setSThemeId] = useState<string>('custom');
  const [s_themeTitle, setSThemeTitle] = useState('');
  const [s_category, setSCategory] = useState(CATEGORIES[0]);
  const [s_supervisor, setSSupervisor] = useState<string>('');
  const [s_location, setSLocation] = useState(LOCATIONS[0]);
  const [s_duration, setSDuration] = useState<number>(15);
  const [s_summary, setSSummary] = useState('');
  const [s_attendees, setSAttendees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [m, t, ss, em] = await Promise.all([
      supabase.from('dds_operation_mode').select('*').is('ended_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('dds_themes').select('*').order('category').order('title'),
      supabase.from('dds_sessions').select('*').order('session_date', { ascending: false }).limit(500),
      supabase.from('employees').select('id, full_name, status').eq('status','ativo').order('full_name'),
    ]);
    if (m.data) setMode(m.data as Mode);
    if (t.data) setThemes(t.data as Theme[]);
    if (ss.data) setSessions(ss.data as Session[]);
    if (em.data) setEmployees(em.data as Employee[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (mode) setSFreq(mode.mode === 'diario' ? 'diario' : 'semanal');
  }, [mode]);

  // KPIs
  const kpi = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now), end = endOfMonth(now);
    const monthSessions = sessions.filter(s => {
      const d = parseISO(s.session_date);
      return d >= start && d <= end;
    });
    const next = sessions.find(s => parseISO(s.session_date) >= now);
    const expected = mode?.mode === 'diario'
      ? differenceInDays(now, start) + 1
      : Math.ceil((differenceInDays(now, start) + 1) / 7);
    const aderencia = expected > 0 ? Math.min(100, Math.round((monthSessions.length / expected) * 100)) : 100;
    return { monthCount: monthSessions.length, next, aderencia };
  }, [sessions, mode]);

  // Heatmap
  const heatmap = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
    return days.map(d => {
      const has = sessions.some(s => isSameDay(parseISO(s.session_date), d));
      return { date: d, has };
    });
  }, [sessions]);

  // Filtered table
  const filtered = useMemo(() => sessions.filter(s => {
    if (filterFreq !== 'all' && s.frequency_type !== filterFreq) return false;
    if (filterCat !== 'all' && s.category !== filterCat) return false;
    if (filterSup !== 'all' && s.supervisor_id !== filterSup) return false;
    if (search && !`${s.theme_title} ${s.category||''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sessions, filterFreq, filterCat, filterSup, search]);

  const empName = (id: string | null) => employees.find(e => e.id === id)?.full_name || '—';

  // Toggle mode
  const switchMode = async (newMode: 'semanal' | 'diario') => {
    if (!isAdmin) return toast.error('Sem permissão');
    if (newMode === 'diario') { setModeOpen(true); return; }
    // back to weekly: end current, insert weekly
    if (mode?.id) await supabase.from('dds_operation_mode').update({ ended_at: new Date().toISOString() }).eq('id', mode.id);
    const { error } = await supabase.from('dds_operation_mode').insert({ mode: 'semanal', reason: 'retorno', description: 'Retorno ao modo semanal', created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success('Modo alterado para Semanal');
    fetchAll();
  };

  const confirmDailyMode = async () => {
    if (mode?.id) await supabase.from('dds_operation_mode').update({ ended_at: new Date().toISOString() }).eq('id', mode.id);
    const { error } = await supabase.from('dds_operation_mode').insert({
      mode: 'diario', reason: modeReason, description: modeDesc,
      expected_end_date: modeEndDate || null, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Modo intensificado: DIÁRIO');
    setModeOpen(false); setModeDesc(''); setModeEndDate('');
    fetchAll();
  };

  const openNewSession = () => {
    setSDate(format(new Date(),'yyyy-MM-dd'));
    setSTime('08:00');
    setSFreq(mode?.mode === 'diario' ? 'diario' : 'semanal');
    setSThemeId('custom'); setSThemeTitle(''); setSCategory(CATEGORIES[0]);
    setSSupervisor(''); setSLocation(LOCATIONS[0]); setSDuration(15);
    setSSummary(''); setSAttendees([]);
    setSessionOpen(true);
  };

  const onPickTheme = (id: string) => {
    setSThemeId(id);
    if (id !== 'custom') {
      const t = themes.find(x => x.id === id);
      if (t) { setSThemeTitle(t.title); setSCategory(t.category); }
    }
  };

  const saveSession = async () => {
    if (!s_themeTitle.trim()) return toast.error('Informe o tema');
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dds_sessions').insert({
        session_date: s_date, session_time: s_time, frequency_type: s_freq,
        theme_id: s_themeId === 'custom' ? null : s_themeId,
        theme_title: s_themeTitle, category: s_category,
        supervisor_id: s_supervisor || null, location: s_location,
        duration_minutes: s_duration, summary: s_summary,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      if (s_attendees.length) {
        await supabase.from('dds_attendance').insert(s_attendees.map(eid => ({ session_id: data.id, employee_id: eid, present: true })));
      }
      if (s_themeId !== 'custom') {
        await supabase.from('dds_themes').update({ last_addressed_at: new Date().toISOString() }).eq('id', s_themeId);
      }
      // Calendar integration
      await supabase.from('calendar_events').insert({
        title: `🦺 DDS - ${s_themeTitle}`,
        description: s_summary || null,
        event_date: s_date, event_time: s_time,
        category: 'dds', created_by: user?.id,
      });
      toast.success('DDS registrado com sucesso');
      setSessionOpen(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const toggleAttendee = (id: string) => setSAttendees(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id]);

  const isDaily = mode?.mode === 'diario';

  return (
    <div className="p-4 space-y-4">
      {/* Mode toggle */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center',
              isDaily ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
              {isDaily ? <ShieldAlert className="h-5 w-5"/> : <ShieldCheck className="h-5 w-5"/>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modo de Operação atual</p>
              <p className="font-bold text-sm">{isDaily ? '🔴 DIÁRIO (alerta ativo)' : '🟢 SEMANAL (padrão)'}</p>
              {isDaily && mode?.reason && <p className="text-[11px] text-muted-foreground">Motivo: {mode.reason} • Retorno previsto: {mode.expected_end_date || '—'}</p>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button size="sm" variant={!isDaily?'default':'outline'} onClick={()=>switchMode('semanal')}>Semanal</Button>
              <Button size="sm" variant={isDaily?'destructive':'outline'} onClick={()=>switchMode('diario')}>Diário</Button>
              <Button size="sm" onClick={openNewSession}><Plus className="h-4 w-4 mr-1"/>Novo DDS</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3"/>DDS este mês</div><p className="text-2xl font-bold">{kpi.monthCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3"/>Funcionários treinados (mês)</div><p className="text-2xl font-bold">—</p><p className="text-[10px] text-muted-foreground">via presença</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3 w-3"/>Próximo DDS</div><p className="text-sm font-bold">{kpi.next ? format(parseISO(kpi.next.session_date), "dd/MM 'às' ", { locale: ptBR }) + (kpi.next.session_time||'') : '—'}</p></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3"/>Aderência</div><p className={cn('text-2xl font-bold', kpi.aderencia >= 80 ? 'text-success' : kpi.aderencia >= 50 ? 'text-warning' : 'text-destructive')}>{kpi.aderencia}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="sessoes">
        <TabsList>
          <TabsTrigger value="sessoes">Sessões</TabsTrigger>
          <TabsTrigger value="biblioteca">Biblioteca de Temas</TabsTrigger>
          <TabsTrigger value="heatmap">Calendário</TabsTrigger>
        </TabsList>

        <TabsContent value="sessoes" className="space-y-3">
          <Card>
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"/>
                <Input className="pl-7 h-9" placeholder="Buscar tema..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <Select value={filterFreq} onValueChange={setFilterFreq}>
                <SelectTrigger className="w-32 h-9"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="all">Toda freq.</SelectItem><SelectItem value="semanal">Semanal</SelectItem><SelectItem value="diario">Diário</SelectItem></SelectContent>
              </Select>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-44 h-9"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas categorias</SelectItem>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSup} onValueChange={setFilterSup}>
                <SelectTrigger className="w-44 h-9"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos encarregados</SelectItem>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Tema</TableHead><TableHead>Categoria</TableHead>
                  <TableHead>Freq.</TableHead><TableHead>Encarregado</TableHead>
                  <TableHead>Local</TableHead><TableHead>Duração</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow> :
                   filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum DDS registrado</TableCell></TableRow> :
                   filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{format(parseISO(s.session_date),'dd/MM/yyyy')} {s.session_time||''}</TableCell>
                      <TableCell className="text-xs font-medium">{s.theme_title}</TableCell>
                      <TableCell className="text-xs">{s.category||'—'}</TableCell>
                      <TableCell><Badge variant={s.frequency_type==='diario'?'destructive':'secondary'} className="text-[10px]">{s.frequency_type}</Badge></TableCell>
                      <TableCell className="text-xs">{empName(s.supervisor_id)}</TableCell>
                      <TableCell className="text-xs">{s.location||'—'}</TableCell>
                      <TableCell className="text-xs">{s.duration_minutes||0} min</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biblioteca">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {themes.map(t => {
              const days = t.last_addressed_at ? differenceInDays(new Date(), parseISO(t.last_addressed_at)) : null;
              const recommended = days === null || days > 90;
              return (
                <Card key={t.id}>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-start justify-between gap-2">
                      <span>{t.title}</span>
                      {recommended && <Badge className="bg-success text-success-foreground shrink-0 text-[10px]">Recomendado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-1">
                    <p><Badge variant="outline" className="text-[10px]">{t.category}</Badge></p>
                    {t.description && <p className="line-clamp-2">{t.description}</p>}
                    <p className="text-[10px]">Última vez: {t.last_addressed_at ? format(parseISO(t.last_addressed_at),'dd/MM/yyyy') : 'Nunca'}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader className="p-3"><CardTitle className="text-sm">{format(new Date(),"MMMM 'de' yyyy",{locale:ptBR})}</CardTitle></CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
                {['D','S','T','Q','Q','S','S'].map((d,i)=><div key={i}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({length: getDay(heatmap[0]?.date || new Date())}).map((_,i)=><div key={'b'+i}/>)}
                {heatmap.map(({date, has}) => {
                  const isPast = date <= new Date();
                  const missing = isDaily && isPast && !has;
                  return (
                    <div key={date.toISOString()} className={cn(
                      'aspect-square rounded text-[10px] flex items-center justify-center font-medium',
                      has ? 'bg-success/30 text-success-foreground' :
                      missing ? 'bg-destructive/30 text-destructive' :
                      'bg-muted text-muted-foreground'
                    )}>{format(date,'d')}</div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily mode dialog */}
      <Dialog open={modeOpen} onOpenChange={setModeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Intensificar para modo DIÁRIO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Motivo</Label>
              <Select value={modeReason} onValueChange={setModeReason}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{REASONS.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={modeDesc} onChange={e=>setModeDesc(e.target.value)}/></div>
            <div><Label>Data prevista para retornar ao semanal</Label><Input type="date" value={modeEndDate} onChange={e=>setModeEndDate(e.target.value)}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setModeOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDailyMode}>Ativar Diário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New session dialog */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo DDS</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={s_date} onChange={e=>setSDate(e.target.value)}/></div>
            <div><Label>Hora</Label><Input type="time" value={s_time} onChange={e=>setSTime(e.target.value)}/></div>
            <div className="col-span-2 flex gap-4 items-center">
              <Label>Frequência:</Label>
              <label className="flex items-center gap-1 text-sm"><input type="radio" checked={s_freq==='semanal'} onChange={()=>setSFreq('semanal')}/>Semanal</label>
              <label className="flex items-center gap-1 text-sm"><input type="radio" checked={s_freq==='diario'} onChange={()=>setSFreq('diario')}/>Diário</label>
            </div>
            <div className="col-span-2"><Label>Tema</Label>
              <Select value={s_themeId} onValueChange={onPickTheme}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">+ Tema personalizado</SelectItem>
                  {themes.map(t=><SelectItem key={t.id} value={t.id}>{t.title} ({t.category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Título do tema</Label><Input value={s_themeTitle} onChange={e=>setSThemeTitle(e.target.value)}/></div>
            <div><Label>Categoria</Label>
              <Select value={s_category} onValueChange={setSCategory}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Encarregado</Label>
              <Select value={s_supervisor} onValueChange={setSSupervisor}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Local</Label>
              <Select value={s_location} onValueChange={setSLocation}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{LOCATIONS.map(l=><SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duração (min)</Label><Input type="number" value={s_duration} onChange={e=>setSDuration(parseInt(e.target.value)||0)}/></div>
            <div className="col-span-2"><Label>Resumo</Label><Textarea rows={3} value={s_summary} onChange={e=>setSSummary(e.target.value)}/></div>
            <div className="col-span-2">
              <Label>Participantes ({s_attendees.length})</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                {employees.map(e => (
                  <label key={e.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted p-1 rounded">
                    <input type="checkbox" checked={s_attendees.includes(e.id)} onChange={()=>toggleAttendee(e.id)}/>
                    {e.full_name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setSessionOpen(false)}>Cancelar</Button>
            <Button onClick={saveSession} disabled={saving}>{saving?'Salvando...':'Salvar DDS'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

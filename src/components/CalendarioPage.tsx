import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus, FileText, Wallet, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type EventType = 'bill' | 'document' | 'manual';

interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  amount?: number | null;
  category?: string | null;
  status?: string | null;
  description?: string | null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function diffDays(target: string) {
  const t = new Date(target + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function dotColor(dateStr: string): string {
  const d = diffDays(dateStr);
  if (d <= 0) return 'bg-destructive';
  if (d <= 7) return 'bg-orange-500';
  if (d <= 30) return 'bg-yellow-400';
  return 'bg-success';
}

export function CalendarioPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showBills, setShowBills] = useState(true);
  const [showDocs, setShowDocs] = useState(true);
  const [showManual, setShowManual] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', event_date: fmtDate(new Date()), event_time: '',
    description: '', category: 'lembrete', reminder_days: '1',
  });

  const fetchAll = useCallback(async () => {
    const [billsRes, docsRes, eventsRes] = await Promise.all([
      supabase.from('bills').select('id, description, due_date, amount, category, status').neq('status', 'pago'),
      supabase.from('company_documents').select('id, name, expiry_date, category').not('expiry_date', 'is', null),
      supabase.from('calendar_events').select('*'),
    ]);

    const list: CalEvent[] = [];
    (billsRes.data || []).forEach((b: any) => list.push({
      id: 'bill:' + b.id, type: 'bill', title: b.description, date: b.due_date,
      amount: Number(b.amount || 0), category: b.category, status: b.status,
    }));
    (docsRes.data || []).forEach((d: any) => list.push({
      id: 'doc:' + d.id, type: 'document', title: d.name, date: d.expiry_date,
      category: d.category,
    }));
    (eventsRes.data || []).forEach((e: any) => list.push({
      id: 'manual:' + e.id, type: 'manual', title: e.title, date: e.event_date,
      time: e.event_time, description: e.description, category: e.category,
    }));
    setEvents(list);
  }, []);

  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(fetchAll);

  const filtered = useMemo(() => events.filter((e) =>
    (e.type === 'bill' && showBills) ||
    (e.type === 'document' && showDocs) ||
    (e.type === 'manual' && showManual)
  ), [events, showBills, showDocs, showManual]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of filtered) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [filtered]);

  // Build calendar grid: 6 weeks
  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const dayEvents = eventsByDay[selectedDate] || [];
  const todayStr = fmtDate(new Date());

  const handleCreate = async () => {
    if (!form.title.trim() || !user) {
      toast.error('Preencha o título.');
      return;
    }
    const { error } = await supabase.from('calendar_events').insert({
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      description: form.description || null,
      category: form.category,
      reminder_days: parseInt(form.reminder_days, 10) || 1,
      created_by: user.id,
    });
    if (error) {
      toast.error('Erro ao criar evento');
      return;
    }
    toast.success('Evento criado');
    setModalOpen(false);
    setForm({ title: '', event_date: fmtDate(new Date()), event_time: '', description: '', category: 'lembrete', reminder_days: '1' });
    refresh();
  };

  const goToDetails = (e: CalEvent) => {
    if (e.type === 'bill') navigate('/contas-pagar');
    else if (e.type === 'document') navigate('/documentos');
  };

  const typeIcon = (t: EventType) => {
    if (t === 'bill') return <Wallet className="h-4 w-4 text-orange-500" />;
    if (t === 'document') return <FileText className="h-4 w-4 text-info" />;
    return <CalendarDays className="h-4 w-4 text-success" />;
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Calendário</h1>
        <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
      </div>

      {/* Filters & action */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={showBills} onCheckedChange={(v) => setShowBills(!!v)} />
          <span>Contas a Pagar</span>
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={showDocs} onCheckedChange={(v) => setShowDocs(!!v)} />
          <span>Documentos</span>
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={showManual} onCheckedChange={(v) => setShowManual(!!v)} />
          <span>Eventos Manuais</span>
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" />Vencido/hoje</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />7 dias</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />30 dias</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />+30 dias</span>
          </div>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Novo Evento Manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Evento Manual</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Hora (opcional)</Label>
                    <Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lembrete">Lembrete</SelectItem>
                        <SelectItem value="reuniao">Reunião</SelectItem>
                        <SelectItem value="tarefa">Tarefa</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lembrete antes</Label>
                    <Select value={form.reminder_days} onValueChange={(v) => setForm({ ...form, reminder_days: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No dia</SelectItem>
                        <SelectItem value="1">1 dia antes</SelectItem>
                        <SelectItem value="3">3 dias antes</SelectItem>
                        <SelectItem value="7">1 semana antes</SelectItem>
                        <SelectItem value="15">15 dias antes</SelectItem>
                        <SelectItem value="30">30 dias antes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Body: 70/30 split */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
        {/* Calendar */}
        <Card className="lg:col-span-7 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => { const t = new Date(); setCursor(startOfMonth(t)); setSelectedDate(fmtDate(t)); }}>
                Hoje
              </Button>
            </div>
            <div className="text-sm font-semibold">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
            <div className="w-[140px]" />
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-muted-foreground mb-1">
            {WEEKDAYS.map((w) => <div key={w} className="text-center">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d) => {
              const ds = fmtDate(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const dayEvts = eventsByDay[ds] || [];
              return (
                <button
                  key={ds}
                  onClick={() => setSelectedDate(ds)}
                  className={cn(
                    'aspect-square min-h-[60px] border rounded p-1 text-left flex flex-col transition-colors',
                    inMonth ? 'bg-card' : 'bg-muted/40 text-muted-foreground',
                    isSelected && 'ring-2 ring-primary',
                    isToday && 'border-primary',
                  )}
                >
                  <span className={cn('text-xs font-medium', isToday && 'text-primary font-bold')}>{d.getDate()}</span>
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {dayEvts.slice(0, 6).map((e) => (
                      <span key={e.id} className={cn('h-1.5 w-1.5 rounded-full', dotColor(e.date))} title={e.title} />
                    ))}
                    {dayEvts.length > 6 && <span className="text-[9px] text-muted-foreground">+{dayEvts.length - 6}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Side panel */}
        <Card className="lg:col-span-3 p-3 flex flex-col">
          <h2 className="text-sm font-bold mb-2">
            Eventos de {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </h2>
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
            {dayEvents.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum evento neste dia.</p>
            )}
            {dayEvents.map((e) => (
              <div key={e.id} className="border rounded p-2 space-y-1">
                <div className="flex items-center gap-2">
                  {typeIcon(e.type)}
                  <span className="text-xs font-semibold flex-1 truncate">{e.title}</span>
                  <span className={cn('h-2 w-2 rounded-full', dotColor(e.date))} />
                </div>
                {e.amount != null && (
                  <div className="text-xs text-muted-foreground">
                    R$ {e.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                )}
                {e.category && (
                  <div className="text-[11px] text-muted-foreground">{e.category}</div>
                )}
                {e.time && (
                  <div className="text-[11px] text-muted-foreground">{e.time.slice(0, 5)}</div>
                )}
                {e.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{e.description}</div>
                )}
                {e.type !== 'manual' && (
                  <Button size="sm" variant="outline" className="h-6 w-full text-[11px]" onClick={() => goToDetails(e)}>
                    Ir para detalhes
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
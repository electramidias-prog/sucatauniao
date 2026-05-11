import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
  Download, Database, Search, X, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'matching' | 'fila';

interface SicoobRow {
  data: string;
  historico: string;
  destinatario: string;
  cpf_cnpj: string;
  instituicao: string;
  valor: number;
}

interface ClientRow {
  id: string;
  name: string;
  nickname: string | null;
  document_number: string;
  vehicle_plate: string | null;
}

interface MatchedLine {
  origem: SicoobRow;
  client_id: string | null;
  client_name: string;
  cpf_cnpj: string;
  vehicle_plate: string;
  peso: number;
  classificacao: string;
  matched_auto: boolean;
}

const MATERIAIS = [
  { value: 'mista', label: 'Sucata Mista' },
  { value: 'pesada', label: 'Sucata Pesada' },
  { value: 'limaria', label: 'Limaria' },
  { value: 'fundido', label: 'Fundido' },
  { value: 'amortecedor', label: 'Amortecedor' },
];

const HEADER_HINTS = ['data movimento', 'historico', 'destinatario', 'cpf/cnpj do destinatario', 'instituicao', 'valor'];

function normalize(str: string): string {
  return (str ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValor(raw: any): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? Math.abs(n) : 0;
}

function parseData(raw: any): string {
  if (!raw) return '';
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function dataBR(iso: string): string {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CentralEmissaoPage() {
  const [step, setStep] = useState<Step>('upload');

  // Etapa 1
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<SicoobRow[]>([]);
  const [pricePerKg, setPricePerKg] = useState('');
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Etapa 2/3
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [matched, setMatched] = useState<MatchedLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem('nfe_price_history') || '[]');
      if (Array.isArray(h)) setPriceHistory(h);
    } catch { /* ignore */ }
  }, []);

  const refreshClients = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, nickname, document_number, vehicle_plate');
    if (data) setClients(data as ClientRow[]);
  }, []);
  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(refreshClients);

  const savePrice = (price: number) => {
    const next = [price, ...priceHistory.filter(p => p !== price)].slice(0, 10);
    setPriceHistory(next);
    localStorage.setItem('nfe_price_history', JSON.stringify(next));
  };

  // ─── Etapa 1: parse ───
  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

      // localizar linha de header (a partir da linha 10, varrendo até 30)
      let headerIdx = -1;
      let headerMap: Record<string, number> = {};
      for (let i = 10; i < Math.min(grid.length, 35); i++) {
        const row = grid[i] || [];
        const norm = row.map((c: any) => normalize(String(c)));
        const hits = HEADER_HINTS.filter(h => norm.includes(h)).length;
        if (hits >= 4) {
          headerIdx = i;
          norm.forEach((c: string, idx: number) => { headerMap[c] = idx; });
          break;
        }
      }
      if (headerIdx === -1) {
        toast.error('Não foi possível localizar o cabeçalho do extrato SICOOB.');
        return;
      }

      const idxData = headerMap['data movimento'];
      const idxHist = headerMap['historico'];
      const idxDest = headerMap['destinatario'];
      const idxDoc = headerMap['cpf/cnpj do destinatario'];
      const idxInst = headerMap['instituicao'];
      const idxVal = headerMap['valor'];

      const out: SicoobRow[] = [];
      for (let i = headerIdx + 1; i < grid.length; i++) {
        const r = grid[i] || [];
        const dest = String(r[idxDest] ?? '').trim();
        const valor = parseValor(r[idxVal]);
        if (!dest || !valor) continue;
        out.push({
          data: parseData(r[idxData]),
          historico: String(r[idxHist] ?? '').trim(),
          destinatario: dest,
          cpf_cnpj: String(r[idxDoc] ?? '').trim(),
          instituicao: String(r[idxInst] ?? '').trim(),
          valor,
        });
      }

      if (out.length === 0) {
        toast.error('Nenhuma linha válida encontrada após o cabeçalho.');
        return;
      }

      setFileName(file.name);
      setRawRows(out);
      toast.success(`${out.length} lançamentos carregados.`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler arquivo: ' + (e?.message || 'desconhecido'));
    }
  };

  const totalValor = useMemo(() => rawRows.reduce((s, r) => s + r.valor, 0), [rawRows]);

  const goMatching = async () => {
    const price = parseFloat(pricePerKg.replace(',', '.'));
    if (!rawRows.length || !price || price <= 0) {
      toast.error('Carregue um arquivo e informe o preço por kg.');
      return;
    }
    savePrice(price);

    const { data, error } = await supabase
      .from('clients')
      .select('id, name, nickname, document_number, vehicle_plate');
    if (error) {
      toast.error('Erro ao carregar clientes: ' + error.message);
      return;
    }
    setClients((data || []) as ClientRow[]);

    // matching
    const idx = new Map<string, ClientRow>();
    (data || []).forEach((c: any) => {
      idx.set(normalize(c.name), c);
      if (c.nickname) idx.set(normalize(c.nickname), c);
    });

    const lines: MatchedLine[] = rawRows.map(r => {
      const c = idx.get(normalize(r.destinatario));
      return {
        origem: r,
        client_id: c?.id ?? null,
        client_name: c?.name ?? r.destinatario,
        cpf_cnpj: c?.document_number ?? r.cpf_cnpj ?? '',
        vehicle_plate: c?.vehicle_plate ?? '',
        peso: Number((r.valor / price).toFixed(3)),
        classificacao: 'mista',
        matched_auto: !!c,
      };
    });
    setMatched(lines);
    setStep('matching');
  };

  // ─── Etapa 2: helpers ───
  const updateLine = (i: number, patch: Partial<MatchedLine>) => {
    setMatched(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const selectClient = (i: number, c: ClientRow) => {
    updateLine(i, {
      client_id: c.id,
      client_name: c.name,
      cpf_cnpj: c.document_number,
      vehicle_plate: c.vehicle_plate ?? '',
    });
  };

  const removeLine = (i: number) => {
    setMatched(prev => prev.filter((_, idx) => idx !== i));
  };

  const matchedCount = matched.filter(l => l.client_id).length;
  const allMatched = matched.length > 0 && matchedCount === matched.length;

  // ─── Etapa 3: exports ───
  const exportNFe = () => {
    const header = ['Nome', 'CPF_CNPJ', 'Data', 'Peso_KG', 'Valor_RS', 'Classificacao', 'Placa'];
    const rows = matched.filter(l => l.client_id).map(l => [
      l.client_name,
      l.cpf_cnpj,
      dataBR(l.origem.data),
      l.peso.toFixed(3).replace('.', ','),
      l.origem.valor.toFixed(2).replace('.', ','),
      MATERIAIS.find(m => m.value === l.classificacao)?.label ?? l.classificacao,
      l.vehicle_plate,
    ]);
    downloadCSV(`nfe_${Date.now()}.csv`, [header, ...rows]);
  };

  const exportMTR = () => {
    const header = ['CPF_CNPJ_Gerador', 'Nome_Gerador', 'Placa_Veiculo', 'Tipo_Residuo', 'Peso_KG', 'Data_Coleta'];
    const rows = matched.filter(l => l.client_id).map(l => [
      l.cpf_cnpj,
      l.client_name,
      l.vehicle_plate,
      MATERIAIS.find(m => m.value === l.classificacao)?.label ?? l.classificacao,
      l.peso.toFixed(3).replace('.', ','),
      dataBR(l.origem.data),
    ]);
    downloadCSV(`mtr_${Date.now()}.csv`, [header, ...rows]);
  };

  const registrarSistema = async () => {
    const ready = matched.filter(l => l.client_id);
    if (ready.length === 0) {
      toast.error('Nenhuma linha pronta para registrar.');
      return;
    }
    setSaving(true);
    const price = parseFloat(pricePerKg.replace(',', '.'));
    const { data: { user } } = await supabase.auth.getUser();

    const payload = ready.map(l => ({
      client_id: l.client_id!,
      vehicle_plate: l.vehicle_plate || null,
      material_type: l.classificacao,
      gross_weight: l.peso,
      tare_weight: 0,
      net_weight: l.peso,
      price_per_kg: price,
      total_value: l.origem.valor,
      status: 'pago',
      notes: `Importado SICOOB ${dataBR(l.origem.data)}`,
      created_by: user?.id ?? null,
    }));

    const { error } = await supabase.from('weighings').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
      return;
    }
    toast.success(`${payload.length} pesagens registradas.`);
    // reset
    setStep('upload');
    setFileName('');
    setRawRows([]);
    setPricePerKg('');
    setMatched([]);
  };

  // ─── Render ───
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Central de Emissão NF-e / MTR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe o extrato SICOOB, cruze com clientes e gere os arquivos de emissão.
          </p>
        </div>
        <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {(['upload', 'matching', 'fila'] as Step[]).map((s, i) => {
          const active = step === s;
          const done = (step === 'matching' && s === 'upload') || (step === 'fila' && s !== 'fila');
          const labels = { upload: '1. Upload', matching: '2. Matching', fila: '3. Fila' };
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold border',
                active && 'bg-primary text-primary-foreground border-primary',
                done && !active && 'bg-success/10 text-success border-success/30',
                !active && !done && 'bg-muted text-muted-foreground border-border'
              )}>
                {labels[s]}
              </div>
              {i < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* ───── ETAPA 1 ───── */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload do Extrato SICOOB</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {fileName || 'Arraste o arquivo .xlsx ou clique para selecionar'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Extrato SICOOB exportado em Excel
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            {rawRows.length > 0 && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary">{rawRows.length} lançamentos</Badge>
                  <Badge variant="outline">
                    Total: R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>

                <div className="border rounded-md max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Instituição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawRows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{dataBR(r.data)}</TableCell>
                          <TableCell className="text-xs">{r.destinatario}</TableCell>
                          <TableCell className="text-xs">{r.cpf_cnpj}</TableCell>
                          <TableCell className="text-xs">{r.instituicao}</TableCell>
                          <TableCell className="text-xs text-right">
                            R$ {r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rawRows.length > 50 && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      Exibindo 50 de {rawRows.length} linhas
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Preço Base R$/kg</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 1,25"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="max-w-xs"
              />
              {priceHistory.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground self-center">Recentes:</span>
                  {priceHistory.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPricePerKg(String(p))}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                    >
                      R$ {p.toFixed(2).replace('.', ',')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={goMatching} disabled={!rawRows.length || !pricePerKg}>
                Avançar para Matching <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───── ETAPA 2 ───── */}
      {step === 'matching' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Matching com Clientes</CardTitle>
              <Badge variant={allMatched ? 'default' : 'secondary'}>
                {matchedCount} de {matched.length} casados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Destinatário (extrato)</TableHead>
                    <TableHead>Cliente Sistema</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Peso (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((l, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        l.client_id && l.matched_auto && 'bg-success/5',
                        !l.client_id && 'bg-destructive/5',
                      )}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeLine(i)}
                          title="Remover linha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        {l.client_id
                          ? <CheckCircle2 className="h-4 w-4 text-success" />
                          : <AlertCircle className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{l.origem.destinatario}</div>
                        <div className="text-muted-foreground">{dataBR(l.origem.data)}</div>
                      </TableCell>
                      <TableCell>
                        <ClientPicker
                          clients={clients}
                          value={l.client_id}
                          label={l.client_id ? l.client_name : 'Selecionar cliente...'}
                          onSelect={(c) => selectClient(i, c)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={l.cpf_cnpj}
                          onChange={(e) => updateLine(i, { cpf_cnpj: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={l.vehicle_plate}
                          onChange={(e) => updateLine(i, { vehicle_plate: e.target.value.toUpperCase() })}
                          className="h-8 text-xs w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        R$ {l.origem.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.001"
                          value={l.peso}
                          onChange={(e) => updateLine(i, { peso: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs w-24 text-right ml-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep('fila')} disabled={matched.length === 0}>
                Avançar para Fila de Emissão <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───── ETAPA 3 ───── */}
      {step === 'fila' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fila de Emissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">R$/kg</TableHead>
                    <TableHead className="text-right">Peso (kg)</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((l, i) => {
                    const ready = !!l.classificacao;
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{dataBR(l.origem.data)}</TableCell>
                        <TableCell className="text-xs font-medium">{l.client_name}</TableCell>
                        <TableCell className="text-xs">{l.cpf_cnpj}</TableCell>
                        <TableCell className="text-xs">{l.vehicle_plate || '—'}</TableCell>
                        <TableCell className="text-xs text-right">
                          R$ {l.origem.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {parseFloat(pricePerKg.replace(',', '.')).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-right">{l.peso.toFixed(3)}</TableCell>
                        <TableCell>
                          <Select
                            value={l.classificacao}
                            onValueChange={(v) => updateLine(i, { classificacao: v })}
                          >
                            <SelectTrigger className="h-8 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MATERIAIS.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ready ? 'default' : 'secondary'}>
                            {ready ? 'Pronto' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('matching')}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportNFe}>
                  <Download className="h-4 w-4" /> Exportar NF-e (CSV)
                </Button>
                <Button variant="outline" onClick={exportMTR}>
                  <Download className="h-4 w-4" /> Exportar MTR (CSV)
                </Button>
                <Button onClick={registrarSistema} disabled={saving}>
                  <Database className="h-4 w-4" />
                  {saving ? 'Registrando...' : 'Registrar no Sistema'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Combobox de cliente ───
function ClientPicker({
  clients, value, label, onSelect,
}: {
  clients: ClientRow[];
  value: string | null;
  label: string;
  onSelect: (c: ClientRow) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 text-xs justify-start font-normal w-full max-w-[220px]',
            !value && 'text-muted-foreground'
          )}
        >
          <Search className="h-3 w-3" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome, apelido ou CPF/CNPJ..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clients.map(c => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.nickname ?? ''} ${c.document_number}`}
                  onSelect={() => { onSelect(c); setOpen(false); }}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.document_number}{c.nickname ? ` · ${c.nickname}` : ''}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

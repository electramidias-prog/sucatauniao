import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, ArrowRight, Check, X } from 'lucide-react';

interface ImportMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const DB_FIELDS = [
  { key: 'ignorar', label: '— Ignorar —' },
  { key: 'name', label: 'Nome / Razão Social' },
  { key: 'nickname', label: 'Apelido' },
  { key: 'trade_name', label: 'Nome Fantasia' },
  { key: 'document_number', label: 'CPF / CNPJ' },
  { key: 'rg', label: 'RG' },
  { key: 'birth_date', label: 'Data de Nascimento' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'vehicle_plate', label: 'Placa do Veículo' },
  { key: 'address_street', label: 'Rua / Avenida' },
  { key: 'address_number', label: 'Nº' },
  { key: 'address_complement', label: 'Complemento' },
  { key: 'address_neighborhood', label: 'Bairro' },
  { key: 'address_city', label: 'Cidade' },
  { key: 'address_state', label: 'Estado / UF' },
  { key: 'address_zip', label: 'CEP' },
  { key: 'pix_key', label: 'Chave PIX' },
  { key: 'pix_key_type', label: 'Tipo Chave PIX' },
  { key: 'bank_name', label: 'Banco' },
  { key: 'bank_agency', label: 'Agência' },
  { key: 'bank_account', label: 'Conta' },
  { key: 'notes', label: 'Observações' },
  { key: 'client_type', label: 'Tipo de Cliente' },
  { key: 'source', label: 'Origem' },
];

// Attempt auto-mapping based on header names
function autoMap(header: string): string {
  const h = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (h.includes('nome') && (h.includes('cliente') || h.includes('razao') || !h.includes('titular') && !h.includes('fantasia'))) return 'name';
  if (h.includes('fantasia')) return 'trade_name';
  if (h.includes('apelido')) return 'nickname';
  if (h.includes('cpf') || h.includes('cnpj') || h.includes('documento')) return 'document_number';
  if (h.includes('rg') && !h.includes('agencia')) return 'rg';
  if (h.includes('nascimento')) return 'birth_date';
  if (h.includes('e-mail') || h.includes('email')) return 'email';
  if (h.includes('whatsapp') || h.includes('whats')) return 'whatsapp';
  if (h.includes('telefone') || h.includes('phone') || h.includes('fone')) return 'phone';
  if (h.includes('placa')) return 'vehicle_plate';
  if (h.includes('rua') || h.includes('avenida') || h.includes('endereco') || h.includes('logradouro')) return 'address_street';
  if (h.includes('numero') || h === 'n°' || h.includes('n casa') || h.includes('n° casa')) return 'address_number';
  if (h.includes('bairro')) return 'address_neighborhood';
  if (h.includes('cidade')) return 'address_city';
  if (h.includes('estado') || h === 'uf') return 'address_state';
  if (h.includes('cep')) return 'address_zip';
  if (h.includes('chave pix')) return 'pix_key';
  if (h.includes('tipo') && h.includes('chave')) return 'pix_key_type';
  if (h.includes('banco') && !h.includes('conta') && !h.includes('agencia')) return 'bank_name';
  if (h.includes('agencia')) return 'bank_agency';
  if (h.includes('conta') && !h.includes('corrente')) return 'bank_account';
  if (h.includes('observ') || h.includes('obs')) return 'notes';
  return 'ignorar';
}

export function ImportMappingDialog({ open, onOpenChange, onComplete }: ImportMappingDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImportResult(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    // Try to detect separator
    const firstLine = text.split('\n')[0];
    const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('Arquivo vazio ou sem dados'); return; }

    const hdrs = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    const dataRows = lines.slice(1).map(line => line.split(separator).map(c => c.trim().replace(/^"|"$/g, '')));

    setHeaders(hdrs);
    setRows(dataRows);

    // Auto-map headers
    const autoMapping: Record<number, string> = {};
    hdrs.forEach((h, i) => { autoMapping[i] = autoMap(h); });
    setMapping(autoMapping);
    setStep('mapping');

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    // Validate at least name and document mapped
    const mappedFields = Object.values(mapping);
    if (!mappedFields.includes('name')) { toast.error('O campo "Nome" deve ser mapeado'); return; }
    if (!mappedFields.includes('document_number')) { toast.error('O campo "CPF/CNPJ" deve ser mapeado'); return; }

    setStep('importing');
    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of rows) {
      const record: Record<string, string | null> = { source: 'import', created_by: user?.id || null };
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field === 'ignorar') return;
        const val = row[parseInt(colIdx)]?.trim();
        if (val) {
          if (field === 'document_number') {
            record[field] = val.replace(/[^0-9]/g, '');
          } else {
            record[field] = val;
          }
        }
      });

      // Set document_type based on length
      if (record.document_number) {
        record.document_type = record.document_number.length > 11 ? 'cnpj' : 'cpf';
      }

      if (!record.name || !record.document_number) { errors++; continue; }

      const { error } = await supabase.from('clients').insert(record as any);
      if (error) { errors++; } else { success++; }
    }

    setImportResult({ success, errors });
    setImporting(false);
    if (success > 0) {
      toast.success(`${success} clientes importados com sucesso!`);
      onComplete();
    }
    if (errors > 0) toast.error(`${errors} registros com erro (dados incompletos ou duplicados)`);
  };

  const mappedCount = Object.values(mapping).filter(v => v !== 'ignorar').length;
  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Clientes — Mapeamento de Colunas
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Selecione uma planilha para importar</p>
              <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: CSV, TXT (separados por vírgula, ponto-e-vírgula ou tab)</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileSelect} />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Selecionar Arquivo
            </Button>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{headers.length} colunas detectadas · {rows.length} linhas de dados</p>
                <p className="text-xs text-muted-foreground">{mappedCount} campos mapeados</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
                <Button size="sm" onClick={() => setStep('preview')}>Pré-visualizar →</Button>
              </div>
            </div>

            <div className="bg-card border rounded-lg divide-y">
              {headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{header}</p>
                    <p className="text-[10px] text-muted-foreground truncate">Ex: {rows[0]?.[idx] || '—'}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select value={mapping[idx] || 'ignorar'} onValueChange={v => setMapping(p => ({ ...p, [idx]: v }))}>
                    <SelectTrigger className="w-52 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DB_FIELDS.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Pré-visualização (primeiros 5 registros)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>← Voltar ao Mapeamento</Button>
                <Button size="sm" onClick={handleImport}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Confirmar Importação ({rows.length} registros)
                </Button>
              </div>
            </div>

            <div className="bg-card border rounded overflow-auto">
              <table className="w-full table-dense">
                <thead>
                  <tr className="border-b bg-secondary">
                    {Object.entries(mapping).filter(([, v]) => v !== 'ignorar').map(([idx, field]) => (
                      <th key={idx} className="text-left text-muted-foreground font-medium text-[10px]">
                        {DB_FIELDS.find(f => f.key === field)?.label || field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50">
                      {Object.entries(mapping).filter(([, v]) => v !== 'ignorar').map(([idx]) => (
                        <td key={idx} className="text-[10px]">{row[parseInt(idx)] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            {importing ? (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium">Importando {rows.length} registros...</p>
              </>
            ) : importResult && (
              <>
                <div className="mx-auto h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">Importação Concluída!</p>
                  <div className="flex gap-4 justify-center mt-2">
                    <Badge className="bg-accent text-accent-foreground">{importResult.success} importados</Badge>
                    {importResult.errors > 0 && <Badge variant="destructive">{importResult.errors} erros</Badge>}
                  </div>
                </div>
                <Button size="sm" onClick={handleClose}>Fechar</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

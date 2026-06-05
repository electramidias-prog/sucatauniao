import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from './auditLog';

export interface SelectedClient {
  id: string;
  name: string;
  document_number: string;
  phone?: string | null;
}

export function ClientSearchInline({
  value,
  onChange,
  label = 'Cliente',
}: {
  value: SelectedClient | null;
  onChange: (c: SelectedClient | null) => void;
  label?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SelectedClient[]>([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', document_number: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id,name,document_number,phone')
        .or(`name.ilike.%${q}%,document_number.ilike.%${q}%`)
        .limit(10);
      setResults((data as SelectedClient[]) || []);
    }, 250);
  }, [q]);

  if (value) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div>
            <div className="font-semibold">{value.name}</div>
            <div className="text-xs text-muted-foreground">{value.document_number}</div>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const saveNew = async () => {
    if (!newClient.name || !newClient.document_number) {
      toast.error('Nome e CPF/CNPJ obrigatórios');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: newClient.name,
        document_number: newClient.document_number,
        document_type: newClient.document_number.replace(/\D/g, '').length > 11 ? 'cnpj' : 'cpf',
        phone: newClient.phone || null,
        client_type: 'fornecedor',
      } as any)
      .select('id,name,document_number,phone')
      .single();
    setSaving(false);
    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message);
      return;
    }
    if (data) {
      await logAudit({ table: 'clients', recordId: data.id, action: 'INSERT', newValue: data });
      onChange(data as SelectedClient);
      setShowNew(false);
      setNewClient({ name: '', document_number: '', phone: '' });
      toast.success('Cliente cadastrado');
    }
  };

  return (
    <div className="space-y-1 relative">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nome ou CPF/CNPJ"
          className="pl-8 h-9"
        />
      </div>
      {open && q.length >= 2 && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">Nenhum cliente encontrado</div>
          ) : (
            results.map(c => (
              <button
                key={c.id}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ('');
                }}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.document_number}</div>
              </button>
            ))
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm text-red-600 hover:bg-accent"
            onClick={() => {
              setShowNew(true);
              setOpen(false);
              setNewClient(s => ({ ...s, name: q }));
            }}
          >
            <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
          </button>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">CPF/CNPJ *</Label>
              <Input
                value={newClient.document_number}
                onChange={e => setNewClient({ ...newClient, document_number: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={saveNew} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
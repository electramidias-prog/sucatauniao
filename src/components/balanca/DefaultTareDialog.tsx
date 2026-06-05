import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logAudit } from './auditLog';

export function DefaultTareDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  onSaved?: () => void;
}) {
  const [tare, setTare] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('client_default_tares')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (data) {
        setExistingId((data as any).id);
        setTare(String((data as any).tare_weight ?? ''));
        setDesc((data as any).description ?? '');
      } else {
        setExistingId(null);
        setTare('');
        setDesc('');
      }
    })();
  }, [open, clientId]);

  const save = async () => {
    const v = Number(tare);
    if (!v || v <= 0) {
      toast.error('Tara inválida');
      return;
    }
    setSaving(true);
    const payload = { client_id: clientId, tare_weight: v, description: desc || null };
    const { data, error } = existingId
      ? await supabase.from('client_default_tares').update(payload as any).eq('id', existingId).select().single()
      : await supabase.from('client_default_tares').insert(payload as any).select().single();
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    await logAudit({
      table: 'client_default_tares',
      recordId: (data as any).id,
      action: existingId ? 'UPDATE' : 'INSERT',
      newValue: payload,
    });
    toast.success('Tara padrão salva');
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tara Padrão — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tara (kg) *</Label>
            <Input type="number" step="0.001" value={tare} onChange={e => setTare(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex.: Caminhão truck" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
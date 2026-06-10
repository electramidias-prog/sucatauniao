import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from './auditLog';

interface Props {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
  recordId?: string;
  recordTable?: string;
  compact?: boolean;
}

export function PhotoField({ value, onChange, folder = 'misc', recordId, recordTable, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const upload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Arquivo precisa ser uma imagem');
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'png').toLowerCase().split(';')[0];
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('weighing-photos').upload(path, file, {
        contentType: file.type || 'image/png',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('weighing-photos').getPublicUrl(path);
      onChange(data.publicUrl);
      if (recordTable && recordId) {
        await logAudit({
          table: recordTable,
          recordId,
          action: 'UPDATE',
          newValue: { photo_url: data.publicUrl, audit_action: 'PHOTO_UPLOAD' },
        });
      }
      toast.success('Foto enviada');
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + (err?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
            const f = new File([blob], `foto-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
            upload(f);
          }
          break;
        }
      }
    };
    // Listen on document so Ctrl+V works while modal has focus elsewhere
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`border border-dashed rounded ${compact ? 'p-2' : 'p-3'} flex items-center gap-2 text-xs`}
      >
        <label className="cursor-pointer inline-flex items-center gap-1">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span className="inline-flex items-center gap-1">
              <Camera className="h-3 w-3" /> {busy ? 'Enviando…' : 'Foto da carga'}
            </span>
          </Button>
        </label>
        <span className="text-muted-foreground flex-1">
          Arraste, clique para selecionar ou cole com <kbd className="px-1 border rounded">Ctrl+V</kbd>
        </span>
      </div>
      {value && (
        <div className="relative inline-block">
          <a href={value} target="_blank" rel="noreferrer">
            <img src={value} alt="Foto da carga" className="h-24 w-24 object-cover rounded border" />
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
            aria-label="Remover foto"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
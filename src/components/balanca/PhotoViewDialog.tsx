import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Download, X } from 'lucide-react';

export function PhotoThumb({ url, onOpen }: { url: string | null | undefined; onOpen: (u: string) => void }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="inline-flex items-center gap-1 text-primary hover:underline"
      title="Ver foto"
    >
      <Camera className="h-4 w-4" />
    </button>
  );
}

export function PhotoViewDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const download = async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `foto-${Date.now()}.${(blob.type.split('/')[1] || 'png').split(';')[0]}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.open(url, '_blank');
    }
  };
  return (
    <Dialog open={!!url} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Foto da carga</DialogTitle></DialogHeader>
        {url && (
          <div className="flex justify-center">
            <img src={url} alt="Foto da carga" className="max-h-[70vh] object-contain rounded" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4 mr-1" />Fechar</Button>
          <Button onClick={download}><Download className="h-4 w-4 mr-1" />Baixar foto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
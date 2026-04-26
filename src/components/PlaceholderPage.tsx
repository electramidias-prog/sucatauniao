import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <Construction className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">Módulo em desenvolvimento — em breve.</p>
    </div>
  );
}

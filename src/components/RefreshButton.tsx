import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  lastRefreshAt?: Date | null;
  className?: string;
}

export function RefreshButton({ onRefresh, isRefreshing, lastRefreshAt, className }: RefreshButtonProps) {
  const [, setTick] = useState(0);

  // Tick every second to update "Atualizado há X segundos"
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatAgo = (d: Date | null | undefined) => {
    if (!d) return null;
    const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 60) return `Atualizado há ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `Atualizado há ${m} min`;
    const h = Math.floor(m / 60);
    return `Atualizado há ${h}h`;
  };

  return (
    <div className={cn('flex flex-col items-end gap-0.5', className)}>
      <div className="flex items-center gap-2">
        {isRefreshing && (
          <span
            className="inline-block h-2 w-2 rounded-full bg-success animate-pulse"
            title="Atualizando em segundo plano"
            aria-label="Atualizando"
          />
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => { void onRefresh(); }}
          disabled={isRefreshing}
          className="h-8 gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          Atualizar
        </Button>
      </div>
      {lastRefreshAt && (
        <span className="text-[10px] text-muted-foreground">{formatAgo(lastRefreshAt)}</span>
      )}
    </div>
  );
}

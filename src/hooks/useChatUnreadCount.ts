import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const CHANNELS_BY_ROLE: Record<string, string[]> = {
  admin: ['geral', 'balanca', 'financeiro', 'patio'],
  financeiro: ['geral', 'financeiro'],
  operador_balanca: ['geral', 'balanca'],
  conferente: ['geral', 'patio'],
  contador: ['geral'],
};

export function useChatUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const channels = CHANNELS_BY_ROLE[user.role] || ['geral'];

    const fetchCount = async () => {
      const { data: reads } = await supabase
        .from('chat_reads')
        .select('channel, last_read_at')
        .eq('user_id', user.id);
      const readsMap = new Map((reads || []).map((r: any) => [r.channel, r.last_read_at]));

      let total = 0;
      for (const ch of channels) {
        const lastRead = readsMap.get(ch) || '1970-01-01';
        const { count: c } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel', ch)
          .gt('created_at', lastRead)
          .neq('user_id', user.id);
        total += c || 0;
      }
      if (!cancelled) setCount(total);
    };

    fetchCount();

    const sub = supabase
      .channel('chat-unread-watcher')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reads' }, fetchCount)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(sub);
    };
  }, [user]);

  return count;
}
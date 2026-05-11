import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Count of overdue + due-today events across bills, company_documents and calendar_events. */
export function useCalendarAlertsCount(intervalMs = 5 * 60 * 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayStr = today.toISOString().slice(0, 10);
      try {
        const [bills, docs, events] = await Promise.all([
          supabase
            .from('bills')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'pago')
            .lte('due_date', todayStr),
          supabase
            .from('company_documents')
            .select('id', { count: 'exact', head: true })
            .not('expiry_date', 'is', null)
            .lte('expiry_date', todayStr),
          supabase
            .from('calendar_events')
            .select('id', { count: 'exact', head: true })
            .lte('event_date', todayStr),
        ]);
        if (cancelled) return;
        const total = (bills.count || 0) + (docs.count || 0) + (events.count || 0);
        setCount(total);
      } catch (err) {
        console.error('[useCalendarAlertsCount]', err);
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, intervalMs);
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);

  return count;
}
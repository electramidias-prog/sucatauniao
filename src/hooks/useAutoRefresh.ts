import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAutoRefresh
 * - Calls fetchFn on mount
 * - Calls fetchFn when the tab regains focus or visibility
 * - Returns { refresh, isRefreshing, lastRefreshAt }
 */
export function useAutoRefresh(fetchFn: () => Promise<void> | void, deps: React.DependencyList = []) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await fnRef.current();
      setLastRefreshAt(new Date());
    } catch (err) {
      console.error('[useAutoRefresh] refresh failed', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial mount + dependency changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, deps);

  // Focus / visibility refresh
  useEffect(() => {
    const onFocus = () => { refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return { refresh, isRefreshing, lastRefreshAt };
}

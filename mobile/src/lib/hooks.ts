import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth';
import * as api from './api';

/** Loads data when the screen opens, and again every time it comes back into view. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const ticket = useRef(0);
  const hasData = useRef(false);

  const load = useCallback(async (mode: 'auto' | 'pull' = 'auto') => {
    const mine = ++ticket.current;
    if (mode === 'pull') setRefreshing(true);
    else if (!hasData.current) setLoading(true);
    try {
      const result = await fnRef.current();
      if (mine !== ticket.current) return;
      hasData.current = true;
      setData(result);
      setError(null);
    } catch (e: any) {
      if (mine !== ticket.current) return;
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      if (mine === ticket.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(); }, deps));

  return {
    data, error, loading, refreshing,
    reload: () => load('auto'),
    pull: () => load('pull'),
    setData,
  };
}

/** Number of unread notifications. Refreshed whenever the tab holding the bell icon regains focus. */
export function useUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.listNotifications();
      setCount(list.filter((n) => !n.read_at).length);
    } catch { /* keep the last known count on a transient network error */ }
  }, [user]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return { count, refresh };
}

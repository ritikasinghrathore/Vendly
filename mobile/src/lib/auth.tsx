import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, friendly, setLoggedOutHandler, setTokens } from './apiClient';
import { loadTokens } from './secureTokens';
import type { Shop } from './types';

export interface User { id: string; email: string; name: string; phone: string | null; role: 'customer' | 'shopkeeper' }
export interface SubscriptionInfo { status: string; hasAccess: boolean; accessUntil: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; checkoutUrl: string | null }

interface AuthState {
  loading: boolean;
  loadError: string | null;
  user: User | null;
  shops: Shop[];
  activeShop: Shop | null;
  subscription: SubscriptionInfo | null;
  setActiveShopId: (id: string) => void;
  refresh: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; role: 'customer' | 'shopkeeper'; phone?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    setUser(null); setShops([]); setSubscription(null); setActiveId(null); setLoadError(null);
  }, []);

  // A refresh failure anywhere in the app (apiClient) lands here so the whole app returns to the welcome screen.
  useEffect(() => { setLoggedOutHandler(() => { setTokens(null); clearAll(); }); }, [clearAll]);

  const load = useCallback(async () => {
    const tokens = await loadTokens();
    if (!tokens) { clearAll(); setDataReady(true); return; }
    try {
      const me = await apiGet<{ user: User }>('/api/v1/auth/me');
      setUser(me.user);
      if (me.user.role === 'shopkeeper') {
        const mine = await apiGet<{ shops: Shop[] }>('/api/v1/shops/mine');
        setShops(mine.shops);
        const chosen = mine.shops.find((s) => s.id === activeId) ?? mine.shops[0] ?? null;
        setActiveId(chosen?.id ?? null);
        if (chosen) {
          const sub = await apiGet<SubscriptionInfo>(`/api/v1/shops/${chosen.id}/subscription`);
          setSubscription(sub);
        } else setSubscription(null);
      } else {
        setShops([]); setSubscription(null);
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(friendly(e));
    } finally {
      setDataReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load().finally(() => setBooting(false)); }, [load]);

  const refreshSubscription = useCallback(async () => {
    if (!activeId) return;
    try { setSubscription(await apiGet<SubscriptionInfo>(`/api/v1/shops/${activeId}/subscription`)); } catch { /* keep the last known state */ }
  }, [activeId]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPost<{ user: User; tokens: { accessToken: string; refreshToken: string } }>('/api/v1/auth/login', { email, password }, );
    await setTokens(res.tokens);
    setDataReady(false);
    await load();
  }, [load]);

  const register = useCallback(async (input: { name: string; email: string; password: string; role: 'customer' | 'shopkeeper'; phone?: string }) => {
    const res = await apiPost<{ user: User; tokens: { accessToken: string; refreshToken: string } }>('/api/v1/auth/register', input);
    await setTokens(res.tokens);
    setDataReady(false);
    await load();
  }, [load]);

  const signOut = useCallback(async () => {
    try { await apiPost('/api/v1/auth/logout'); } catch { /* best effort - clear locally regardless */ }
    await setTokens(null);
    clearAll();
  }, [clearAll]);

  const value = useMemo<AuthState>(() => ({
    loading: booting || !dataReady,
    loadError,
    user,
    shops,
    activeShop: shops.find((s) => s.id === activeId) ?? shops[0] ?? null,
    subscription,
    setActiveShopId: setActiveId,
    refresh: load,
    refreshSubscription,
    login,
    register,
    signOut,
  }), [booting, dataReady, loadError, user, shops, activeId, subscription, load, refreshSubscription, login, register, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

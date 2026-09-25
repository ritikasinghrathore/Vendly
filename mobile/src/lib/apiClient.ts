import { API_BASE_URL } from '../config';
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from './secureTokens';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || /network request failed|failed to fetch/i.test(String((e as Error)?.message ?? ''));
}
export function friendly(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (isNetworkError(e)) return 'Connection lost. Please check your internet and try again.';
  return 'Something went wrong. Please try again.';
}

let cached: StoredTokens | null = null;
let refreshInFlight: Promise<StoredTokens | null> | null = null;
let onLoggedOut: (() => void) | null = null;
/** Called once by AuthProvider so the client can clear session state app-wide on an unrecoverable auth failure. */
export const setLoggedOutHandler = (fn: () => void) => { onLoggedOut = fn; };

async function getTokens(): Promise<StoredTokens | null> {
  if (cached) return cached;
  cached = await loadTokens();
  return cached;
}
export async function setTokens(tokens: StoredTokens | null) {
  cached = tokens;
  if (tokens) await saveTokens(tokens);
  else await clearTokens();
}

async function refreshTokens(): Promise<StoredTokens | null> {
  if (refreshInFlight) return refreshInFlight; // several 401s at once share one refresh call
  refreshInFlight = (async () => {
    const current = await getTokens();
    if (!current) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) { await setTokens(null); return null; }
      const data = await res.json();
      const next: StoredTokens = data.tokens;
      await setTokens(next);
      return next;
    } catch {
      return null; // a network hiccup during refresh: keep the old tokens, don't log the person out
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions { method?: string; body?: unknown; auth?: boolean; }

/** Every call to the backend goes through here: attaches the access token, retries once on a 401
 *  after a silent refresh, and turns error responses into a friendly ApiError. */
export async function apiFetch<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, 'NOT_CONFIGURED', 'The app is not connected to its server yet.');
  const auth = opts.auth ?? true;
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      const tokens = await getTokens();
      if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return fetch(`${API_BASE_URL}${path}`, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  };

  let res: Response;
  try { res = await doFetch(); } catch (e) { throw new ApiError(0, 'NETWORK', friendly(e)); }

  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (!refreshed) { onLoggedOut?.(); throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'); }
    try { res = await doFetch(); } catch (e) { throw new ApiError(0, 'NETWORK', friendly(e)); }
  }

  if (res.status === 204) return undefined as T;
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    const err = payload?.error ?? {};
    if (res.status === 401) onLoggedOut?.();
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? 'Something went wrong. Please try again.', err.details);
  }
  return payload as T;
}

export const apiGet = <T = any>(path: string) => apiFetch<T>(path);
export const apiPost = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body });
export const apiPut = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body });
export const apiPatch = <T = any>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body });
export const apiDelete = <T = any>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
export const qs = (params: Record<string, string | number | undefined>) => {
  const s = Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return s ? `?${s}` : '';
};

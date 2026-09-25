import * as SecureStore from 'expo-secure-store';

// SecureStore values are size-limited, so a token is split into chunks (JWTs can run long).
const CHUNK = 1800;
const k = (key: string) => key.replace(/[^\w.-]/g, '_');

async function getChunked(key: string): Promise<string | null> {
  const n = await SecureStore.getItemAsync(`${k(key)}.n`);
  if (n === null) return null;
  let out = '';
  for (let i = 0; i < Number(n); i++) {
    const part = await SecureStore.getItemAsync(`${k(key)}.${i}`);
    if (part === null) return null;
    out += part;
  }
  return out;
}
async function setChunked(key: string, value: string): Promise<void> {
  const old = Number((await SecureStore.getItemAsync(`${k(key)}.n`)) ?? 0);
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < chunks; i++) await SecureStore.setItemAsync(`${k(key)}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(`${k(key)}.n`, String(chunks));
  for (let i = chunks; i < old; i++) await SecureStore.deleteItemAsync(`${k(key)}.${i}`);
}
async function removeChunked(key: string): Promise<void> {
  const old = Number((await SecureStore.getItemAsync(`${k(key)}.n`)) ?? 0);
  for (let i = 0; i < old; i++) await SecureStore.deleteItemAsync(`${k(key)}.${i}`);
  await SecureStore.deleteItemAsync(`${k(key)}.n`);
}

export interface StoredTokens { accessToken: string; refreshToken: string }
const KEY = 'vendly.tokens';

// Tokens live in the phone's Keychain/Keystore (hardware-backed on most devices), never in plain
// storage - this is exactly where a real bank or shopping app keeps a login session.
export const loadTokens = async (): Promise<StoredTokens | null> => {
  const raw = await getChunked(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredTokens; } catch { return null; }
};
export const saveTokens = (tokens: StoredTokens) => setChunked(KEY, JSON.stringify(tokens));
export const clearTokens = () => removeChunked(KEY);

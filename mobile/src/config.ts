export const APP_NAME = 'Vendly';

// The Node.js backend's address. EXPO_PUBLIC_ variables are safe to expose: they end up compiled
// into the app itself. No secret (JWT signing key, database password, Razorpay key secret) is ever
// read from here - those live only on the server, in backend/.env.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? '';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? '';
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
export const isConfigured = API_BASE_URL.startsWith('http');

export const imageUrl = (imageId: string | null | undefined): string | null =>
  imageId ? `${API_BASE_URL}/api/v1/images/${imageId}` : null;

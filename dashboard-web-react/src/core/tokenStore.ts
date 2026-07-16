/** Ported from dashboard-web/lib/core/secure_token_store.dart — same key names, same
 * localStorage-backed storage a browser session already implies (no more sensitive than
 * the Flutter Web build's own storage backend for the same tokens). */
const ACCESS_TOKEN_KEY = 'bao_tin_dashboard_access_token';
const REFRESH_TOKEN_KEY = 'bao_tin_dashboard_refresh_token';

export const tokenStore = {
  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  readAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  readRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

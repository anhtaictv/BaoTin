/** Refresh token still needs to survive a page reload and the backend has no httpOnly-cookie
 * support yet, so it stays in localStorage. The access token — shorter-lived but higher
 * privilege on every request — is kept in a module variable instead: an XSS payload that reads
 * localStorage once no longer walks off with a live access token too, and nothing sensitive is
 * left on disk once the tab closes. On reload, AuthContext exchanges the stored refresh token
 * for a fresh access token before rendering, so this doesn't cost a full re-login. */
const REFRESH_TOKEN_KEY = 'bao_tin_dashboard_refresh_token';

let accessToken: string | null = null;

export const tokenStore = {
  saveTokens(newAccessToken: string, refreshToken: string): void {
    accessToken = newAccessToken;
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  readAccessToken(): string | null {
    return accessToken;
  },
  readRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  clear(): void {
    accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

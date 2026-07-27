import axios, { type InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from './tokenStore';

/** Ported from dashboard-web/lib/core/api_client.dart's session-expiry handling. */
export class SessionExpiredError extends Error {}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

let onSessionExpired: (() => void) | null = null;

/** Set once by AuthContext on mount — mirrors ApiClient's constructor-injected callback in
 * the Flutter version, just wired at runtime instead of construction time since there's a
 * single shared axios instance module-wide here. */
export function setOnSessionExpired(callback: () => void): void {
  onSessionExpired = callback;
}

export const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 10_000 });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.readAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

async function refreshAccessToken(): Promise<void> {
  const refreshToken = tokenStore.readRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  const data = response.data.data as { accessToken: string; refreshToken: string };
  tokenStore.saveTokens(data.accessToken, data.refreshToken);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isUnauthorized = error.response?.status === 401;
    const hadToken = Boolean(error.config?.headers?.Authorization);
    const alreadyRetried = error.config?.__retried === true;

    // A 401 with no Authorization header on the original request (login itself) can only mean
    // wrong credentials, never an expired session — attempting a refresh here fails immediately
    // (no refresh token yet) and replaces the real INVALID_CREDENTIALS response with a bare
    // SessionExpiredError, masking the actual error. Only authenticated calls are eligible for
    // refresh-and-retry.
    if (isUnauthorized && hadToken && !alreadyRetried) {
      try {
        await refreshAccessToken();
        error.config.__retried = true;
        return apiClient.request(error.config);
      } catch {
        tokenStore.clear();
        onSessionExpired?.();
        throw new SessionExpiredError();
      }
    }

    throw error;
  },
);

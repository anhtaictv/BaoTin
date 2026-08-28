import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, refreshAccessToken, setOnSessionExpired } from './apiClient';
import { tokenStore } from './tokenStore';

export interface District {
  id: string;
  tenXa: string;
}

export interface Account {
  username: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  fullName: string;
  unitName: string | null;
  role: 'officer' | 'senior_officer' | 'commune_head' | 'admin';
  districts: District[];
}

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMyAccount(): Promise<Account> {
  const res = await apiClient.get('/web-accounts/me');
  return res.data.data as Account;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAccount(null);
  }, []);

  useEffect(() => {
    setOnSessionExpired(logout);
  }, [logout]);

  useEffect(() => {
    (async () => {
      // The access token lives in memory only (see tokenStore.ts), so it's always gone after a
      // reload — exchange the persisted refresh token for a new one before deciding the user is
      // logged out.
      if (!tokenStore.readAccessToken()) {
        if (!tokenStore.readRefreshToken()) {
          setLoading(false);
          return;
        }
        try {
          await refreshAccessToken();
        } catch {
          tokenStore.clear();
          setLoading(false);
          return;
        }
      }
      try {
        setAccount(await fetchMyAccount());
      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiClient.post('/auth/web/login', { username, password });
    const { accessToken, refreshToken } = res.data.data as { accessToken: string; refreshToken: string };
    tokenStore.saveTokens(accessToken, refreshToken);
    setAccount(await fetchMyAccount());
  }, []);

  const refreshAccount = useCallback(async () => {
    setAccount(await fetchMyAccount());
  }, []);

  const value = useMemo(
    () => ({ account, loading, login, logout, refreshAccount }),
    [account, loading, login, logout, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

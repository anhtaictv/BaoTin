import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './core/AuthContext';
import { ThemeModeProvider } from './core/ThemeModeContext';
import { apiClient } from './core/apiClient';
import { tokenStore } from './core/tokenStore';
import App from './App';

vi.mock('./core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const BASE_ACCOUNT = {
  username: '0900001111',
  mustChangePassword: false,
  lastLoginAt: null,
  fullName: '[DEMO] A',
  unitName: 'Công an phường Buôn Ma Thuột',
  districts: [],
};

function mockLoggedInAs(role: 'officer' | 'senior_officer' | 'admin') {
  tokenStore.saveTokens('access-1', 'refresh-1');
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/web-accounts/me') return { data: { data: { ...BASE_ACCOUNT, role } } };
    if (url === '/admin/dashboard/districts') return { data: { data: [] } };
    if (url === '/admin/dashboard/overview') {
      return { data: { data: { totalReports: 0, byStatus: {}, avgResponseTimeSeconds: null } } };
    }
    if (url === '/admin/dashboard/response-time-by-district') return { data: { data: [] } };
    if (url === '/admin/dashboard/response-time-by-officer') return { data: { data: [] } };
    if (url === '/admin/dashboard/volume-trend') return { data: { data: [] } };
    if (url === '/admin/dashboard/camera-queue') return { data: { data: {} } };
    if (url === '/officer/reports') return { data: { data: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // basename must match main.tsx's <BrowserRouter basename="/admin"> — a route path defined
  // without accounting for this basename silently renders a blank <Outlet/> in production
  // while looking fine under a basename-less test router (caught for admin/accounts once already).
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <BrowserRouter basename="/admin">
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeModeProvider>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.mocked(apiClient.get).mockReset();
    window.history.pushState({}, '', '/admin/');
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    renderApp();
    expect(await screen.findByText('Báo Tin — Trung tâm điều hành')).toBeInTheDocument();
  });

  it('sends a plain "officer" account straight to Tin báo — /admin/dashboard/* and /admin/search 403 for that role', async () => {
    mockLoggedInAs('officer');
    renderApp();

    expect(await screen.findByText('Chọn 1 tin báo bên trái để xem chi tiết.')).toBeInTheDocument();
    // The two dashboard/search-only tabs must not even be offered — clicking either would
    // hit a route the backend 403s for a plain officer (docs/API_SPEC.md role gates).
    expect(screen.queryByRole('link', { name: 'Tổng quan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tìm kiếm' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tin báo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tin nhanh' })).toBeInTheDocument();
  });

  it('lets a senior_officer account land on Tổng quan and see the dashboard/search tabs', async () => {
    mockLoggedInAs('senior_officer');
    renderApp();

    expect(await screen.findByRole('link', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tìm kiếm' })).toBeInTheDocument();
  });

  it('renders Quản lý tài khoản for an admin at /admin/accounts (regression: basename+route path mismatch left this blank)', async () => {
    mockLoggedInAs('admin');
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/web-accounts/me') return { data: { data: { ...BASE_ACCOUNT, role: 'admin' } } };
      if (url === '/admin/web-accounts') return { data: { data: [] } };
      throw new Error(`unexpected GET ${url}`);
    });
    window.history.pushState({}, '', '/admin/accounts');
    renderApp();

    expect(await screen.findByText('Quản lý tài khoản')).toBeInTheDocument();
  });
});

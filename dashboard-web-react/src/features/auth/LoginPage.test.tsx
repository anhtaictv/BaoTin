import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { LoginPage } from './LoginPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    localStorage.clear();
  });

  it('shows an error message on invalid credentials, without crashing', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: { code: 'INVALID_CREDENTIALS', message: 'Sai tên đăng nhập hoặc mật khẩu.' } } },
    });
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Tên đăng nhập/), '0900001111');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên đăng nhập hoặc mật khẩu.');
  });

  it('logs in successfully and stores tokens', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { accessToken: 'access-1', refreshToken: 'refresh-1', mustChangePassword: true } },
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: {
          username: '0900001111',
          mustChangePassword: true,
          lastLoginAt: null,
          fullName: '[DEMO] A',
          unitName: 'Công an phường Buôn Ma Thuột',
          role: 'officer',
          districts: [],
        },
      },
    });
    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Tên đăng nhập/), '0900001111');
    await user.type(screen.getByLabelText(/Mật khẩu/), 'Correct-Horse-1');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));

    await waitFor(() => expect(localStorage.getItem('bao_tin_dashboard_access_token')).toBe('access-1'));
    expect(apiClient.post).toHaveBeenCalledWith('/auth/web/login', {
      username: '0900001111',
      password: 'Correct-Horse-1',
    });
  });
});

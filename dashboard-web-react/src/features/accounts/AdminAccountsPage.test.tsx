import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { AdminAccountsPage } from './AdminAccountsPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const ACCOUNTS = [
  {
    officerId: 'o1',
    username: '0900001111',
    mustChangePassword: true,
    lastLoginAt: null,
    isLocked: false,
    fullName: '[DEMO] Nguyễn Văn A',
    unitName: 'Công an phường Buôn Ma Thuột',
    role: 'officer',
    districts: ['Buôn Ma Thuột'],
  },
  {
    officerId: 'o2',
    username: '0900002222',
    mustChangePassword: false,
    lastLoginAt: '2026-01-01T08:00:00Z',
    isLocked: true,
    fullName: '[DEMO] Trần Thị B',
    unitName: 'Công an phường Buôn Hồ',
    role: 'officer',
    districts: ['Buôn Hồ'],
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAccountsPage />
    </QueryClientProvider>,
  );
}

describe('AdminAccountsPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('lists every provisioned account with role/district/status', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: ACCOUNTS } });
    renderPage();

    expect(await screen.findByText('0900001111')).toBeInTheDocument();
    expect(screen.getByText('[DEMO] Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Buôn Ma Thuột')).toBeInTheDocument();
    expect(screen.getByText('Chưa đổi mật khẩu')).toBeInTheDocument();
    expect(screen.getByText(/Đang khoá/)).toBeInTheDocument();
  });

  it('resetting a password shows the one-time temp password exactly once', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: ACCOUNTS } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { tempPassword: 'AbCdEfGh23' } } });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('0900001111');
    const resetButtons = screen.getAllByRole('button', { name: 'Đặt lại mật khẩu' });
    await user.click(resetButtons[0]);

    expect(await screen.findByText('AbCdEfGh23')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/admin/web-accounts/o1/reset-password');

    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText('AbCdEfGh23')).not.toBeInTheDocument();
  });

  it('shows an error message when the reset request fails', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: ACCOUNTS } });
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network down'));
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('0900001111');
    await user.click(screen.getAllByRole('button', { name: 'Đặt lại mật khẩu' })[0]);

    expect(await screen.findByText('Đặt lại mật khẩu thất bại. Vui lòng thử lại.')).toBeInTheDocument();
  });
});

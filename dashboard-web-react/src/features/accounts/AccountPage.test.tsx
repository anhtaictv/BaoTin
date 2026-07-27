import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { tokenStore } from '../../core/tokenStore';
import { AccountPage } from './AccountPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const BASE_ACCOUNT = {
  username: '0900001111',
  mustChangePassword: false,
  lastLoginAt: null,
  fullName: '[DEMO] Nguyễn Văn A',
  unitName: 'Công an phường Buôn Ma Thuột',
  role: 'senior_officer',
  districts: [{ id: 'd1', tenXa: 'Buôn Ma Thuột' }],
};

describe('AccountPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    tokenStore.saveTokens('access-1', 'refresh-1');
  });

  it('shows the account info read-only fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: BASE_ACCOUNT } });
    render(
      <AuthProvider>
        <AccountPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('0900001111')).toBeInTheDocument();
    expect(screen.getByText('Cán bộ cấp cao')).toBeInTheDocument();
    expect(screen.getByText('Buôn Ma Thuột')).toBeInTheDocument();
  });

  it('updates full name and unit name via the info form', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: BASE_ACCOUNT } })
      .mockResolvedValueOnce({ data: { data: { ...BASE_ACCOUNT, fullName: '[DEMO] Tên mới' } } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { data: { updated: true } } });

    render(
      <AuthProvider>
        <AccountPage />
      </AuthProvider>,
    );
    // Wait for the form to actually be populated from the loaded account, not just for some
    // other unrelated text to appear — the sync happens in a useEffect that fires *after* the
    // account-loaded render commits, so "0900001111" being visible doesn't guarantee the input
    // has been filled in yet (a real race that intermittently scrambled the typed text below).
    const fullNameInput = await screen.findByLabelText('Họ tên');
    await waitFor(() => expect(fullNameInput).toHaveValue('[DEMO] Nguyễn Văn A'));

    const user = userEvent.setup();
    await user.clear(fullNameInput);
    // userEvent.type treats "[" / "{" as special key syntax — escape them per its docs
    // (typing "{[}"/"{]}" for literal brackets) rather than avoiding the "[DEMO]" prefix
    // used consistently elsewhere in this project's seed/demo data.
    await user.type(fullNameInput, '{[}DEMO{]} Tên mới');
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

    expect(await screen.findByText('Đã lưu thông tin.')).toBeInTheDocument();
    expect(apiClient.patch).toHaveBeenCalledWith('/web-accounts/me/info', {
      fullName: '[DEMO] Tên mới',
      unitName: 'Công an phường Buôn Ma Thuột',
    });
  });

  it('allows a voluntary password change', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: BASE_ACCOUNT } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { data: { changed: true } } });

    render(
      <AuthProvider>
        <AccountPage />
      </AuthProvider>,
    );
    await screen.findByText('0900001111');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'Old-Password-1');
    await user.type(screen.getByLabelText(/Mật khẩu mới/), 'New-Password-1');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'New-Password-1');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Đã đổi mật khẩu thành công.')).toBeInTheDocument();
  });
});

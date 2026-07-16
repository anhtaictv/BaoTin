import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { ChangePasswordGate } from './ChangePasswordGate';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

function account(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    username: '0900001111',
    mustChangePassword: true,
    lastLoginAt: null,
    fullName: '[DEMO] A',
    unitName: null,
    role: 'officer',
    districts: [],
    ...overrides,
  };
}

describe('ChangePasswordGate', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    localStorage.setItem('bao_tin_dashboard_access_token', 'access-1');
    localStorage.setItem('bao_tin_dashboard_refresh_token', 'refresh-1');
  });

  it('blocks children and shows the forced-change form when mustChangePassword is true', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: account({ mustChangePassword: true }) } });
    render(
      <AuthProvider>
        <ChangePasswordGate>
          <p>Nội dung được bảo vệ</p>
        </ChangePasswordGate>
      </AuthProvider>,
    );

    expect(await screen.findByText('Bắt buộc đổi mật khẩu')).toBeInTheDocument();
    expect(screen.queryByText('Nội dung được bảo vệ')).not.toBeInTheDocument();
  });

  it('renders children directly when mustChangePassword is false', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: account({ mustChangePassword: false }) } });
    render(
      <AuthProvider>
        <ChangePasswordGate>
          <p>Nội dung được bảo vệ</p>
        </ChangePasswordGate>
      </AuthProvider>,
    );

    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
  });

  it('unblocks and shows children after a successful password change', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: account({ mustChangePassword: true }) } })
      .mockResolvedValueOnce({ data: { data: account({ mustChangePassword: false }) } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { data: { changed: true } } });

    render(
      <AuthProvider>
        <ChangePasswordGate>
          <p>Nội dung được bảo vệ</p>
        </ChangePasswordGate>
      </AuthProvider>,
    );

    await screen.findByText('Bắt buộc đổi mật khẩu');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'Old-Password-1');
    await user.type(screen.getByLabelText(/Mật khẩu mới/), 'New-Password-1');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'New-Password-1');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByText('Nội dung được bảo vệ')).toBeInTheDocument();
  });

  it("shows a client-side error when the confirmation doesn't match, without calling the API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: account({ mustChangePassword: true }) } });
    render(
      <AuthProvider>
        <ChangePasswordGate>
          <p>Nội dung được bảo vệ</p>
        </ChangePasswordGate>
      </AuthProvider>,
    );

    await screen.findByText('Bắt buộc đổi mật khẩu');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'Old-Password-1');
    await user.type(screen.getByLabelText(/Mật khẩu mới/), 'New-Password-1');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'Different-1');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Xác nhận mật khẩu không khớp.');
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});

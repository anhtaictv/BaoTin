import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { listWebAccounts, resetWebAccountPassword } from './accountsAdminApi';

const ROLE_LABELS: Record<string, string> = {
  officer: 'Cán bộ',
  senior_officer: 'Cán bộ cấp cao',
  admin: 'Quản trị viên',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Chưa đăng nhập';
  try {
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** Admin-only — the 102-xã account roster. Resetting a password shows the new one-time temp
 * password exactly once in the UI (mirrors backend/prisma/seed/seed-web-accounts.ts's
 * console-print-once contract) — it is never stored in plaintext anywhere. */
export function AdminAccountsPage() {
  const accounts = useQuery({ queryKey: ['admin', 'web-accounts'], queryFn: listWebAccounts });
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleReset(officerId: string, username: string) {
    setResettingId(officerId);
    setResetError(null);
    try {
      const tempPassword = await resetWebAccountPassword(officerId);
      setResetResult({ username, tempPassword });
    } catch {
      setResetError('Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setResettingId(null);
    }
  }

  if (accounts.isLoading) return <ChartCardSkeleton height={300} />;
  if (accounts.isError) return <ChartCardError onRetry={() => accounts.refetch()} height={300} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18 }}>Quản lý tài khoản — 102 xã/phường</h1>

      {resetResult && (
        <Card style={{ background: '#fff3e0' }}>
          <p>
            Mật khẩu tạm mới cho <strong>{resetResult.username}</strong>:{' '}
            <code style={{ fontSize: 16 }}>{resetResult.tempPassword}</code>
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Chỉ hiển thị 1 lần duy nhất — hãy bàn giao ngay cho cán bộ. Tài khoản sẽ bắt buộc đổi
            mật khẩu ở lần đăng nhập tiếp theo.
          </p>
          <button onClick={() => setResetResult(null)}>Đóng</button>
        </Card>
      )}
      {resetError && (
        <p role="alert" style={{ color: 'var(--destructive)' }}>
          {resetError}
        </p>
      )}

      <Card style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: 12 }}>Tên đăng nhập</th>
              <th style={{ padding: 12 }}>Họ tên</th>
              <th style={{ padding: 12 }}>Vai trò</th>
              <th style={{ padding: 12 }}>Địa bàn</th>
              <th style={{ padding: 12 }}>Đăng nhập gần nhất</th>
              <th style={{ padding: 12 }}>Trạng thái</th>
              <th style={{ padding: 12 }} />
            </tr>
          </thead>
          <tbody>
            {accounts.data!.map((account) => (
              <tr key={account.officerId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12 }}>{account.username}</td>
                <td style={{ padding: 12 }}>{account.fullName}</td>
                <td style={{ padding: 12 }}>{ROLE_LABELS[account.role] ?? account.role}</td>
                <td style={{ padding: 12 }}>{account.districts.join(', ')}</td>
                <td style={{ padding: 12 }}>{formatDate(account.lastLoginAt)}</td>
                <td style={{ padding: 12 }}>
                  {account.isLocked && <span style={{ color: 'var(--destructive)' }}>Đang khoá · </span>}
                  {account.mustChangePassword && <span>Chưa đổi mật khẩu</span>}
                </td>
                <td style={{ padding: 12 }}>
                  <button
                    disabled={resettingId === account.officerId}
                    onClick={() => handleReset(account.officerId, account.username)}
                  >
                    {resettingId === account.officerId ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

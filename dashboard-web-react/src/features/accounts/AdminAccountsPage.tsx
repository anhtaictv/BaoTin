import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyRound, Lock, ShieldAlert, Users } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { PageHeader } from '../../components/PageHeader';
import { roleLabel, theme } from '../../core/theme';
import {
  assignOfficerToDistrict,
  listWebAccounts,
  resetWebAccountPassword,
  setOfficerRole,
  type OfficerRole,
  type WebAccountSummary,
} from './accountsAdminApi';
import { ChangeRoleDialog } from './ChangeRoleDialog';

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
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ['admin', 'web-accounts'], queryFn: listWebAccounts });
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<WebAccountSummary | null>(null);

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

  async function handleChangeRole(officerId: string, role: OfficerRole, districtId: string | null) {
    if (districtId) await assignOfficerToDistrict(officerId, districtId);
    await setOfficerRole(officerId, role);
    await queryClient.invalidateQueries({ queryKey: ['admin', 'web-accounts'] });
    setEditingAccount(null);
  }

  if (accounts.isLoading) return <ChartCardSkeleton height={300} />;
  if (accounts.isError) return <ChartCardError onRetry={() => accounts.refetch()} height={300} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Quản lý tài khoản" subtitle="Roster tài khoản đăng nhập web — 102 xã/phường" />

      {resetResult && (
        <Card style={{ background: `${theme.accent}12`, border: `1px solid ${theme.accent}33`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#B45309' }}>
            <KeyRound size={14} /> Mật khẩu tạm mới cho <strong>{resetResult.username}</strong>
          </p>
          <code style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.03em', background: 'var(--surface-raised)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
            {resetResult.tempPassword}
          </code>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Chỉ hiển thị 1 lần duy nhất — hãy bàn giao ngay cho cán bộ. Tài khoản sẽ bắt buộc đổi
            mật khẩu ở lần đăng nhập tiếp theo.
          </p>
          <button onClick={() => setResetResult(null)} className="btn-sm" style={{ alignSelf: 'flex-start' }}>
            Đóng
          </button>
        </Card>
      )}
      {resetError && (
        <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
          {resetError}
        </p>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div className="scroll-panel" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Địa bàn</th>
                <th>Đăng nhập gần nhất</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.data!.map((account) => (
                <tr key={account.officerId}>
                  <td style={{ fontWeight: 500 }}>{account.username}</td>
                  <td>{account.fullName}</td>
                  <td>{roleLabel(account.role)}</td>
                  <td>{account.districts.join(', ')}</td>
                  <td style={{ color: 'var(--ink-muted)' }}>{formatDate(account.lastLoginAt)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {account.isLocked && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--destructive)', fontSize: 12, fontWeight: 600 }}>
                          <Lock size={11} /> Đang khoá
                        </span>
                      )}
                      {account.mustChangePassword && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>
                          <ShieldAlert size={11} /> Chưa đổi mật khẩu
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        disabled={resettingId === account.officerId}
                        onClick={() => handleReset(account.officerId, account.username)}
                        className="btn-sm"
                      >
                        {resettingId === account.officerId ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                      </button>
                      <button onClick={() => setEditingAccount(account)} className="btn-sm">
                        Đổi vai trò
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {accounts.data!.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Users size={20} />
              <p style={{ fontSize: 13 }}>Chưa có tài khoản nào.</p>
            </div>
          )}
        </div>
      </Card>

      {editingAccount && (
        <ChangeRoleDialog
          account={editingAccount}
          onCancel={() => setEditingAccount(null)}
          onSubmit={(role, districtId) => handleChangeRole(editingAccount.officerId, role, districtId)}
        />
      )}
    </div>
  );
}

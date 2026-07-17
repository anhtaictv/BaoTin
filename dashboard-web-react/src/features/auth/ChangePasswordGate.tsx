import type { ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';
import { theme } from '../../core/theme';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Blocks access to everything else in the app until a newly-provisioned/reset account
 * changes its temp password — mirrors the seed script's "mustChangePassword" contract
 * (backend/prisma/seed/seed-web-accounts.ts, webAccountAuth.service.ts). */
export function ChangePasswordGate({ children }: { children: ReactNode }) {
  const { account, refreshAccount } = useAuth();

  if (!account?.mustChangePassword) return <>{children}</>;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--surface)', padding: 24 }}>
      <div className="surface-card rise-in" style={{ padding: 32, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-full)',
            background: `${theme.accent}17`,
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <KeyRound size={19} />
        </span>
        <div>
          <h1 style={{ fontSize: 19 }}>Bắt buộc đổi mật khẩu</h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: 13, marginTop: 6 }}>
            Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được quản trị viên đặt lại). Vui lòng
            đổi mật khẩu trước khi tiếp tục sử dụng.
          </p>
        </div>
        <ChangePasswordForm onSuccess={refreshAccount} />
      </div>
    </div>
  );
}

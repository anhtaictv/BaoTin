import type { ReactNode } from 'react';
import { useAuth } from '../../core/AuthContext';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Blocks access to everything else in the app until a newly-provisioned/reset account
 * changes its temp password — mirrors the seed script's "mustChangePassword" contract
 * (backend/prisma/seed/seed-web-accounts.ts, webAccountAuth.service.ts). */
export function ChangePasswordGate({ children }: { children: ReactNode }) {
  const { account, refreshAccount } = useAuth();

  if (!account?.mustChangePassword) return <>{children}</>;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div>
        <h1 style={{ fontSize: 20 }}>Bắt buộc đổi mật khẩu</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 320 }}>
          Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được quản trị viên đặt lại). Vui lòng
          đổi mật khẩu trước khi tiếp tục sử dụng.
        </p>
        <ChangePasswordForm onSuccess={refreshAccount} />
      </div>
    </div>
  );
}

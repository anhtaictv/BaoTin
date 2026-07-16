import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { getApiErrorMessage } from '../../core/apiError';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';

const ROLE_LABELS: Record<string, string> = {
  officer: 'Cán bộ',
  senior_officer: 'Cán bộ cấp cao',
  admin: 'Quản trị viên',
};

export function AccountPage() {
  const { account, refreshAccount } = useAuth();
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [unitName, setUnitName] = useState(account?.unitName ?? '');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoSaved, setInfoSaved] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const initializedRef = useRef(false);

  // account loads asynchronously (AuthContext fetches it after mount), so the initial
  // useState default above is usually empty — sync the form fields once the real data first
  // arrives. Deliberately only once (guarded by initializedRef), not on every subsequent
  // `account` change: refreshAccount() is also called right after a save, and re-syncing then
  // would clobber whatever the person is mid-typing into the *other* field with server data —
  // a real race that showed up as scrambled input in testing.
  useEffect(() => {
    if (!account || initializedRef.current) return;
    initializedRef.current = true;
    setFullName(account.fullName);
    setUnitName(account.unitName ?? '');
  }, [account]);

  if (!account) return null;

  async function handleInfoSubmit(e: FormEvent) {
    e.preventDefault();
    setInfoError(null);
    setInfoSaved(false);
    setSavingInfo(true);
    try {
      await apiClient.patch('/web-accounts/me/info', { fullName, unitName });
      await refreshAccount();
      setInfoSaved(true);
    } catch (err) {
      setInfoError(getApiErrorMessage(err, 'Cập nhật thông tin thất bại. Vui lòng thử lại.'));
    } finally {
      setSavingInfo(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
      <h1 style={{ fontSize: 20 }}>Tài khoản của tôi</h1>

      <section>
        <p>
          <strong>Tên đăng nhập:</strong> {account.username}
        </p>
        <p>
          <strong>Vai trò:</strong> {ROLE_LABELS[account.role] ?? account.role}
        </p>
        {account.districts.length > 0 && (
          <p>
            <strong>Địa bàn phụ trách:</strong> {account.districts.map((d) => d.tenXa).join(', ')}
          </p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Đổi thông tin cá nhân</h2>
        <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
          <label>
            Họ tên
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <label>
            Đơn vị công tác
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          {infoError && (
            <p role="alert" style={{ color: 'var(--destructive)' }}>
              {infoError}
            </p>
          )}
          {infoSaved && <p>Đã lưu thông tin.</p>}
          <button type="submit" disabled={savingInfo}>
            {savingInfo ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Đổi mật khẩu</h2>
        {passwordChanged ? (
          <p>Đã đổi mật khẩu thành công.</p>
        ) : (
          <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />
        )}
      </section>
    </div>
  );
}

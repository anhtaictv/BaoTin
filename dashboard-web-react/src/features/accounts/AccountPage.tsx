import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, IdCard, KeyRound, MapPin } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { getApiErrorMessage } from '../../core/apiError';
import { roleLabel } from '../../core/theme';
import { Card } from '../../components/ChartCard';
import { PageHeader } from '../../components/PageHeader';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
      <PageHeader title="Tài khoản của tôi" />

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <InfoLine icon={<IdCard size={14} />} label="Tên đăng nhập" value={account.username} />
        <InfoLine icon={<KeyRound size={14} />} label="Vai trò" value={roleLabel(account.role)} />
        {account.districts.length > 0 && (
          <InfoLine icon={<MapPin size={14} />} label="Địa bàn phụ trách" value={account.districts.map((d) => d.tenXa).join(', ')} />
        )}
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Đổi thông tin cá nhân</h2>
        <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 340 }}>
          <label htmlFor="account-fullname">
            Họ tên
            <input id="account-fullname" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label htmlFor="account-unit">
            Đơn vị công tác
            <input id="account-unit" type="text" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
          </label>
          {infoError && (
            <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
              {infoError}
            </p>
          )}
          {infoSaved && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--secondary)', fontSize: 13 }}>
              <CheckCircle2 size={14} /> Đã lưu thông tin.
            </p>
          )}
          <button type="submit" disabled={savingInfo} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
            {savingInfo ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </form>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>Đổi mật khẩu</h2>
        {passwordChanged ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--secondary)', fontSize: 13 }}>
            <CheckCircle2 size={14} /> Đã đổi mật khẩu thành công.
          </p>
        ) : (
          <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />
        )}
      </Card>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
      <span style={{ color: 'var(--ink-faint)', display: 'flex' }}>{icon}</span>
      <span style={{ color: 'var(--ink-muted)' }}>{label}:</span>
      <strong style={{ fontWeight: 600 }}>{value}</strong>
    </p>
  );
}

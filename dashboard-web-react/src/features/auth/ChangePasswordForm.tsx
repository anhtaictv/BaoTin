import { useState, type FormEvent } from 'react';
import { apiClient } from '../../core/apiClient';
import { getApiErrorMessage } from '../../core/apiError';

interface ChangePasswordFormProps {
  onSuccess: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.patch('/web-accounts/me/password', { oldPassword, newPassword });
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Đổi mật khẩu thất bại. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 320 }}>
      <label htmlFor="cp-old">
        Mật khẩu hiện tại
        <input
          id="cp-old"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <label htmlFor="cp-new">
        Mật khẩu mới (tối thiểu 8 ký tự)
        <input
          id="cp-new"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <label htmlFor="cp-confirm">
        Xác nhận mật khẩu mới
        <input
          id="cp-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13, background: 'var(--destructive-surface)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

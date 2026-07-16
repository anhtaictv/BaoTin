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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
      <label>
        Mật khẩu hiện tại
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <label>
        Mật khẩu mới (tối thiểu 8 ký tự)
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <label>
        Xác nhận mật khẩu mới
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--destructive)' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

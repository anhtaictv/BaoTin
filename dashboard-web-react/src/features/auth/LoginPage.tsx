import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

export function LoginPage() {
  const { account, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && account) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError('Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Báo Tin" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}>BÁO TIN</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <h1 style={{ color: 'var(--sidebar-ink)', fontSize: 30 }}>Báo Tin — Trung tâm điều hành</h1>
          <p style={{ color: 'var(--sidebar-ink-muted)', fontSize: 14.5, lineHeight: 1.7 }}>
            Kênh phản ứng nhanh cấp cơ sở: tiếp nhận tin báo từ người dân, định tuyến tức thời đến
            đúng cán bộ phụ trách địa bàn, rút ngắn thời gian xác minh — bổ trợ VNeID, không thay
            thế.
          </p>
        </div>

        <p style={{ color: 'var(--sidebar-ink-muted)', fontSize: 12 }}>Dành riêng cho cán bộ phụ trách địa bàn — 102 xã/phường.</p>
      </div>

      <div className="auth-form-panel">
        <form onSubmit={handleSubmit} className="rise-in" style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h2 style={{ fontSize: 22 }}>Đăng nhập</h2>
            <p style={{ color: 'var(--ink-muted)', fontSize: 13, marginTop: 4 }}>Nhập tài khoản được cấp để truy cập hệ thống.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label htmlFor="login-username">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <User size={13} /> Tên đăng nhập (số điện thoại)
              </span>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="09xxxxxxxx"
              />
            </label>
            <label htmlFor="login-password">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} /> Mật khẩu
              </span>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13, background: 'var(--destructive-surface)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary btn-block">
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

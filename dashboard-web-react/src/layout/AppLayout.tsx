import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../core/AuthContext';

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: 'block',
  padding: '8px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  color: isActive ? 'white' : 'var(--foreground)',
  background: isActive ? 'var(--primary)' : 'transparent',
});

/** Mirrors dashboard-web/lib/features/dashboard/dashboard_screen.dart's NavigationRail +
 * AppBar shell — sidebar destinations + top bar (refresh/account/logout). */
export function AppLayout() {
  const { account, logout } = useAuth();
  const queryClient = useQueryClient();

  function refreshAll() {
    queryClient.invalidateQueries();
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 220, borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Báo Tin</p>
        <NavLink to="/" end style={navLinkStyle}>
          Tổng quan
        </NavLink>
        <NavLink to="/reports" style={navLinkStyle}>
          Tin báo
        </NavLink>
        <NavLink to="/signals" style={navLinkStyle}>
          Tin nhanh
        </NavLink>
        <NavLink to="/search" style={navLinkStyle}>
          Tìm kiếm
        </NavLink>
        {account?.role === 'admin' && (
          <NavLink to="/admin/accounts" style={navLinkStyle}>
            Quản lý tài khoản
          </NavLink>
        )}
      </nav>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button onClick={refreshAll}>Làm mới</button>
          <NavLink to="/account">{account?.fullName ?? 'Tài khoản của tôi'}</NavLink>
          <button onClick={logout}>Đăng xuất</button>
        </header>
        <main style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, LogOut, Monitor, Moon, RadioTower, RefreshCw, Search, Siren, Sun, UsersRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../core/AuthContext';
import { canAccessDashboard, roleLabel } from '../core/theme';
import { useThemeMode, type ThemeMode } from '../core/ThemeModeContext';

const THEME_CYCLE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<ThemeMode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const THEME_LABEL: Record<ThemeMode, string> = {
  system: 'Giao diện: Theo hệ thống',
  light: 'Giao diện: Sáng',
  dark: 'Giao diện: Tối',
};

/** One button cycling system -> light -> dark -> system, rather than a 3-option dropdown — this
 * header only has room for compact icon buttons (see refresh button below), and a single click
 * target is enough for a toggle this low-frequency. */
function ThemeModeToggle() {
  const { mode, setMode } = useThemeMode();
  const Icon = THEME_ICON[mode];
  return (
    <button
      onClick={() => setMode(THEME_CYCLE[mode])}
      aria-label={THEME_LABEL[mode]}
      title={THEME_LABEL[mode]}
      className="btn-sm btn-ghost"
      style={{ display: 'inline-flex', alignItems: 'center', padding: 8 }}
    >
      <Icon size={16} />
    </button>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutGrid, end: true, dashboardOnly: true },
  { to: '/reports', label: 'Tin báo', icon: Siren, end: false, dashboardOnly: false },
  { to: '/signals', label: 'Tin nhanh', icon: RadioTower, end: false, dashboardOnly: false },
  { to: '/search', label: 'Tìm kiếm', icon: Search, end: false, dashboardOnly: true },
];

function navLinkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: isActive ? 600 : 500,
    color: isActive ? 'var(--sidebar-ink)' : 'var(--sidebar-ink-muted)',
    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
    transition: 'background-color 150ms ease, color 150ms ease',
  };
}

function SidebarLink({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutGrid; end: boolean }) {
  return (
    <NavLink to={to} end={end} style={navLinkStyle}>
      <Icon size={17} strokeWidth={2} />
      {label}
    </NavLink>
  );
}

/** Sidebar (dark command-center chrome) + slim topbar shell. Mirrors dashboard-web/lib/features
 * /dashboard/dashboard_screen.dart's NavigationRail + AppBar in intent, restyled for a real
 * design system. */
export function AppLayout() {
  const { account, logout } = useAuth();
  const queryClient = useQueryClient();

  function refreshAll() {
    queryClient.invalidateQueries();
  }

  const initials = (account?.fullName ?? '?')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav
        style={{
          width: 260,
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 22px' }}>
          <img
            src="/logo.png"
            alt="Báo Tin"
            style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
          />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.02em', color: 'var(--sidebar-ink)' }}>
              BÁO TIN
            </p>
            <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sidebar-ink-muted)' }}>
              Trung tâm điều hành
            </p>
          </div>
        </div>

        {NAV_ITEMS.filter((item) => !item.dashboardOnly || canAccessDashboard(account?.role)).map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}

        {account?.role === 'admin' && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--sidebar-border)', margin: '10px 4px' }} />
            <SidebarLink to="/accounts" label="Quản lý tài khoản" icon={UsersRound} end={false} />
          </>
        )}

        <div style={{ flex: 1 }} />

        <hr style={{ border: 'none', borderTop: '1px solid var(--sidebar-border)', margin: '8px 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavLink
            to="/account"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-full)',
                background: 'var(--sidebar-active-bg)',
                color: 'var(--sidebar-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11.5,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </span>
            <span style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--sidebar-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {account?.fullName ?? 'Tài khoản của tôi'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--sidebar-ink-muted)' }}>{account ? roleLabel(account.role) : ''}</p>
            </span>
          </NavLink>
          <button
            onClick={logout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="btn-ghost"
            style={{ color: 'var(--sidebar-ink-muted)', padding: 8, flexShrink: 0 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            background: 'var(--surface-raised)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <ThemeModeToggle />
          <button onClick={refreshAll} className="btn-sm btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </header>
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {/* Only the routed page (App.tsx's lazy() imports) suspends here — the sidebar/header
              shell above stays mounted across page navigations instead of flashing away. */}
          <Suspense fallback={<p>Đang tải...</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

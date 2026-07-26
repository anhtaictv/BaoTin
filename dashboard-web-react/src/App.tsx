import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './core/AuthContext';
import { canAccessDashboard, defaultRouteForRole } from './core/theme';
import { LoginPage } from './features/auth/LoginPage';
import { ChangePasswordGate } from './features/auth/ChangePasswordGate';
import { AccountPage } from './features/accounts/AccountPage';
import { AdminAccountsPage } from './features/accounts/AdminAccountsPage';
import { OverviewPage } from './features/dashboard/OverviewPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SignalsPage } from './features/signals/SignalsPage';
import { SearchPage } from './features/search/SearchPage';
import { AppLayout } from './layout/AppLayout';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth();
  if (loading) return <p>Đang tải...</p>;
  if (!account) return <Navigate to="/login" replace />;
  return <ChangePasswordGate>{children}</ChangePasswordGate>;
}

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (account?.role !== 'admin') return <Navigate to={defaultRouteForRole(account?.role)} replace />;
  return <>{children}</>;
}

/** "Tổng quan" (/admin/dashboard/*) and "Tìm kiếm" (/admin/search) 403 for a plain "officer"
 * account at the backend — redirect away instead of letting the tab render into a dead-end
 * API error. Mirrors AdminOnlyRoute's pattern, one role tier down. */
function DashboardOnlyRoute({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  if (!canAccessDashboard(account?.role)) return <Navigate to={defaultRouteForRole(account?.role)} replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <DashboardOnlyRoute>
              <OverviewPage />
            </DashboardOnlyRoute>
          }
        />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="signals" element={<SignalsPage />} />
        <Route
          path="search"
          element={
            <DashboardOnlyRoute>
              <SearchPage />
            </DashboardOnlyRoute>
          }
        />
        <Route path="account" element={<AccountPage />} />
        <Route
          path="accounts"
          element={
            <AdminOnlyRoute>
              <AdminAccountsPage />
            </AdminOnlyRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;

import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './core/AuthContext';
import { canAccessDashboard, defaultRouteForRole } from './core/theme';
import { ChangePasswordGate } from './features/auth/ChangePasswordGate';
import { AppLayout } from './layout/AppLayout';

// Route-level code splitting: OverviewPage alone pulls in recharts + leaflet (react-leaflet),
// which used to ship in the single ~1.5MB main bundle even for an officer who only ever opens
// /reports — every page below now loads its JS on first visit instead of on every login.
const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const AccountPage = lazy(() => import('./features/accounts/AccountPage').then((m) => ({ default: m.AccountPage })));
const AdminAccountsPage = lazy(() =>
  import('./features/accounts/AdminAccountsPage').then((m) => ({ default: m.AdminAccountsPage })),
);
const OverviewPage = lazy(() => import('./features/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SignalsPage = lazy(() => import('./features/signals/SignalsPage').then((m) => ({ default: m.SignalsPage })));
const SearchPage = lazy(() => import('./features/search/SearchPage').then((m) => ({ default: m.SearchPage })));
const LegalLookupPage = lazy(() =>
  import('./features/legal_lookup/LegalLookupPage').then((m) => ({ default: m.LegalLookupPage })),
);
const CamerasPage = lazy(() => import('./features/cameras/CamerasPage').then((m) => ({ default: m.CamerasPage })));

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
      <Route
        path="/login"
        element={
          <Suspense fallback={<p>Đang tải...</p>}>
            <LoginPage />
          </Suspense>
        }
      />
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
        <Route path="legal-lookup" element={<LegalLookupPage />} />
        <Route path="cameras" element={<CamerasPage />} />
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

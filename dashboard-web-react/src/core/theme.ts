/**
 * Ported 1:1 from dashboard-web/lib/core/theme.dart's status/urgency/trustLevel/heatLevel
 * color+label mapping — kept as a literal copy (no shared package across the Flutter and
 * React clients) so all 4 clients (mobile-app-officer, mobile-app-citizen, dashboard-web,
 * dashboard-web-react) agree on what each value means visually.
 */

export const theme = {
  primary: '#1E40AF',
  secondary: '#3B82F6',
  accent: '#D97706',
  backgroundLight: '#F8FAFC',
  foregroundLight: '#1E3A8A',
  borderLight: '#DBEAFE',
  destructiveLight: '#DC2626',
};

export function statusColor(status: string): string {
  switch (status) {
    case 'confirmed_true':
      return '#2E7D32';
    case 'confirmed_false':
      return '#757575';
    case 'verifying':
      return '#F9A825';
    case 'pending':
    default:
      return theme.primary;
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed_true':
      return 'Đúng sự thật';
    case 'confirmed_false':
      return 'Tin sai';
    case 'verifying':
      return 'Đang xác minh';
    case 'pending':
    default:
      return 'Chờ xử lý';
  }
}

export function urgencyColor(urgency: string): string {
  return urgency === 'emergency' ? '#D32F2F' : '#64748B';
}

export function urgencyLabel(urgency: string): string {
  return urgency === 'emergency' ? 'KHẨN CẤP' : 'Bình thường';
}

/** CLAUDE.md nguyên tắc #1: tín hiệu MXH/báo chí không bao giờ được gắn nhãn giống tin đã
 * xác thực — bảng màu hoàn toàn khác statusColor/urgencyColor (tím/xám). */
export function trustLevelColor(trustLevel: string): string {
  return trustLevel === 'verified_press' ? '#6A1B9A' : '#64748B';
}

export function trustLevelLabel(trustLevel: string): string {
  return trustLevel === 'verified_press' ? 'Báo chí' : 'MXH — chưa xác thực';
}

export function heatLevelColor(level: string): string {
  switch (level) {
    case 'high':
      return '#D32F2F';
    case 'medium':
      return '#F9A825';
    case 'low':
    default:
      return '#94A3B8';
  }
}

export function heatLevelLabel(level: string): string {
  switch (level) {
    case 'high':
      return 'Nóng';
    case 'medium':
      return 'Đang tăng';
    case 'low':
    default:
      return 'Bình thường';
  }
}

/** Backend role gates (docs/API_SPEC.md — /admin/dashboard/*, /admin/search are 403 for a
 * plain "officer"): kept here so the frontend route guards/nav in App.tsx and AppLayout.tsx
 * read from one place instead of drifting out of sync with each other. */
export const DASHBOARD_ONLY_ROLES = ['admin', 'senior_officer'];

export function canAccessDashboard(role: string | undefined): boolean {
  return role != null && DASHBOARD_ONLY_ROLES.includes(role);
}

/** Where to send an account after login/after being bounced from a role-gated route — the
 * first route every role is guaranteed backend access to. */
export function defaultRouteForRole(role: string | undefined): string {
  return canAccessDashboard(role) ? '/' : '/reports';
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'senior_officer':
      return 'Cán bộ cấp cao';
    case 'admin':
      return 'Quản trị viên';
    case 'officer':
    default:
      return 'Cán bộ';
  }
}

/** Ported 1:1 from theme.dart's categoryOptions (both Flutter apps) — kept in sync so a
 * report's category reads the same Vietnamese label everywhere a citizen/officer/admin sees
 * it. category is free-text on the backend (Report.category is String?, not an enum), so any
 * value not in this map falls back to the raw code rather than hiding it. */
const CATEGORY_LABELS: Record<string, string> = {
  trom_cap: 'Trộm cắp',
  tai_nan: 'Tai nạn',
  chay_no: 'Cháy nổ',
  an_ninh_khan_cap: 'An ninh khẩn cấp',
  khac: 'Khác',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function extractionStatusLabel(status: string): string {
  switch (status) {
    case 'sent':
      return 'Đã gửi';
    case 'fulfilled':
      return 'Đã xử lý';
    case 'rejected':
      return 'Từ chối';
    case 'pending':
    default:
      return 'Đang chờ';
  }
}

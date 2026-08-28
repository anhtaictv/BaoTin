import { apiClient } from '../../core/apiClient';

export interface WebAccountSummary {
  officerId: string;
  username: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isLocked: boolean;
  fullName: string;
  unitName: string | null;
  role: string;
  districts: string[];
}

export async function listWebAccounts(): Promise<WebAccountSummary[]> {
  return (await apiClient.get('/admin/web-accounts')).data.data as WebAccountSummary[];
}

/** Returns the new one-time temp password — shown once in the UI, never persisted client-side. */
export async function resetWebAccountPassword(officerId: string): Promise<string> {
  const res = await apiClient.post(`/admin/web-accounts/${officerId}/reset-password`);
  return (res.data.data as { tempPassword: string }).tempPassword;
}

export type OfficerRole = 'officer' | 'senior_officer' | 'commune_head' | 'admin';

/** Nâng/hạ tầng tài khoản — backend/src/services/accountRegistration.service.ts's setOfficerRole. */
export async function setOfficerRole(officerId: string, role: OfficerRole): Promise<void> {
  await apiClient.patch(`/admin/officers/${officerId}/role`, { role });
}

/** Gán (hoặc thêm) tài khoản vào 1 xã/phường mới — cùng endpoint dùng để duyệt officer tự
 * đăng ký (idempotent, upsert theo (officerId, districtId)), tái dùng ở đây để đảm bảo một
 * tài khoản vừa nâng lên commune_head có địa bàn để phụ trách. */
export async function assignOfficerToDistrict(officerId: string, districtId: string): Promise<void> {
  await apiClient.post(`/admin/officers/${officerId}/approve`, { districtId });
}

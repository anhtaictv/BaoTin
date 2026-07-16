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

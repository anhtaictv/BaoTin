import { apiClient } from '../../core/apiClient';

export interface CommuneHeadDistrict {
  districtId: string;
  tenXa: string;
}

export interface OldWardOption {
  oldDistrictId: string;
  tenXa: string;
  tenHuyen: string | null;
  tenTinh: string | null;
  overlapRatio: number;
}

export interface SubordinateSummary {
  officerId: string;
  fullName: string;
  oldDistrictId: string | null;
  oldWardLabel: string | null;
}

/** null for every role except commune_head (admin has no single "own district" — unrestricted
 * across all). Used to auto-select the district when a trưởng xã opens the page. */
export async function getMyCommuneDistrict(): Promise<CommuneHeadDistrict | null> {
  return (await apiClient.get('/officer/commune/my-district')).data.data as CommuneHeadDistrict | null;
}

export async function listOldWards(districtId: string): Promise<OldWardOption[]> {
  return (await apiClient.get(`/officer/commune/${districtId}/old-wards`)).data.data as OldWardOption[];
}

export async function listSubordinates(districtId: string): Promise<SubordinateSummary[]> {
  return (await apiClient.get(`/officer/commune/${districtId}/subordinates`)).data.data as SubordinateSummary[];
}

/** oldDistrictId: null clears the sub-area (cấp dưới phụ trách toàn bộ xã/phường mới). */
export async function assignSubordinate(districtId: string, officerId: string, oldDistrictId: string | null): Promise<void> {
  await apiClient.post(`/officer/commune/${districtId}/subordinates/${officerId}/assignment`, { oldDistrictId });
}

/** Admin-only — the full 102-xã list, for the district picker admin gets instead of a fixed
 * "own district" (reuses the officer-approval endpoint, same 102-row shape). */
export async function listAllDistricts(): Promise<{ id: string; tenXa: string }[]> {
  return (await apiClient.get('/admin/officers/districts')).data.data as { id: string; tenXa: string }[];
}

import { apiClient } from '../../core/apiClient';

export interface NearbyCamera {
  id: string;
  name: string;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  distanceMeters: number;
}

export async function getNearbyCameras(reportId: string): Promise<NearbyCamera[]> {
  const res = await apiClient.get(`/officer/reports/${reportId}/nearby-cameras`, { params: { radius_m: 500 } });
  return res.data.data as NearbyCamera[];
}

/** One call, N cameras — backend creates one independent administrative request row per
 * camera (see backend/src/services/cameraExtraction.service.ts's v1.9.0 groupId behavior). */
export async function createExtractionRequest(
  reportId: string,
  input: { cameraIds: string[]; timeRangeStart: string; timeRangeEnd: string; note?: string },
): Promise<void> {
  await apiClient.post(`/officer/reports/${reportId}/camera-extraction-requests`, input);
}

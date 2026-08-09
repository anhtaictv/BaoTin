import { apiClient } from '../../core/apiClient';

export interface NearbyCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  distanceMeters: number;
  directionDegrees: number | null;
  fovDegrees: number | null;
  /** null = unknown (no direction data). true/false = whether the camera's own facing
   * direction actually covers this report's location, not just "nearby". */
  facesLocation: boolean | null;
}

export interface DistrictCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string | null;
  managingUnitContact: string | null;
  districtId: string | null;
  directionDegrees: number | null;
  fovDegrees: number | null;
}

export interface CameraInput {
  name: string;
  lat: number;
  lng: number;
  managingUnitName?: string;
  managingUnitContact?: string;
  districtId: string;
  directionDegrees?: number;
  fovDegrees?: number;
}

export async function getNearbyCameras(reportId: string): Promise<NearbyCamera[]> {
  const res = await apiClient.get(`/officer/reports/${reportId}/nearby-cameras`, { params: { radius_m: 500 } });
  return res.data.data as NearbyCamera[];
}

/** All cameras in the officer's own assigned district(s) — for the standalone "Camera" map
 * page (backend/src/services/cameraExtraction.service.ts's listDistrictCameras). */
export async function getDistrictCameras(): Promise<DistrictCamera[]> {
  const res = await apiClient.get('/officer/cameras');
  return res.data.data as DistrictCamera[];
}

/** Admin/senior_officer only (enforced server-side) — registers a real camera. */
export async function createCamera(input: CameraInput): Promise<DistrictCamera> {
  const res = await apiClient.post('/officer/cameras', input);
  return res.data.data as DistrictCamera;
}

/** Full replace, not a partial patch — always sends every field back. */
export async function updateCamera(id: string, input: CameraInput): Promise<DistrictCamera> {
  const res = await apiClient.put(`/officer/cameras/${id}`, input);
  return res.data.data as DistrictCamera;
}

/** 409s (not a raw 500) if the camera already has an extraction request or traffic-accident
 * alert pointing at it (backend/src/services/cameraExtraction.service.ts's deleteCamera). */
export async function deleteCamera(id: string): Promise<void> {
  await apiClient.delete(`/officer/cameras/${id}`);
}

/** One call, N cameras — backend creates one independent administrative request row per
 * camera (see backend/src/services/cameraExtraction.service.ts's v1.9.0 groupId behavior). */
export async function createExtractionRequest(
  reportId: string,
  input: { cameraIds: string[]; timeRangeStart: string; timeRangeEnd: string; note?: string },
): Promise<void> {
  await apiClient.post(`/officer/reports/${reportId}/camera-extraction-requests`, input);
}

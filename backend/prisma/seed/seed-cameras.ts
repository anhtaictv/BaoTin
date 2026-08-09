import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface SeedCameraSpec {
  name: string;
  lat: number;
  lng: number;
  managingUnitName: string;
  managingUnitContact: string;
  /** Must match a districts.ten_xa value seeded from data/raw/Daklak.geojson. */
  wardTenXa: string;
  /** Compass bearing (0-359, 0 = Bắc) the lens faces — hand-estimated from the camera's
   * named location (which intersection/street side it sits on), not measured on-site. Real
   * cameras added later should get a surveyed value instead of a guess. */
  directionDegrees: number;
  /** Field-of-view width in degrees — typical fixed security-camera lens, not a spec sheet value. */
  fovDegrees: number;
}

/**
 * Obviously-fake demo cameras ([DEMO] prefix), placed near the same seeded wards as
 * seed-officers.ts. CLAUDE.md non-negotiable #8: only location + contact info — never a
 * video/stream URL, since this system never connects to camera feeds itself.
 */
export const SEED_CAMERAS: SeedCameraSpec[] = [
  {
    name: "[DEMO] Camera ngã tư Lê Duẩn - Nguyễn Tất Thành",
    lat: 12.678,
    lng: 108.05,
    managingUnitName: "Công an phường Buôn Ma Thuột",
    managingUnitContact: "0900000001",
    wardTenXa: "Buôn Ma Thuột",
    directionDegrees: 135,
    fovDegrees: 80,
  },
  {
    name: "[DEMO] Camera chợ trung tâm Buôn Ma Thuột",
    lat: 12.682,
    lng: 108.048,
    managingUnitName: "Ban quản lý chợ trung tâm",
    managingUnitContact: "0900000005",
    wardTenXa: "Buôn Ma Thuột",
    directionDegrees: 270,
    fovDegrees: 90,
  },
  {
    name: "[DEMO] Camera bến xe Buôn Hồ",
    lat: 12.91,
    lng: 108.27,
    managingUnitName: "Công an phường Buôn Hồ",
    managingUnitContact: "0900000002",
    wardTenXa: "Buôn Hồ",
    directionDegrees: 0,
    fovDegrees: 100,
  },
];

export async function seedCameras(prisma: PrismaClient, cameras: SeedCameraSpec[] = SEED_CAMERAS): Promise<void> {
  for (const spec of cameras) {
    const district = await prisma.district.findFirst({ where: { tenXa: spec.wardTenXa } });
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO cameras (
        id, name, location, managing_unit_name, managing_unit_contact, district_id,
        direction_degrees, fov_degrees
      )
      VALUES (
        ${id}::uuid, ${spec.name},
        ST_SetSRID(ST_MakePoint(${spec.lng}, ${spec.lat}), 4326),
        ${spec.managingUnitName}, ${spec.managingUnitContact}, ${district?.id ?? null}::uuid,
        ${spec.directionDegrees}, ${spec.fovDegrees}
      )
    `;
    // eslint-disable-next-line no-console
    console.log(`[seed-cameras] ${spec.name} -> ${spec.wardTenXa}`);
  }
}

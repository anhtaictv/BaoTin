import type { PrismaClient } from "@prisma/client";
import type { GeoMatchService } from "../geo/geoMatch.service.js";

export interface EmergencyContactsDeps {
  prisma: PrismaClient;
  geoMatch: GeoMatchService;
}

export interface EmergencyContactResult {
  contactType: string;
  name: string;
  phoneNumber: string;
  note: string | null;
  /** True if this is a district-specific contact rather than the national default. */
  isLocal: boolean;
}

/**
 * Giai đoạn 3 "Danh bạ khẩn cấp tự động theo vị trí" — API_SPEC.md `GET /emergency-contacts`.
 * districtId=null rows (113/114/115 quốc gia) luôn có sẵn; nếu địa bàn xác định được có
 * liên hệ riêng cho cùng contactType, ưu tiên liên hệ riêng đó thay vì số quốc gia.
 */
export function createEmergencyContactsService(deps: EmergencyContactsDeps) {
  async function getEmergencyContacts(params: { lat: number; lng: number }): Promise<EmergencyContactResult[]> {
    let districtId = await deps.geoMatch.matchDistrict(params);
    if (!districtId) {
      districtId = await deps.geoMatch.matchNearestDistrict(params);
    }

    const rows = await deps.prisma.emergencyContact.findMany({
      where: districtId ? { OR: [{ districtId }, { districtId: null }] } : { districtId: null },
    });

    const byType = new Map<string, EmergencyContactResult>();
    for (const row of rows) {
      const isLocal = row.districtId !== null;
      const existing = byType.get(row.contactType);
      // District-specific always wins over the national default for the same type.
      if (!existing || (isLocal && !existing.isLocal)) {
        byType.set(row.contactType, {
          contactType: row.contactType,
          name: row.name,
          phoneNumber: row.phoneNumber,
          note: row.note,
          isLocal,
        });
      }
    }

    return [...byType.values()];
  }

  return { getEmergencyContacts };
}

export type EmergencyContactsService = ReturnType<typeof createEmergencyContactsService>;

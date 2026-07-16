import type { PrismaClient } from "@prisma/client";

export interface SeedEmergencyContactSpec {
  contactType: "police" | "medical" | "fire";
  name: string;
  phoneNumber: string;
  note?: string;
  /** Must match a districts.ten_xa value seeded from data/raw/Daklak.geojson, or undefined
   * for a national default (districtId stays null). */
  wardTenXa?: string;
}

/**
 * The 3 national numbers are real, well-known Vietnam-wide hotlines — safe to ship even
 * outside a demo (113 = police, 114 = fire, 115 = medical). Everything below with a
 * "[DEMO]" prefix is obviously-fake placeholder data (same convention as seed-officers.ts/
 * seed-cameras.ts) standing in for a specific police/medical/fire station's real number,
 * which we have no way to verify — never present a guessed number as if it were real.
 */
export const SEED_EMERGENCY_CONTACTS: SeedEmergencyContactSpec[] = [
  { contactType: "police", name: "Công an (toàn quốc)", phoneNumber: "113" },
  { contactType: "fire", name: "Cứu hỏa (toàn quốc)", phoneNumber: "114" },
  { contactType: "medical", name: "Cấp cứu y tế (toàn quốc)", phoneNumber: "115" },
  {
    contactType: "police",
    name: "[DEMO] Công an phường Buôn Ma Thuột",
    phoneNumber: "0900000001",
    wardTenXa: "Buôn Ma Thuột",
  },
  {
    contactType: "medical",
    name: "[DEMO] Trung tâm y tế Buôn Ma Thuột",
    phoneNumber: "0900000101",
    wardTenXa: "Buôn Ma Thuột",
  },
  {
    contactType: "police",
    name: "[DEMO] Công an phường Buôn Hồ",
    phoneNumber: "0900000002",
    wardTenXa: "Buôn Hồ",
  },
];

export async function seedEmergencyContacts(
  prisma: PrismaClient,
  contacts: SeedEmergencyContactSpec[] = SEED_EMERGENCY_CONTACTS,
): Promise<void> {
  for (const spec of contacts) {
    const district = spec.wardTenXa ? await prisma.district.findFirst({ where: { tenXa: spec.wardTenXa } }) : null;
    await prisma.emergencyContact.create({
      data: {
        contactType: spec.contactType,
        name: spec.name,
        phoneNumber: spec.phoneNumber,
        note: spec.note,
        districtId: district?.id ?? null,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[seed-emergency-contacts] ${spec.name} (${spec.contactType}) -> ${spec.wardTenXa ?? "toàn quốc"}`);
  }
}

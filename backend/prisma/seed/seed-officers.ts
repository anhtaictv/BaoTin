import type { PrismaClient } from "@prisma/client";
import { encryptField } from "../../src/crypto/aesGcm.js";
import { hashPhoneNumber } from "../../src/crypto/phoneBlindIndex.js";
import { upsertWholeDistrictAssignment } from "../../src/db/officerDistrictAssignment.js";

export interface SeedOfficerSpec {
  fullName: string;
  phoneNumber: string;
  unitName: string;
  /** Must match a districts.ten_xa value seeded from data/raw/Daklak.geojson. */
  wardTenXa: string;
  /** Defaults to 'officer' — see backend/prisma/schema.prisma OfficerRole. */
  role?: "officer" | "senior_officer" | "commune_head" | "admin";
}

/** Obviously-fake demo data — [DEMO] prefix + 09000000xx numbers, never a real officer roster. */
export const SEED_OFFICERS: SeedOfficerSpec[] = [
  {
    fullName: "[DEMO] Nguyễn Văn A",
    phoneNumber: "0900000001",
    unitName: "Công an phường Buôn Ma Thuột",
    wardTenXa: "Buôn Ma Thuột",
  },
  {
    fullName: "[DEMO] Trần Thị B",
    phoneNumber: "0900000002",
    unitName: "Công an phường Buôn Hồ",
    wardTenXa: "Buôn Hồ",
  },
  {
    fullName: "[DEMO] Lê Văn C",
    phoneNumber: "0900000003",
    unitName: "Công an xã Cư M’gar",
    wardTenXa: "Cư M’gar",
  },
  {
    fullName: "[DEMO] Phạm Thị D",
    phoneNumber: "0900000004",
    unitName: "Công an xã Cư Pơng",
    wardTenXa: "Cư Pơng",
  },
  {
    fullName: "[DEMO] Y Bơn Niê — Trưởng xã",
    phoneNumber: "0900000098",
    unitName: "UBND phường Buôn Ma Thuột",
    wardTenXa: "Buôn Ma Thuột",
    role: "commune_head",
  },
  {
    fullName: "[DEMO] Quản trị — Trung tâm điều hành",
    phoneNumber: "0900000099",
    unitName: "Trung tâm điều hành",
    wardTenXa: "Buôn Ma Thuột",
    role: "admin",
  },
  // Vùng Phú Yên cũ (sáp nhập vào Đắk Lắk 2025) — trải theo địa hình: đô thị ven biển,
  // đồng bằng, miền núi, để demo geo-matching hoạt động đúng trên toàn bộ tỉnh mới.
  {
    fullName: "[DEMO] Hoàng Văn E",
    phoneNumber: "0900000005",
    unitName: "Công an phường Tuy Hòa",
    wardTenXa: "Tuy Hòa",
  },
  {
    fullName: "[DEMO] Ngô Thị F",
    phoneNumber: "0900000006",
    unitName: "Công an phường Sông Cầu",
    wardTenXa: "Sông Cầu",
  },
  {
    fullName: "[DEMO] Đặng Văn G",
    phoneNumber: "0900000007",
    unitName: "Công an phường Đông Hòa",
    wardTenXa: "Đông Hòa",
  },
  {
    fullName: "[DEMO] Bùi Thị H",
    phoneNumber: "0900000008",
    unitName: "Công an xã Tuy An Đông",
    wardTenXa: "Tuy An Đông",
  },
  {
    fullName: "[DEMO] Võ Văn I",
    phoneNumber: "0900000009",
    unitName: "Công an xã Sơn Hòa",
    wardTenXa: "Sơn Hòa",
  },
  {
    fullName: "[DEMO] Lý Thị K",
    phoneNumber: "0900000010",
    unitName: "Công an xã Sông Hinh",
    wardTenXa: "Sông Hinh",
  },
  {
    fullName: "[DEMO] Trương Văn L",
    phoneNumber: "0900000011",
    unitName: "Công an xã Đồng Xuân",
    wardTenXa: "Đồng Xuân",
  },
  {
    fullName: "[DEMO] Phan Thị M",
    phoneNumber: "0900000012",
    unitName: "Công an xã Phú Hòa 1",
    wardTenXa: "Phú Hòa 1",
  },
];

export interface SeedOfficersDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
  phoneBlindIndexKey: string;
  officers?: SeedOfficerSpec[];
}

export interface DistrictForAutoSeed {
  id: string;
  tenXa: string;
  loai: string | null;
}

/**
 * Pure mapping (testable without a DB): one deterministic demo officer per district that
 * isn't already covered by the hand-picked SEED_OFFICERS list above. Phone numbers start at
 * 0900001000 — well clear of the manually-assigned 0900000001-0900000099 range, so the two
 * generation strategies never collide.
 */
export function buildAutoOfficerSpec(district: DistrictForAutoSeed, sequenceNumber: number): SeedOfficerSpec {
  const phoneNumber = `09${String(1000 + sequenceNumber).padStart(8, "0")}`;
  const unitLabel = district.loai ? `${district.loai} ${district.tenXa}` : district.tenXa;
  return {
    fullName: `[DEMO] Cán bộ phụ trách ${unitLabel}`,
    phoneNumber,
    unitName: `Công an ${unitLabel}`,
    wardTenXa: district.tenXa,
  };
}

/**
 * Seeds demo officers through the same encryptField/hashPhoneNumber path used at runtime
 * (never a raw-plaintext insert) and assigns each to a real seeded ward by ten_xa lookup.
 */
export async function seedOfficers(deps: SeedOfficersDeps): Promise<void> {
  const specs = deps.officers ?? SEED_OFFICERS;

  for (const spec of specs) {
    const district = await deps.prisma.district.findFirst({ where: { tenXa: spec.wardTenXa } });
    if (!district) {
      // eslint-disable-next-line no-console
      console.warn(`[seed-officers] district "${spec.wardTenXa}" not found — run seed-districts first. Skipping ${spec.fullName}.`);
      continue;
    }

    const phoneHash = hashPhoneNumber(spec.phoneNumber, deps.phoneBlindIndexKey);
    const officer = await deps.prisma.officer.upsert({
      where: { phoneHash },
      update: {},
      create: {
        phoneHash,
        phoneNumberEnc: encryptField(spec.phoneNumber, deps.piiEncryptionKey),
        fullNameEnc: encryptField(spec.fullName, deps.piiEncryptionKey),
        unitName: spec.unitName,
        role: spec.role ?? "officer",
      },
    });

    await upsertWholeDistrictAssignment(deps.prisma, officer.id, district.id);

    // eslint-disable-next-line no-console
    console.log(`[seed-officers] ${spec.fullName} -> ${spec.wardTenXa}`);
  }
}

/**
 * Ensures EVERY seeded district (all 102 xã/phường from data/raw/Daklak.geojson) has an
 * active officer assignment — not just the 4 hand-picked wards above. Without this, a
 * citizen report whose GPS geo-matches to any of the other ~98 wards would find a district
 * but no officer to assign/notify (see reportLifecycle.service.ts createCitizenReport:
 * assignedOfficerId stays null and no notification fires). Districts already covered by
 * SEED_OFFICERS (via seedOfficers, called first in prisma/seed/index.ts) are skipped.
 */
export async function seedOfficersForAllDistricts(deps: SeedOfficersDeps): Promise<void> {
  const districts = await deps.prisma.district.findMany({
    select: { id: true, tenXa: true, loai: true },
    orderBy: { tenXa: "asc" },
  });

  const activeAssignments = await deps.prisma.officerDistrictAssignment.findMany({
    where: { isActive: true },
    select: { districtId: true },
  });
  const coveredDistrictIds = new Set(activeAssignments.map((a) => a.districtId));

  let sequenceNumber = 0;
  for (const district of districts) {
    if (coveredDistrictIds.has(district.id)) continue;
    sequenceNumber += 1;
    await seedOfficers({ ...deps, officers: [buildAutoOfficerSpec(district, sequenceNumber)] });
  }

  // eslint-disable-next-line no-console
  console.log(
    `[seed-officers] auto-covered ${sequenceNumber} additional district(s) — every seeded ` +
      `district now has an active officer to receive geo-matched report notifications.`,
  );
}

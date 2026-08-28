import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCommuneAssignmentService } from "./communeAssignment.service.js";
import { encryptField } from "../crypto/aesGcm.js";

const PII_KEY = randomBytes(32).toString("base64");

interface FakeAssignmentRow {
  id: string;
  officerId: string;
  districtId: string;
  oldDistrictId: string | null;
  isActive: boolean;
  role: string;
}

function fakePrisma() {
  const assignments = new Map<string, FakeAssignmentRow>();
  const districts = new Map<string, { id: string; tenXa: string }>();
  const oldDistricts = new Map<string, { id: string; tenXa: string; tenHuyen: string | null; tenTinh: string | null }>();
  const overlaps: { oldDistrictId: string; districtId: string; overlapRatio: number }[] = [];
  const auditLogRows: unknown[] = [];

  return {
    store: { assignments, districts, oldDistricts, overlaps, auditLogRows },
    officerDistrictAssignment: {
      async findFirst({ where }: any) {
        const row = [...assignments.values()].find(
          (a) =>
            a.officerId === where.officerId &&
            (where.districtId === undefined || a.districtId === where.districtId) &&
            (where.oldDistrictId === undefined || a.oldDistrictId === where.oldDistrictId) &&
            (where.isActive === undefined || a.isActive === where.isActive) &&
            (where.officer?.role === undefined || a.role === where.officer.role),
        );
        if (!row) return null;
        return { ...row, district: districts.get(row.districtId)! };
      },
      async findMany({ where }: any) {
        return [...assignments.values()]
          .filter(
            (a) =>
              a.districtId === where.districtId &&
              (where.isActive === undefined || a.isActive === where.isActive) &&
              (where.officer?.role === undefined || a.role === where.officer.role),
          )
          .map((a) => ({
            ...a,
            district: districts.get(a.districtId)!,
            officer: { id: a.officerId, fullNameEnc: encryptField(`Cán bộ ${a.officerId.slice(0, 4)}`, PII_KEY) },
            oldDistrict: a.oldDistrictId ? oldDistricts.get(a.oldDistrictId) ?? null : null,
          }));
      },
      async update({ where, data }: any) {
        const row = assignments.get(where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      },
    },
    oldDistrictOverlap: {
      async findMany({ where }: any) {
        return overlaps
          .filter((o) => o.districtId === where.districtId)
          .sort((a, b) => b.overlapRatio - a.overlapRatio)
          .map((o) => ({ ...o, oldDistrict: oldDistricts.get(o.oldDistrictId)! }));
      },
      async findUnique({ where }: any) {
        const k = where.oldDistrictId_districtId;
        return overlaps.find((o) => o.oldDistrictId === k.oldDistrictId && o.districtId === k.districtId) ?? null;
      },
    },
    adminAuditLog: {
      async create({ data }: any) {
        auditLogRows.push(data);
      },
    },
  };
}

function build() {
  const prisma = fakePrisma();
  const auditLog = {
    async record(officerId: string, action: string, target?: unknown, metadata?: unknown) {
      prisma.store.auditLogRows.push({ officerId, action, target, metadata });
    },
  };
  const service = createCommuneAssignmentService({ prisma: prisma as any, piiEncryptionKey: PII_KEY, auditLog: auditLog as any });
  return { prisma, service };
}

describe("communeAssignment.service", () => {
  it("getCommuneHeadDistrict finds the head's own district-level assignment", async () => {
    const { prisma, service } = build();
    const headId = randomUUID();
    const districtId = randomUUID();
    prisma.store.districts.set(districtId, { id: districtId, tenXa: "Phường Buôn Ma Thuột" });
    prisma.store.assignments.set(randomUUID(), {
      id: randomUUID(),
      officerId: headId,
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "commune_head",
    });

    const result = await service.getCommuneHeadDistrict(headId);
    expect(result).toEqual({ districtId, tenXa: "Phường Buôn Ma Thuột" });
  });

  it("getCommuneHeadDistrict returns null for someone with no district-level assignment", async () => {
    const { service } = build();
    await expect(service.getCommuneHeadDistrict(randomUUID())).resolves.toBeNull();
  });

  it("getCommuneHeadDistrict returns null for a plain officer, even though their default (un-sub-assigned) row also has oldDistrictId null", async () => {
    const { prisma, service } = build();
    const officerId = randomUUID();
    const districtId = randomUUID();
    prisma.store.districts.set(districtId, { id: districtId, tenXa: "Phường X" });
    prisma.store.assignments.set(randomUUID(), {
      id: randomUUID(),
      officerId,
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "officer",
    });

    await expect(service.getCommuneHeadDistrict(officerId)).resolves.toBeNull();
  });

  it("listOldWardsForDistrict returns overlaps sorted by ratio descending", async () => {
    const { prisma, service } = build();
    const districtId = randomUUID();
    const oldA = randomUUID();
    const oldB = randomUUID();
    prisma.store.oldDistricts.set(oldA, { id: oldA, tenXa: "An Phú", tenHuyen: "Tuy Hòa", tenTinh: "Phú Yên" });
    prisma.store.oldDistricts.set(oldB, { id: oldB, tenXa: "Hòa Kiến", tenHuyen: "Tuy Hòa", tenTinh: "Phú Yên" });
    prisma.store.overlaps.push({ oldDistrictId: oldA, districtId, overlapRatio: 0.3 });
    prisma.store.overlaps.push({ oldDistrictId: oldB, districtId, overlapRatio: 0.9 });

    const result = await service.listOldWardsForDistrict(districtId);
    expect(result.map((r) => r.tenXa)).toEqual(["Hòa Kiến", "An Phú"]);
  });

  it("assignSubordinateOldDistrict lets a commune_head assign a valid old ward to their own subordinate", async () => {
    const { prisma, service } = build();
    const headId = randomUUID();
    const subId = randomUUID();
    const districtId = randomUUID();
    const oldDistrictId = randomUUID();
    prisma.store.districts.set(districtId, { id: districtId, tenXa: "X" });
    prisma.store.oldDistricts.set(oldDistrictId, { id: oldDistrictId, tenXa: "Old X", tenHuyen: null, tenTinh: null });
    prisma.store.overlaps.push({ oldDistrictId, districtId, overlapRatio: 0.5 });
    prisma.store.assignments.set(randomUUID(), {
      id: "head-row",
      officerId: headId,
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "commune_head",
    });
    const subRowId = randomUUID();
    prisma.store.assignments.set(subRowId, {
      id: subRowId,
      officerId: subId,
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "officer",
    });

    await service.assignSubordinateOldDistrict({ id: headId, role: "commune_head" }, districtId, subId, oldDistrictId);

    expect(prisma.store.assignments.get(subRowId)?.oldDistrictId).toBe(oldDistrictId);
    expect(prisma.store.auditLogRows).toHaveLength(1);
  });

  it("rejects a commune_head assigning outside their own district — the core security guarantee", async () => {
    const { prisma, service } = build();
    const headId = randomUUID();
    const myDistrict = randomUUID();
    const otherDistrict = randomUUID();
    prisma.store.districts.set(myDistrict, { id: myDistrict, tenXa: "My" });
    prisma.store.assignments.set("head-row", {
      id: "head-row",
      officerId: headId,
      districtId: myDistrict,
      oldDistrictId: null,
      isActive: true,
      role: "commune_head",
    });

    await expect(
      service.assignSubordinateOldDistrict({ id: headId, role: "commune_head" }, otherDistrict, randomUUID(), null),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an old ward that doesn't overlap the target district", async () => {
    const { prisma, service } = build();
    const adminId = randomUUID();
    const districtId = randomUUID();
    const subId = randomUUID();
    const wrongOldDistrictId = randomUUID();
    const subRowId = randomUUID();
    prisma.store.assignments.set(subRowId, {
      id: subRowId,
      officerId: subId,
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "officer",
    });

    await expect(
      service.assignSubordinateOldDistrict({ id: adminId, role: "admin" }, districtId, subId, wrongOldDistrictId),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects assigning a target who isn't an active 'officer'-tier subordinate of that district", async () => {
    const { service } = build();
    await expect(
      service.assignSubordinateOldDistrict({ id: randomUUID(), role: "admin" }, randomUUID(), randomUUID(), null),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("listSubordinates only returns officer-tier rows, with decrypted names and old-ward labels", async () => {
    const { prisma, service } = build();
    const districtId = randomUUID();
    const oldDistrictId = randomUUID();
    prisma.store.oldDistricts.set(oldDistrictId, { id: oldDistrictId, tenXa: "Old X", tenHuyen: "Huyện Y", tenTinh: null });
    const subRowId = randomUUID();
    const subId = randomUUID();
    prisma.store.assignments.set(subRowId, {
      id: subRowId,
      officerId: subId,
      districtId,
      oldDistrictId,
      isActive: true,
      role: "officer",
    });
    prisma.store.assignments.set("head-row", {
      id: "head-row",
      officerId: randomUUID(),
      districtId,
      oldDistrictId: null,
      isActive: true,
      role: "commune_head",
    });

    const result = await service.listSubordinates(districtId);
    expect(result).toEqual([
      { officerId: subId, fullName: `Cán bộ ${subId.slice(0, 4)}`, oldDistrictId, oldWardLabel: "Old X (Huyện Y cũ)" },
    ]);
  });
});

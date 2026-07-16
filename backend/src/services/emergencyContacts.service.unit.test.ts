import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createEmergencyContactsService } from "./emergencyContacts.service.js";
import type { GeoMatchService } from "../geo/geoMatch.service.js";

interface FakeContact {
  id: string;
  districtId: string | null;
  contactType: string;
  name: string;
  phoneNumber: string;
  note: string | null;
}

function createFakePrisma(contacts: FakeContact[]) {
  return {
    emergencyContact: {
      async findMany({ where }: any) {
        if (where.districtId === null) {
          return contacts.filter((c) => c.districtId === null);
        }
        const ids: (string | null)[] = where.OR.map((clause: any) => clause.districtId);
        return contacts.filter((c) => ids.includes(c.districtId));
      },
    },
  };
}

function fakeGeoMatch(districtId: string | null, nearestId: string | null = null): GeoMatchService {
  return {
    matchDistrict: async () => districtId,
    matchNearestDistrict: async () => nearestId,
  };
}

const NATIONAL: FakeContact[] = [
  { id: "n1", districtId: null, contactType: "police", name: "Công an (toàn quốc)", phoneNumber: "113", note: null },
  { id: "n2", districtId: null, contactType: "fire", name: "Cứu hỏa (toàn quốc)", phoneNumber: "114", note: null },
  { id: "n3", districtId: null, contactType: "medical", name: "Cấp cứu y tế (toàn quốc)", phoneNumber: "115", note: null },
];

describe("emergencyContacts.service — getEmergencyContacts", () => {
  it("returns the national defaults when the point matches no district and there's no nearest fallback", async () => {
    const prisma = createFakePrisma(NATIONAL);
    const service = createEmergencyContactsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(null, null) });

    const result = await service.getEmergencyContacts({ lat: 0, lng: 0 });

    expect(result).toHaveLength(3);
    expect(result.every((c) => !c.isLocal)).toBe(true);
    expect(result.find((c) => c.contactType === "police")?.phoneNumber).toBe("113");
  });

  it("prefers the district-specific contact over the national default for the same type", async () => {
    const districtId = randomUUID();
    const contacts: FakeContact[] = [
      ...NATIONAL,
      {
        id: "local-police",
        districtId,
        contactType: "police",
        name: "[DEMO] Công an phường Buôn Ma Thuột",
        phoneNumber: "0900000001",
        note: null,
      },
    ];
    const prisma = createFakePrisma(contacts);
    const service = createEmergencyContactsService({ prisma: prisma as any, geoMatch: fakeGeoMatch(districtId) });

    const result = await service.getEmergencyContacts({ lat: 12.68, lng: 108.05 });

    const police = result.find((c) => c.contactType === "police");
    expect(police?.phoneNumber).toBe("0900000001");
    expect(police?.isLocal).toBe(true);
    // Types with no local override still fall back to the national number.
    const fire = result.find((c) => c.contactType === "fire");
    expect(fire?.phoneNumber).toBe("114");
    expect(fire?.isLocal).toBe(false);
  });

  it("falls back to the nearest district when the point is outside every boundary", async () => {
    const nearestId = randomUUID();
    const contacts: FakeContact[] = [
      ...NATIONAL,
      {
        id: "local-medical",
        districtId: nearestId,
        contactType: "medical",
        name: "[DEMO] Trung tâm y tế gần nhất",
        phoneNumber: "0900000101",
        note: null,
      },
    ];
    const prisma = createFakePrisma(contacts);
    const service = createEmergencyContactsService({
      prisma: prisma as any,
      geoMatch: fakeGeoMatch(null, nearestId),
    });

    const result = await service.getEmergencyContacts({ lat: 99, lng: 99 });
    expect(result.find((c) => c.contactType === "medical")?.phoneNumber).toBe("0900000101");
  });
});

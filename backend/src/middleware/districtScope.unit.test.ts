import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDistrictScopeService } from "./districtScope.js";
import { createFakeOfficerPrisma } from "../test-utils/fakeOfficerPrisma.js";

describe("districtScope — assertDistrictAccess", () => {
  it("allows a regular officer to access a district they're actively assigned to", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });

    const scope = createDistrictScopeService(fakePrisma as any);
    await expect(scope.assertDistrictAccess({ id: officerId, role: "officer" }, districtId)).resolves.toBeUndefined();
  });

  it("blocks a regular officer from a district they are NOT assigned to — the core security guarantee", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const myDistrict = randomUUID();
    const otherDistrict = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });

    const scope = createDistrictScopeService(fakePrisma as any);
    await expect(scope.assertDistrictAccess({ id: officerId, role: "officer" }, otherDistrict)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("blocks access to a district the officer was assigned to but is no longer active in", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: false });

    const scope = createDistrictScopeService(fakePrisma as any);
    await expect(scope.assertDistrictAccess({ id: officerId, role: "officer" }, districtId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("bypasses the restriction entirely for senior_officer and admin roles", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const scope = createDistrictScopeService(fakePrisma as any);
    const someDistrict = randomUUID();

    await expect(
      scope.assertDistrictAccess({ id: randomUUID(), role: "senior_officer" }, someDistrict),
    ).resolves.toBeUndefined();
    await expect(scope.assertDistrictAccess({ id: randomUUID(), role: "admin" }, someDistrict)).resolves.toBeUndefined();
  });

  it("rejects a report with no district assignment for a regular officer", async () => {
    const fakePrisma = createFakeOfficerPrisma();
    const scope = createDistrictScopeService(fakePrisma as any);
    await expect(scope.assertDistrictAccess({ id: randomUUID(), role: "officer" }, null)).rejects.toMatchObject({
      status: 403,
    });
  });
});

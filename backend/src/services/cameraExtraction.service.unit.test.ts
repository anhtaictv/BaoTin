import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCameraExtractionService } from "./cameraExtraction.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { createFakeCameraPrisma, type FakeCameraPrisma } from "../test-utils/fakeCameraPrisma.js";

function buildService(fakePrisma: FakeCameraPrisma) {
  const districtScope = createDistrictScopeService(fakePrisma as any);
  return createCameraExtractionService({ prisma: fakePrisma as any, districtScope });
}

const BUON_MA_THUOT = { lat: 12.68, lng: 108.05 };

describe("cameraExtraction.service — nearbyCameras", () => {
  it("auto-suggests cameras within the radius, closest first, without any manual search step", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });

    const near = { id: randomUUID(), name: "Camera gần", lat: 12.6805, lng: 108.0505, managingUnitName: "A", managingUnitContact: "090" };
    const far = { id: randomUUID(), name: "Camera xa", lat: 13.5, lng: 109.0, managingUnitName: "B", managingUnitContact: "091" };
    fakePrisma.seedCamera(near);
    fakePrisma.seedCamera(far);

    const service = buildService(fakePrisma);
    const result = await service.nearbyCameras({ id: officerId, role: "officer" }, reportId, 1000);

    expect(result.map((c) => c.id)).toEqual([near.id]);
    expect(result[0]?.distanceMeters).toBeLessThan(1000);
  });

  it("returns no video/stream field on any suggested camera (CLAUDE.md #8)", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({ id: randomUUID(), name: "Camera", lat: 12.6801, lng: 108.0501, managingUnitName: "A", managingUnitContact: "090" });

    const service = buildService(fakePrisma);
    const [camera] = await service.nearbyCameras({ id: officerId, role: "officer" }, reportId, 1000);

    expect(camera).not.toHaveProperty("streamUrl");
    expect(camera).not.toHaveProperty("videoUrl");
  });

  it("404s for a non-existent report", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const service = buildService(fakePrisma);
    await expect(
      service.nearbyCameras({ id: randomUUID(), role: "officer" }, randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("403s an officer trying to view cameras for a report outside their district", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId: randomUUID(), isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId: randomUUID(), ...BUON_MA_THUOT });

    const service = buildService(fakePrisma);
    await expect(service.nearbyCameras({ id: officerId, role: "officer" }, reportId)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("cameraExtraction.service — createExtractionRequest", () => {
  it("creates a pending request — administrative metadata only, no video field accepted", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const cameraId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({ id: cameraId, name: "Camera", lat: 12.68, lng: 108.05, managingUnitName: "A", managingUnitContact: "090" });

    const service = buildService(fakePrisma);
    const start = new Date("2026-01-01T08:00:00Z");
    const end = new Date("2026-01-01T09:00:00Z");
    const result = await service.createExtractionRequest({ id: officerId, role: "officer" }, reportId, {
      cameraId,
      timeRangeStart: start,
      timeRangeEnd: end,
      note: "Xin trích xuất giờ cao điểm",
    });

    expect(result.status).toBe("pending");
    expect(result).not.toHaveProperty("videoUrl");
    expect(fakePrisma.store.extractionRequests).toHaveLength(1);
    expect(fakePrisma.store.extractionRequests[0]).toMatchObject({ reportId, cameraId, requestedBy: officerId });
  });

  it("rejects an end time before the start time", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const cameraId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({ id: cameraId, name: "Camera", lat: 12.68, lng: 108.05, managingUnitName: "A", managingUnitContact: "090" });

    const service = buildService(fakePrisma);
    await expect(
      service.createExtractionRequest({ id: officerId, role: "officer" }, reportId, {
        cameraId,
        timeRangeStart: new Date("2026-01-01T09:00:00Z"),
        timeRangeEnd: new Date("2026-01-01T08:00:00Z"),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s for a camera that doesn't exist", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });

    const service = buildService(fakePrisma);
    await expect(
      service.createExtractionRequest({ id: officerId, role: "officer" }, reportId, {
        cameraId: randomUUID(),
        timeRangeStart: new Date("2026-01-01T08:00:00Z"),
        timeRangeEnd: new Date("2026-01-01T09:00:00Z"),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("cameraExtraction.service — listExtractionRequests", () => {
  it("lists requests for a report with the camera's name attached", async () => {
    const fakePrisma = createFakeCameraPrisma();
    const officerId = randomUUID();
    const districtId = randomUUID();
    const reportId = randomUUID();
    const cameraId = randomUUID();
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });
    fakePrisma.seedReport({ id: reportId, districtId, ...BUON_MA_THUOT });
    fakePrisma.seedCamera({ id: cameraId, name: "Camera chợ", lat: 12.68, lng: 108.05, managingUnitName: "A", managingUnitContact: "090" });

    const service = buildService(fakePrisma);
    await service.createExtractionRequest({ id: officerId, role: "officer" }, reportId, {
      cameraId,
      timeRangeStart: new Date("2026-01-01T08:00:00Z"),
      timeRangeEnd: new Date("2026-01-01T09:00:00Z"),
    });

    const list = await service.listExtractionRequests({ id: officerId, role: "officer" }, reportId);
    expect(list).toHaveLength(1);
    expect(list[0]?.camera?.name).toBe("Camera chợ");
  });
});

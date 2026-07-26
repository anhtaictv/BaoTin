import { randomUUID } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createReportsController } from "./reports.controller.js";
import { createReportsRoutes } from "./reports.routes.js";
import { createReportLifecycleService } from "../../services/reportLifecycle.service.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { createFakeReportPrisma } from "../../test-utils/fakeReportPrisma.js";
import type { GeoMatchService } from "../../geo/geoMatch.service.js";
import type { AssignOfficerService } from "../../geo/assignOfficer.service.js";
import type { StorageClient } from "../../storage/minioClient.js";
import type { NotificationService } from "../../notifications/notification.service.js";
import type { ReportCategorySuggester } from "../../services/reportClassifier.js";

async function buildTestApp(categorySuggester?: ReportCategorySuggester) {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeReportPrisma();
  const districtId = randomUUID();
  const officerId = randomUUID();
  const notifyCalls: unknown[] = [];

  const geoMatch: GeoMatchService = { matchDistrict: async () => districtId, matchNearestDistrict: async () => districtId };
  const assignOfficer: AssignOfficerService = { pickOfficerForDistrict: async () => officerId };
  const storage: StorageClient = {
    putObject: async () => {},
    getPresignedGetUrl: async (key) => `https://minio.local/${key}`,
  };
  const notifications: NotificationService = {
    notifyOfficerOfNewReport: async (o, r, u) => {
      notifyCalls.push({ o, r, u });
      return new Date();
    },
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
    notifyOfficerOfChatMessage: async () => new Date(),
  };

  const reportLifecycle = createReportLifecycleService({
    prisma: fakePrisma as any,
    geoMatch,
    assignOfficer,
    storage,
    notifications,
  });
  const controller = createReportsController(reportLifecycle, categorySuggester ?? { suggestCategory: async () => null });
  const requireAuth = createAuthMiddleware(publicKey);
  const citizenReportsRouter = createReportsRoutes(controller, requireAuth);

  // Minimal authRouter stub — this test file only exercises /reports/*.
  const { Router } = await import("express");
  const authRouter = Router();

  const app = createApp({ authRouter, citizenReportsRouter });

  const citizenToken = await signAccessToken({ sub: randomUUID(), role: "citizen" }, privateKey, 20);

  return { app, citizenToken, fakePrisma, notifyCalls };
}

describe("POST /reports", () => {
  it("creates a report with a valid location and no attachments", async () => {
    const { app, citizenToken } = await buildTestApp();

    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${citizenToken}`)
      .field("category", "trom_cap")
      .field("description", "Mất xe máy trước nhà")
      .field("location", JSON.stringify({ lat: 12.66, lng: 108.05, source: "device_gps" }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("pending");
  });

  it("401s without a bearer token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post("/reports")
      .field("category", "x")
      .field("location", JSON.stringify({ lat: 12.66, lng: 108.05, source: "device_gps" }));
    expect(res.status).toBe(401);
  });

  it("400s when location is missing", async () => {
    const { app, citizenToken } = await buildTestApp();
    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${citizenToken}`)
      .field("category", "trom_cap");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts a real image attachment and rejects a fake one", async () => {
    const { app, citizenToken } = await buildTestApp();
    const realPng = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const okRes = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${citizenToken}`)
      .field("category", "trom_cap")
      .field("location", JSON.stringify({ lat: 12.66, lng: 108.05, source: "exif" }))
      .attach("attachments", realPng, { filename: "a.png", contentType: "image/png" });
    expect(okRes.status).toBe(201);

    const badRes = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${citizenToken}`)
      .field("category", "trom_cap")
      .field("location", JSON.stringify({ lat: 12.66, lng: 108.05, source: "exif" }))
      .attach("attachments", Buffer.from("not an image"), { filename: "a.png", contentType: "image/png" });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe("INVALID_ATTACHMENT");
  });
});

describe("POST /reports/emergency", () => {
  it("creates an emergency report with minimal fields", async () => {
    const { app, citizenToken, notifyCalls } = await buildTestApp();
    const res = await request(app)
      .post("/reports/emergency")
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ emergencyType: "chay_no", location: { lat: 12.66, lng: 108.05 } });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(notifyCalls).toEqual([expect.objectContaining({ u: true })]);
  });
});

describe("GET /reports/mine and /reports/:id/status", () => {
  it("round-trips: create -> appears in list -> status is queryable", async () => {
    const { app, citizenToken } = await buildTestApp();
    const createRes = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${citizenToken}`)
      .field("category", "trom_cap")
      .field("location", JSON.stringify({ lat: 12.66, lng: 108.05, source: "device_gps" }));
    const reportId = createRes.body.data.reportId;

    const listRes = await request(app).get("/reports/mine").set("Authorization", `Bearer ${citizenToken}`);
    expect(listRes.body.data.some((r: any) => r.id === reportId)).toBe(true);

    const statusRes = await request(app)
      .get(`/reports/${reportId}/status`)
      .set("Authorization", `Bearer ${citizenToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("pending");
  });
});

describe("POST /reports/classify-suggestion", () => {
  it("returns the suggester's category", async () => {
    const { app, citizenToken } = await buildTestApp({ suggestCategory: async () => "chay_no" });
    const res = await request(app)
      .post("/reports/classify-suggestion")
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ description: "Có khói và lửa bốc lên từ nhà kho gần đây" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ category: "chay_no" });
  });

  it("returns category: null when the suggester is uncertain/unavailable", async () => {
    const { app, citizenToken } = await buildTestApp({ suggestCategory: async () => null });
    const res = await request(app)
      .post("/reports/classify-suggestion")
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({ description: "..." });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ category: null });
  });

  it("401s without a bearer token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).post("/reports/classify-suggestion").send({ description: "abc" });
    expect(res.status).toBe(401);
  });

  it("400s when description is missing", async () => {
    const { app, citizenToken } = await buildTestApp();
    const res = await request(app)
      .post("/reports/classify-suggestion")
      .set("Authorization", `Bearer ${citizenToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

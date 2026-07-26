import { randomUUID, randomBytes, generateKeyPairSync } from "node:crypto";
import { exportPKCS8, exportSPKI } from "jose";
import request from "supertest";
import { Router } from "express";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { createChatController } from "./chat.controller.js";
import { createChatRoutes } from "./chat.routes.js";
import { createChatService } from "../../services/chat.service.js";
import { createDistrictScopeService } from "../../middleware/districtScope.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { loadJwtKeys, signAccessToken } from "../../crypto/jwtKeys.js";
import { encryptField } from "../../crypto/aesGcm.js";
import { createFakeChatPrisma } from "../../test-utils/fakeChatPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

async function buildTestApp() {
  const { publicKey: pub, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey, publicKey } = await loadJwtKeys(
    await exportPKCS8(priv as never),
    await exportSPKI(pub as never),
  );

  const fakePrisma = createFakeChatPrisma();
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
    notifyOfficerOfChatMessage: async () => new Date(),
  };
  const service = createChatService({
    prisma: fakePrisma as any,
    districtScope,
    notifications: notifications as any,
    piiEncryptionKey: PII_KEY,
  });
  const controller = createChatController(service);
  const requireAuth = createAuthMiddleware(publicKey);
  const chatRouter = createChatRoutes(controller, requireAuth);

  const app = createApp({ authRouter: Router(), chatRouter });

  async function tokenFor(role: string, id = randomUUID()) {
    return signAccessToken({ sub: id, role }, privateKey, 20);
  }

  return { app, fakePrisma, tokenFor };
}

describe("GET /officer/chat/channels", () => {
  it("401s without a token", async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get("/officer/chat/channels");
    expect(res.status).toBe(401);
  });

  it("returns the general channel plus the officer's assigned district", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    const districtId = randomUUID();
    fakePrisma.seedOfficer({
      id: officerId,
      fullNameEnc: encryptField("A", PII_KEY),
      role: "officer",
      approvalStatus: "approved",
    });
    fakePrisma.seedDistrict({ id: districtId, tenXa: "Phường A" });
    fakePrisma.seedAssignment({ officerId, districtId, isActive: true });

    const res = await request(app)
      .get("/officer/chat/channels")
      .set("Authorization", `Bearer ${await tokenFor("officer", officerId)}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe("POST /officer/chat/messages + GET /officer/chat/messages", () => {
  it("a sent message shows up in the general channel's history", async () => {
    const { app, fakePrisma, tokenFor } = await buildTestApp();
    const officerId = randomUUID();
    fakePrisma.seedOfficer({
      id: officerId,
      fullNameEnc: encryptField("[DEMO] Cán bộ A", PII_KEY),
      role: "officer",
      approvalStatus: "approved",
    });
    const token = await tokenFor("officer", officerId);

    const sendRes = await request(app)
      .post("/officer/chat/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ channelType: "general", content: "Xin chào các đơn vị" });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.senderName).toBe("[DEMO] Cán bộ A");

    const listRes = await request(app)
      .get("/officer/chat/messages?channel_type=general")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].content).toBe("Xin chào các đơn vị");
  });

  it("400s when channel_type=district is requested without district_id", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .get("/officer/chat/messages?channel_type=district")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`);
    expect(res.status).toBe(400);
  });

  it("403s when sending to a district the officer is not assigned to", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/officer/chat/messages")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ channelType: "district", districtId: randomUUID(), content: "Xin chào" });
    expect(res.status).toBe(403);
  });

  it("400s on an empty message", async () => {
    const { app, tokenFor } = await buildTestApp();
    const res = await request(app)
      .post("/officer/chat/messages")
      .set("Authorization", `Bearer ${await tokenFor("officer")}`)
      .send({ channelType: "general", content: "" });
    expect(res.status).toBe(400);
  });
});

import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createChatService } from "./chat.service.js";
import { createDistrictScopeService } from "../middleware/districtScope.js";
import { HttpError } from "../middleware/errorHandler.js";
import { encryptField } from "../crypto/aesGcm.js";
import { createFakeChatPrisma, type FakeChatPrisma } from "../test-utils/fakeChatPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

function buildService(fakePrisma: FakeChatPrisma) {
  const notifyCalls: Array<{ officerId: string; senderName: string; channelLabel: string; preview: string }> = [];
  const notifications = {
    notifyOfficerOfNewReport: async () => new Date(),
    notifyUserOfStatusChange: async () => new Date(),
    notifyOfficerOfAccidentAlert: async () => new Date(),
    notifyOfficerOfChatMessage: async (officerId: string, senderName: string, channelLabel: string, preview: string) => {
      notifyCalls.push({ officerId, senderName, channelLabel, preview });
      return new Date();
    },
  };
  const districtScope = createDistrictScopeService(fakePrisma as any);
  const service = createChatService({
    prisma: fakePrisma as any,
    districtScope,
    notifications: notifications as any,
    piiEncryptionKey: PII_KEY,
  });
  return { service, notifyCalls };
}

function seedOfficer(
  fakePrisma: FakeChatPrisma,
  overrides: Partial<{ id: string; name: string; role: string; approvalStatus: string }> = {},
) {
  const id = overrides.id ?? randomUUID();
  fakePrisma.seedOfficer({
    id,
    fullNameEnc: encryptField(overrides.name ?? "Cán bộ", PII_KEY),
    role: overrides.role ?? "officer",
    approvalStatus: overrides.approvalStatus ?? "approved",
  });
  return id;
}

describe("chat.service — listChannels", () => {
  it("a regular officer sees the general channel plus only their assigned district(s)", async () => {
    const fakePrisma = createFakeChatPrisma();
    const officerId = seedOfficer(fakePrisma, { name: "A" });
    const myDistrict = randomUUID();
    const otherDistrict = randomUUID();
    fakePrisma.seedDistrict({ id: myDistrict, tenXa: "Phường A" });
    fakePrisma.seedDistrict({ id: otherDistrict, tenXa: "Phường B" });
    fakePrisma.seedAssignment({ officerId, districtId: myDistrict, isActive: true });
    fakePrisma.seedAssignment({ officerId: randomUUID(), districtId: otherDistrict, isActive: true });

    const { service } = buildService(fakePrisma);
    const channels = await service.listChannels({ id: officerId, role: "officer" });

    expect(channels).toHaveLength(2);
    expect(channels.some((c) => c.channelType === "general")).toBe(true);
    expect(channels.some((c) => c.districtId === myDistrict)).toBe(true);
    expect(channels.some((c) => c.districtId === otherDistrict)).toBe(false);
  });

  it("admin sees a private channel for every district that currently has an assigned officer", async () => {
    const fakePrisma = createFakeChatPrisma();
    const adminId = seedOfficer(fakePrisma, { name: "Admin", role: "admin" });
    const districtA = randomUUID();
    const districtB = randomUUID();
    fakePrisma.seedDistrict({ id: districtA, tenXa: "Phường A" });
    fakePrisma.seedDistrict({ id: districtB, tenXa: "Phường B" });
    fakePrisma.seedAssignment({ officerId: randomUUID(), districtId: districtA, isActive: true });
    fakePrisma.seedAssignment({ officerId: randomUUID(), districtId: districtB, isActive: true });

    const { service } = buildService(fakePrisma);
    const channels = await service.listChannels({ id: adminId, role: "admin" });

    expect(channels.filter((c) => c.channelType === "district")).toHaveLength(2);
  });

  it("decrypts the last message's sender name — never returns ciphertext", async () => {
    const fakePrisma = createFakeChatPrisma();
    const officerId = seedOfficer(fakePrisma, { name: "[DEMO] Nguyễn Văn A" });
    const { service } = buildService(fakePrisma);

    await service.sendMessage({ id: officerId, role: "officer" }, { channelType: "general", content: "Xin chào" });
    const channels = await service.listChannels({ id: officerId, role: "officer" });

    const general = channels.find((c) => c.channelType === "general");
    expect(general?.lastMessage?.senderName).toBe("[DEMO] Nguyễn Văn A");
    expect(JSON.stringify(general)).not.toContain("iv");
  });
});

describe("chat.service — listMessages", () => {
  it("throws 403 when a regular officer requests a district channel they are not assigned to", async () => {
    const fakePrisma = createFakeChatPrisma();
    const officerId = seedOfficer(fakePrisma);
    const otherDistrict = randomUUID();
    fakePrisma.seedDistrict({ id: otherDistrict, tenXa: "Phường Khác" });

    const { service } = buildService(fakePrisma);
    await expect(
      service.listMessages({ id: officerId, role: "officer" }, { channelType: "district", districtId: otherDistrict }),
    ).rejects.toThrow(HttpError);
  });

  it("returns messages newest-first with decrypted sender names", async () => {
    const fakePrisma = createFakeChatPrisma();
    const officerId = seedOfficer(fakePrisma, { name: "A" });
    const { service } = buildService(fakePrisma);

    await service.sendMessage({ id: officerId, role: "officer" }, { channelType: "general", content: "Tin 1" });
    await service.sendMessage({ id: officerId, role: "officer" }, { channelType: "general", content: "Tin 2" });

    const messages = await service.listMessages({ id: officerId, role: "officer" }, { channelType: "general" });
    expect(messages.map((m) => m.content)).toEqual(["Tin 2", "Tin 1"]);
    expect(messages[0]?.senderName).toBe("A");
  });
});

describe("chat.service — sendMessage", () => {
  it("throws 403 when sending to a district channel the officer is not assigned to", async () => {
    const fakePrisma = createFakeChatPrisma();
    const officerId = seedOfficer(fakePrisma);
    const otherDistrict = randomUUID();
    fakePrisma.seedDistrict({ id: otherDistrict, tenXa: "Phường Khác" });

    const { service } = buildService(fakePrisma);
    await expect(
      service.sendMessage(
        { id: officerId, role: "officer" },
        { channelType: "district", districtId: otherDistrict, content: "Xin chào" },
      ),
    ).rejects.toThrow(HttpError);
  });

  it("notifies every other channel member but not the sender, for a district channel", async () => {
    const fakePrisma = createFakeChatPrisma();
    const districtId = randomUUID();
    fakePrisma.seedDistrict({ id: districtId, tenXa: "Phường X" });
    const senderId = seedOfficer(fakePrisma, { name: "Cán bộ gửi" });
    const peerId = seedOfficer(fakePrisma, { name: "Đồng nghiệp" });
    const adminId = seedOfficer(fakePrisma, { name: "Admin", role: "admin" });
    const unrelatedOfficerId = seedOfficer(fakePrisma, { name: "Không liên quan" });
    fakePrisma.seedAssignment({ officerId: senderId, districtId, isActive: true });
    fakePrisma.seedAssignment({ officerId: peerId, districtId, isActive: true });

    const { service, notifyCalls } = buildService(fakePrisma);
    await service.sendMessage(
      { id: senderId, role: "officer" },
      { channelType: "district", districtId, content: "Cần hỗ trợ" },
    );

    const notifiedIds = notifyCalls.map((c) => c.officerId);
    expect(notifiedIds).toContain(peerId);
    expect(notifiedIds).toContain(adminId);
    expect(notifiedIds).not.toContain(senderId);
    expect(notifiedIds).not.toContain(unrelatedOfficerId);
    expect(notifyCalls[0]?.channelLabel).toBe("Phường X");
  });

  it("notifies every approved officer but not the sender, for the general channel", async () => {
    const fakePrisma = createFakeChatPrisma();
    const senderId = seedOfficer(fakePrisma, { name: "Người gửi" });
    const otherId = seedOfficer(fakePrisma, { name: "Người khác" });
    const pendingId = seedOfficer(fakePrisma, { name: "Chưa duyệt", approvalStatus: "pending" });

    const { service, notifyCalls } = buildService(fakePrisma);
    await service.sendMessage({ id: senderId, role: "officer" }, { channelType: "general", content: "Thông báo" });

    const notifiedIds = notifyCalls.map((c) => c.officerId);
    expect(notifiedIds).toContain(otherId);
    expect(notifiedIds).not.toContain(senderId);
    expect(notifiedIds).not.toContain(pendingId);
  });
});

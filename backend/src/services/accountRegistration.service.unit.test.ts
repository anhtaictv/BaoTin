import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createAccountRegistrationService } from "./accountRegistration.service.js";
import { hashPhoneNumber } from "../crypto/phoneBlindIndex.js";

const PII_KEY = randomBytes(32).toString("base64");
const PHONE_KEY = randomBytes(32).toString("base64");

async function testJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();
}

function fakePrisma() {
  const users = new Map<string, any>();
  const officers = new Map<string, any>();
  const auditLogRows: any[] = [];
  return {
    store: { users, officers, auditLogRows },
    user: {
      async findUnique({ where }: any) {
        if (where.username) return [...users.values()].find((u) => u.username === where.username) ?? null;
        if (where.phoneHash) return [...users.values()].find((u) => u.phoneHash === where.phoneHash) ?? null;
        return users.get(where.id) ?? null;
      },
      async create({ data }: any) {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        users.set(row.id, row);
        return row;
      },
      async update({ where, data }: any) {
        const row = users.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
    officer: {
      async findUnique({ where }: any) {
        if (where.username) return [...officers.values()].find((o) => o.username === where.username) ?? null;
        if (where.phoneHash) return [...officers.values()].find((o) => o.phoneHash === where.phoneHash) ?? null;
        return officers.get(where.id) ?? null;
      },
      async findMany({ where }: any) {
        return [...officers.values()]
          .filter((o) => !where?.approvalStatus || o.approvalStatus === where.approvalStatus)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async create({ data }: any) {
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        officers.set(row.id, row);
        return row;
      },
      async update({ where, data }: any) {
        const row = officers.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
    adminAuditLog: {
      async create({ data }: any) {
        auditLogRows.push(data);
        return data;
      },
    },
  };
}

function fakeStorage() {
  const objects = new Map<string, Buffer>();
  return {
    storage: {
      async putObject(key: string, buffer: Buffer) {
        objects.set(key, buffer);
      },
      async getPresignedGetUrl(key: string) {
        return `https://minio.example/${key}`;
      },
    } as any,
    objects,
  };
}

function buildService(prisma: ReturnType<typeof fakePrisma>) {
  const issueTokenPairCalls: unknown[] = [];
  const authService = {
    issueTokenPair: async (subject: any) => {
      issueTokenPairCalls.push(subject);
      return { accessToken: "fake-access", refreshToken: "fake-refresh", expiresInMinutes: 20 };
    },
  };
  const { storage, objects } = fakeStorage();
  const auditLog = {
    record: async (officerId: string, action: string, target?: unknown) => {
      await prisma.adminAuditLog.create({ data: { officerId, action, target } });
    },
  };
  const service = createAccountRegistrationService({
    prisma: prisma as any,
    piiEncryptionKey: PII_KEY,
    phoneBlindIndexKey: PHONE_KEY,
    authService: authService as any,
    storage,
    auditLog: auditLog as any,
  });
  return { service, issueTokenPairCalls, objects };
}

describe("accountRegistration.service — registerCitizen / loginCitizen", () => {
  it("registers a citizen with CCCD photos and issues a token pair", async () => {
    const prisma = fakePrisma();
    const { service, issueTokenPairCalls, objects } = buildService(prisma);
    const jpeg = await testJpeg();

    const tokens = await service.registerCitizen({
      username: "citizen_1",
      password: "P@ssword123",
      fullName: "Nguyễn Văn A",
      phoneNumber: "0901234567",
      cccdNumber: "079099001234",
      address: "123 Lê Lợi",
      cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
      cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    expect(tokens.accessToken).toBe("fake-access");
    expect(objects.size).toBe(2);
    expect(issueTokenPairCalls).toEqual([{ subjectType: "user", userId: expect.any(String), role: "citizen" }]);
    expect(prisma.store.users.size).toBe(1);
  });

  it("rejects registration when CCCD photo isn't a real image, without touching storage/DB", async () => {
    const prisma = fakePrisma();
    const { service, objects } = buildService(prisma);
    const jpeg = await testJpeg();

    await expect(
      service.registerCitizen({
        username: "citizen_2",
        password: "P@ssword123",
        fullName: "B",
        phoneNumber: "0901234568",
        cccdNumber: "079099001235",
        address: "addr",
        cccdFront: { buffer: Buffer.from("not an image"), mimetype: "image/jpeg" },
        cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(objects.size).toBe(0);
    expect(prisma.store.users.size).toBe(0);
  });

  it("attaches registration fields to a User row that already exists from prior OTP use", async () => {
    const prisma = fakePrisma();
    const phoneHash = hashPhoneNumber("0901234567", PHONE_KEY);
    const existingId = randomUUID();
    prisma.store.users.set(existingId, {
      id: existingId,
      phoneHash,
      phoneNumberEnc: "irrelevant",
      fullNameEnc: null,
      createdAt: new Date(),
    });
    const { service } = buildService(prisma);
    const jpeg = await testJpeg();

    await service.registerCitizen({
      username: "citizen_3",
      password: "P@ssword123",
      fullName: "C",
      phoneNumber: "0901234567",
      cccdNumber: "079099001236",
      address: "addr",
      cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
      cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    expect(prisma.store.users.size).toBe(1);
    expect(prisma.store.users.get(existingId)?.username).toBe("citizen_3");
  });

  it("409s when the phone number is already fully registered", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    const jpeg = await testJpeg();
    const input = {
      username: "citizen_4",
      password: "P@ssword123",
      fullName: "D",
      phoneNumber: "0909999999",
      cccdNumber: "079099001237",
      address: "addr",
      cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
      cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
    };
    await service.registerCitizen(input);

    await expect(service.registerCitizen({ ...input, username: "citizen_4b" })).rejects.toMatchObject({
      status: 409,
      code: "PHONE_ALREADY_REGISTERED",
    });
  });

  it("409s when the username is already taken", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    const jpeg = await testJpeg();
    await service.registerCitizen({
      username: "dup_name",
      password: "P@ssword123",
      fullName: "E",
      phoneNumber: "0900000001",
      cccdNumber: "079099001238",
      address: "addr",
      cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
      cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    await expect(
      service.registerCitizen({
        username: "dup_name",
        password: "P@ssword123",
        fullName: "F",
        phoneNumber: "0900000002",
        cccdNumber: "079099001239",
        address: "addr",
        cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
        cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
      }),
    ).rejects.toMatchObject({ status: 409, code: "USERNAME_TAKEN" });
  });

  it("logs in with the registered username/password", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    const jpeg = await testJpeg();
    await service.registerCitizen({
      username: "citizen_5",
      password: "Correct-Horse-1",
      fullName: "G",
      phoneNumber: "0900000003",
      cccdNumber: "079099001240",
      address: "addr",
      cccdFront: { buffer: jpeg, mimetype: "image/jpeg" },
      cccdBack: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    const tokens = await service.loginCitizen("citizen_5", "Correct-Horse-1");
    expect(tokens.accessToken).toBe("fake-access");
    await expect(service.loginCitizen("citizen_5", "wrong")).rejects.toMatchObject({ status: 401 });
  });
});

describe("accountRegistration.service — registerOfficer / loginOfficer / approval", () => {
  it("creates a pending officer that cannot log in until approved", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);

    const result = await service.registerOfficer({
      username: "officer_1",
      password: "Correct-Horse-1",
      fullName: "H",
      phoneNumber: "0911111111",
      cccdNumber: "079099001241",
      address: "addr",
    });
    expect(result.pending).toBe(true);

    await expect(service.loginOfficer("officer_1", "Correct-Horse-1")).rejects.toMatchObject({
      status: 403,
      code: "APPROVAL_PENDING",
    });
  });

  it("lets an approved officer log in and issues a token with their role", async () => {
    const prisma = fakePrisma();
    const { service, issueTokenPairCalls } = buildService(prisma);
    await service.registerOfficer({
      username: "officer_2",
      password: "Correct-Horse-1",
      fullName: "I",
      phoneNumber: "0911111112",
      cccdNumber: "079099001242",
      address: "addr",
    });
    const officerId = [...prisma.store.officers.values()][0]!.id;
    const adminId = randomUUID();

    await service.approveOfficer(adminId, officerId);
    const tokens = await service.loginOfficer("officer_2", "Correct-Horse-1");

    expect(tokens.accessToken).toBe("fake-access");
    expect(issueTokenPairCalls).toEqual([{ subjectType: "officer", officerId, role: "officer" }]);
    expect(prisma.store.auditLogRows).toEqual([
      { officerId: adminId, action: "approve_officer", target: { type: "officer", id: officerId } },
    ]);
  });

  it("rejects a pending officer and blocks their login with a clear message", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    await service.registerOfficer({
      username: "officer_3",
      password: "Correct-Horse-1",
      fullName: "J",
      phoneNumber: "0911111113",
      cccdNumber: "079099001243",
      address: "addr",
    });
    const officerId = [...prisma.store.officers.values()][0]!.id;

    await service.rejectOfficer(randomUUID(), officerId);
    await expect(service.loginOfficer("officer_3", "Correct-Horse-1")).rejects.toMatchObject({
      status: 403,
      code: "APPROVAL_REJECTED",
    });
  });

  it("lists only pending officers with decrypted PII, and audits the view", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    await service.registerOfficer({
      username: "officer_4",
      password: "Correct-Horse-1",
      fullName: "Trần Thị K",
      phoneNumber: "0911111114",
      cccdNumber: "079099001244",
      address: "456 Hai Bà Trưng",
    });
    const officerId = [...prisma.store.officers.values()][0]!.id;
    const adminId = randomUUID();

    const pending = await service.listPendingOfficers(adminId);
    expect(pending).toEqual([
      {
        id: officerId,
        username: "officer_4",
        fullName: "Trần Thị K",
        phoneNumber: "0911111114",
        cccdNumber: "079099001244",
        address: "456 Hai Bà Trưng",
        createdAt: expect.any(Date),
      },
    ]);
    expect(prisma.store.auditLogRows).toEqual([
      { officerId: adminId, action: "view_pending_officers", target: undefined },
    ]);
  });

  it("409s when the phone number already has an officer account", async () => {
    const prisma = fakePrisma();
    const { service } = buildService(prisma);
    const input = {
      username: "officer_5",
      password: "Correct-Horse-1",
      fullName: "L",
      phoneNumber: "0911111115",
      cccdNumber: "079099001245",
      address: "addr",
    };
    await service.registerOfficer(input);

    await expect(service.registerOfficer({ ...input, username: "officer_5b" })).rejects.toMatchObject({
      status: 409,
      code: "PHONE_ALREADY_REGISTERED",
    });
  });
});

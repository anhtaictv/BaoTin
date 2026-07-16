import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seedWebAccounts } from "./seed-web-accounts.js";
import { encryptField } from "../../src/crypto/aesGcm.js";
import { verifyPassword } from "../../src/crypto/passwordHash.js";
import { createFakeWebAccountPrisma, seedFullAccount } from "../../src/test-utils/fakeWebAccountPrisma.js";

const PII_KEY = randomBytes(32).toString("base64");

describe("seedWebAccounts", () => {
  it("provisions one web account per officer, username decrypted from phone", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const officerId = randomUUID();
    fakePrisma.seedOfficer({
      id: officerId,
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
      unitName: "Công an phường Buôn Ma Thuột",
      role: "officer",
      phoneNumberEnc: encryptField("0900001234", PII_KEY),
    });

    const provisioned = await seedWebAccounts({ prisma: fakePrisma as any, piiEncryptionKey: PII_KEY });

    expect(provisioned).toHaveLength(1);
    expect(provisioned[0]?.username).toBe("0900001234");
    expect(provisioned[0]?.tempPassword).toHaveLength(10);

    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.username).toBe("0900001234");
    expect(account?.mustChangePassword).toBe(true);
    expect(await verifyPassword(provisioned[0]!.tempPassword, account!.passwordHash)).toBe(true);
  });

  it("never stores the temp password in plaintext anywhere in the row", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    fakePrisma.seedOfficer({
      id: randomUUID(),
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
      unitName: null,
      role: "officer",
      phoneNumberEnc: encryptField("0900005678", PII_KEY),
    });

    const [provisioned] = await seedWebAccounts({ prisma: fakePrisma as any, piiEncryptionKey: PII_KEY });
    const account = [...fakePrisma.store.webAccounts.values()][0];
    expect(account?.passwordHash).not.toContain(provisioned!.tempPassword);
  });

  it("is idempotent — skips officers that already have a web account", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const officerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash: "existing-hash",
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });
    // seedFullAccount doesn't set phoneNumberEnc — add it directly since seedWebAccounts reads it.
    fakePrisma.store.officers.set(officerId, {
      ...fakePrisma.store.officers.get(officerId)!,
      phoneNumberEnc: encryptField("0900001111", PII_KEY),
    });

    const provisioned = await seedWebAccounts({ prisma: fakePrisma as any, piiEncryptionKey: PII_KEY });

    expect(provisioned).toHaveLength(0);
    expect(fakePrisma.store.webAccounts.size).toBe(1);
  });

  it("provisions the remaining officers when only some already have accounts", async () => {
    const fakePrisma = createFakeWebAccountPrisma();
    const coveredOfficerId = seedFullAccount(fakePrisma, {
      username: "0900001111",
      passwordHash: "existing-hash",
      fullNameEnc: encryptField("[DEMO] A", PII_KEY),
    });
    fakePrisma.store.officers.set(coveredOfficerId, {
      ...fakePrisma.store.officers.get(coveredOfficerId)!,
      phoneNumberEnc: encryptField("0900001111", PII_KEY),
    });
    const newOfficerId = randomUUID();
    fakePrisma.seedOfficer({
      id: newOfficerId,
      fullNameEnc: encryptField("[DEMO] B", PII_KEY),
      unitName: null,
      role: "officer",
      phoneNumberEnc: encryptField("0900002222", PII_KEY),
    });

    const provisioned = await seedWebAccounts({ prisma: fakePrisma as any, piiEncryptionKey: PII_KEY });

    expect(provisioned).toHaveLength(1);
    expect(provisioned[0]?.username).toBe("0900002222");
    expect(fakePrisma.store.webAccounts.size).toBe(2);
  });
});

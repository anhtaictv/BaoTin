import type { PrismaClient } from "@prisma/client";
import { decryptField } from "../../src/crypto/aesGcm.js";
import { generateTempPassword, hashPassword } from "../../src/crypto/passwordHash.js";

export interface SeedWebAccountsDeps {
  prisma: PrismaClient;
  piiEncryptionKey: string;
}

export interface ProvisionedWebAccount {
  username: string;
  tempPassword: string;
}

/**
 * dashboard-web-react's username/password accounts for the 102 xã/phường — provisioned for
 * every existing officer (seed-officers.ts already covers 102/102 districts by the time this
 * runs), one web_accounts row each. Idempotent: officers that already have an account are
 * skipped, so re-running seed doesn't reset anyone's password. Temp passwords are printed
 * once for manual handoff and never stored in plaintext (mustChangePassword forces a change
 * at first login — see webAccountAuth.service.ts).
 */
export async function seedWebAccounts(deps: SeedWebAccountsDeps): Promise<ProvisionedWebAccount[]> {
  const officers = await deps.prisma.officer.findMany({ select: { id: true, phoneNumberEnc: true } });
  const existing = await deps.prisma.webAccount.findMany({ select: { officerId: true } });
  const alreadyProvisioned = new Set(existing.map((a: { officerId: string }) => a.officerId));

  const provisioned: ProvisionedWebAccount[] = [];
  for (const officer of officers) {
    if (alreadyProvisioned.has(officer.id)) continue;

    const username = decryptField(officer.phoneNumberEnc, deps.piiEncryptionKey);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await deps.prisma.webAccount.create({
      data: { officerId: officer.id, username, passwordHash, mustChangePassword: true },
    });

    provisioned.push({ username, tempPassword });
    // eslint-disable-next-line no-console
    console.log(`[seed-web-accounts] ${username} / ${tempPassword} (bắt buộc đổi mật khẩu ở lần đăng nhập đầu)`);
  }

  // eslint-disable-next-line no-console
  console.log(`[seed-web-accounts] đã cấp ${provisioned.length} tài khoản mới (bỏ qua ${officers.length - provisioned.length} tài khoản đã có).`);
  return provisioned;
}

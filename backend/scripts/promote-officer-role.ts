import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { hashPhoneNumber } from "../src/crypto/phoneBlindIndex.js";

/**
 * One-off admin ops tool — never takes a password, only usernames/phone numbers, so it's safe
 * to commit and run against production without ever putting a credential in git. Promotes one
 * officer (by username) to role "admin" + approved + assigned to a district, and optionally
 * demotes another officer (by phone number) down to plain "officer".
 *
 * Usage: PROMOTE_USERNAME=<username> [DEMOTE_PHONE=<phone>] npx tsx scripts/promote-officer-role.ts
 */
async function main() {
  const env = loadEnv();
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  const promoteUsername = process.env.PROMOTE_USERNAME;
  if (!promoteUsername) throw new Error("Set PROMOTE_USERNAME to the officer username to promote to admin.");

  const officer = await prisma.officer.findUnique({ where: { username: promoteUsername } });
  if (!officer) throw new Error(`No officer with username "${promoteUsername}" — register it first via /auth/register/officer.`);

  const district = await prisma.district.findFirst({ where: { tenXa: "Buôn Ma Thuột" } });
  if (!district) throw new Error('District "Buôn Ma Thuột" not found — run seed:districts first.');

  await prisma.officer.update({ where: { id: officer.id }, data: { role: "admin", approvalStatus: "approved" } });
  await prisma.officerDistrictAssignment.upsert({
    where: { officerId_districtId: { officerId: officer.id, districtId: district.id } },
    update: { isActive: true },
    create: { officerId: officer.id, districtId: district.id, isActive: true },
  });
  console.log(`[promote-officer-role] ${promoteUsername} -> role=admin, approved, assigned to Buôn Ma Thuột`);

  const demotePhone = process.env.DEMOTE_PHONE;
  if (demotePhone) {
    const phoneHash = hashPhoneNumber(demotePhone, env.PHONE_BLIND_INDEX_KEY);
    const toDemote = await prisma.officer.findUnique({ where: { phoneHash } });
    if (!toDemote) {
      console.warn(`[promote-officer-role] no officer with phone ${demotePhone} — nothing to demote.`);
    } else {
      await prisma.officer.update({ where: { id: toDemote.id }, data: { role: "officer" } });
      console.log(`[promote-officer-role] ${demotePhone} -> role=officer (demoted)`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("promote-officer-role failed:", err);
  process.exit(1);
});

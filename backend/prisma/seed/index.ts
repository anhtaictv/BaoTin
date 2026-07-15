import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { seedDistricts } from "./seed-districts.js";
import { seedOfficers, seedOfficersForAllDistricts } from "./seed-officers.js";
import { seedCameras } from "./seed-cameras.js";

async function main() {
  const env = loadEnv();
  // Seeding runs as the migrator/owner role (DATABASE_URL), not the runtime app role.
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  const geojsonPath = join(process.cwd(), "..", "data", "raw", "Daklak.geojson");

  console.log("Seeding districts from data/raw/Daklak.geojson ...");
  const count = await seedDistricts(prisma, geojsonPath);
  console.log(`Districts seeded: ${count}`);

  console.log("Seeding demo officers (named + admin) ...");
  const officerSeedDeps = {
    prisma,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    phoneBlindIndexKey: env.PHONE_BLIND_INDEX_KEY,
  };
  await seedOfficers(officerSeedDeps);

  console.log("Auto-covering remaining districts with a demo officer each ...");
  await seedOfficersForAllDistricts(officerSeedDeps);

  console.log("Seeding demo cameras (v1.1) ...");
  await seedCameras(prisma);

  await prisma.$disconnect();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { seedOldDistricts } from "./seed-old-districts.js";
import { seedOldDistrictOverlaps } from "./seed-old-district-overlaps.js";

/** Standalone entry point, added after districts/officers were already seeded once in
 * production (docs/DEPLOY.md warns against rerunning dist/prisma/seed/index.js on a DB that
 * already has real data) — same pattern as run-seed-demo-reports.ts. Safe to rerun any number
 * of times: seedOldDistricts is ON CONFLICT DO NOTHING, seedOldDistrictOverlaps is ON CONFLICT
 * DO NOTHING. Requires seed-districts.ts to have already run (the districts table it joins
 * against must be populated first).
 */
async function main() {
  const env = loadEnv();
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  const rawDir = join(process.cwd(), "..", "data", "raw");
  const dakLakCount = await seedOldDistricts(prisma, join(rawDir, "Đắk Lắk (phường xã) - 63.geojson"));
  const phuYenCount = await seedOldDistricts(prisma, join(rawDir, "Phú Yên (phường xã) - 63.geojson"));
  // eslint-disable-next-line no-console
  console.log(`Old districts seeded: ${dakLakCount + phuYenCount}`);

  const overlapCount = await seedOldDistrictOverlaps(prisma);
  // eslint-disable-next-line no-console
  console.log(`Old district overlaps seeded: ${overlapCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed (old districts) failed:", err);
  process.exit(1);
});

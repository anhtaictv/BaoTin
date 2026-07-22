import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { createStorageClient } from "../../src/storage/minioClient.js";
import { seedDistricts } from "./seed-districts.js";
import { seedOfficers, seedOfficersForAllDistricts } from "./seed-officers.js";
import { seedWebAccounts } from "./seed-web-accounts.js";
import { seedCameras } from "./seed-cameras.js";
import { seedSignals } from "./seed-signals.js";
import { seedEmergencyContacts } from "./seed-emergency-contacts.js";
import { seedAccountRegistrationDemo } from "./seed-account-registration.js";

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

  console.log("Seeding dashboard-web-react web accounts (username/password, 102 xã) ...");
  await seedWebAccounts({ prisma, piiEncryptionKey: env.PII_ENCRYPTION_KEY });

  console.log("Seeding demo cameras (v1.1) ...");
  await seedCameras(prisma);

  console.log("Seeding demo social-media/press signals (Giai đoạn 2) ...");
  await seedSignals(prisma);

  console.log("Seeding emergency contacts (Giai đoạn 3) ...");
  await seedEmergencyContacts(prisma);

  console.log("Seeding demo username/password accounts (registration flow) ...");
  const storage = createStorageClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
    bucket: env.MINIO_BUCKET,
    presignedUrlTtlSeconds: env.MINIO_PRESIGNED_URL_TTL_SECONDS,
    publicEndPoint: env.MINIO_PUBLIC_ENDPOINT,
    publicPort: env.MINIO_PUBLIC_PORT,
    publicUseSSL: env.MINIO_PUBLIC_USE_SSL,
  });
  await seedAccountRegistrationDemo({
    prisma,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    phoneBlindIndexKey: env.PHONE_BLIND_INDEX_KEY,
    otpPepper: env.OTP_HASH_PEPPER,
    storage,
    jwtPrivateKeyPem: readFileSync(env.JWT_PRIVATE_KEY_PATH, "utf8"),
    jwtPublicKeyPem: readFileSync(env.JWT_PUBLIC_KEY_PATH, "utf8"),
  });

  await prisma.$disconnect();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

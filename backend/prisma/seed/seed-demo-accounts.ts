import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { createStorageClient } from "../../src/storage/minioClient.js";
import { seedAccountRegistrationDemo } from "./seed-account-registration.js";

/**
 * Standalone entry point — seeds ONLY the 3 username/password demo accounts, unlike
 * index.ts's `main()` which reseeds districts/cameras/signals/emergency-contacts too. Those
 * use plain `.create()` (not upsert), so re-running index.ts against a database that already
 * has real data would duplicate rows (see docs/DEPLOY.md's "seed lặp lại trên DB đã có dữ liệu
 * thật là nguy hiểm"). seedAccountRegistrationDemo itself IS safe to rerun — it catches
 * PHONE_ALREADY_REGISTERED/USERNAME_TAKEN and skips — so this script is safe to run against
 * production any number of times, e.g. via .github/workflows/seed-demo-accounts.yml.
 */
async function main() {
  const env = loadEnv();
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  const storage = createStorageClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
    bucket: env.MINIO_BUCKET,
    presignedUrlTtlSeconds: env.MINIO_PRESIGNED_URL_TTL_SECONDS,
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
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed (demo accounts) failed:", err);
  process.exit(1);
});

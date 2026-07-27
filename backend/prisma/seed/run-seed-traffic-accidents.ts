import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { createStorageClient } from "../../src/storage/minioClient.js";
import { seedTrafficAccidents } from "./seed-traffic-accidents.js";

/** Standalone entry point — safe to rerun (seedTrafficAccidents skips once enough demo alerts
 * already exist on the demo cameras), same pattern as run-seed-demo-reports.ts. Requires
 * seed-cameras.ts (and the districts/officers it depends on) to have already run once. */
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
    publicEndPoint: env.MINIO_PUBLIC_ENDPOINT,
    publicPort: env.MINIO_PUBLIC_PORT,
    publicUseSSL: env.MINIO_PUBLIC_USE_SSL,
  });

  await seedTrafficAccidents({ prisma, storage });

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed (traffic accidents) failed:", err);
  process.exit(1);
});

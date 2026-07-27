import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";
import { createStorageClient } from "../../src/storage/minioClient.js";
import { createGeoMatchService } from "../../src/geo/geoMatch.service.js";
import { createAssignOfficerService } from "../../src/geo/assignOfficer.service.js";
import { ConsoleNotificationSender } from "../../src/notifications/ConsoleNotificationSender.js";
import { createNotificationService } from "../../src/notifications/notification.service.js";
import { createReportLifecycleService } from "../../src/services/reportLifecycle.service.js";
import { seedLockedCitizen } from "./seed-locked-citizen.js";

/** Standalone entry point — safe to rerun (seedLockedCitizen skips once the demo citizen is
 * already locked), same pattern as run-seed-demo-reports.ts. */
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
  const geoMatch = createGeoMatchService(prisma);
  const assignOfficer = createAssignOfficerService(prisma);
  const notifications = createNotificationService(new ConsoleNotificationSender());
  const reportLifecycle = createReportLifecycleService({ prisma, geoMatch, assignOfficer, storage, notifications });

  await seedLockedCitizen({
    prisma,
    reportLifecycle,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    phoneBlindIndexKey: env.PHONE_BLIND_INDEX_KEY,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed (locked citizen) failed:", err);
  process.exit(1);
});

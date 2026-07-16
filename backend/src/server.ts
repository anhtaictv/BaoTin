import { readFileSync } from "node:fs";
import { loadEnv } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { loadJwtKeys } from "./crypto/jwtKeys.js";
import { createAuthService } from "./api/auth/auth.service.js";
import { createAuthController } from "./api/auth/auth.controller.js";
import { createAuthRoutes } from "./api/auth/auth.routes.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createGeoMatchService } from "./geo/geoMatch.service.js";
import { createAssignOfficerService } from "./geo/assignOfficer.service.js";
import { createStorageClient } from "./storage/minioClient.js";
import { ConsoleNotificationSender } from "./notifications/ConsoleNotificationSender.js";
import { createNotificationService } from "./notifications/notification.service.js";
import { createReportLifecycleService } from "./services/reportLifecycle.service.js";
import { createReportsController } from "./api/citizen/reports.controller.js";
import { createReportsRoutes } from "./api/citizen/reports.routes.js";
import { createDistrictScopeService } from "./middleware/districtScope.js";
import { createOfficialCaseLinkService } from "./services/officialCaseLink.service.js";
import { createAuditLogService } from "./services/auditLog.service.js";
import { createOfficerReportsService } from "./services/officerReports.service.js";
import { createOfficerReportsController } from "./api/officer/officerReports.controller.js";
import { createOfficerReportsRoutes } from "./api/officer/officerReports.routes.js";
import { createCameraExtractionService } from "./services/cameraExtraction.service.js";
import { createCamerasController } from "./api/officer/cameras.controller.js";
import { createCamerasRoutes } from "./api/officer/cameras.routes.js";
import { createDashboardStatsService } from "./services/dashboardStats.service.js";
import { createDashboardController } from "./api/admin/dashboard.controller.js";
import { createDashboardRoutes } from "./api/admin/dashboard.routes.js";
import { createSignalsService } from "./services/signals.service.js";
import { createSignalsController } from "./api/officer/signals.controller.js";
import { createSignalsRoutes } from "./api/officer/signals.routes.js";
import { createEmergencyContactsService } from "./services/emergencyContacts.service.js";
import { createEmergencyContactsController } from "./api/citizen/emergencyContacts.controller.js";
import { createEmergencyContactsRoutes } from "./api/citizen/emergencyContacts.routes.js";
import { createAreaAlertsService } from "./services/areaAlerts.service.js";
import { createAreaAlertsController } from "./api/citizen/areaAlerts.controller.js";
import { createAreaAlertsRoutes } from "./api/citizen/areaAlerts.routes.js";
import { createApp } from "./app.js";

async function main() {
  const env = loadEnv();

  const privateKeyPem = readFileSync(env.JWT_PRIVATE_KEY_PATH, "utf8");
  const publicKeyPem = readFileSync(env.JWT_PUBLIC_KEY_PATH, "utf8");
  const { privateKey, publicKey } = await loadJwtKeys(privateKeyPem, publicKeyPem);

  const authService = createAuthService({
    prisma,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    phoneBlindIndexKey: env.PHONE_BLIND_INDEX_KEY,
    otpPepper: env.OTP_HASH_PEPPER,
    jwtPrivateKey: privateKey,
    jwtAccessTtlMinutes: env.JWT_ACCESS_TTL_MINUTES,
    jwtRefreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
  });
  const authController = createAuthController(authService);
  const requireAuth = createAuthMiddleware(publicKey);
  const authRouter = createAuthRoutes(authController, requireAuth);

  const geoMatch = createGeoMatchService(prisma);
  const assignOfficer = createAssignOfficerService(prisma);
  const storage = createStorageClient({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ROOT_USER,
    secretKey: env.MINIO_ROOT_PASSWORD,
    bucket: env.MINIO_BUCKET,
    presignedUrlTtlSeconds: env.MINIO_PRESIGNED_URL_TTL_SECONDS,
  });
  const notifications = createNotificationService(new ConsoleNotificationSender());
  const reportLifecycle = createReportLifecycleService({ prisma, geoMatch, assignOfficer, storage, notifications });
  const reportsController = createReportsController(reportLifecycle);
  const citizenReportsRouter = createReportsRoutes(reportsController, requireAuth);

  const districtScope = createDistrictScopeService(prisma);
  const officialCaseLink = createOfficialCaseLinkService(prisma);
  const auditLog = createAuditLogService(prisma);
  const officerReportsService = createOfficerReportsService({
    prisma,
    districtScope,
    officialCaseLink,
    auditLog,
    storage,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
  });
  const officerReportsController = createOfficerReportsController(officerReportsService);
  const officerReportsRouter = createOfficerReportsRoutes(officerReportsController, requireAuth);

  const cameraExtractionService = createCameraExtractionService({ prisma, districtScope });
  const camerasController = createCamerasController(cameraExtractionService);
  const camerasRouter = createCamerasRoutes(camerasController, requireAuth);

  const dashboardStats = createDashboardStatsService({ prisma, piiEncryptionKey: env.PII_ENCRYPTION_KEY });
  const dashboardController = createDashboardController(dashboardStats);
  const dashboardRouter = createDashboardRoutes(dashboardController, requireAuth);

  const signalsService = createSignalsService({ prisma, districtScope });
  const signalsController = createSignalsController(signalsService);
  const signalsRouter = createSignalsRoutes(signalsController, requireAuth);

  const emergencyContactsService = createEmergencyContactsService({ prisma, geoMatch });
  const emergencyContactsController = createEmergencyContactsController(emergencyContactsService);
  const emergencyContactsRouter = createEmergencyContactsRoutes(emergencyContactsController, requireAuth);

  const areaAlertsService = createAreaAlertsService({ prisma, geoMatch });
  const areaAlertsController = createAreaAlertsController(areaAlertsService);
  const areaAlertsRouter = createAreaAlertsRoutes(areaAlertsController, requireAuth);

  const app = createApp(
    {
      authRouter,
      citizenReportsRouter,
      officerReportsRouter,
      camerasRouter,
      dashboardRouter,
      signalsRouter,
      emergencyContactsRouter,
      areaAlertsRouter,
    },
    {
      corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  );

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Báo Tin backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});

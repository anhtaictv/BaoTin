import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
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
import { FirebaseNotificationSender } from "./notifications/FirebaseNotificationSender.js";
import type { NotificationSender } from "./notifications/NotificationSender.js";
import { createNotificationService } from "./notifications/notification.service.js";
import { createCache } from "./cache/cache.js";
import { createReportLifecycleService } from "./services/reportLifecycle.service.js";
import { createReportCategorySuggester } from "./services/reportClassifier.js";
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
import { createHeatNarrator } from "./services/heatNarrative.js";
import { createSignalsController } from "./api/officer/signals.controller.js";
import { createSignalsRoutes } from "./api/officer/signals.routes.js";
import { createEmergencyContactsService } from "./services/emergencyContacts.service.js";
import { createEmergencyContactsController } from "./api/citizen/emergencyContacts.controller.js";
import { createEmergencyContactsRoutes } from "./api/citizen/emergencyContacts.routes.js";
import { createAreaAlertsService } from "./services/areaAlerts.service.js";
import { createAreaAlertsController } from "./api/citizen/areaAlerts.controller.js";
import { createAreaAlertsRoutes } from "./api/citizen/areaAlerts.routes.js";
import { createQueryInterpreter } from "./services/searchInterpreter.js";
import { createSearchAssistantService } from "./services/searchAssistant.service.js";
import { createSearchController } from "./api/admin/search.controller.js";
import { createSearchRoutes } from "./api/admin/search.routes.js";
import { createWebAccountAuthService } from "./services/webAccountAuth.service.js";
import { createWebAccountController } from "./api/auth/webAccount.controller.js";
import { createWebAccountRoutes } from "./api/auth/webAccount.routes.js";
import { createWantedNoticesService } from "./services/wantedNotices.service.js";
import { createWantedNoticesController } from "./api/wanted/wantedNotices.controller.js";
import { createWantedNoticesRoutes } from "./api/wanted/wantedNotices.routes.js";
import { createAccountRegistrationService } from "./services/accountRegistration.service.js";
import { createRegistrationController } from "./api/auth/registration.controller.js";
import { createRegistrationRoutes } from "./api/auth/registration.routes.js";
import { createOfficerApprovalController } from "./api/admin/officerApproval.controller.js";
import { createOfficerApprovalRoutes } from "./api/admin/officerApproval.routes.js";
import { createAdminCitizensController } from "./api/admin/adminCitizens.controller.js";
import { createAdminCitizensRoutes } from "./api/admin/adminCitizens.routes.js";
import { createTrafficAccidentAlertsService } from "./services/trafficAccidentAlerts.service.js";
import { createTrafficAccidentsController } from "./api/detections/trafficAccidents.controller.js";
import { createTrafficAccidentIngestRoutes } from "./api/detections/trafficAccidentIngest.routes.js";
import { createTrafficAccidentAlertsRoutes } from "./api/officer/trafficAccidentAlerts.routes.js";
import { createDetectorApiKeyMiddleware } from "./middleware/detectorApiKey.js";
import { createNewsFeedService } from "./services/newsFeed.service.js";
import { createNewsFeedController } from "./api/news/newsFeed.controller.js";
import { createNewsFeedRoutes } from "./api/news/newsFeed.routes.js";
import { createChatService } from "./services/chat.service.js";
import { createChatController } from "./api/officer/chat.controller.js";
import { createChatRoutes } from "./api/officer/chat.routes.js";
import { createBroadcastAlertsService } from "./services/broadcastAlerts.service.js";
import { createBroadcastAlertsController } from "./api/officer/broadcastAlerts.controller.js";
import { createBroadcastAlertsRoutes } from "./api/officer/broadcastAlerts.routes.js";
import { createLegalQueryInterpreter } from "./services/legalQueryInterpreter.js";
import { createLegalLookupService } from "./services/legalLookup.service.js";
import { createLegalLookupController } from "./api/legal/legalLookup.controller.js";
import { createLegalLookupRoutes } from "./api/legal/legalLookup.routes.js";
import { createApp } from "./app.js";

/** FCM env vars are all-or-nothing — anything short of all three configured falls back to the
 * console stub (dev/demo default) rather than crashing startup. */
function createNotificationSender(env: ReturnType<typeof loadEnv>, prisma: PrismaClient): NotificationSender {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    return new ConsoleNotificationSender();
  }
  try {
    return new FirebaseNotificationSender(prisma, {
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      privateKey: env.FCM_PRIVATE_KEY,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[fcm] failed to initialize Firebase Admin, falling back to console sender:", err);
    return new ConsoleNotificationSender();
  }
}

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

  const cache = createCache(env.REDIS_URL);
  const geoMatch = createGeoMatchService(prisma, cache);
  const assignOfficer = createAssignOfficerService(prisma);
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
  const notifications = createNotificationService(createNotificationSender(env, prisma));
  const reportLifecycle = createReportLifecycleService({ prisma, geoMatch, assignOfficer, storage, notifications });
  const categorySuggester = createReportCategorySuggester(env);
  const reportsController = createReportsController(reportLifecycle, categorySuggester);
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
    notifications,
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

  const heatNarrator = createHeatNarrator(env);
  const signalsService = createSignalsService({ prisma, districtScope, heatNarrator });
  const signalsController = createSignalsController(signalsService);
  const signalsRouter = createSignalsRoutes(signalsController, requireAuth);

  const emergencyContactsService = createEmergencyContactsService({ prisma, geoMatch });
  const emergencyContactsController = createEmergencyContactsController(emergencyContactsService);
  const emergencyContactsRouter = createEmergencyContactsRoutes(emergencyContactsController, requireAuth);

  const areaAlertsService = createAreaAlertsService({ prisma, geoMatch });
  const areaAlertsController = createAreaAlertsController(areaAlertsService);
  const areaAlertsRouter = createAreaAlertsRoutes(areaAlertsController, requireAuth);

  const queryInterpreter = createQueryInterpreter(env);
  const searchAssistantService = createSearchAssistantService({ prisma, interpreter: queryInterpreter });
  const searchController = createSearchController(searchAssistantService);
  const searchRouter = createSearchRoutes(searchController, requireAuth);

  const webAccountAuthService = createWebAccountAuthService({
    prisma,
    authService,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    auditLog,
    webAccountAccessTtlMinutes: env.WEB_ACCOUNT_ACCESS_TTL_MINUTES,
  });
  const webAccountController = createWebAccountController(webAccountAuthService);
  const webAccountRouter = createWebAccountRoutes(webAccountController, requireAuth);

  const wantedNoticesService = createWantedNoticesService({ prisma, storage });
  const wantedNoticesController = createWantedNoticesController(wantedNoticesService);
  const wantedNoticesRouter = createWantedNoticesRoutes(wantedNoticesController, requireAuth);

  const accountRegistrationService = createAccountRegistrationService({
    prisma,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
    phoneBlindIndexKey: env.PHONE_BLIND_INDEX_KEY,
    authService,
    storage,
    auditLog,
  });
  const registrationController = createRegistrationController(accountRegistrationService);
  const registrationRouter = createRegistrationRoutes(registrationController, requireAuth);
  const officerApprovalController = createOfficerApprovalController(accountRegistrationService);
  const officerApprovalRouter = createOfficerApprovalRoutes(officerApprovalController, requireAuth);
  const adminCitizensController = createAdminCitizensController(accountRegistrationService);
  const adminCitizensRouter = createAdminCitizensRoutes(adminCitizensController, requireAuth);

  const trafficAccidentAlertsService = createTrafficAccidentAlertsService({
    prisma,
    districtScope,
    assignOfficer,
    storage,
    notifications,
  });
  const trafficAccidentsController = createTrafficAccidentsController(trafficAccidentAlertsService);
  const requireDetectorApiKey = createDetectorApiKeyMiddleware(env.TRAFFIC_DETECTOR_API_KEY);
  const trafficAccidentIngestRouter = createTrafficAccidentIngestRoutes(
    trafficAccidentsController,
    requireDetectorApiKey,
  );
  const trafficAccidentAlertsRouter = createTrafficAccidentAlertsRoutes(trafficAccidentsController, requireAuth);

  const newsFeedService = createNewsFeedService();
  const newsFeedController = createNewsFeedController(newsFeedService);
  const newsFeedRouter = createNewsFeedRoutes(newsFeedController, requireAuth);

  const chatService = createChatService({
    prisma,
    districtScope,
    notifications,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY,
  });
  const chatController = createChatController(chatService);
  const chatRouter = createChatRoutes(chatController, requireAuth);

  const broadcastAlertsService = createBroadcastAlertsService({ prisma, districtScope, notifications });
  const broadcastAlertsController = createBroadcastAlertsController(broadcastAlertsService);
  const broadcastAlertsRouter = createBroadcastAlertsRoutes(broadcastAlertsController, requireAuth);

  const legalQueryInterpreter = createLegalQueryInterpreter(env);
  const legalLookupService = createLegalLookupService({ prisma, interpreter: legalQueryInterpreter });
  const legalLookupController = createLegalLookupController(legalLookupService);
  const legalLookupRouter = createLegalLookupRoutes(legalLookupController, requireAuth);

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
      searchRouter,
      webAccountRouter,
      wantedNoticesRouter,
      registrationRouter,
      officerApprovalRouter,
      adminCitizensRouter,
      trafficAccidentIngestRouter,
      trafficAccidentAlertsRouter,
      newsFeedRouter,
      chatRouter,
      broadcastAlertsRouter,
      legalLookupRouter,
    },
    {
      corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      // docs/DEPLOY.md: production sits behind exactly 1 reverse-proxy hop (IIS + URL
      // Rewrite/ARR). Trusting that one hop lets req.ip resolve to the real client address
      // instead of the proxy's own — otherwise every IP-keyed rate limiter collapses into one
      // shared bucket for all users (see rateLimiters.ts).
      trustProxy: env.NODE_ENV === "production" ? 1 : false,
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

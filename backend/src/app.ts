import compression from "compression";
import cors from "cors";
import express, { type Router } from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export interface AppRouters {
  authRouter: Router;
  citizenReportsRouter?: Router;
  officerReportsRouter?: Router;
  /** v1.1 — nearby-cameras + extraction requests, mounted at the same base as officerReportsRouter. */
  camerasRouter?: Router;
  /** v1.2 — admin/senior_officer only, mounted at "/admin/dashboard". */
  dashboardRouter?: Router;
  /** Giai đoạn 2 "kênh tình báo mở" — read-only, mounted at "/officer/signals". */
  signalsRouter?: Router;
  /** Giai đoạn 3 — mounted at "/emergency-contacts". */
  emergencyContactsRouter?: Router;
  /** Giai đoạn 3 — mounted at "/area-alerts". */
  areaAlertsRouter?: Router;
  /** Trợ lý tìm kiếm ngôn ngữ tự nhiên (AI cục bộ) — mounted at "/admin/search". */
  searchRouter?: Router;
  /** dashboard-web-react's username/password auth — mounted at "/" (routes spell out their
   * own full path: "/auth/web/login", "/web-accounts/*", "/admin/web-accounts/*"). Sits
   * alongside authRouter without touching it — the OTP flow is untouched. */
  webAccountRouter?: Router;
  /** "Lệnh truy nã" — mounted at "/wanted-notices". GET is any authenticated account
   * (citizen or officer); POST is senior_officer/admin only. */
  wantedNoticesRouter?: Router;
  /** Username/password registration+login — mounted at "/auth" alongside authRouter's OTP
   * flow. Both routers share the base path; neither one touches the other's routes. */
  registrationRouter?: Router;
  /** Admin approval for self-registered officer accounts — mounted at "/admin/officers". */
  officerApprovalRouter?: Router;
  /** Admin unlock for citizen accounts auto-locked after repeated false reports — mounted
   * at "/admin/citizens". */
  adminCitizensRouter?: Router;
  /** Detector worker ingestion (X-Detector-Api-Key, not a user JWT) — mounted at
   * "/detections/traffic-accidents". */
  trafficAccidentIngestRouter?: Router;
  /** Officer-facing list/detail/confirm/dismiss — mounted at "/officer/traffic-accident-alerts". */
  trafficAccidentAlertsRouter?: Router;
  /** Tin tức bocongan.gov.vn — mounted at "/news". GET is any authenticated account. */
  newsFeedRouter?: Router;
  /** Chat giữa các đơn vị (bottom-nav "Chat") — mounted at "/officer/chat". Channel-level
   * access is enforced in chat.service.ts, not here. */
  chatRouter?: Router;
}

export interface AppConfig {
  /** Empty/undefined => reflect any origin (dev/test only, never production — see config/env.ts). */
  corsAllowedOrigins?: string[];
  /** Express "trust proxy" setting. Must match the real number of reverse-proxy hops in front
   * of the app (docs/DEPLOY.md: 1 hop, IIS/ARR) in production, or req.ip always resolves to the
   * proxy's own address — silently collapsing every IP-keyed rate limiter (rateLimiters.ts),
   * including the SOS/emergency-report limiter, into one shared bucket for all users. */
  trustProxy?: number | boolean;
}

/** Builds the Express app from already-constructed routers — no env/DB access happens here. */
export function createApp(routers: AppRouters, config: AppConfig = {}) {
  const app = express();

  if (config.trustProxy !== undefined) {
    app.set("trust proxy", config.trustProxy);
  }

  app.use(helmet());
  app.use(cors(config.corsAllowedOrigins?.length ? { origin: config.corsAllowedOrigins } : {}));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok" }, error: null });
  });

  app.use("/auth", routers.authRouter);
  if (routers.registrationRouter) {
    app.use("/auth", routers.registrationRouter);
  }
  if (routers.officerApprovalRouter) {
    app.use("/admin/officers", routers.officerApprovalRouter);
  }
  if (routers.adminCitizensRouter) {
    app.use("/admin/citizens", routers.adminCitizensRouter);
  }
  if (routers.citizenReportsRouter) {
    app.use("/reports", routers.citizenReportsRouter);
  }
  if (routers.officerReportsRouter) {
    app.use("/officer/reports", routers.officerReportsRouter);
  }
  if (routers.camerasRouter) {
    app.use("/officer/reports", routers.camerasRouter);
  }
  if (routers.dashboardRouter) {
    app.use("/admin/dashboard", routers.dashboardRouter);
  }
  if (routers.signalsRouter) {
    app.use("/officer/signals", routers.signalsRouter);
  }
  if (routers.emergencyContactsRouter) {
    app.use("/emergency-contacts", routers.emergencyContactsRouter);
  }
  if (routers.areaAlertsRouter) {
    app.use("/area-alerts", routers.areaAlertsRouter);
  }
  if (routers.searchRouter) {
    app.use("/admin/search", routers.searchRouter);
  }
  if (routers.webAccountRouter) {
    app.use(routers.webAccountRouter);
  }
  if (routers.wantedNoticesRouter) {
    app.use("/wanted-notices", routers.wantedNoticesRouter);
  }
  if (routers.trafficAccidentIngestRouter) {
    app.use("/detections/traffic-accidents", routers.trafficAccidentIngestRouter);
  }
  if (routers.trafficAccidentAlertsRouter) {
    app.use("/officer/traffic-accident-alerts", routers.trafficAccidentAlertsRouter);
  }
  if (routers.newsFeedRouter) {
    app.use("/news", routers.newsFeedRouter);
  }
  if (routers.chatRouter) {
    app.use("/officer/chat", routers.chatRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

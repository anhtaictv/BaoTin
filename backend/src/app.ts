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
}

export interface AppConfig {
  /** Empty/undefined => reflect any origin (dev/test only, never production — see config/env.ts). */
  corsAllowedOrigins?: string[];
}

/** Builds the Express app from already-constructed routers — no env/DB access happens here. */
export function createApp(routers: AppRouters, config: AppConfig = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors(config.corsAllowedOrigins?.length ? { origin: config.corsAllowedOrigins } : {}));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok" }, error: null });
  });

  app.use("/auth", routers.authRouter);
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

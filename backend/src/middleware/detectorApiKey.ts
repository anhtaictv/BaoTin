import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler.js";

/**
 * Machine-to-machine auth for the traffic-accident detector worker (never a citizen/officer
 * JWT — that worker isn't a logged-in person). Empty expectedKey means "not configured", so
 * everything is rejected rather than silently accepting any request.
 */
export function createDetectorApiKeyMiddleware(expectedKey: string) {
  return function requireDetectorApiKey(req: Request, _res: Response, next: NextFunction): void {
    const provided = req.headers["x-detector-api-key"];
    if (!expectedKey || provided !== expectedKey) {
      next(new HttpError(401, "UNAUTHENTICATED", "Thiếu hoặc sai API key của thiết bị phát hiện."));
      return;
    }
    next();
  };
}

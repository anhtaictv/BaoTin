import type { NextFunction, Request, Response } from "express";
import type { KeyLike } from "jose";
import { verifyAccessToken } from "../crypto/jwtKeys.js";
import { HttpError } from "./errorHandler.js";
import type { AuthSubjectRole } from "../types/express.js";

/**
 * Builds requireAuth(roles) bound to the app's JWT public key. roles=[] means
 * "any authenticated subject"; otherwise the caller's role must be in the list.
 */
export function createAuthMiddleware(publicKey: KeyLike) {
  return function requireAuth(roles: AuthSubjectRole[] = []) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        next(new HttpError(401, "UNAUTHENTICATED", "Thiếu access token."));
        return;
      }
      const token = header.slice("Bearer ".length);

      try {
        const payload = await verifyAccessToken(token, publicKey);
        const role = payload.role as AuthSubjectRole;
        if (roles.length > 0 && !roles.includes(role)) {
          next(new HttpError(403, "FORBIDDEN", "Không có quyền truy cập tài nguyên này."));
          return;
        }
        req.user = { id: String(payload.sub), role };
        next();
      } catch {
        next(new HttpError(401, "INVALID_TOKEN", "Access token không hợp lệ hoặc đã hết hạn."));
      }
    };
  };
}

export type RequireAuth = ReturnType<typeof createAuthMiddleware>;

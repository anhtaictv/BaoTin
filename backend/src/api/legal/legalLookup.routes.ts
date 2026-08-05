import { Router } from "express";
import type { LegalLookupController } from "./legalLookup.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { legalLookupLimiter } from "../../middleware/rateLimiters.js";
import { legalLookupQuerySchema } from "../../validation/schemas/legalLookup.schema.js";

/** Tra cứu văn bản luật/quy định (AI local qua Ollama) — mounted at "/legal-lookup". Cùng 1
 * tính năng, cùng quyền cho officer VÀ citizen: requireAuth([]) chấp nhận bất kỳ role nào đã
 * đăng nhập, không giới hạn như "/admin/search" — nên cần legalLookupLimiter (rateLimiters.ts)
 * để chặn 1 tài khoản citizen spam request tốn tài nguyên Ollama. */
export function createLegalLookupRoutes(controller: LegalLookupController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.post(
    "/",
    legalLookupLimiter,
    requireAuth([]),
    validateRequest(legalLookupQuerySchema),
    asyncHandler(controller.lookup),
  );

  return router;
}

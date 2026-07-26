import { Router } from "express";
import type { ChatController } from "./chat.controller.js";
import type { RequireAuth } from "../../middleware/auth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { listChatMessagesQuerySchema, sendChatMessageSchema } from "../../validation/schemas/chat.schema.js";

const OFFICER_ROLES = ["officer", "senior_officer", "admin"] as const;

/** Mounted at "/officer/chat". Channel-level access (which district channels a plain
 * "officer" may read/write) is enforced inside chat.service.ts, same split as everything
 * else district-scoped — this layer only confirms the caller is an officer account at all. */
export function createChatRoutes(controller: ChatController, requireAuth: RequireAuth): Router {
  const router = Router();

  router.get("/channels", requireAuth([...OFFICER_ROLES]), asyncHandler(controller.listChannels));

  router.get(
    "/messages",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(listChatMessagesQuerySchema, "query"),
    asyncHandler(controller.listMessages),
  );

  router.post(
    "/messages",
    requireAuth([...OFFICER_ROLES]),
    validateRequest(sendChatMessageSchema, "body"),
    asyncHandler(controller.sendMessage),
  );

  return router;
}

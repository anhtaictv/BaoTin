import { z } from "zod";

export const wantedNoticeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

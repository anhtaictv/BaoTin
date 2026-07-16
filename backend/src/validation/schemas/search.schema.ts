import { z } from "zod";

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(300),
});

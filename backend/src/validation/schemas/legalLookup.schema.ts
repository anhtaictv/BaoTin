import { z } from "zod";

export const legalLookupQuerySchema = z.object({
  query: z.string().min(1).max(300),
});

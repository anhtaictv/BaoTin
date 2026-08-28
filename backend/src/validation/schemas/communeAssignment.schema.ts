import { z } from "zod";

export const districtIdParamsSchema = z.object({
  districtId: z.string().uuid(),
});

export const subordinateParamsSchema = z.object({
  districtId: z.string().uuid(),
  officerId: z.string().uuid(),
});

export const assignOldDistrictSchema = z.object({
  oldDistrictId: z.string().uuid().nullable(),
});

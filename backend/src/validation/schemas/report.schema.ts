import { z } from "zod";

export const reportLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  source: z.enum(["exif", "device_gps", "manual_pin"]),
});

/** Multipart text fields arrive as strings — `location` is sent as a JSON-encoded string field. */
const parseJsonField = (val: unknown) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

export const createReportSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  location: z.preprocess(parseJsonField, reportLocationSchema),
});

export const createEmergencyReportSchema = z.object({
  emergencyType: z.string().min(1).max(100),
  location: z.preprocess(parseJsonField, z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })),
});

/** Giai đoạn "nâng cấp AI cục bộ" — gợi ý loại vụ việc, không phải gửi tin báo thật nên
 * validation lỏng hơn createReportSchema (không cần location/attachments). */
export const classifyReportSchema = z.object({
  description: z.string().min(1).max(2000),
});

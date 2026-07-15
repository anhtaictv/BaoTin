import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_DATABASE_URL: z.string().min(1).optional(),

  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  MINIO_ROOT_USER: z.string().min(1).default("minioadmin"),
  MINIO_ROOT_PASSWORD: z.string().min(1).default("changeme_minio_pw"),
  MINIO_BUCKET: z.string().min(1).default("baotin-reports"),
  MINIO_PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  JWT_PRIVATE_KEY_PATH: z.string().min(1).default("./keys/jwt-private.pem"),
  JWT_PUBLIC_KEY_PATH: z.string().min(1).default("./keys/jwt-public.pem"),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  PII_ENCRYPTION_KEY: z
    .string()
    .min(1, "PII_ENCRYPTION_KEY is required (32 random bytes, base64)"),
  PHONE_BLIND_INDEX_KEY: z
    .string()
    .min(1, "PHONE_BLIND_INDEX_KEY is required (HMAC key, base64)"),
  OTP_HASH_PEPPER: z.string().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | undefined;

/** Parses process.env once and caches it. Throws with a readable message on first bad access. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cachedEnv = result.data;
  return cachedEnv;
}

/** Test-only: clears the cache so a test can reload env with different values. */
export function _resetEnvCacheForTests(): void {
  cachedEnv = undefined;
}

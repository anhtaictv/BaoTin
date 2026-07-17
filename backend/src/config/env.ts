import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_DATABASE_URL: z.string().min(1).optional(),

  /** Comma-separated allow-list (mobile apps don't send Origin; dashboard-web does). */
  CORS_ALLOWED_ORIGINS: z.string().default(""),

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

  /** Giai đoạn 2 crawler — AI tóm tắt 1-2 câu. No key configured => falls back to a plain
   * truncation, never crashes the crawler pipeline (see crawler/summarizer.ts). "ollama" runs
   * a local model (no API key, no data leaving the machine) via Ollama's REST API. */
  LLM_PROVIDER: z.enum(["openai", "gemini", "ollama", "none"]).default("none"),
  OPENAI_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen2.5:1.5b"),
})
  /**
   * SECURITY.md §4 (least-privilege DB user) and §5 (no wildcard CORS in production) are easy
   * to satisfy in dev and silently regress in prod — fail startup loudly instead of falling
   * back to the migrator/owner DB role or a wide-open CORS policy.
   */
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (!env.APP_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_DATABASE_URL"],
        message:
          "APP_DATABASE_URL is required in production — the least-privilege baotin_app role, not the migrator/owner role (SECURITY.md §4).",
      });
    }
    if (!env.CORS_ALLOWED_ORIGINS.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ALLOWED_ORIGINS"],
        message: "CORS_ALLOWED_ORIGINS is required in production — comma-separated allow-list, no wildcard.",
      });
    }
    if (!env.OTP_HASH_PEPPER.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OTP_HASH_PEPPER"],
        message:
          "OTP_HASH_PEPPER is required in production — an empty pepper lets a stolen otp_challenges " +
          "table be brute-forced offline (SECURITY.md §1.2/§2.2). Generate one with: " +
          `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      });
    }
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

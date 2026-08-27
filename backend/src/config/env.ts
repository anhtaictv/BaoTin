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
  /** Host baked into presigned GET URLs handed to browsers/apps — MinIO itself stays bound to
   * 127.0.0.1 only (docs/DEPLOY.md §1.4, never exposed directly), so this must be a
   * reverse-proxied public host (e.g. the domain, path-proxying the bucket name to MinIO) or
   * every presigned URL comes back as "http://localhost:9000/..." — unreachable from any
   * client that isn't the server itself. Defaults to MINIO_ENDPOINT/PORT/USE_SSL, which is
   * correct for local dev (browser and MinIO are the same "localhost" there) but MUST be
   * overridden in production. */
  MINIO_PUBLIC_ENDPOINT: z.string().min(1).optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().int().positive().optional(),
  MINIO_PUBLIC_USE_SSL: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  JWT_PRIVATE_KEY_PATH: z.string().min(1).default("./keys/jwt-private.pem"),
  JWT_PUBLIC_KEY_PATH: z.string().min(1).default("./keys/jwt-public.pem"),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** dashboard-web-react's username/password login (webAccountAuth.service.ts) only — officer/
   * admin accounts carry more sensitive access than a citizen session, so baomat.txt's hardening
   * pass asks for a shorter access-token lifetime specifically for this path, on top of the
   * already-short JWT_ACCESS_TTL_MINUTES shared by the citizen OTP flow. Does not touch
   * JWT_ACCESS_TTL_MINUTES or the OTP flow at all. */
  WEB_ACCOUNT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),

  PII_ENCRYPTION_KEY: z
    .string()
    .min(1, "PII_ENCRYPTION_KEY is required (32 random bytes, base64)"),
  PHONE_BLIND_INDEX_KEY: z
    .string()
    .min(1, "PHONE_BLIND_INDEX_KEY is required (HMAC key, base64)"),
  OTP_HASH_PEPPER: z.string().default(""),

  /** Every AI business task (crawler summarizer/relevance/dedup, report classifier, heat
   * narrative, search interpreter) reads this same block — one place to point them all.
   * No key configured => falls back to a plain truncation/heuristic, never crashes the
   * pipeline (see crawler/summarizer.ts). "ollama" runs a local model directly via Ollama's
   * REST API. "openai" calls any OpenAI-compatible chat-completions endpoint — default
   * OPENAI_BASE_URL is the shared AI Gateway (AI_GATEWAY.md) running on this same VPS at
   * 127.0.0.1:8080, which routes to Ollama on "máy A" via Tailscale with cloud fallback; set
   * OPENAI_API_KEY to the gateway's GATEWAY_API_KEY. Override OPENAI_BASE_URL to call a real
   * provider directly instead (e.g. https://api.openai.com/v1 or NVIDIA NIM). */
  LLM_PROVIDER: z.enum(["openai", "gemini", "ollama", "none"]).default("none"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().min(1).default("http://127.0.0.1:8080/v1"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().default(""),
  OLLAMA_BASE_URL: z.string().min(1).default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b"),

  /** Shared secret the traffic-accident detector worker sends as X-Detector-Api-Key when
   * posting a detected accident (object-detection + plate OCR only, see TrafficAccidentAlert
   * in schema.prisma) — machine-to-machine, not a citizen/officer JWT. Empty default means the
   * ingestion endpoint rejects everything until explicitly configured. */
  TRAFFIC_DETECTOR_API_KEY: z.string().default(""),

  /** Firebase Cloud Messaging — real push notification provider (server.ts wiring). Same
   * "no key configured => safe fallback, never crashes" pattern as LLM_PROVIDER above: unless
   * all three are set, server.ts falls back to ConsoleNotificationSender. FCM_PRIVATE_KEY is
   * the service account's PEM private key (literal "\n" sequences are un-escaped in
   * FirebaseNotificationSender before use — that's how it arrives in a .env file/most secret
   * managers). */
  FCM_PROJECT_ID: z.string().default(""),
  FCM_CLIENT_EMAIL: z.string().default(""),
  FCM_PRIVATE_KEY: z.string().default(""),

  /** Cache layer (src/cache/cache.ts) for rarely-changing lookups — currently geo-matching's
   * per-point district query (geo/geoMatch.service.ts). An unreachable Redis fails open: the
   * wrapped function just runs directly, same never-crash-the-request spirit as the LLM
   * fallbacks above. */
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
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
    if (!env.MINIO_PUBLIC_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MINIO_PUBLIC_ENDPOINT"],
        message:
          "MINIO_PUBLIC_ENDPOINT is required in production — without it, presigned image URLs " +
          "default to MINIO_ENDPOINT (e.g. \"localhost\"), which a browser/app on any other " +
          "machine can never reach. Set it to the public domain, reverse-proxied to MinIO.",
      });
    }
    if (env.MINIO_ROOT_USER === "minioadmin") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MINIO_ROOT_USER"],
        message: "MINIO_ROOT_USER must not be left at the default \"minioadmin\" in production.",
      });
    }
    if (env.MINIO_ROOT_PASSWORD === "changeme_minio_pw") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MINIO_ROOT_PASSWORD"],
        message: "MINIO_ROOT_PASSWORD must not be left at the default value in production.",
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

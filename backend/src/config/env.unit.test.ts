import { afterEach, describe, expect, it } from "vitest";
import { _resetEnvCacheForTests, loadEnv } from "./env.js";

const BASE_ENV = {
  DATABASE_URL: "postgres://localhost/baotin",
  PII_ENCRYPTION_KEY: "a".repeat(44),
  PHONE_BLIND_INDEX_KEY: "b".repeat(44),
};

afterEach(() => {
  _resetEnvCacheForTests();
});

describe("loadEnv — development", () => {
  it("allows an empty OTP_HASH_PEPPER outside production (dev/demo convenience)", () => {
    expect(() => loadEnv({ ...BASE_ENV, NODE_ENV: "development" })).not.toThrow();
  });
});

describe("loadEnv — production fail-fast", () => {
  it("throws when OTP_HASH_PEPPER is missing — an empty pepper lets a stolen otp_challenges table be brute-forced offline", () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: "production",
        APP_DATABASE_URL: "postgres://app_role@localhost/baotin",
        CORS_ALLOWED_ORIGINS: "https://dashboard.example.com",
      }),
    ).toThrow(/OTP_HASH_PEPPER is required in production/);
  });

  it("throws when APP_DATABASE_URL or CORS_ALLOWED_ORIGINS is missing (existing guards still hold)", () => {
    expect(() =>
      loadEnv({ ...BASE_ENV, NODE_ENV: "production", OTP_HASH_PEPPER: "c".repeat(44) }),
    ).toThrow(/APP_DATABASE_URL is required in production/);
  });

  it("succeeds once every production-only secret is set", () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: "production",
        APP_DATABASE_URL: "postgres://app_role@localhost/baotin",
        CORS_ALLOWED_ORIGINS: "https://dashboard.example.com",
        OTP_HASH_PEPPER: "c".repeat(44),
      }),
    ).not.toThrow();
  });
});

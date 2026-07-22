import { describe, expect, it } from "vitest";
import { createStorageClient } from "./minioClient.js";

// presignedGetObject is a pure local HMAC-signature computation — the minio SDK never
// contacts the server to build the URL, so this is testable without a live MinIO instance.
const BASE = {
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "test-access",
  secretKey: "test-secret",
  bucket: "baotin-reports",
  presignedUrlTtlSeconds: 900,
};

describe("minioClient — presigned URL host", () => {
  it("uses the internal endPoint when no public* config is given (local dev)", async () => {
    const storage = createStorageClient(BASE);
    const url = await storage.getPresignedGetUrl("reports/some-key");
    expect(url.startsWith("http://localhost:9000/")).toBe(true);
  });

  it("uses the public endPoint/port/useSSL when given — never the internal-only host", async () => {
    const storage = createStorageClient({
      ...BASE,
      publicEndPoint: "baotin.work.gd",
      publicPort: 443,
      publicUseSSL: true,
    });
    const url = await storage.getPresignedGetUrl("reports/some-key");
    expect(url.startsWith("https://baotin.work.gd/")).toBe(true);
    expect(url).not.toContain("localhost");
  });
});

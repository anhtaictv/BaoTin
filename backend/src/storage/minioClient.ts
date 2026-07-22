import { Client } from "minio";

// MinIO's default region — matches what a self-hosted MinIO server without MINIO_REGION set
// actually reports. Pinning it (instead of leaving `region` unset) matters: minio-js's
// presignedGetObject would otherwise call getBucketRegionAsync() over the network first, and
// the presigningClient below is deliberately configured with a host (the public domain) that
// only becomes reachable once the reverse-proxy side of this fix is deployed — a network
// round-trip there is fragile (VPS hairpin NAT, outbound-blocked, or just slow) for something
// that should be a pure local HMAC computation.
const DEFAULT_REGION = "us-east-1";

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** Presigned GET URLs expire quickly (SECURITY.md §2.2) — objects are never made public. */
  presignedUrlTtlSeconds: number;
  /** Host/port/scheme baked into presigned URLs — defaults to endPoint/port/useSSL above when
   * omitted (correct for local dev, where the browser and MinIO share "localhost"). In
   * production this must be the public domain (reverse-proxied to MinIO), never the
   * internal-only address MinIO actually listens on — see env.ts's MINIO_PUBLIC_ENDPOINT. */
  publicEndPoint?: string;
  publicPort?: number;
  publicUseSSL?: boolean;
}

export function createStorageClient(config: MinioConfig) {
  const client = new Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: DEFAULT_REGION,
  });

  const presigningClient =
    config.publicEndPoint === undefined && config.publicPort === undefined && config.publicUseSSL === undefined
      ? client
      : new Client({
          endPoint: config.publicEndPoint ?? config.endPoint,
          port: config.publicPort ?? config.port,
          useSSL: config.publicUseSSL ?? config.useSSL,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
          region: DEFAULT_REGION,
        });

  async function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await client.putObject(config.bucket, key, buffer, buffer.length, { "Content-Type": contentType });
  }

  async function getPresignedGetUrl(key: string): Promise<string> {
    return presigningClient.presignedGetObject(config.bucket, key, config.presignedUrlTtlSeconds);
  }

  return { putObject, getPresignedGetUrl };
}

export type StorageClient = ReturnType<typeof createStorageClient>;

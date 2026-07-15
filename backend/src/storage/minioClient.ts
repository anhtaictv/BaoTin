import { Client } from "minio";

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** Presigned GET URLs expire quickly (SECURITY.md §2.2) — objects are never made public. */
  presignedUrlTtlSeconds: number;
}

export function createStorageClient(config: MinioConfig) {
  const client = new Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  async function putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await client.putObject(config.bucket, key, buffer, buffer.length, { "Content-Type": contentType });
  }

  async function getPresignedGetUrl(key: string): Promise<string> {
    return client.presignedGetObject(config.bucket, key, config.presignedUrlTtlSeconds);
  }

  return { putObject, getPresignedGetUrl };
}

export type StorageClient = ReturnType<typeof createStorageClient>;

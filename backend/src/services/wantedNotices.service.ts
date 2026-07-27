import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import type { StorageClient } from "../storage/minioClient.js";
import { validateImageBuffer } from "../api/citizen/imageValidation.js";

export interface WantedNoticesDeps {
  prisma: PrismaClient;
  storage: StorageClient;
}

export interface WantedNoticeSummary {
  id: string;
  photoUrl: string;
  createdAt: Date;
}

export interface CreateWantedNoticeInput {
  postedById: string;
  buffer: Buffer;
  mimetype: string;
}

/**
 * "Lệnh truy nã" — posted only by admin (role gating happens at the route
 * layer, api/wanted/wantedNotices.routes.ts), visible to any authenticated account. The photo
 * carries all identifying info by product decision, so there's nothing to store beyond it.
 */
export function createWantedNoticesService(deps: WantedNoticesDeps) {
  async function list(): Promise<WantedNoticeSummary[]> {
    const rows = await deps.prisma.wantedNotice.findMany({ orderBy: { createdAt: "desc" } });
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        photoUrl: await deps.storage.getPresignedGetUrl(row.photoUrl),
        createdAt: row.createdAt,
      })),
    );
  }

  async function create(input: CreateWantedNoticeInput): Promise<WantedNoticeSummary> {
    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new HttpError(400, "INVALID_IMAGE", validation.reason ?? "Ảnh không hợp lệ.");
    }

    const key = `wanted-notices/${randomUUID()}`;
    await deps.storage.putObject(key, input.buffer, input.mimetype);
    const row = await deps.prisma.wantedNotice.create({
      data: { photoUrl: key, postedById: input.postedById },
    });

    return { id: row.id, photoUrl: await deps.storage.getPresignedGetUrl(key), createdAt: row.createdAt };
  }

  /** Replaces the photo in place (the only editable content — no other field exists on this
   * record). Uploads the new object and repoints the row before removing the old object, so a
   * failure mid-upload never leaves the row referencing nothing. */
  async function update(id: string, input: { buffer: Buffer; mimetype: string }): Promise<WantedNoticeSummary> {
    const existing = await deps.prisma.wantedNotice.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "NOTICE_NOT_FOUND", "Không tìm thấy lệnh truy nã.");

    const validation = await validateImageBuffer(input.buffer);
    if (!validation.valid) {
      throw new HttpError(400, "INVALID_IMAGE", validation.reason ?? "Ảnh không hợp lệ.");
    }

    const newKey = `wanted-notices/${randomUUID()}`;
    await deps.storage.putObject(newKey, input.buffer, input.mimetype);
    const row = await deps.prisma.wantedNotice.update({ where: { id }, data: { photoUrl: newKey } });
    await deps.storage.removeObject(existing.photoUrl);

    return { id: row.id, photoUrl: await deps.storage.getPresignedGetUrl(newKey), createdAt: row.createdAt };
  }

  async function remove(id: string): Promise<void> {
    const existing = await deps.prisma.wantedNotice.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "NOTICE_NOT_FOUND", "Không tìm thấy lệnh truy nã.");

    await deps.prisma.wantedNotice.delete({ where: { id } });
    await deps.storage.removeObject(existing.photoUrl);
  }

  return { list, create, update, remove };
}

export type WantedNoticesService = ReturnType<typeof createWantedNoticesService>;

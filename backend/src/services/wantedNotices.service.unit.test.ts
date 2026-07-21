import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWantedNoticesService } from "./wantedNotices.service.js";
import type { StorageClient } from "../storage/minioClient.js";

async function makeTestJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .jpeg()
    .toBuffer();
}

function fakeStorage() {
  const objects = new Map<string, Buffer>();
  const storage: StorageClient = {
    async putObject(key, buffer) {
      objects.set(key, buffer);
    },
    async getPresignedGetUrl(key) {
      return `https://minio.example/${key}?presigned=1`;
    },
  };
  return { storage, objects };
}

function fakePrisma() {
  const rows: { id: string; photoUrl: string; postedById: string; createdAt: Date }[] = [];
  let clockMs = 0;
  return {
    wantedNotice: {
      async findMany() {
        return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      async create({ data }: { data: { photoUrl: string; postedById: string } }) {
        clockMs += 1;
        const row = { id: randomUUID(), createdAt: new Date(clockMs), ...data };
        rows.push(row);
        return row;
      },
    },
  };
}

describe("wantedNotices.service", () => {
  it("rejects a non-image buffer without touching storage or the DB", async () => {
    const { storage, objects } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });

    await expect(
      service.create({ postedById: randomUUID(), buffer: Buffer.from("not an image"), mimetype: "image/jpeg" }),
    ).rejects.toThrow();
    expect(objects.size).toBe(0);
    expect(await prisma.wantedNotice.findMany()).toHaveLength(0);
  });

  it("stores a valid photo and returns it with a resolved presigned URL", async () => {
    const { storage, objects } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });
    const officerId = randomUUID();

    const created = await service.create({
      postedById: officerId,
      buffer: await makeTestJpeg(),
      mimetype: "image/jpeg",
    });

    expect(created.photoUrl).toContain("presigned=1");
    expect(objects.size).toBe(1);

    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
    expect(list[0]?.photoUrl).toContain("presigned=1");
  });

  it("lists newest notices first", async () => {
    const { storage } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });
    const jpeg = await makeTestJpeg();

    const first = await service.create({ postedById: randomUUID(), buffer: jpeg, mimetype: "image/jpeg" });
    const second = await service.create({ postedById: randomUUID(), buffer: jpeg, mimetype: "image/jpeg" });

    const list = await service.list();
    expect(list.map((n) => n.id)).toEqual([second.id, first.id]);
  });
});

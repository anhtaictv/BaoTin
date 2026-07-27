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
    async removeObject(key) {
      objects.delete(key);
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
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return rows.find((r) => r.id === id) ?? null;
      },
      async create({ data }: { data: { photoUrl: string; postedById: string } }) {
        clockMs += 1;
        const row = { id: randomUUID(), createdAt: new Date(clockMs), ...data };
        rows.push(row);
        return row;
      },
      async update({ where: { id }, data }: { where: { id: string }; data: { photoUrl: string } }) {
        const row = rows.find((r) => r.id === id);
        if (!row) throw new Error("not found");
        row.photoUrl = data.photoUrl;
        return row;
      },
      async delete({ where: { id } }: { where: { id: string } }) {
        const index = rows.findIndex((r) => r.id === id);
        if (index === -1) throw new Error("not found");
        const [row] = rows.splice(index, 1);
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

  it("update() replaces the photo and removes the old object from storage", async () => {
    const { storage, objects } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });

    const created = await service.create({ postedById: randomUUID(), buffer: await makeTestJpeg(), mimetype: "image/jpeg" });
    expect(objects.size).toBe(1);

    const updated = await service.update(created.id, { buffer: await makeTestJpeg(), mimetype: "image/jpeg" });
    expect(updated.id).toBe(created.id);
    expect(objects.size).toBe(1); // old object removed, new one uploaded — never both at once
  });

  it("update() rejects a non-image buffer without touching storage", async () => {
    const { storage, objects } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });
    const created = await service.create({ postedById: randomUUID(), buffer: await makeTestJpeg(), mimetype: "image/jpeg" });

    await expect(
      service.update(created.id, { buffer: Buffer.from("not an image"), mimetype: "image/jpeg" }),
    ).rejects.toThrow();
    expect(objects.size).toBe(1); // unchanged
  });

  it("update() 404s for a notice that doesn't exist", async () => {
    const { storage } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });

    await expect(
      service.update(randomUUID(), { buffer: await makeTestJpeg(), mimetype: "image/jpeg" }),
    ).rejects.toThrow();
  });

  it("remove() deletes both the row and the storage object", async () => {
    const { storage, objects } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });
    const created = await service.create({ postedById: randomUUID(), buffer: await makeTestJpeg(), mimetype: "image/jpeg" });

    await service.remove(created.id);

    expect(objects.size).toBe(0);
    expect(await prisma.wantedNotice.findMany()).toHaveLength(0);
  });

  it("remove() 404s for a notice that doesn't exist", async () => {
    const { storage } = fakeStorage();
    const prisma = fakePrisma();
    const service = createWantedNoticesService({ prisma: prisma as any, storage });

    await expect(service.remove(randomUUID())).rejects.toThrow();
  });
});

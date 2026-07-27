import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import type { StorageClient } from "../../src/storage/minioClient.js";

export interface SeedTrafficAccidentSpec {
  /** Must match a cameras.name value seeded by seed-cameras.ts. */
  cameraName: string;
  /** Comma-separated OCR reads, mirrors trafficAccidentAlerts.service.ts's ingestDetection. */
  plateNumbers: string[];
  status: "pending" | "confirmed" | "dismissed";
  detectedAt: Date;
  withThumbnail: boolean;
}

/**
 * Demo data for "Cảnh báo TNGT" (v1.2 — object-detection + plate-OCR alerts, camera-only,
 * never actual video). Mirrors ingestDetection's own behavior (district/officer assignment
 * from the camera, thumbnail uploaded to MinIO under the same key prefix, presigned on read)
 * instead of going through the full service, so this doesn't need its notification/assignOfficer
 * deps wired up — see seed-signals.ts / seed-cameras.ts for the same direct-create pattern.
 */
export const SEED_TRAFFIC_ACCIDENTS: SeedTrafficAccidentSpec[] = [
  {
    cameraName: "[DEMO] Camera ngã tư Lê Duẩn - Nguyễn Tất Thành",
    plateNumbers: ["47H1-123.45", "47F2-678.90"],
    status: "pending",
    detectedAt: new Date(Date.now() - 20 * 60 * 1000),
    withThumbnail: true,
  },
  {
    cameraName: "[DEMO] Camera chợ trung tâm Buôn Ma Thuột",
    plateNumbers: ["47B1-555.12"],
    status: "pending",
    detectedAt: new Date(Date.now() - 90 * 60 * 1000),
    withThumbnail: true,
  },
  {
    cameraName: "[DEMO] Camera ngã tư Lê Duẩn - Nguyễn Tất Thành",
    plateNumbers: ["47H1-999.99"],
    status: "confirmed",
    detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    withThumbnail: true,
  },
  {
    cameraName: "[DEMO] Camera bến xe Buôn Hồ",
    plateNumbers: [],
    status: "dismissed",
    detectedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    withThumbnail: false,
  },
  {
    cameraName: "[DEMO] Camera bến xe Buôn Hồ",
    plateNumbers: ["47C-246.80"],
    status: "pending",
    detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    withThumbnail: true,
  },
];

/** A plain colored placeholder frame — good enough to render as a real thumbnail in the UI;
 * this is demo seed data, not an actual camera capture (CLAUDE.md: no real video/footage ever
 * touches this system). */
async function placeholderThumbnail(): Promise<Buffer> {
  return sharp({ create: { width: 320, height: 180, channels: 3, background: { r: 60, g: 60, b: 70 } } })
    .jpeg()
    .toBuffer();
}

export interface SeedTrafficAccidentsDeps {
  prisma: PrismaClient;
  storage: StorageClient;
  accidents?: SeedTrafficAccidentSpec[];
}

export async function seedTrafficAccidents(deps: SeedTrafficAccidentsDeps): Promise<void> {
  const specs = deps.accidents ?? SEED_TRAFFIC_ACCIDENTS;

  // No natural unique key on this table (unlike seed-account-registration.ts's
  // username/phone) to catch-and-skip per row, and detectedAt is relative-to-now so it can't
  // be compared across runs — guard the whole batch instead: if a prior run already created
  // at least this many alerts against these demo cameras, assume it's done and skip, so
  // rerunning this against production doesn't keep piling up duplicate alerts.
  const cameraNames = [...new Set(specs.map((s) => s.cameraName))];
  const cameraIds = (await deps.prisma.camera.findMany({ where: { name: { in: cameraNames } }, select: { id: true } })).map(
    (c) => c.id,
  );
  const alreadySeeded = await deps.prisma.trafficAccidentAlert.count({ where: { cameraId: { in: cameraIds } } });
  if (alreadySeeded >= specs.length) {
    // eslint-disable-next-line no-console
    console.log(`[seed-traffic-accidents] ${alreadySeeded} alert(s) already exist on demo cameras — skipping.`);
    return;
  }

  const thumbnail = await placeholderThumbnail();

  for (const spec of specs) {
    const camera = await deps.prisma.camera.findFirst({ where: { name: spec.cameraName } });
    if (!camera) {
      // eslint-disable-next-line no-console
      console.warn(`[seed-traffic-accidents] camera "${spec.cameraName}" not found — run seed-cameras first. Skipping.`);
      continue;
    }

    let thumbnailUrl: string | null = null;
    if (spec.withThumbnail) {
      thumbnailUrl = `traffic-accident-alerts/${randomUUID()}`;
      await deps.storage.putObject(thumbnailUrl, thumbnail, "image/jpeg");
    }

    const assignment = camera.districtId
      ? await deps.prisma.officerDistrictAssignment.findFirst({
          where: { districtId: camera.districtId, isActive: true },
          orderBy: { id: "asc" },
        })
      : null;

    const isResolved = spec.status !== "pending";
    const alert = await deps.prisma.trafficAccidentAlert.create({
      data: {
        cameraId: camera.id,
        districtId: camera.districtId,
        assignedOfficerId: assignment?.officerId ?? null,
        plateNumbers: spec.plateNumbers.length ? spec.plateNumbers.join(", ") : null,
        thumbnailUrl,
        status: spec.status,
        detectedAt: spec.detectedAt,
        confirmedAt: isResolved ? new Date(spec.detectedAt.getTime() + 10 * 60 * 1000) : null,
        confirmedByOfficerId: isResolved ? (assignment?.officerId ?? null) : null,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`[seed-traffic-accidents] ${spec.cameraName} (${spec.status}) -> alert ${alert.id}`);
  }
}

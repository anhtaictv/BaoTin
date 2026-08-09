import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import type { ReportLifecycleService } from "../../src/services/reportLifecycle.service.js";
import type { WantedNoticesService } from "../../src/services/wantedNotices.service.js";

export interface SeedDemoReportsDeps {
  prisma: PrismaClient;
  reportLifecycle: ReportLifecycleService;
  wantedNotices: WantedNoticesService;
}

const DEMO_MARKER = "[DEMO]";

interface DemoReportSpec {
  category: string;
  description: string;
  lat: number;
  lng: number;
  /** Omitted => stays 'pending' (whatever createCitizenReport left it at). */
  finalStatus?: "verifying" | "confirmed_true" | "confirmed_false";
  note?: string;
  withPhoto?: boolean;
}

interface DemoEmergencySpec {
  emergencyType: string;
  lat: number;
  lng: number;
  finalStatus?: "verifying" | "confirmed_true" | "confirmed_false";
  note?: string;
}

// Same verified coordinates seed-cameras.ts already uses (confirmed inside real district
// polygons from data/raw/Daklak.geojson) — reusing them avoids guessing new points that might
// land in a gap between wards and come back with districtId null.
const BUON_MA_THUOT = { lat: 12.678, lng: 108.05 };
const BUON_MA_THUOT_2 = { lat: 12.682, lng: 108.048 };
const BUON_HO = { lat: 12.91, lng: 108.27 };
// ~150m due north of BUON_MA_THUOT (= seed-cameras.ts's Camera 1, directionDegrees=135 "Đông
// Nam", fovDegrees=80). Bearing from that camera to this point is ~0° (Bắc), outside its
// 95°-175° field of view — demos the "gần nhưng camera không hướng tới" (facesLocation=false)
// case distinctly from every other report above, which sit exactly on a camera's own
// coordinates (facesLocation=true, distance≈0m, trivial). Close enough to the verified
// BUON_MA_THUOT point that it should stay inside the same ward polygon.
const NEAR_CAMERA_1_NOT_FACING = { lat: 12.679347, lng: 108.05 };

const DEMO_REPORTS: DemoReportSpec[] = [
  {
    category: "trom_cap",
    description: `${DEMO_MARKER} Mất xe máy để trước cửa hàng tạp hóa, nghi bị trộm lúc rạng sáng.`,
    ...BUON_MA_THUOT,
  },
  {
    category: "tai_nan",
    description: `${DEMO_MARKER} Va chạm giao thông giữa xe máy và ô tô tại ngã tư, không có thương vong nặng.`,
    ...BUON_MA_THUOT_2,
    finalStatus: "verifying",
    note: "Cán bộ đang xuống hiện trường xác minh.",
  },
  {
    category: "chay_no",
    description: `${DEMO_MARKER} Cháy nhỏ tại khu vực bếp một hộ dân, đã được dập tắt kịp thời.`,
    ...BUON_HO,
    finalStatus: "confirmed_true",
    note: "Đã xác minh qua camera và người dân xung quanh — đúng sự thật.",
    withPhoto: true,
  },
  {
    category: "an_ninh_khan_cap",
    description: `${DEMO_MARKER} Nghi có người khả nghi đi lại nhiều lần quanh khu dân cư ban đêm.`,
    ...BUON_MA_THUOT,
    finalStatus: "confirmed_false",
    note: "Xác minh là người giao hàng của khu vực, không có dấu hiệu bất thường.",
  },
  {
    category: "khac",
    description: `${DEMO_MARKER} Phản ánh về tiếng ồn lớn kéo dài từ một quán karaoke gần khu dân cư.`,
    ...BUON_HO,
  },
  {
    category: "an_ninh_khan_cap",
    description: `${DEMO_MARKER} Phát hiện đối tượng lạ mặt lảng vảng gần trạm xe buýt, có biểu hiện nghi vấn.`,
    ...NEAR_CAMERA_1_NOT_FACING,
  },
  {
    category: "trom_cap",
    description: `${DEMO_MARKER} Trộm đột nhập cửa hàng tiện lợi, lấy đi một số hàng hóa.`,
    ...BUON_MA_THUOT_2,
    finalStatus: "confirmed_true",
    note: "Đã xác minh qua camera an ninh của cửa hàng.",
    withPhoto: true,
  },
];

const DEMO_EMERGENCIES: DemoEmergencySpec[] = [
  {
    emergencyType: "chay_no",
    ...BUON_MA_THUOT,
  },
  {
    emergencyType: "an_ninh_khan_cap",
    ...BUON_HO,
    finalStatus: "verifying",
    note: "Cán bộ phụ trách địa bàn đang có mặt tại hiện trường.",
  },
];

async function placeholderPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 6, height: 6, channels: 3, background: { r: 120, g: 40, b: 40 } } })
    .jpeg()
    .toBuffer();
}

async function applyFinalStatus(
  prisma: PrismaClient,
  reportId: string,
  status: "verifying" | "confirmed_true" | "confirmed_false",
  note?: string,
): Promise<void> {
  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
  const isConfirmed = status === "confirmed_true" || status === "confirmed_false";
  await prisma.report.update({
    where: { id: reportId },
    data: { status, verifiedAt: isConfirmed ? new Date() : null },
  });
  await prisma.reportStatusHistory.create({
    data: {
      reportId,
      oldStatus: report.status,
      newStatus: status,
      changedBy: report.assignedOfficerId,
      note: note ?? null,
    },
  });
}

/**
 * Sample citizen reports + wanted notices for a populated demo — anh, 2026-07-22 ("thêm dữ
 * liệu mẫu tin báo, tin truy nã cho đầy đủ trước khi demo"). Goes through the real
 * reportLifecycle/wantedNotices services (same geo-matching, officer assignment, MinIO
 * upload path as a genuine citizen submission) rather than inserting rows by hand, so demo
 * data behaves identically to real usage. Idempotent: skips entirely if any [DEMO]-tagged
 * report already exists, so re-running the seed doesn't keep duplicating content.
 */
export async function seedDemoReports(deps: SeedDemoReportsDeps): Promise<void> {
  const demoCitizen = await deps.prisma.user.findUnique({ where: { username: "demo_citizen" } });
  if (!demoCitizen) {
    console.log("[seed-demo-reports] demo_citizen not found — run seed:demo-accounts first, skipping.");
    return;
  }

  const existing = await deps.prisma.report.findFirst({ where: { userId: demoCitizen.id, description: { startsWith: DEMO_MARKER } } });
  if (existing) {
    console.log("[seed-demo-reports] demo reports already exist — skipping.");
  } else {
    const photo = await placeholderPhoto();
    for (const spec of DEMO_REPORTS) {
      const { reportId } = await deps.reportLifecycle.createCitizenReport({
        userId: demoCitizen.id,
        category: spec.category,
        description: spec.description,
        location: { lat: spec.lat, lng: spec.lng, source: "manual_pin" },
        attachments: spec.withPhoto ? [{ buffer: photo, mimetype: "image/jpeg", exifGps: null }] : [],
      });
      if (spec.finalStatus) {
        await applyFinalStatus(deps.prisma, reportId, spec.finalStatus, spec.note);
      }
      console.log(`[seed-demo-reports] ${spec.category} @ (${spec.lat},${spec.lng}) -> ${spec.finalStatus ?? "pending"}`);
    }

    for (const spec of DEMO_EMERGENCIES) {
      const { reportId } = await deps.reportLifecycle.createEmergencyReport({
        userId: demoCitizen.id,
        emergencyType: spec.emergencyType,
        location: { lat: spec.lat, lng: spec.lng },
      });
      if (spec.finalStatus) {
        await applyFinalStatus(deps.prisma, reportId, spec.finalStatus, spec.note);
      }
      console.log(`[seed-demo-reports] EMERGENCY ${spec.emergencyType} -> ${spec.finalStatus ?? "pending"}`);
    }
  }

  const adminOfficer = await deps.prisma.officer.findFirst({ where: { role: "admin" } });
  const existingWanted = await deps.prisma.wantedNotice.findFirst();
  if (!adminOfficer) {
    console.log("[seed-demo-reports] no admin officer found — skipping wanted notices.");
  } else if (existingWanted) {
    console.log("[seed-demo-reports] wanted notices already exist — skipping.");
  } else {
    const photo = await placeholderPhoto();
    for (let i = 0; i < 3; i++) {
      await deps.wantedNotices.create({ postedById: adminOfficer.id, buffer: photo, mimetype: "image/jpeg" });
    }
    console.log("[seed-demo-reports] 3 demo wanted notices created.");
  }
}

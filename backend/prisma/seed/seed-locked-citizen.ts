import type { PrismaClient } from "@prisma/client";
import type { ReportLifecycleService } from "../../src/services/reportLifecycle.service.js";
import { encryptField } from "../../src/crypto/aesGcm.js";
import { hashPhoneNumber } from "../../src/crypto/phoneBlindIndex.js";

export interface SeedLockedCitizenDeps {
  prisma: PrismaClient;
  reportLifecycle: ReportLifecycleService;
  piiEncryptionKey: string;
  phoneBlindIndexKey: string;
}

const DEMO_MARKER = "[DEMO]";
const DEMO_PHONE = "0900000098";
const DEMO_FULL_NAME = `${DEMO_MARKER} Công dân bị khóa (báo tin sai)`;

// Same verified in-district coordinates seed-demo-reports.ts already uses.
const BUON_MA_THUOT = { lat: 12.678, lng: 108.05 };

/** 4 obviously-false reports, one past the FALSE_REPORT_LOCK_THRESHOLD in
 * officerReports.service.ts's lockIfRepeatedlyFalse — enough to demo the real auto-lock
 * screen (locked_citizens_screen.dart) without needing a real officer to click through 4
 * confirmations live. Reports/status are created directly (same lighter-weight pattern as
 * seed-demo-reports.ts's applyFinalStatus) rather than replaying the full officerReports
 * .service.ts updateStatus flow — that needs districtScope/officialCaseLink/auditLog wired up
 * just to reach a 3-line lockedAt write this replicates directly. */
const DEMO_FALSE_REPORTS = [
  { category: "trom_cap", description: `${DEMO_MARKER} Báo mất xe máy — xác minh không có thật, xe vẫn ở nhà.` },
  { category: "chay_no", description: `${DEMO_MARKER} Báo cháy nhà hàng xóm — xác minh không có cháy.` },
  { category: "an_ninh_khan_cap", description: `${DEMO_MARKER} Báo người khả nghi trước nhà — xác minh là shipper quen.` },
  { category: "khac", description: `${DEMO_MARKER} Báo tiếng ồn giữa đêm — xác minh không có vụ việc.` },
];

/**
 * Demo data for "Tài khoản bị khóa" (admin_citizens/locked_citizens_screen.dart) — a citizen
 * auto-locked after their 4th confirmed_false report. Idempotent: skips if this demo citizen
 * already exists.
 */
export async function seedLockedCitizen(deps: SeedLockedCitizenDeps): Promise<void> {
  const phoneHash = hashPhoneNumber(DEMO_PHONE, deps.phoneBlindIndexKey);
  const existing = await deps.prisma.user.findUnique({ where: { phoneHash } });
  if (existing?.lockedAt) {
    console.log("[seed-locked-citizen] demo locked citizen already exists — skipping.");
    return;
  }

  const user =
    existing ??
    (await deps.prisma.user.create({
      data: {
        phoneHash,
        phoneNumberEnc: encryptField(DEMO_PHONE, deps.piiEncryptionKey),
        fullNameEnc: encryptField(DEMO_FULL_NAME, deps.piiEncryptionKey),
        verifiedAt: new Date(),
      },
    }));

  const adminOfficer = await deps.prisma.officer.findFirst({ where: { role: "admin" } });

  for (const spec of DEMO_FALSE_REPORTS) {
    const { reportId } = await deps.reportLifecycle.createCitizenReport({
      userId: user.id,
      category: spec.category,
      description: spec.description,
      location: { ...BUON_MA_THUOT, source: "manual_pin" },
      attachments: [],
    });
    const report = await deps.prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    await deps.prisma.report.update({
      where: { id: reportId },
      data: { status: "confirmed_false", verifiedAt: new Date() },
    });
    await deps.prisma.reportStatusHistory.create({
      data: {
        reportId,
        oldStatus: report.status,
        newStatus: "confirmed_false",
        changedBy: adminOfficer?.id ?? null,
        note: "[DEMO] Cán bộ xác minh: tin báo không đúng sự thật.",
      },
    });
  }

  await deps.prisma.user.update({ where: { id: user.id }, data: { lockedAt: new Date() } });
  console.log(`[seed-locked-citizen] ${DEMO_FULL_NAME} -> locked after ${DEMO_FALSE_REPORTS.length} confirmed_false reports`);
}

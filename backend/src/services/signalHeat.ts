export type HeatLevel = "low" | "medium" | "high";

export interface SignalHeat {
  score: number;
  level: HeatLevel;
}

export const HEAT_LOOKBACK_DAYS = 14;
/** score = số tín hiệu trong cùng địa bàn, 14 ngày gần nhất. Ngưỡng thấp hơn areaAlerts.service.ts
 * vì tín hiệu MXH/báo chí thưa hơn nhiều so với tin dân báo. */
const HEAT_THRESHOLD_HIGH = 5;
const HEAT_THRESHOLD_MEDIUM = 2;

export function heatLevelFor(score: number): HeatLevel {
  if (score >= HEAT_THRESHOLD_HIGH) return "high";
  if (score >= HEAT_THRESHOLD_MEDIUM) return "medium";
  return "low";
}

/**
 * Giai đoạn 4 "Tính độ nóng tin MXH" — ROADMAP.md note: "cần dữ liệu chạy vài tuần" để có ý
 * nghĩa thật, nhưng phép tính chạy đúng ngay cả khi dữ liệu còn ít (score đơn giản là 0 nếu
 * chưa có tín hiệu nào khác trong địa bàn). Không tính cho tín hiệu chưa xác định địa bàn.
 */
export function computeHeatByDistrict(
  signals: { districtId: string | null; crawledAt: Date; publishedAt: Date | null }[],
): Map<string, SignalHeat> {
  const since = new Date(Date.now() - HEAT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const counts = new Map<string, number>();

  for (const signal of signals) {
    if (!signal.districtId) continue;
    const effectiveDate = signal.publishedAt ?? signal.crawledAt;
    if (effectiveDate < since) continue;
    counts.set(signal.districtId, (counts.get(signal.districtId) ?? 0) + 1);
  }

  const result = new Map<string, SignalHeat>();
  for (const [districtId, score] of counts) {
    result.set(districtId, { score, level: heatLevelFor(score) });
  }
  return result;
}

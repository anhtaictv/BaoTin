/**
 * Giai đoạn 2 "kênh tình báo mở" — lọc từ khóa. Chỉ tin có ít nhất 1 từ khóa loại vụ việc
 * khớp mới được lưu vào social_media_signals; địa danh là optional (nhiều bài báo chung
 * chung không nêu tên xã/phường cụ thể).
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  trom_cap: ["trộm cắp", "trộm", "mất trộm", "trộm xe", "cướp giật", "cướp tài sản"],
  chay_no: ["cháy nổ", "hỏa hoạn", "cháy nhà", "cháy lớn", "phát nổ"],
  tai_nan_giao_thong: ["tai nạn giao thông", "va chạm giao thông", "tai nạn"],
  lua_dao: ["lừa đảo", "lừa gạt", "giả danh công an", "chiếm đoạt tài sản"],
  gay_roi_trat_tu: ["gây rối trật tự", "đánh nhau", "ẩu đả", "hành hung"],
  ma_tuy: ["ma túy", "buôn bán ma túy", "sử dụng trái phép chất ma túy"],
};

/** Returns the first matching category, or null if nothing in CATEGORY_KEYWORDS matched. */
export function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return null;
}

export interface DistrictNameLookup {
  id: string;
  tenXa: string;
}

/**
 * Longest name first — otherwise a short ward name that's a substring of a longer one
 * (rare, but possible with Vietnamese admin names) could match the wrong district.
 */
export function detectDistrict(text: string, districts: DistrictNameLookup[]): string | null {
  const lower = text.toLowerCase();
  const sorted = [...districts].sort((a, b) => b.tenXa.length - a.tenXa.length);
  for (const district of sorted) {
    if (lower.includes(district.tenXa.toLowerCase())) return district.id;
  }
  return null;
}

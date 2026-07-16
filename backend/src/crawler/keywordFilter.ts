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
  /** "Sáp nhập" — tên (các) xã/phường cũ đã gộp vào xã/phường này sau đợt sáp nhập 2025
   * (vd. "An Phú, Hòa Kiến, Bình Kiến, Phường 9 (1 phần)"). Báo chí thực tế hầu như luôn
   * dùng tên cũ chứ không phải tên mới đã gộp, nên đây là nguồn từ khóa địa danh chính —
   * tenXa (tên mới) chỉ là một bí danh trong số nhiều bí danh. */
  parentName?: string | null;
}

const MIN_ALIAS_LENGTH = 4;

const PROVINCE_MARKERS = ["đắk lắk", "dak lak", "phú yên", "phu yen"];

/**
 * VnExpress/Tuổi Trẻ là báo toàn quốc — một bài thực sự về Đắk Lắk/Phú Yên hầu như luôn
 * nêu tên tỉnh rõ ràng. Không có cổng chặn này, các tên xã/phường cũ generic (vd. "Đoàn
 * Kết", "Thống Nhất", "Tân Lập" — đều là từ ngữ thông thường, không riêng gì địa danh) sẽ
 * khớp nhầm liên tục vào tin tức không liên quan gì đến 2 tỉnh này.
 */
function mentionsProvince(lowerText: string): boolean {
  return PROVINCE_MARKERS.some((marker) => lowerText.includes(marker));
}

/** Bỏ chú thích trong ngoặc ("(1 phần)", "(huyện Sông Hinh)"...) trước khi tách theo dấu
 * phẩy — chú thích đôi khi tự chứa dấu phẩy (vd. "(huyện Sông Hinh, 1 phần)"), tách trước
 * sẽ làm vỡ tên thành nhiều mảnh sai. */
function extractOldWardNames(parentName: string | null | undefined): string[] {
  if (!parentName) return [];
  const withoutAnnotations = parentName.replace(/\([^)]*\)/g, "");
  return withoutAnnotations
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length >= MIN_ALIAS_LENGTH);
}

/**
 * Longest name first — otherwise a short ward name that's a substring of a longer one
 * could match the wrong district. Chỉ chạy khi văn bản có nhắc tên tỉnh (xem
 * mentionsProvince), và bỏ qua mọi bí danh bị trùng giữa từ 2 xã/phường mới trở lên (vd.
 * "Ea Bar" từng tồn tại ở cả huyện Sông Hinh lẫn huyện Buôn Đôn cũ) — gán nhầm còn tệ hơn
 * là không gán được địa bàn.
 */
export function detectDistrict(text: string, districts: DistrictNameLookup[]): string | null {
  const lower = text.toLowerCase();
  if (!mentionsProvince(lower)) return null;

  const aliasToDistricts = new Map<string, Set<string>>();
  for (const district of districts) {
    const aliases = [district.tenXa, ...extractOldWardNames(district.parentName)];
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      if (!aliasToDistricts.has(key)) aliasToDistricts.set(key, new Set());
      aliasToDistricts.get(key)!.add(district.id);
    }
  }

  const uniqueAliases = [...aliasToDistricts.entries()]
    .filter(([, districtIds]) => districtIds.size === 1)
    .map(([alias, districtIds]) => ({ alias, districtId: [...districtIds][0]! }))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const candidate of uniqueAliases) {
    if (lower.includes(candidate.alias)) return candidate.districtId;
  }
  return null;
}

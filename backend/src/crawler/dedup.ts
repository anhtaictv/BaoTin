/**
 * Giai đoạn 2 "kênh tình báo mở" — gộp tin trùng. Trigram Jaccard similarity, không cần
 * gọi AI (rẻ, chạy được với hàng trăm tin mỗi lần crawl). Đây chỉ là cờ "có thể trùng" để
 * hiển thị cho cán bộ tự đánh giá — không phải kết luận tự động (CLAUDE.md #3 vẫn chỉ áp
 * dụng cho Report, nhưng giữ tinh thần "con người quyết định" cho cả Signal).
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

function trigrams(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/\s+/g, " ").trim();
  const grams = new Set<string>();
  for (let i = 0; i <= clean.length - 3; i++) grams.add(clean.slice(i, i + 3));
  return grams;
}

export function similarity(a: string, b: string): number {
  const gramsA = trigrams(a);
  const gramsB = trigrams(b);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let intersection = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) intersection++;
  }
  const union = gramsA.size + gramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DedupCandidate {
  id: string;
  text: string;
}

/** Returns the id of the first existing item similar enough to count as a duplicate, or null. */
export function findDuplicate(candidateText: string, existing: DedupCandidate[]): string | null {
  for (const item of existing) {
    if (similarity(candidateText, item.text) >= DUPLICATE_SIMILARITY_THRESHOLD) return item.id;
  }
  return null;
}

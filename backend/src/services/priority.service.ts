export interface PriorityInput {
  urgency: string;
  category: string | null;
  createdAt: Date;
}

/**
 * Giai đoạn 1 stub rule table (ARCHITECTURE.md "services/ — tính mức ưu tiên"): emergency
 * always outranks normal, a small set of inherently dangerous categories break ties within
 * the same urgency tier, and otherwise older reports go first (first-in-first-served).
 * Not a general priority engine — revisit once real usage data exists.
 */
export const HIGH_PRIORITY_CATEGORIES = new Set(["chay_no", "tai_nan", "an_ninh_khan_cap"]);

/** API_SPEC.md: confirmed_true reports only push to the official case system "nếu ... mức độ nghiêm trọng". */
export function isSeriousReport(input: Pick<PriorityInput, "urgency" | "category">): boolean {
  return input.urgency === "emergency" || (input.category !== null && HIGH_PRIORITY_CATEGORIES.has(input.category));
}

export function computePriorityScore(input: PriorityInput): number {
  let score = input.urgency === "emergency" ? 1000 : 0;
  if (input.category && HIGH_PRIORITY_CATEGORIES.has(input.category)) score += 500;
  return score;
}

export function sortByPriority<T extends PriorityInput>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = computePriorityScore(b) - computePriorityScore(a);
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

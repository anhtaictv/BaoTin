/**
 * Giai đoạn 2 "kênh tình báo mở" — gộp tin trùng. Trigram Jaccard similarity, không cần
 * gọi AI (rẻ, chạy được với hàng trăm tin mỗi lần crawl). Đây chỉ là cờ "có thể trùng" để
 * hiển thị cho cán bộ tự đánh giá — không phải kết luận tự động (CLAUDE.md #3 vẫn chỉ áp
 * dụng cho Report, nhưng giữ tinh thần "con người quyết định" cho cả Signal).
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

/** Below this, two texts are different enough that asking an LLM is pointless — saves a
 * model call per pair for the (common) case of two completely unrelated articles. */
export const DUPLICATE_BORDERLINE_MIN = 0.15;

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

export interface SemanticDuplicateChecker {
  /** Always resolves — never throws. See NoopSemanticDuplicateChecker for the fail-closed default. */
  isSameEvent(a: string, b: string): Promise<boolean>;
}

/** Default when no LLM is configured — matches pre-Ollama behavior exactly (trigram-only).
 * Also the fail-closed fallback on any classifier error: a broken/slow local model must never
 * cause *extra* items to get flagged as duplicates beyond what trigram already caught. */
export class NoopSemanticDuplicateChecker implements SemanticDuplicateChecker {
  async isSameEvent(_a: string, _b: string): Promise<boolean> {
    return false;
  }
}

const SAME_EVENT_PROMPT =
  "Hai đoạn tin sau có mô tả CÙNG MỘT vụ việc an ninh trật tự (cùng địa điểm/thời điểm/đối " +
  "tượng, chỉ diễn đạt khác nhau) hay là hai vụ việc khác nhau? Chỉ trả lời đúng 1 từ duy " +
  "nhất: CUNG hoặc KHAC.";

function parseSameEventDecision(modelText: string): boolean {
  const normalized = modelText
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return normalized.startsWith("CUNG");
}

/** Runs on a local model (no API key, no data leaving the machine). Any failure falls back to
 * "not a duplicate" — see NoopSemanticDuplicateChecker's fail-closed rationale. */
export class OllamaSemanticDuplicateChecker implements SemanticDuplicateChecker {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async isSameEvent(a: string, b: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SAME_EVENT_PROMPT },
            { role: "user", content: `Tin 1: ${a}\n\nTin 2: ${b}` },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { message?: { content?: string } };
      const text = data.message?.content;
      return text ? parseSameEventDecision(text) : false;
    } catch {
      return false;
    }
  }
}

/** Same as OllamaSemanticDuplicateChecker but against any OpenAI-compatible chat-completions
 * endpoint (OpenAI itself, or e.g. NVIDIA NIM: https://integrate.api.nvidia.com/v1). */
export class OpenAiSemanticDuplicateChecker implements SemanticDuplicateChecker {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {}

  async isSameEvent(a: string, b: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SAME_EVENT_PROMPT },
            { role: "user", content: `Tin 1: ${a}\n\nTin 2: ${b}` },
          ],
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      return text ? parseSameEventDecision(text) : false;
    } catch {
      return false;
    }
  }
}

export interface SemanticDedupEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** "gemini"/"none" fall back to trigram-only — no Gemini implementation of this feature exists. */
export function createSemanticDuplicateChecker(env: SemanticDedupEnv): SemanticDuplicateChecker {
  if (env.LLM_PROVIDER === "ollama") return new OllamaSemanticDuplicateChecker(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY)
    return new OpenAiSemanticDuplicateChecker(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  return new NoopSemanticDuplicateChecker();
}

/**
 * Trigram pass first (cheap, exact threshold) — if nothing clears it, only *then* ask the
 * semantic checker about pairs in the borderline band (too similar to ignore, not similar
 * enough for the hard trigram threshold). Never calls the checker for near-0 similarity pairs
 * (obviously unrelated) or for pairs the trigram pass already resolved.
 */
export async function findDuplicateSemantic(
  candidateText: string,
  existing: DedupCandidate[],
  checker: SemanticDuplicateChecker = new NoopSemanticDuplicateChecker(),
): Promise<string | null> {
  const trigramResult = findDuplicate(candidateText, existing);
  if (trigramResult) return trigramResult;

  for (const item of existing) {
    const score = similarity(candidateText, item.text);
    if (score >= DUPLICATE_BORDERLINE_MIN && score < DUPLICATE_SIMILARITY_THRESHOLD) {
      if (await checker.isSameEvent(candidateText, item.text)) return item.id;
    }
  }
  return null;
}

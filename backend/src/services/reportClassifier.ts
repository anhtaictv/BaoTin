/**
 * Giai đoạn "nâng cấp AI cục bộ" — gợi ý loại vụ việc từ mô tả tự do người dân gõ vào màn
 * "Báo tin", để pre-fill dropdown thay vì người dân phải tự chọn từ đầu. Đây CHỈ LÀ GỢI Ý:
 * người dân luôn là người bấm chọn cuối cùng trước khi gửi — không có luồng nào tự động gửi
 * đi category do AI chọn mà không qua mắt người dùng.
 */

/** Same category keys as the citizen app's dropdown (bao_tin_screen.dart _categories) and
 * priority.service.ts's HIGH_PRIORITY_CATEGORIES — a different, report-specific taxonomy from
 * the crawler's Signal categories in keywordFilter.ts (CATEGORY_KEYWORDS), which must stay
 * separate per CLAUDE.md #1/#2 (Signal and Report are never the same concept). */
export const REPORT_CATEGORIES = ["trom_cap", "tai_nan", "chay_no", "an_ninh_khan_cap", "khac"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface ReportCategorySuggester {
  /** Always resolves — never throws. Returns null when unavailable/uncertain; the citizen
   * dropdown simply keeps its current default selection in that case. */
  suggestCategory(description: string): Promise<ReportCategory | null>;
}

/** Default when no LLM is configured — no suggestion, matches pre-Ollama behavior exactly. */
export class NoopReportCategorySuggester implements ReportCategorySuggester {
  async suggestCategory(_description: string): Promise<ReportCategory | null> {
    return null;
  }
}

const CLASSIFY_PROMPT =
  "Người dân mô tả một sự việc cần báo cho công an. Hãy chọn ĐÚNG 1 loại phù hợp nhất trong " +
  `danh sách sau: ${REPORT_CATEGORIES.join(", ")}. Chỉ trả lời đúng 1 từ trong danh sách trên, ` +
  "không thêm chữ nào khác. Nếu không chắc hoặc mô tả không rõ ràng, trả lời: khac.";

function parseCategory(modelText: string): ReportCategory | null {
  const normalized = modelText.trim().toLowerCase();
  return (REPORT_CATEGORIES as readonly string[]).find((c) => normalized.includes(c)) as ReportCategory | undefined ?? null;
}

/** Runs on a local model (no API key, no data leaving the machine). Any failure or an
 * out-of-list response falls back to null — never invents a category outside REPORT_CATEGORIES. */
export class OllamaReportCategorySuggester implements ReportCategorySuggester {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async suggestCategory(description: string): Promise<ReportCategory | null> {
    if (!description.trim()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: CLASSIFY_PROMPT },
            { role: "user", content: description },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: { content?: string } };
      const text = data.message?.content;
      return text ? parseCategory(text) : null;
    } catch {
      return null;
    }
  }
}

/** Same as OllamaReportCategorySuggester but against any OpenAI-compatible chat-completions
 * endpoint (OpenAI itself, or e.g. NVIDIA NIM: https://integrate.api.nvidia.com/v1). */
export class OpenAiReportCategorySuggester implements ReportCategorySuggester {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {}

  async suggestCategory(description: string): Promise<ReportCategory | null> {
    if (!description.trim()) return null;
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: CLASSIFY_PROMPT },
            { role: "user", content: description },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      return text ? parseCategory(text) : null;
    } catch {
      return null;
    }
  }
}

export interface ReportClassifierEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** "gemini"/"none" give no suggestion — no Gemini implementation of this feature exists. */
export function createReportCategorySuggester(env: ReportClassifierEnv): ReportCategorySuggester {
  if (env.LLM_PROVIDER === "ollama") return new OllamaReportCategorySuggester(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY)
    return new OpenAiReportCategorySuggester(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  return new NoopReportCategorySuggester();
}

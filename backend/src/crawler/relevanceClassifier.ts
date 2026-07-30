export interface RelevanceInput {
  title: string;
  content: string;
  category: string;
}

export interface RelevanceClassifier {
  /** Always resolves — never throws. See AlwaysRelevantClassifier for the fail-open default. */
  isRelevant(input: RelevanceInput): Promise<boolean>;
}

/**
 * Default when no LLM is configured — keyword match alone decides (unchanged pre-Ollama
 * behavior). Also the fail-open fallback on any classifier error: a broken/slow local model
 * must never cause the crawler to silently drop signals it would otherwise have kept.
 */
export class AlwaysRelevantClassifier implements RelevanceClassifier {
  async isRelevant(_input: RelevanceInput): Promise<boolean> {
    return true;
  }
}

const RELEVANCE_PROMPT =
  "Bài báo sau có thực sự tường thuật một vụ việc an ninh trật tự CỤ THỂ, ĐÃ XẢY RA, thuộc loại " +
  '"{category}" không? Trả lời KHONG nếu đây là bài tổng hợp số liệu, xã luận, quảng cáo, tin thể thao/giải trí, ' +
  "hoặc chỉ nhắc từ khóa mà không mô tả một vụ việc thật. Chỉ trả lời đúng 1 từ duy nhất: CO hoặc KHONG.";

/** Only "KHONG" (unambiguous no) excludes an item — anything else keeps it, matching the
 * fail-open contract: a keyword-matched item is never dropped on a garbled/uncertain model
 * response, only on a clear negative. */
function parseKeepDecision(modelText: string): boolean {
  const normalized = modelText
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip diacritics: "KHÔNG" -> "KHONG"
  return !normalized.startsWith("KHONG");
}

/**
 * Second-pass filter after keywordFilter.ts's regex match — narrows further, never widens.
 * Runs entirely on a local model (no API key, no data leaving the machine). Any failure
 * (server down, model not pulled, malformed response) falls back to keeping the item.
 */
export class OllamaRelevanceClassifier implements RelevanceClassifier {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async isRelevant(input: RelevanceInput): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: RELEVANCE_PROMPT.replace("{category}", input.category) },
            { role: "user", content: `${input.title}\n\n${input.content}` },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return true;
      const data = (await res.json()) as { message?: { content?: string } };
      const text = data.message?.content;
      return text ? parseKeepDecision(text) : true;
    } catch {
      return true;
    }
  }
}

/** Same as OllamaRelevanceClassifier but against any OpenAI-compatible chat-completions
 * endpoint (OpenAI itself, or e.g. NVIDIA NIM: https://integrate.api.nvidia.com/v1). */
export class OpenAiRelevanceClassifier implements RelevanceClassifier {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {}

  async isRelevant(input: RelevanceInput): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: RELEVANCE_PROMPT.replace("{category}", input.category) },
            { role: "user", content: `${input.title}\n\n${input.content}` },
          ],
        }),
      });
      if (!res.ok) return true;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      return text ? parseKeepDecision(text) : true;
    } catch {
      return true;
    }
  }
}

export interface RelevanceClassifierEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** "gemini"/"none" keep keyword-only behavior — no Gemini implementation of this feature exists. */
export function createRelevanceClassifier(env: RelevanceClassifierEnv): RelevanceClassifier {
  if (env.LLM_PROVIDER === "ollama") return new OllamaRelevanceClassifier(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY)
    return new OpenAiRelevanceClassifier(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  return new AlwaysRelevantClassifier();
}

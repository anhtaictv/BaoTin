export interface HeatNarrativeSignal {
  summary: string | null;
  detectedCategory: string | null;
}

export interface HeatNarrator {
  /** Always resolves — never throws. Returns null when unavailable/uncertain; the caller
   * treats null as "no narrative" and simply omits the section, same as before this feature
   * existed. Never invents facts beyond what's in `signals` — no external knowledge, no
   * conclusion about whether the signals are related to each other or true. */
  generate(input: { districtName: string; signals: HeatNarrativeSignal[] }): Promise<string | null>;
}

/** Default when no LLM is configured — matches pre-Ollama behavior: heat is shown only as the
 * 🔥 score/level badge, no narrative text. */
export class NoopHeatNarrator implements HeatNarrator {
  async generate(_input: { districtName: string; signals: HeatNarrativeSignal[] }): Promise<string | null> {
    return null;
  }
}

const NARRATIVE_PROMPT =
  "Bạn đang hỗ trợ cán bộ đọc nhanh tin tức MXH/báo chí (CHƯA xác thực) về một khu vực. Viết " +
  "đúng 1-2 câu tiếng Việt tóm tắt các tín hiệu dưới đây đang nói về (các) chuyện gì, chỉ dựa " +
  "trên nội dung được cung cấp, không suy đoán thêm, không kết luận đúng/sai, không thêm lời " +
  "khuyên hành động.";

/**
 * Runs on a local model (no API key, no data leaving the machine). Purely descriptive — this
 * never feeds into heat score/level (signalHeat.ts is unchanged, deterministic) and never
 * decides whether signals describe the same event (that's still only a human officer's call,
 * same as the "Đối chiếu chéo" relatedReports section it sits next to).
 */
export class OllamaHeatNarrator implements HeatNarrator {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async generate(input: { districtName: string; signals: HeatNarrativeSignal[] }): Promise<string | null> {
    if (input.signals.length === 0) return null;
    try {
      const bulletList = input.signals
        .map((s, i) => `${i + 1}. [${s.detectedCategory ?? "không rõ loại"}] ${s.summary ?? "(không có tóm tắt)"}`)
        .join("\n");
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: NARRATIVE_PROMPT },
            { role: "user", content: `Khu vực: ${input.districtName}\n\nCác tín hiệu gần đây:\n${bulletList}` },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }
}

export interface HeatNarrativeEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** Only "ollama" wires in the narrative — see relevanceClassifier.ts for why this feature set
 * is scoped to the local-model provider specifically. */
export function createHeatNarrator(env: HeatNarrativeEnv): HeatNarrator {
  if (env.LLM_PROVIDER === "ollama") return new OllamaHeatNarrator(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  return new NoopHeatNarrator();
}

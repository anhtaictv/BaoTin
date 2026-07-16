import { z } from "zod";

export interface SearchInterpretation {
  /** Must match an existing district's tenXa (case-insensitive) — matching against the real
   * district list happens in searchAssistant.service.ts, not here. Null when no area is named. */
  districtName: string | null;
  /** Relative time phrases ("tuần qua", "tháng trước"...) converted to a day count. Null when
   * the query doesn't mention a time window. */
  sinceDays: number | null;
  /** A few words to text-search in report/signal descriptions — never a made-up fact, just an
   * extraction of what the query already said. Null when the query names no specific topic. */
  keyword: string | null;
}

const InterpretationSchema = z.object({
  districtName: z.string().max(200).nullable().optional(),
  sinceDays: z.number().int().positive().max(365).nullable().optional(),
  keyword: z.string().max(200).nullable().optional(),
});

export interface QueryInterpreter {
  /** Always resolves — never throws. Returns null when unavailable/unparseable; the caller
   * (searchAssistant.service.ts) treats null as "can't interpret this query" and returns
   * available: false rather than guessing at filters. */
  interpret(query: string, knownDistrictNames: string[]): Promise<SearchInterpretation | null>;
}

/** Default when no LLM is configured — this feature has no non-AI fallback (unlike the
 * summarizer/classifier features, which degrade to a deterministic default), since turning
 * natural language into filters requires a model. Search is simply unavailable until Ollama
 * is configured. */
export class NoopQueryInterpreter implements QueryInterpreter {
  async interpret(_query: string, _knownDistrictNames: string[]): Promise<SearchInterpretation | null> {
    return null;
  }
}

function buildPrompt(knownDistrictNames: string[]): string {
  return (
    "Bạn giúp cán bộ chuyển 1 câu hỏi tự nhiên thành bộ lọc tìm kiếm trong dữ liệu có sẵn. " +
    "Chỉ trả về ĐÚNG 1 JSON object, không thêm chữ nào khác, không thêm giải thích, đúng khuôn:\n" +
    '{"districtName": string hoặc null, "sinceDays": số nguyên hoặc null, "keyword": string hoặc null}\n\n' +
    "- districtName: tên xã/phường được nhắc tới, PHẢI khớp với 1 tên trong danh sách địa bàn " +
    "hợp lệ bên dưới; nếu không nhắc địa bàn hoặc không khớp tên nào, để null.\n" +
    '- sinceDays: đổi cụm thời gian tương đối thành số ngày (vd. "tuần qua"->7, "tháng trước"->30, ' +
    '"3 tháng gần đây"->90); nếu câu hỏi không nói về thời gian, để null.\n' +
    '- keyword: một vài từ mô tả loại vụ việc/nội dung cần tìm (vd. "cháy nổ", "trộm cắp xe máy"); ' +
    "để null nếu câu hỏi không nêu chủ đề cụ thể.\n" +
    "Không tự bịa thêm dữ kiện ngoài câu hỏi.\n\n" +
    `Danh sách địa bàn hợp lệ: ${knownDistrictNames.join(", ")}`
  );
}

/** Model responses are occasionally wrapped in prose or a markdown code fence — pull out the
 * first {...} block rather than requiring the whole response to be bare JSON. */
function extractJsonObject(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Runs on a local model (no API key, no data leaving the machine). Only ever extracts
 * structured filter parameters from the query — never asked to answer the question itself, so
 * it has no opportunity to invent facts about reports/signals it hasn't seen. The actual
 * answer always comes from a real database query in searchAssistant.service.ts.
 */
export class OllamaQueryInterpreter implements QueryInterpreter {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:1.5b",
  ) {}

  async interpret(query: string, knownDistrictNames: string[]): Promise<SearchInterpretation | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: buildPrompt(knownDistrictNames) },
            { role: "user", content: query },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: { content?: string } };
      const text = data.message?.content;
      if (!text) return null;

      const parsed = extractJsonObject(text);
      if (!parsed) return null;
      const result = InterpretationSchema.safeParse(parsed);
      if (!result.success) return null;

      return {
        districtName: result.data.districtName ?? null,
        sinceDays: result.data.sinceDays ?? null,
        keyword: result.data.keyword ?? null,
      };
    } catch {
      return null;
    }
  }
}

export interface SearchInterpreterEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** Only "ollama" wires in the interpreter — see relevanceClassifier.ts for why this feature
 * set is scoped to the local-model provider specifically. */
export function createQueryInterpreter(env: SearchInterpreterEnv): QueryInterpreter {
  if (env.LLM_PROVIDER === "ollama") return new OllamaQueryInterpreter(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  return new NoopQueryInterpreter();
}

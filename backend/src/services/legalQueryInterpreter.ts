import { z } from "zod";

export interface LegalQueryInterpretation {
  /** Tên văn bản được nhắc tới trong câu hỏi (vd. "bộ luật hình sự") — khớp lỏng (contains,
   * không phân biệt hoa thường) với LegalDocument.title ở legalLookup.service.ts, không cần
   * khớp chính xác tuyệt đối. Null khi câu hỏi không nêu tên văn bản cụ thể. */
  documentHint: string | null;
  /** Số Điều được hỏi tới. Null khi câu hỏi không hỏi về 1 điều cụ thể (tìm theo từ khóa). */
  articleNumber: number | null;
  /** Số khoản trong Điều đó, nếu có nhắc riêng (vd. "khoản 1 điều 123"). Null nếu không nhắc
   * khoản cụ thể — khi đó trả về nguyên Điều. */
  khoanNumber: number | null;
  /** Dùng khi câu hỏi không nêu số điều cụ thể — vài từ mô tả nội dung cần tìm. */
  keyword: string | null;
}

const InterpretationSchema = z.object({
  documentHint: z.string().max(200).nullable().optional(),
  articleNumber: z.number().int().positive().nullable().optional(),
  khoanNumber: z.number().int().positive().nullable().optional(),
  keyword: z.string().max(200).nullable().optional(),
});

export interface LegalQueryInterpreter {
  /** Luôn resolve — không bao giờ throw. Null khi không dùng được/không hiểu; caller
   * (legalLookup.service.ts) coi null là "không hiểu được câu hỏi" chứ không đoán bừa. */
  interpret(query: string): Promise<LegalQueryInterpretation | null>;
}

/** Mặc định khi chưa cấu hình LLM — tra cứu văn bản luật không có fallback phi-AI (giống
 * searchInterpreter.ts), vì chuyển câu hỏi tự nhiên thành điều/khoản cần model. */
export class NoopLegalQueryInterpreter implements LegalQueryInterpreter {
  async interpret(_query: string): Promise<LegalQueryInterpretation | null> {
    return null;
  }
}

const SYSTEM_PROMPT =
  "Bạn giúp chuyển 1 câu hỏi tra cứu văn bản luật thành bộ lọc tìm kiếm trong dữ liệu có sẵn. " +
  "Chỉ trả về ĐÚNG 1 JSON object, không thêm chữ nào khác, không thêm giải thích, đúng khuôn:\n" +
  '{"documentHint": string hoặc null, "articleNumber": số nguyên hoặc null, "khoanNumber": số nguyên hoặc null, "keyword": string hoặc null}\n\n' +
  '- documentHint: tên văn bản/bộ luật được nhắc tới (vd. "bộ luật hình sự", "bộ luật dân sự"); null nếu không nhắc.\n' +
  '- articleNumber: số Điều được hỏi (vd. "điều 123" -> 123); null nếu câu hỏi không hỏi về 1 điều cụ thể.\n' +
  '- khoanNumber: số khoản trong điều đó, CHỈ điền khi câu hỏi nhắc rõ khoản (vd. "khoản 1 điều 123" -> 1); null nếu không.\n' +
  "- keyword: vài từ mô tả nội dung cần tìm, CHỈ dùng khi câu hỏi KHÔNG nêu số điều cụ thể; null nếu đã có articleNumber.\n" +
  "Không tự bịa thêm dữ kiện ngoài câu hỏi.";

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

function toInterpretation(parsed: unknown): LegalQueryInterpretation | null {
  const result = InterpretationSchema.safeParse(parsed);
  if (!result.success) return null;
  return {
    documentHint: result.data.documentHint ?? null,
    articleNumber: result.data.articleNumber ?? null,
    khoanNumber: result.data.khoanNumber ?? null,
    keyword: result.data.keyword ?? null,
  };
}

/** Chạy trên model local (không cần API key, dữ liệu không rời máy). Chỉ trích tham số tìm
 * kiếm từ câu hỏi — câu trả lời thật luôn lấy từ LegalArticle.fullText trong
 * legalLookup.service.ts, không bao giờ từ chính model. */
export class OllamaLegalQueryInterpreter implements LegalQueryInterpreter {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async interpret(query: string): Promise<LegalQueryInterpretation | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
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
      return toInterpretation(parsed);
    } catch {
      return null;
    }
  }
}

/** Same as OllamaLegalQueryInterpreter but against any OpenAI-compatible chat-completions
 * endpoint (OpenAI itself, or e.g. NVIDIA NIM). */
export class OpenAiLegalQueryInterpreter implements LegalQueryInterpreter {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {}

  async interpret(query: string): Promise<LegalQueryInterpretation | null> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return null;

      const parsed = extractJsonObject(text);
      if (!parsed) return null;
      return toInterpretation(parsed);
    } catch {
      return null;
    }
  }
}

export interface LegalQueryInterpreterEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** "gemini"/"none" để tra cứu văn bản luật không khả dụng — chưa có impl Gemini cho tính
 * năng này, giống searchInterpreter.ts's createQueryInterpreter. */
export function createLegalQueryInterpreter(env: LegalQueryInterpreterEnv): LegalQueryInterpreter {
  if (env.LLM_PROVIDER === "ollama") return new OllamaLegalQueryInterpreter(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY)
    return new OpenAiLegalQueryInterpreter(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  return new NoopLegalQueryInterpreter();
}

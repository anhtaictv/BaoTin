export interface SummarizeInput {
  title: string;
  content: string;
}

export interface Summarizer {
  /** Always resolves — never throws. A failed API call falls back to truncation. */
  summarize(input: SummarizeInput): Promise<string>;
}

const MAX_FALLBACK_LENGTH = 220;

function truncate(input: SummarizeInput): string {
  const text = (input.content || input.title).trim();
  return text.length > MAX_FALLBACK_LENGTH ? `${text.slice(0, MAX_FALLBACK_LENGTH - 1)}…` : text;
}

/** Default when no LLM_PROVIDER/API key is configured — "chỗ nhét API vào" stays empty and safe. */
export class TruncateSummarizer implements Summarizer {
  async summarize(input: SummarizeInput): Promise<string> {
    return truncate(input);
  }
}

const SUMMARIZE_PROMPT =
  "Tóm tắt bản tin sau bằng đúng 1-2 câu tiếng Việt, ngắn gọn, chỉ nêu sự việc chính, " +
  "không thêm bình luận hay suy đoán:";

/** Plain `fetch` against the REST API — avoids pulling in the full `openai` SDK for one call.
 * `baseUrl` defaults to OpenAI itself but works against any OpenAI-compatible endpoint (e.g.
 * NVIDIA NIM: https://integrate.api.nvidia.com/v1). */
export class OpenAiSummarizer implements Summarizer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o-mini",
    private readonly baseUrl: string = "https://api.openai.com/v1",
  ) {}

  async summarize(input: SummarizeInput): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SUMMARIZE_PROMPT },
            { role: "user", content: `${input.title}\n\n${input.content}` },
          ],
          max_tokens: 120,
          temperature: 0.3,
        }),
      });
      if (!res.ok) return truncate(input);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const summary = data.choices?.[0]?.message?.content?.trim();
      return summary || truncate(input);
    } catch {
      return truncate(input);
    }
  }
}

/** Plain `fetch` against the REST API — avoids pulling in `@google/generative-ai` for one call. */
export class GeminiSummarizer implements Summarizer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-1.5-flash",
  ) {}

  async summarize(input: SummarizeInput): Promise<string> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${SUMMARIZE_PROMPT}\n\n${input.title}\n\n${input.content}` }] }],
            generationConfig: { maxOutputTokens: 120, temperature: 0.3 },
          }),
        },
      );
      if (!res.ok) return truncate(input);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return summary || truncate(input);
    } catch {
      return truncate(input);
    }
  }
}

/**
 * Local model via Ollama's REST API (`/api/chat`) — no API key, no data leaving the machine.
 * Same fallback contract as the hosted providers: any failure (model not pulled, server not
 * running, slow cold-start load) falls back to truncation rather than blocking the crawler.
 */
export class OllamaSummarizer implements Summarizer {
  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly model: string = "qwen2.5:7b",
  ) {}

  async summarize(input: SummarizeInput): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SUMMARIZE_PROMPT },
            { role: "user", content: `${input.title}\n\n${input.content}` },
          ],
          stream: false,
        }),
      });
      if (!res.ok) return truncate(input);
      const data = (await res.json()) as { message?: { content?: string } };
      const summary = data.message?.content?.trim();
      return summary || truncate(input);
    } catch {
      return truncate(input);
    }
  }
}

export interface SummarizerEnv {
  LLM_PROVIDER: "openai" | "gemini" | "ollama" | "none";
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  GEMINI_API_KEY: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
}

/** "Chỗ nhét API vào" — set LLM_PROVIDER + the matching key in .env, nothing else changes. */
export function createSummarizer(env: SummarizerEnv): Summarizer {
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY)
    return new OpenAiSummarizer(env.OPENAI_API_KEY, env.OPENAI_MODEL, env.OPENAI_BASE_URL);
  if (env.LLM_PROVIDER === "gemini" && env.GEMINI_API_KEY) return new GeminiSummarizer(env.GEMINI_API_KEY);
  if (env.LLM_PROVIDER === "ollama") return new OllamaSummarizer(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  return new TruncateSummarizer();
}

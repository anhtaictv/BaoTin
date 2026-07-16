import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSummarizer,
  GeminiSummarizer,
  OllamaSummarizer,
  OpenAiSummarizer,
  TruncateSummarizer,
  type SummarizerEnv,
} from "./summarizer.js";

const BASE_ENV: SummarizerEnv = {
  LLM_PROVIDER: "none",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  OLLAMA_BASE_URL: "http://localhost:11434",
  OLLAMA_MODEL: "qwen2.5:1.5b",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TruncateSummarizer", () => {
  it("returns short text unchanged", async () => {
    const summarizer = new TruncateSummarizer();
    const result = await summarizer.summarize({ title: "Tiêu đề", content: "Nội dung ngắn." });
    expect(result).toBe("Nội dung ngắn.");
  });

  it("truncates long text with an ellipsis", async () => {
    const summarizer = new TruncateSummarizer();
    const longContent = "a".repeat(300);
    const result = await summarizer.summarize({ title: "t", content: longContent });
    expect(result.length).toBeLessThan(300);
    expect(result.endsWith("…")).toBe(true);
  });

  it("falls back to the title when content is empty", async () => {
    const summarizer = new TruncateSummarizer();
    const result = await summarizer.summarize({ title: "Chỉ có tiêu đề", content: "" });
    expect(result).toBe("Chỉ có tiêu đề");
  });
});

describe("OpenAiSummarizer", () => {
  it("returns the model's summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Tóm tắt từ OpenAI." } }] }),
      })),
    );
    const summarizer = new OpenAiSummarizer("fake-key");
    const result = await summarizer.summarize({ title: "t", content: "c" });
    expect(result).toBe("Tóm tắt từ OpenAI.");
  });

  it("falls back to truncation when the API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const summarizer = new OpenAiSummarizer("fake-key");
    const result = await summarizer.summarize({ title: "t", content: "Nội dung dự phòng." });
    expect(result).toBe("Nội dung dự phòng.");
  });

  it("falls back to truncation when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const summarizer = new OpenAiSummarizer("fake-key");
    const result = await summarizer.summarize({ title: "t", content: "Nội dung dự phòng." });
    expect(result).toBe("Nội dung dự phòng.");
  });
});

describe("GeminiSummarizer", () => {
  it("returns the model's summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Tóm tắt từ Gemini." }] } }] }),
      })),
    );
    const summarizer = new GeminiSummarizer("fake-key");
    const result = await summarizer.summarize({ title: "t", content: "c" });
    expect(result).toBe("Tóm tắt từ Gemini.");
  });

  it("falls back to truncation when the API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const summarizer = new GeminiSummarizer("fake-key");
    const result = await summarizer.summarize({ title: "t", content: "Nội dung dự phòng." });
    expect(result).toBe("Nội dung dự phòng.");
  });
});

describe("OllamaSummarizer", () => {
  it("returns the model's summary on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "Tóm tắt từ Ollama." } }),
      })),
    );
    const summarizer = new OllamaSummarizer("http://localhost:11434", "qwen2.5:1.5b");
    const result = await summarizer.summarize({ title: "t", content: "c" });
    expect(result).toBe("Tóm tắt từ Ollama.");
  });

  it("falls back to truncation when the local server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const summarizer = new OllamaSummarizer();
    const result = await summarizer.summarize({ title: "t", content: "Nội dung dự phòng." });
    expect(result).toBe("Nội dung dự phòng.");
  });

  it("falls back to truncation on a non-ok response (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const summarizer = new OllamaSummarizer();
    const result = await summarizer.summarize({ title: "t", content: "Nội dung dự phòng." });
    expect(result).toBe("Nội dung dự phòng.");
  });
});

describe("createSummarizer", () => {
  it("returns TruncateSummarizer when LLM_PROVIDER is 'none'", () => {
    const summarizer = createSummarizer(BASE_ENV);
    expect(summarizer).toBeInstanceOf(TruncateSummarizer);
  });

  it("returns TruncateSummarizer when the provider is set but its key is empty", () => {
    const summarizer = createSummarizer({ ...BASE_ENV, LLM_PROVIDER: "openai" });
    expect(summarizer).toBeInstanceOf(TruncateSummarizer);
  });

  it("returns OpenAiSummarizer when provider is 'openai' and a key is set", () => {
    const summarizer = createSummarizer({ ...BASE_ENV, LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-fake" });
    expect(summarizer).toBeInstanceOf(OpenAiSummarizer);
  });

  it("returns GeminiSummarizer when provider is 'gemini' and a key is set", () => {
    const summarizer = createSummarizer({ ...BASE_ENV, LLM_PROVIDER: "gemini", GEMINI_API_KEY: "fake" });
    expect(summarizer).toBeInstanceOf(GeminiSummarizer);
  });

  it("returns OllamaSummarizer when provider is 'ollama' — no API key required", () => {
    const summarizer = createSummarizer({ ...BASE_ENV, LLM_PROVIDER: "ollama" });
    expect(summarizer).toBeInstanceOf(OllamaSummarizer);
  });
});

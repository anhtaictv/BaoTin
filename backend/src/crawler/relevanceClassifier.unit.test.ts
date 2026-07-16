import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AlwaysRelevantClassifier,
  createRelevanceClassifier,
  OllamaRelevanceClassifier,
} from "./relevanceClassifier.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlwaysRelevantClassifier", () => {
  it("always returns true", async () => {
    const classifier = new AlwaysRelevantClassifier();
    expect(await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" })).toBe(true);
  });
});

describe("OllamaRelevanceClassifier", () => {
  it("returns false when the model clearly says KHONG", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "KHONG" } }) })),
    );
    const classifier = new OllamaRelevanceClassifier();
    const result = await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" });
    expect(result).toBe(false);
  });

  it("returns true when the model says CO", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "CO" } }) })),
    );
    const classifier = new OllamaRelevanceClassifier();
    const result = await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" });
    expect(result).toBe(true);
  });

  it("handles a lowercase, accented response the same as an unaccented one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "không, đây là bài xã luận." } }) })),
    );
    const classifier = new OllamaRelevanceClassifier();
    const result = await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" });
    expect(result).toBe(false);
  });

  it("fails open (keeps the item) when the server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const classifier = new OllamaRelevanceClassifier();
    const result = await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" });
    expect(result).toBe(true);
  });

  it("fails open on a non-ok response (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const classifier = new OllamaRelevanceClassifier();
    const result = await classifier.isRelevant({ title: "t", content: "c", category: "trom_cap" });
    expect(result).toBe(true);
  });

  it("substitutes the category into the prompt", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ message: { content: "CO" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const classifier = new OllamaRelevanceClassifier();
    await classifier.isRelevant({ title: "t", content: "c", category: "chay_no" });

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.messages[0].content).toContain("chay_no");
  });
});

describe("createRelevanceClassifier", () => {
  it("returns AlwaysRelevantClassifier when LLM_PROVIDER is 'none'", () => {
    const classifier = createRelevanceClassifier({
      LLM_PROVIDER: "none",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(classifier).toBeInstanceOf(AlwaysRelevantClassifier);
  });

  it("returns AlwaysRelevantClassifier for openai/gemini — this feature is Ollama-specific", () => {
    const classifier = createRelevanceClassifier({
      LLM_PROVIDER: "openai",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(classifier).toBeInstanceOf(AlwaysRelevantClassifier);
  });

  it("returns OllamaRelevanceClassifier when LLM_PROVIDER is 'ollama'", () => {
    const classifier = createRelevanceClassifier({
      LLM_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(classifier).toBeInstanceOf(OllamaRelevanceClassifier);
  });
});

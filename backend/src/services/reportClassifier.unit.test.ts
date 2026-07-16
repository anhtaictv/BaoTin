import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createReportCategorySuggester,
  NoopReportCategorySuggester,
  OllamaReportCategorySuggester,
  REPORT_CATEGORIES,
} from "./reportClassifier.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NoopReportCategorySuggester", () => {
  it("always returns null", async () => {
    const suggester = new NoopReportCategorySuggester();
    expect(await suggester.suggestCategory("Nhà tôi bị trộm mất xe máy")).toBeNull();
  });
});

describe("OllamaReportCategorySuggester", () => {
  it("returns the model's suggested category when it's a known one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "trom_cap" } }) })),
    );
    const suggester = new OllamaReportCategorySuggester();
    const result = await suggester.suggestCategory("Nhà tôi bị trộm mất xe máy");
    expect(result).toBe("trom_cap");
  });

  it("tolerates extra words around the category token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "Loại phù hợp nhất là: chay_no" } }) })),
    );
    const suggester = new OllamaReportCategorySuggester();
    const result = await suggester.suggestCategory("Có khói và lửa bốc lên từ nhà kho");
    expect(result).toBe("chay_no");
  });

  it("returns null when the model's response isn't one of the known categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "khong_ro" } }) })),
    );
    const suggester = new OllamaReportCategorySuggester();
    const result = await suggester.suggestCategory("...");
    expect(result).toBeNull();
  });

  it("returns null for empty/whitespace-only description without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const suggester = new OllamaReportCategorySuggester();
    expect(await suggester.suggestCategory("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const suggester = new OllamaReportCategorySuggester();
    expect(await suggester.suggestCategory("mô tả bất kỳ")).toBeNull();
  });

  it("returns null on a non-ok response (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const suggester = new OllamaReportCategorySuggester();
    expect(await suggester.suggestCategory("mô tả bất kỳ")).toBeNull();
  });
});

describe("createReportCategorySuggester", () => {
  it("returns NoopReportCategorySuggester when LLM_PROVIDER is not 'ollama'", () => {
    const suggester = createReportCategorySuggester({
      LLM_PROVIDER: "none",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(suggester).toBeInstanceOf(NoopReportCategorySuggester);
  });

  it("returns OllamaReportCategorySuggester when LLM_PROVIDER is 'ollama'", () => {
    const suggester = createReportCategorySuggester({
      LLM_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(suggester).toBeInstanceOf(OllamaReportCategorySuggester);
  });
});

describe("REPORT_CATEGORIES", () => {
  it("matches the citizen app's dropdown keys and priority.service.ts's taxonomy", () => {
    expect(REPORT_CATEGORIES).toEqual(["trom_cap", "tai_nan", "chay_no", "an_ninh_khan_cap", "khac"]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHeatNarrator, NoopHeatNarrator, OllamaHeatNarrator } from "./heatNarrative.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NoopHeatNarrator", () => {
  it("always returns null", async () => {
    const narrator = new NoopHeatNarrator();
    const result = await narrator.generate({
      districtName: "Buôn Ma Thuột",
      signals: [{ summary: "Cháy nhỏ gần chợ", detectedCategory: "chay_no" }],
    });
    expect(result).toBeNull();
  });
});

describe("OllamaHeatNarrator", () => {
  it("returns the model's narrative on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: "Khu vực đang có nhiều tin về cháy nổ gần chợ trung tâm." } }),
      })),
    );
    const narrator = new OllamaHeatNarrator();
    const result = await narrator.generate({
      districtName: "Buôn Ma Thuột",
      signals: [{ summary: "Cháy nhỏ gần chợ", detectedCategory: "chay_no" }],
    });
    expect(result).toBe("Khu vực đang có nhiều tin về cháy nổ gần chợ trung tâm.");
  });

  it("returns null immediately when there are no signals, without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const narrator = new OllamaHeatNarrator();
    const result = await narrator.generate({ districtName: "Buôn Ma Thuột", signals: [] });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const narrator = new OllamaHeatNarrator();
    const result = await narrator.generate({
      districtName: "Buôn Ma Thuột",
      signals: [{ summary: "s", detectedCategory: null }],
    });
    expect(result).toBeNull();
  });

  it("returns null on a non-ok response (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const narrator = new OllamaHeatNarrator();
    const result = await narrator.generate({
      districtName: "Buôn Ma Thuột",
      signals: [{ summary: "s", detectedCategory: null }],
    });
    expect(result).toBeNull();
  });
});

describe("createHeatNarrator", () => {
  it("returns NoopHeatNarrator when LLM_PROVIDER is not 'ollama'", () => {
    const narrator = createHeatNarrator({
      LLM_PROVIDER: "none",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(narrator).toBeInstanceOf(NoopHeatNarrator);
  });

  it("returns OllamaHeatNarrator when LLM_PROVIDER is 'ollama'", () => {
    const narrator = createHeatNarrator({
      LLM_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(narrator).toBeInstanceOf(OllamaHeatNarrator);
  });
});

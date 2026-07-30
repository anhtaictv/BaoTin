import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQueryInterpreter,
  NoopQueryInterpreter,
  OllamaQueryInterpreter,
  OpenAiQueryInterpreter,
} from "./searchInterpreter.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NoopQueryInterpreter", () => {
  it("always returns null", async () => {
    const interpreter = new NoopQueryInterpreter();
    expect(await interpreter.interpret("tin cháy nổ ở Buôn Ma Thuột tháng trước", ["Buôn Ma Thuột"])).toBeNull();
  });
});

describe("OllamaQueryInterpreter", () => {
  it("parses a well-formed JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: { content: '{"districtName": "Buôn Ma Thuột", "sinceDays": 30, "keyword": "cháy nổ"}' },
        }),
      })),
    );
    const interpreter = new OllamaQueryInterpreter();
    const result = await interpreter.interpret("tin cháy nổ ở Buôn Ma Thuột tháng trước", ["Buôn Ma Thuột"]);
    expect(result).toEqual({ districtName: "Buôn Ma Thuột", sinceDays: 30, keyword: "cháy nổ" });
  });

  it("extracts JSON even when wrapped in prose/markdown fences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: { content: 'Đây là kết quả:\n```json\n{"districtName": null, "sinceDays": 7, "keyword": null}\n```' },
        }),
      })),
    );
    const interpreter = new OllamaQueryInterpreter();
    const result = await interpreter.interpret("tin tuần qua", []);
    expect(result).toEqual({ districtName: null, sinceDays: 7, keyword: null });
  });

  it("returns null when the response isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "tôi không hiểu câu hỏi" } }) })),
    );
    const interpreter = new OllamaQueryInterpreter();
    const result = await interpreter.interpret("abc", []);
    expect(result).toBeNull();
  });

  it("returns null when the JSON shape doesn't validate (e.g. sinceDays out of range)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: { content: '{"districtName": null, "sinceDays": 99999, "keyword": null}' } }),
      })),
    );
    const interpreter = new OllamaQueryInterpreter();
    const result = await interpreter.interpret("abc", []);
    expect(result).toBeNull();
  });

  it("returns null when the server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const interpreter = new OllamaQueryInterpreter();
    expect(await interpreter.interpret("abc", [])).toBeNull();
  });

  it("returns null on a non-ok response (e.g. model not pulled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const interpreter = new OllamaQueryInterpreter();
    expect(await interpreter.interpret("abc", [])).toBeNull();
  });

  it("includes the known district names in the prompt", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({ message: { content: "{}" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const interpreter = new OllamaQueryInterpreter();
    await interpreter.interpret("abc", ["Buôn Ma Thuột", "Buôn Hồ"]);

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.messages[0].content).toContain("Buôn Ma Thuột");
    expect(body.messages[0].content).toContain("Buôn Hồ");
  });
});

describe("OpenAiQueryInterpreter", () => {
  it("parses a well-formed JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"districtName": "Buôn Ma Thuột", "sinceDays": 30, "keyword": "cháy nổ"}' } }],
        }),
      })),
    );
    const interpreter = new OpenAiQueryInterpreter("fake-key");
    const result = await interpreter.interpret("tin cháy nổ ở Buôn Ma Thuột tháng trước", ["Buôn Ma Thuột"]);
    expect(result).toEqual({ districtName: "Buôn Ma Thuột", sinceDays: 30, keyword: "cháy nổ" });
  });

  it("returns null when the server call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const interpreter = new OpenAiQueryInterpreter("fake-key");
    expect(await interpreter.interpret("abc", [])).toBeNull();
  });
});

describe("createQueryInterpreter", () => {
  const BASE_ENV = {
    OPENAI_API_KEY: "",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    OPENAI_MODEL: "gpt-4o-mini",
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_MODEL: "qwen2.5:1.5b",
  };

  it("returns NoopQueryInterpreter when LLM_PROVIDER is 'none'", () => {
    const interpreter = createQueryInterpreter({ ...BASE_ENV, LLM_PROVIDER: "none" });
    expect(interpreter).toBeInstanceOf(NoopQueryInterpreter);
  });

  it("returns OllamaQueryInterpreter when LLM_PROVIDER is 'ollama'", () => {
    const interpreter = createQueryInterpreter({ ...BASE_ENV, LLM_PROVIDER: "ollama" });
    expect(interpreter).toBeInstanceOf(OllamaQueryInterpreter);
  });

  it("returns OpenAiQueryInterpreter when LLM_PROVIDER is 'openai' and a key is set", () => {
    const interpreter = createQueryInterpreter({ ...BASE_ENV, LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-fake" });
    expect(interpreter).toBeInstanceOf(OpenAiQueryInterpreter);
  });
});

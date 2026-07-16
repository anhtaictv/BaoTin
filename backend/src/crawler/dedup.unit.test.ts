import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSemanticDuplicateChecker,
  findDuplicate,
  findDuplicateSemantic,
  NoopSemanticDuplicateChecker,
  OllamaSemanticDuplicateChecker,
  similarity,
} from "./dedup.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dedup — similarity", () => {
  it("scores near-identical text highly", () => {
    const a = "Người dân phản ánh nghi có cháy nhỏ gần chợ trung tâm";
    const b = "Người dân phản ánh nghi có cháy nhỏ gần khu chợ trung tâm";
    expect(similarity(a, b)).toBeGreaterThan(0.5);
  });

  it("scores unrelated text low", () => {
    const a = "Công an bắt giữ nhóm trộm cắp xe máy";
    const b = "Đội tuyển bóng đá Việt Nam thắng trận giao hữu";
    expect(similarity(a, b)).toBeLessThan(0.3);
  });

  it("is symmetric", () => {
    const a = "Cháy nhà kho tại khu công nghiệp";
    const b = "Cháy nhà kho ở khu công nghiệp";
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 5);
  });
});

describe("dedup — findDuplicate", () => {
  it("returns the id of a similar existing item", () => {
    const existing = [
      { id: "e1", text: "Người dân phản ánh nghi có cháy nhỏ gần chợ trung tâm" },
      { id: "e2", text: "Công an bắt giữ nhóm trộm cắp xe máy" },
    ];
    const result = findDuplicate("Người dân phản ánh nghi có cháy nhỏ gần khu chợ trung tâm", existing);
    expect(result).toBe("e1");
  });

  it("returns null when nothing is similar enough", () => {
    const existing = [{ id: "e1", text: "Công an bắt giữ nhóm trộm cắp xe máy" }];
    expect(findDuplicate("Đội tuyển bóng đá thắng trận giao hữu", existing)).toBeNull();
  });
});

describe("NoopSemanticDuplicateChecker", () => {
  it("always returns false", async () => {
    const checker = new NoopSemanticDuplicateChecker();
    expect(await checker.isSameEvent("a", "b")).toBe(false);
  });
});

describe("OllamaSemanticDuplicateChecker", () => {
  it("returns true when the model says CUNG (same event)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "CUNG" } }) })),
    );
    const checker = new OllamaSemanticDuplicateChecker();
    expect(await checker.isSameEvent("a", "b")).toBe(true);
  });

  it("returns false when the model says KHAC (different event)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: "KHAC" } }) })),
    );
    const checker = new OllamaSemanticDuplicateChecker();
    expect(await checker.isSameEvent("a", "b")).toBe(false);
  });

  it("fails closed (not a duplicate) when the server isn't reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const checker = new OllamaSemanticDuplicateChecker();
    expect(await checker.isSameEvent("a", "b")).toBe(false);
  });
});

describe("findDuplicateSemantic", () => {
  const FIRE_A = "Cháy lớn tại chợ trung tâm Buôn Ma Thuột trong đêm";
  const FIRE_B = "Hỏa hoạn xảy ra tại khu chợ trung tâm thành phố Buôn Ma Thuột";

  it("returns the trigram match directly without consulting the checker", async () => {
    const checker = { isSameEvent: vi.fn(async () => false) };
    const existing = [{ id: "e1", text: "Người dân phản ánh nghi có cháy nhỏ gần chợ trung tâm" }];
    const result = await findDuplicateSemantic(
      "Người dân phản ánh nghi có cháy nhỏ gần khu chợ trung tâm",
      existing,
      checker,
    );
    expect(result).toBe("e1");
    expect(checker.isSameEvent).not.toHaveBeenCalled();
  });

  it("consults the checker for a borderline pair and flags it when confirmed", async () => {
    const checker = { isSameEvent: vi.fn(async () => true) };
    const existing = [{ id: "e1", text: FIRE_B }];
    const result = await findDuplicateSemantic(FIRE_A, existing, checker);
    expect(result).toBe("e1");
    expect(checker.isSameEvent).toHaveBeenCalledWith(FIRE_A, FIRE_B);
  });

  it("does not flag a borderline pair the checker rejects", async () => {
    const checker = { isSameEvent: vi.fn(async () => false) };
    const existing = [{ id: "e1", text: FIRE_B }];
    const result = await findDuplicateSemantic(FIRE_A, existing, checker);
    expect(result).toBeNull();
  });

  it("never consults the checker for a clearly-unrelated pair (below the borderline band)", async () => {
    const checker = { isSameEvent: vi.fn(async () => true) };
    const existing = [{ id: "e1", text: "Công an bắt giữ nhóm trộm cắp xe máy" }];
    const result = await findDuplicateSemantic("Đội tuyển bóng đá thắng trận giao hữu", existing, checker);
    expect(result).toBeNull();
    expect(checker.isSameEvent).not.toHaveBeenCalled();
  });

  it("defaults to trigram-only behavior when no checker is given", async () => {
    const existing = [{ id: "e1", text: FIRE_B }];
    const result = await findDuplicateSemantic(FIRE_A, existing);
    expect(result).toBeNull();
  });
});

describe("createSemanticDuplicateChecker", () => {
  it("returns NoopSemanticDuplicateChecker when LLM_PROVIDER is not 'ollama'", () => {
    const checker = createSemanticDuplicateChecker({
      LLM_PROVIDER: "none",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(checker).toBeInstanceOf(NoopSemanticDuplicateChecker);
  });

  it("returns OllamaSemanticDuplicateChecker when LLM_PROVIDER is 'ollama'", () => {
    const checker = createSemanticDuplicateChecker({
      LLM_PROVIDER: "ollama",
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "qwen2.5:1.5b",
    });
    expect(checker).toBeInstanceOf(OllamaSemanticDuplicateChecker);
  });
});

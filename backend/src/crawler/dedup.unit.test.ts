import { describe, expect, it } from "vitest";
import { findDuplicate, similarity } from "./dedup.js";

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

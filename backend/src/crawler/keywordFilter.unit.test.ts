import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { detectCategory, detectDistrict } from "./keywordFilter.js";

describe("keywordFilter — detectCategory", () => {
  it("matches a known category keyword", () => {
    expect(detectCategory("Công an bắt giữ nhóm trộm cắp xe máy trong đêm")).toBe("trom_cap");
    expect(detectCategory("Vụ hỏa hoạn thiêu rụi một căn nhà")).toBe("chay_no");
  });

  it("is case-insensitive", () => {
    expect(detectCategory("NGƯỜI DÂN PHÁT HIỆN VỤ LỪA ĐẢO QUA MẠNG")).toBe("lua_dao");
  });

  it("returns null when nothing matches", () => {
    expect(detectCategory("Đội tuyển bóng đá thắng trận giao hữu")).toBeNull();
  });
});

describe("keywordFilter — detectDistrict", () => {
  it("matches the longest district name to avoid a shorter substring match", () => {
    const districts = [
      { id: "short", tenXa: "Hồ" },
      { id: "long", tenXa: "Buôn Hồ" },
    ];
    expect(detectDistrict("Vụ việc xảy ra tại Buôn Hồ tối qua", districts)).toBe("long");
  });

  it("returns null when no district name appears in the text", () => {
    const districts = [{ id: randomUUID(), tenXa: "Buôn Ma Thuột" }];
    expect(detectDistrict("Tin tức không liên quan địa phương nào", districts)).toBeNull();
  });
});

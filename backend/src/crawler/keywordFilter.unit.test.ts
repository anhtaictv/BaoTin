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
  it("requires the province to be named — a national outlet almost always says so when the story is actually local", () => {
    const districts = [{ id: randomUUID(), tenXa: "Buôn Ma Thuột" }];
    expect(detectDistrict("Vụ việc xảy ra tại Buôn Ma Thuột tối qua", districts)).toBeNull();
    expect(detectDistrict("Vụ việc xảy ra tại Buôn Ma Thuột, tỉnh Đắk Lắk tối qua", districts)).not.toBeNull();
  });

  it("matches the longest district name to avoid a shorter substring match", () => {
    const districts = [
      { id: "short", tenXa: "Hồ" },
      { id: "long", tenXa: "Buôn Hồ" },
    ];
    expect(detectDistrict("Vụ việc xảy ra tại Buôn Hồ, tỉnh Đắk Lắk tối qua", districts)).toBe("long");
  });

  it("returns null when no district name appears in the text", () => {
    const districts = [{ id: randomUUID(), tenXa: "Buôn Ma Thuột" }];
    expect(detectDistrict("Tin tức tỉnh Đắk Lắk nhưng không nêu xã/phường nào", districts)).toBeNull();
  });

  it("matches a pre-2025-merger ward name from parentName, not just the new merged name", () => {
    const districts = [
      {
        id: "bmt",
        tenXa: "Buôn Ma Thuột",
        parentName: "Thành Công, Tân Tiến, Tân Thành, Tự An, Tân Lợi, Cư Êbur",
      },
    ];
    // The article never says "Buôn Ma Thuột" at all — only the pre-merger ward name.
    expect(detectDistrict("Vụ việc xảy ra tại phường Tự An, tỉnh Đắk Lắk", districts)).toBe("bmt");
  });

  it("strips parenthetical annotations (including ones containing a comma) before matching", () => {
    const districts = [
      { id: "d1", tenXa: "Ea Bar A", parentName: "Ea Bar (huyện Sông Hinh, 1 phần)" },
    ];
    expect(detectDistrict("Tin tại Ea Bar, tỉnh Phú Yên", districts)).toBe("d1");
  });

  it("never attributes an old ward name that's ambiguous across two different new wards", () => {
    const districts = [
      { id: "d1", tenXa: "Xã A", parentName: "Ea Bar (huyện Sông Hinh)" },
      { id: "d2", tenXa: "Xã B", parentName: "Ea Bar (huyện Buôn Đôn)" },
    ];
    // "Ea Bar" alone is ambiguous — must not silently pick either district.
    expect(detectDistrict("Tin tại Ea Bar, tỉnh Đắk Lắk", districts)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { createLegalLookupService, extractKhoan } from "./legalLookup.service.js";
import type { LegalQueryInterpretation, LegalQueryInterpreter } from "./legalQueryInterpreter.js";

describe("extractKhoan", () => {
  const fullText = [
    "Điều 123. Tội giết người",
    "1. Người nào giết người thuộc một trong các trường hợp sau đây...",
    "a) Giết 02 người trở lên;",
    "2. Phạm tội không thuộc trường hợp quy định tại khoản 1 Điều này...",
    "3. Người chuẩn bị phạm tội này...",
  ].join("\n");

  it("cắt đúng nội dung 1 khoản, dừng trước khoản tiếp theo", () => {
    const result = extractKhoan(fullText, 1);
    expect(result).toContain("Người nào giết người thuộc một trong các trường hợp");
    expect(result).toContain("Giết 02 người trở lên");
    expect(result).not.toContain("Phạm tội không thuộc trường hợp");
  });

  it("lấy đúng khoản cuối cùng tới hết fullText", () => {
    const result = extractKhoan(fullText, 3);
    expect(result).toContain("Người chuẩn bị phạm tội này");
  });

  it("trả null khi Điều không có khoản mang số đó", () => {
    expect(extractKhoan(fullText, 99)).toBeNull();
  });
});

interface FakeArticle {
  articleNumber: number;
  title: string;
  fullText: string;
  documentTitle: string;
  documentNumber: string | null;
}

function toRow(a: FakeArticle) {
  return {
    articleNumber: a.articleNumber,
    title: a.title,
    fullText: a.fullText,
    document: { title: a.documentTitle, documentNumber: a.documentNumber },
  };
}

function createFakeLegalPrisma() {
  const articles: FakeArticle[] = [];
  return {
    seedArticle(a: FakeArticle) {
      articles.push(a);
    },
    legalArticle: {
      async findFirst({ where }: any) {
        const hint = where.document?.title?.contains as string | undefined;
        const found = articles.find((a) => {
          if (a.articleNumber !== where.articleNumber) return false;
          if (hint && !a.documentTitle.toLowerCase().includes(hint.toLowerCase())) return false;
          return true;
        });
        return found ? toRow(found) : null;
      },
      async findMany({ where, take }: any) {
        const hint = where.document?.title?.contains as string | undefined;
        const matched = articles.filter((a) => {
          if (hint && !a.documentTitle.toLowerCase().includes(hint.toLowerCase())) return false;
          if (where.OR) {
            const ok = where.OR.some(
              (clause: any) =>
                (clause.title && a.title.toLowerCase().includes(clause.title.contains.toLowerCase())) ||
                (clause.fullText && a.fullText.toLowerCase().includes(clause.fullText.contains.toLowerCase())),
            );
            if (!ok) return false;
          }
          return true;
        });
        return (take ? matched.slice(0, take) : matched).map(toRow);
      },
    },
  };
}

function buildService(
  fakePrisma: ReturnType<typeof createFakeLegalPrisma>,
  interpretation: LegalQueryInterpretation | null,
) {
  const interpreter: LegalQueryInterpreter = { interpret: async () => interpretation };
  return createLegalLookupService({ prisma: fakePrisma as any, interpreter });
}

describe("legalLookup.service — lookup", () => {
  it("trả available: false khi interpreter không hiểu câu hỏi", async () => {
    const fakePrisma = createFakeLegalPrisma();
    const service = buildService(fakePrisma, null);

    const result = await service.lookup("câu hỏi khó hiểu");
    expect(result).toEqual({ available: false, interpreted: null, results: [] });
  });

  it("tìm đúng theo articleNumber, trả nguyên Điều khi không nêu khoản", async () => {
    const fakePrisma = createFakeLegalPrisma();
    fakePrisma.seedArticle({
      articleNumber: 123,
      title: "Tội giết người",
      fullText: "Điều 123. Tội giết người\n1. Nội dung khoản 1...\n2. Nội dung khoản 2...",
      documentTitle: "Bộ luật Hình sự",
      documentNumber: "100/2015/QH13",
    });
    const service = buildService(fakePrisma, {
      documentHint: null, articleNumber: 123, khoanNumber: null, keyword: null,
    });

    const result = await service.lookup("điều 123 bộ luật hình sự");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.text).toContain("Nội dung khoản 1");
    expect(result.results[0]!.text).toContain("Nội dung khoản 2");
  });

  it("cắt đúng khoản khi câu hỏi nêu rõ khoanNumber", async () => {
    const fakePrisma = createFakeLegalPrisma();
    fakePrisma.seedArticle({
      articleNumber: 123,
      title: "Tội giết người",
      fullText: "Điều 123. Tội giết người\n1. Nội dung khoản 1...\n2. Nội dung khoản 2...",
      documentTitle: "Bộ luật Hình sự",
      documentNumber: "100/2015/QH13",
    });
    const service = buildService(fakePrisma, {
      documentHint: "bộ luật hình sự", articleNumber: 123, khoanNumber: 1, keyword: null,
    });

    const result = await service.lookup("khoản 1 điều 123 bộ luật hình sự");
    expect(result.results[0]!.text).toContain("Nội dung khoản 1");
    expect(result.results[0]!.text).not.toContain("Nội dung khoản 2");
  });

  it("lọc theo documentHint — không lẫn Điều cùng số ở văn bản khác", async () => {
    const fakePrisma = createFakeLegalPrisma();
    fakePrisma.seedArticle({
      articleNumber: 123, title: "Điều của Bộ luật Hình sự", fullText: "Điều 123. HS...",
      documentTitle: "Bộ luật Hình sự", documentNumber: "100/2015/QH13",
    });
    fakePrisma.seedArticle({
      articleNumber: 123, title: "Điều của Bộ luật Dân sự", fullText: "Điều 123. DS...",
      documentTitle: "Bộ luật Dân sự", documentNumber: "44-L/CTN",
    });
    const service = buildService(fakePrisma, {
      documentHint: "dân sự", articleNumber: 123, khoanNumber: null, keyword: null,
    });

    const result = await service.lookup("điều 123 bộ luật dân sự");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.documentTitle).toBe("Bộ luật Dân sự");
  });

  it("không tìm thấy Điều -> results rỗng, không tự bịa nội dung", async () => {
    const fakePrisma = createFakeLegalPrisma();
    const service = buildService(fakePrisma, {
      documentHint: null, articleNumber: 999, khoanNumber: null, keyword: null,
    });

    const result = await service.lookup("điều 999");
    expect(result).toEqual({
      available: true,
      interpreted: { documentHint: null, articleNumber: 999, khoanNumber: null, keyword: null },
      results: [],
    });
  });

  it("fallback tìm theo keyword khi không nêu số điều cụ thể", async () => {
    const fakePrisma = createFakeLegalPrisma();
    fakePrisma.seedArticle({
      articleNumber: 168, title: "Tội cướp tài sản", fullText: "Điều 168. Người nào dùng vũ lực...",
      documentTitle: "Bộ luật Hình sự", documentNumber: "100/2015/QH13",
    });
    fakePrisma.seedArticle({
      articleNumber: 169, title: "Tội bắt cóc nhằm chiếm đoạt tài sản", fullText: "Điều 169. Người nào bắt cóc...",
      documentTitle: "Bộ luật Hình sự", documentNumber: "100/2015/QH13",
    });
    const service = buildService(fakePrisma, {
      documentHint: null, articleNumber: null, khoanNumber: null, keyword: "cướp tài sản",
    });

    const result = await service.lookup("tội cướp tài sản bị phạt thế nào");
    expect(result.results.map((r) => r.articleNumber)).toEqual([168]);
  });
});

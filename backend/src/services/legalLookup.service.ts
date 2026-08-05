import type { PrismaClient } from "@prisma/client";
import type { LegalQueryInterpreter } from "./legalQueryInterpreter.js";

export interface LegalLookupDeps {
  prisma: PrismaClient;
  interpreter: LegalQueryInterpreter;
}

const ARTICLE_RESULT_SELECT = {
  articleNumber: true,
  title: true,
  fullText: true,
  document: { select: { title: true, documentNumber: true } },
} as const;

const MAX_RESULTS = 20;

const KHOAN_HEADING = /^(\d+)\.[ \t]+/gm;

/** Cắt đúng 1 khoản ra khỏi fullText của 1 Điều — thuần deterministic (không AI), theo số thứ
 * tự đầu dòng "N. ". Trả null nếu Điều đó không có khoản mang số này. */
export function extractKhoan(fullText: string, khoanNumber: number): string | null {
  const matches = [...fullText.matchAll(KHOAN_HEADING)];
  const i = matches.findIndex((m) => Number(m[1]) === khoanNumber);
  if (i === -1) return null;
  const start = matches[i]!.index!;
  const end = matches[i + 1]?.index ?? fullText.length;
  return fullText.slice(start, end).trim();
}

/**
 * Tra cứu văn bản luật/quy định (officer + citizen, cùng quyền). Model chỉ diễn giải câu hỏi
 * thành điều/khoản/từ khóa cần tìm (legalQueryInterpreter.ts) — nội dung trả về LUÔN là nguyên
 * văn thật lấy từ LegalArticle.fullText đã nạp từ PDF, không bao giờ do model tự viết.
 */
export function createLegalLookupService(deps: LegalLookupDeps) {
  async function lookup(query: string) {
    const interpretation = await deps.interpreter.interpret(query);
    if (!interpretation) {
      return { available: false as const, interpreted: null, results: [] as LookupResult[] };
    }

    const documentFilter = interpretation.documentHint
      ? { document: { title: { contains: interpretation.documentHint, mode: "insensitive" as const } } }
      : {};

    if (interpretation.articleNumber) {
      const article = await deps.prisma.legalArticle.findFirst({
        where: { articleNumber: interpretation.articleNumber, ...documentFilter },
        select: ARTICLE_RESULT_SELECT,
      });
      if (!article) return { available: true as const, interpreted: interpretation, results: [] as LookupResult[] };

      const khoanText = interpretation.khoanNumber ? extractKhoan(article.fullText, interpretation.khoanNumber) : null;
      return {
        available: true as const,
        interpreted: interpretation,
        results: [toResult(article, khoanText ?? article.fullText)],
      };
    }

    const keyword = interpretation.keyword?.trim();
    if (!keyword) return { available: true as const, interpreted: interpretation, results: [] as LookupResult[] };

    const articles = await deps.prisma.legalArticle.findMany({
      where: {
        ...documentFilter,
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { fullText: { contains: keyword, mode: "insensitive" } },
        ],
      },
      select: ARTICLE_RESULT_SELECT,
      take: MAX_RESULTS,
    });

    return {
      available: true as const,
      interpreted: interpretation,
      results: articles.map((a) => toResult(a, a.fullText)),
    };
  }

  return { lookup };
}

interface LookupResult {
  documentTitle: string;
  documentNumber: string | null;
  articleNumber: number;
  articleTitle: string;
  text: string;
}

function toResult(
  article: { articleNumber: number; title: string; document: { title: string; documentNumber: string | null } },
  text: string,
): LookupResult {
  return {
    documentTitle: article.document.title,
    documentNumber: article.document.documentNumber,
    articleNumber: article.articleNumber,
    articleTitle: article.title,
    text,
  };
}

export type LegalLookupService = ReturnType<typeof createLegalLookupService>;

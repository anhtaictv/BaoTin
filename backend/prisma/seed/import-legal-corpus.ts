/**
 * Nạp corpus văn bản luật từ PDF trong data/legal-corpus/ vào bảng LegalDocument/LegalArticle
 * — chạy thủ công 1 lần (`npm run import:legal-corpus`), KHÔNG phải crawl live, KHÔNG chạy tự
 * động lúc build/deploy (dữ liệu tĩnh, chỉ đổi khi anh thêm/thay file PDF). Idempotent — chạy
 * lại nhiều lần an toàn (upsert theo sourceFileName / (legalDocumentId, articleNumber)).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../../src/config/env.js";

interface DocumentMeta {
  title: string;
  documentNumber: string | null;
}

/** Chỉ vài file cố định — map cứng theo tên file đơn giản hơn cố nhận diện tiêu đề tự động
 * từ text PDF (mỗi văn bản một kiểu trình bày trang bìa khác nhau). Thêm file mới thì thêm 1
 * dòng vào đây. */
const DOCUMENT_META: Record<string, DocumentMeta> = {
  "135-vbhn-vpqh.pdf": { title: "Bộ luật Hình sự", documentNumber: "100/2015/QH13" },
  "44-L-CTN_1546677569493.pdf": { title: "Bộ luật Dân sự", documentNumber: "44-L/CTN" },
};

export interface ParsedArticle {
  articleNumber: number;
  title: string;
  fullText: string;
}

const ARTICLE_HEADING = /^[ \t]*Điều (\d+)\.[ \t]*(.+)$/gm;

/** Tách text đã extract từ PDF thành từng Điều — mỗi Điều lấy hết nội dung (kể cả khoản/điểm
 * đánh số bên trong) tới ngay trước "Điều N." tiếp theo. Thuần deterministic, không cần AI. */
export function parseArticles(text: string): ParsedArticle[] {
  const matches = [...text.matchAll(ARTICLE_HEADING)];
  const articles: ParsedArticle[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const start = match.index!;
    const end = matches[i + 1]?.index ?? text.length;
    articles.push({
      articleNumber: Number(match[1]),
      title: match[2]!.trim(),
      fullText: text.slice(start, end).trim(),
    });
  }
  return articles;
}

async function importFile(prisma: PrismaClient, filePath: string, fileName: string): Promise<number> {
  const meta = DOCUMENT_META[fileName] ?? { title: fileName, documentNumber: null };
  const buffer = readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  await parser.destroy();

  const articles = parseArticles(text);
  if (articles.length === 0) {
    console.warn(`[import-legal-corpus] ${fileName}: không tìm thấy Điều nào trong text đã extract, bỏ qua.`);
    return 0;
  }

  const document = await prisma.legalDocument.upsert({
    where: { sourceFileName: fileName },
    create: { title: meta.title, documentNumber: meta.documentNumber, sourceFileName: fileName },
    update: { title: meta.title, documentNumber: meta.documentNumber },
  });

  for (const article of articles) {
    await prisma.legalArticle.upsert({
      where: { legalDocumentId_articleNumber: { legalDocumentId: document.id, articleNumber: article.articleNumber } },
      create: {
        legalDocumentId: document.id,
        articleNumber: article.articleNumber,
        title: article.title,
        fullText: article.fullText,
      },
      update: { title: article.title, fullText: article.fullText },
    });
  }

  return articles.length;
}

async function main() {
  const env = loadEnv();
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

  const corpusDir = join(process.cwd(), "..", "data", "legal-corpus");
  const files = readdirSync(corpusDir).filter((f) => f.toLowerCase().endsWith(".pdf"));

  console.log(`[import-legal-corpus] ${files.length} file PDF trong ${corpusDir}`);
  for (const fileName of files) {
    const count = await importFile(prisma, join(corpusDir, fileName), fileName);
    console.log(`[import-legal-corpus] ${fileName}: ${count} Điều`);
  }

  await prisma.$disconnect();
  console.log("[import-legal-corpus] Xong.");
}

main().catch((err) => {
  console.error("[import-legal-corpus] Lỗi:", err);
  process.exit(1);
});

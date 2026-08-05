-- Tra cứu văn bản luật/quy định (AI local qua Ollama) — corpus nạp thủ công từ PDF, xem
-- backend/prisma/seed/import-legal-corpus.ts và backend/src/services/legalLookup.service.ts.

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "document_number" TEXT,
    "source_file_name" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_source_file_name_key" ON "legal_documents"("source_file_name");

-- CreateTable
CREATE TABLE "legal_articles" (
    "id" TEXT NOT NULL,
    "legal_document_id" TEXT NOT NULL,
    "article_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "full_text" TEXT NOT NULL,

    CONSTRAINT "legal_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_articles_legal_document_id_article_number_key" ON "legal_articles"("legal_document_id", "article_number");

-- AddForeignKey
ALTER TABLE "legal_articles" ADD CONSTRAINT "legal_articles_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

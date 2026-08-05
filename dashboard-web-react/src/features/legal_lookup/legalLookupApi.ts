import { apiClient } from '../../core/apiClient';

export interface LegalLookupResult {
  documentTitle: string;
  documentNumber: string | null;
  articleNumber: number;
  articleTitle: string;
  text: string;
}

export interface LegalLookupResponse {
  available: boolean;
  interpreted: {
    documentHint: string | null;
    articleNumber: number | null;
    khoanNumber: number | null;
    keyword: string | null;
  } | null;
  results: LegalLookupResult[];
}

/** AI (Ollama) is used ONLY to turn the question into điều/khoản/keyword filters — it never
 * answers directly. Every result here is real text imported from a PDF corpus (see
 * backend/src/services/legalLookup.service.ts). */
export async function legalLookup(query: string): Promise<LegalLookupResponse> {
  const res = await apiClient.post('/legal-lookup', { query });
  return res.data.data as LegalLookupResponse;
}

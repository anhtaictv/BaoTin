import { apiClient } from '../../core/apiClient';

export interface SearchResult {
  available: boolean;
  interpreted: { districtName: string | null; sinceDays: number | null; keyword: string | null } | null;
  reports: { id: string; category: string | null; status: string; urgency: string; createdAt: string }[];
  signals: { id: string; sourceName: string | null; summary: string | null; trustLevel: string }[];
}

/** AI (Ollama) is used ONLY to turn the natural-language query into structured filters
 * (district/date-range/keyword) — it never answers directly. Every result here is a real
 * database row (see backend/src/services/searchAssistant.service.ts). */
export async function search(query: string): Promise<SearchResult> {
  const res = await apiClient.post('/admin/search', { query });
  return res.data.data as SearchResult;
}

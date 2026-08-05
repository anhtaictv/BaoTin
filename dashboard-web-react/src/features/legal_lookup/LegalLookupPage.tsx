import { useState } from 'react';
import { Gavel } from 'lucide-react';
import { Card, ChartCardSkeleton } from '../../components/ChartCard';
import { EmptyState } from '../../components/EmptyState';
import { legalLookup, type LegalLookupResponse } from './legalLookupApi';

/** Ported from mobile-app-officer/citizen's legal_lookup_screen.dart — AI only extracts
 * điều/khoản/từ khóa from the question, the answer text itself always comes from the real PDF
 * corpus (backend/src/services/legalLookup.service.ts), never written by the model. */
export function LegalLookupPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LegalLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function runLookup() {
    if (!query.trim()) return;
    setLoading(true);
    setError(false);
    try {
      setResult(await legalLookup(query));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gavel size={17} style={{ color: 'var(--accent)' }} /> Tra cứu văn bản luật, quy định (AI cục bộ)
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 6, maxWidth: '70ch' }}>
          Ví dụ: "khoản 1 điều 123 bộ luật hình sự". Chỉ mang tính tham khảo, không thay thế văn
          bản gốc hoặc tư vấn pháp lý chính thức.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runLookup()}
          placeholder="Nhập câu hỏi..."
          style={{ flex: 1 }}
        />
        <button onClick={runLookup} disabled={loading} className="btn-primary">
          {loading ? 'Đang tra cứu...' : 'Tra cứu'}
        </button>
      </div>

      {loading && <ChartCardSkeleton height={120} />}
      {error && <p style={{ color: 'var(--destructive)', fontSize: 13 }}>Không thực hiện được tra cứu. Vui lòng thử lại.</p>}

      {!loading && !error && result && !result.available && (
        <Card>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Không hiểu được câu hỏi này (hoặc tính năng AI cục bộ chưa được cấu hình — cần
            LLM_PROVIDER=ollama ở backend). Hãy thử diễn đạt rõ hơn, ví dụ nêu rõ số điều/khoản
            và tên bộ luật.
          </p>
        </Card>
      )}

      {!loading && !error && result?.available && result.results.length === 0 && (
        <Card>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Không tìm thấy điều luật phù hợp trong dữ liệu hiện có.</p>
        </Card>
      )}

      {!loading && !error && result?.available && result.results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.results.map((r) => (
            <Card key={`${r.documentTitle}-${r.articleNumber}`}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-muted)' }}>
                {r.documentTitle}
                {r.documentNumber ? ` (${r.documentNumber})` : ''}
              </p>
              <h2 style={{ fontSize: 15, marginTop: 4 }}>
                Điều {r.articleNumber}. {r.articleTitle}
              </h2>
              <p style={{ fontSize: 13.5, marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.text}</p>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && !result && (
        <EmptyState
          icon={<Gavel size={18} />}
          message="Chưa có tra cứu nào."
          hint='Nhập một câu hỏi phía trên, ví dụ "khoản 1 điều 123 bộ luật hình sự".'
        />
      )}
    </div>
  );
}

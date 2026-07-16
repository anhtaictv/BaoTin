import { useState } from 'react';
import { Card, ChartCardSkeleton } from '../../components/ChartCard';
import { statusColor, statusLabel, trustLevelColor, trustLevelLabel, urgencyColor } from '../../core/theme';
import { search, type SearchResult } from './searchApi';

/** Ported from dashboard-web/lib/features/search/search_tab.dart — AI only extracts filters
 * from the question, never answers with its own text; reports and signals stay in two
 * separate lists, never blended (CLAUDE.md #1/#2). */
export function SearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(false);
    try {
      setResult(await search(query));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 18 }}>Tìm kiếm bằng ngôn ngữ tự nhiên (AI cục bộ)</h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Ví dụ: "tin cháy nổ ở Buôn Ma Thuột tháng trước". AI chỉ hiểu câu hỏi thành bộ lọc —
          kết quả luôn là dữ liệu thật, không phải câu trả lời do AI tự tạo ra.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Nhập câu hỏi..."
          style={{ flex: 1 }}
        />
        <button onClick={runSearch} disabled={loading}>
          {loading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </div>

      {loading && <ChartCardSkeleton height={120} />}
      {error && <p>Không thực hiện được tìm kiếm. Vui lòng thử lại.</p>}

      {!loading && !error && result && !result.available && (
        <p>
          Không hiểu được câu hỏi này (hoặc tính năng AI cục bộ chưa được cấu hình — cần
          LLM_PROVIDER=ollama ở backend). Hãy thử diễn đạt khác hoặc dùng trang "Tin báo"/"Tin
          nhanh" để lọc thủ công.
        </p>
      )}

      {!loading && !error && result?.available && (
        <>
          {result.interpreted && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {result.interpreted.districtName && <Chip>Địa bàn: {result.interpreted.districtName}</Chip>}
              {result.interpreted.sinceDays != null && <Chip>{result.interpreted.sinceDays} ngày gần đây</Chip>}
              {result.interpreted.keyword && <Chip>Từ khóa: {result.interpreted.keyword}</Chip>}
            </div>
          )}

          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Tin báo ({result.reports.length})</p>
            {result.reports.length === 0 ? (
              <p>Không có tin báo phù hợp.</p>
            ) : (
              result.reports.map((report) => (
                <Card key={report.id} style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {report.urgency === 'emergency' && <span style={{ color: urgencyColor('emergency') }}>⚠️ </span>}
                      {report.category ?? 'Khác'}
                    </span>
                    <span style={{ color: statusColor(report.status), fontSize: 12, fontWeight: 600 }}>
                      {statusLabel(report.status)}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Tín hiệu MXH/báo chí — chưa xác thực ({result.signals.length})</p>
            {result.signals.length === 0 ? (
              <p>Không có tín hiệu phù hợp.</p>
            ) : (
              result.signals.map((signal) => (
                <Card key={signal.id} style={{ marginTop: 8 }}>
                  <p>{signal.summary ?? '(Không có tóm tắt)'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{signal.sourceName ?? 'Không rõ nguồn'}</span>
                    <span style={{ color: trustLevelColor(signal.trustLevel), fontSize: 12, fontWeight: 600 }}>
                      {trustLevelLabel(signal.trustLevel)}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 12 }}>{children}</span>
  );
}

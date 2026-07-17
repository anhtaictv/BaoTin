import { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { Card, ChartCardSkeleton } from '../../components/ChartCard';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <h1 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={17} style={{ color: 'var(--accent)' }} /> Tìm kiếm bằng ngôn ngữ tự nhiên (AI cục bộ)
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 6, maxWidth: '70ch' }}>
          Ví dụ: "tin cháy nổ ở Buôn Ma Thuột tháng trước". AI chỉ hiểu câu hỏi thành bộ lọc —
          kết quả luôn là dữ liệu thật, không phải câu trả lời do AI tự tạo ra.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <SearchIcon size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Nhập câu hỏi..."
            style={{ width: '100%', paddingLeft: 36 }}
          />
        </div>
        <button onClick={runSearch} disabled={loading} className="btn-primary">
          {loading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </div>

      {loading && <ChartCardSkeleton height={120} />}
      {error && <p style={{ color: 'var(--destructive)', fontSize: 13 }}>Không thực hiện được tìm kiếm. Vui lòng thử lại.</p>}

      {!loading && !error && result && !result.available && (
        <Card>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>
            Không hiểu được câu hỏi này (hoặc tính năng AI cục bộ chưa được cấu hình — cần
            LLM_PROVIDER=ollama ở backend). Hãy thử diễn đạt khác hoặc dùng trang "Tin báo"/"Tin
            nhanh" để lọc thủ công.
          </p>
        </Card>
      )}

      {!loading && !error && result?.available && (
        <>
          {result.interpreted && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {result.interpreted.districtName && <span className="chip">Địa bàn: {result.interpreted.districtName}</span>}
              {result.interpreted.sinceDays != null && <span className="chip">{result.interpreted.sinceDays} ngày gần đây</span>}
              {result.interpreted.keyword && <span className="chip">Từ khóa: {result.interpreted.keyword}</span>}
            </div>
          )}

          <div>
            <h2 style={{ fontSize: 14 }}>Tin báo ({result.reports.length})</h2>
            {result.reports.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>Không có tin báo phù hợp.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {result.reports.map((report) => (
                  <Card key={report.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5 }}>
                      {report.urgency === 'emergency' && <span style={{ color: urgencyColor('emergency') }}>⚠️ </span>}
                      {report.category ?? 'Khác'}
                    </span>
                    <Badge color={statusColor(report.status)}>{statusLabel(report.status)}</Badge>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: 14 }}>Tín hiệu MXH/báo chí — chưa xác thực ({result.signals.length})</h2>
            {result.signals.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 8 }}>Không có tín hiệu phù hợp.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {result.signals.map((signal) => (
                  <Card key={signal.id}>
                    <p style={{ fontSize: 13.5 }}>{signal.summary ?? '(Không có tóm tắt)'}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{signal.sourceName ?? 'Không rõ nguồn'}</span>
                      <Badge color={trustLevelColor(signal.trustLevel)}>{trustLevelLabel(signal.trustLevel)}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !error && !result && (
        <EmptyState
          icon={<SearchIcon size={18} />}
          message="Chưa có tìm kiếm nào."
          hint='Nhập một câu hỏi tự nhiên phía trên, ví dụ "tin trộm cắp tuần này ở Buôn Hồ".'
        />
      )}
    </div>
  );
}

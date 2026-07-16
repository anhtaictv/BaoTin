import { useState } from 'react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { trustLevelColor, trustLevelLabel } from '../../core/theme';
import { useDistrictOptions } from '../dashboard/useDashboard';
import { SignalDetailPane } from './SignalDetailPane';
import { useSignalList } from './useSignals';
import type { SignalsFilters } from './signalsApi';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** "Tin nhanh (tham khảo)" — CLAUDE.md non-negotiable #1/#2: a completely separate page from
 * ReportsPage, never merged into it. No status-verification UI anywhere here. */
export function SignalsPage() {
  const [filters, setFilters] = useState<SignalsFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const districts = useDistrictOptions();
  const signals = useSignalList(filters);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Tín hiệu mạng xã hội/báo chí — chỉ để tham khảo, chưa được xác thực. Tách biệt hoàn toàn
        khỏi tin dân báo.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Card style={{ width: 360, padding: 0 }}>
            <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={filters.trustLevel ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, trustLevel: e.target.value || undefined }))}
              >
                <option value="">Tất cả nguồn</option>
                <option value="verified_press">Báo chí</option>
                <option value="unverified_social">MXH — chưa xác thực</option>
              </select>
              <select
                value={filters.districtId ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, districtId: e.target.value || undefined }))}
                aria-label="Địa bàn"
              >
                <option value="">Tất cả địa bàn</option>
                {districts.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tenXa}
                  </option>
                ))}
              </select>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
            {signals.isLoading ? (
              <ChartCardSkeleton height={200} />
            ) : signals.isError ? (
              <ChartCardError onRetry={() => signals.refetch()} height={200} />
            ) : signals.data!.length === 0 ? (
              <p style={{ padding: 12 }}>Không có tín hiệu nào.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                {signals.data!.map((signal) => (
                  <li key={signal.id}>
                    <button
                      onClick={() => setSelectedId(signal.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 12,
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: selectedId === signal.id ? 'rgba(30,64,175,0.06)' : 'transparent',
                      }}
                    >
                      <p>{signal.summary ?? '(Không có tóm tắt)'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: `${trustLevelColor(signal.trustLevel)}1f`,
                            color: trustLevelColor(signal.trustLevel),
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {trustLevelLabel(signal.trustLevel)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(signal.publishedAt)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card style={{ flex: 1 }}>
            {selectedId ? <SignalDetailPane signalId={selectedId} /> : <p>Chọn 1 tín hiệu bên trái để xem chi tiết.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

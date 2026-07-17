import { useState } from 'react';
import { Info, RadioTower } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Tin nhanh" subtitle="Tín hiệu mạng xã hội/báo chí — tham khảo" />

      <div className="surface-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface-sunken)', border: 'none' }}>
        <Info size={14} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
          Tín hiệu mạng xã hội/báo chí — chỉ để tham khảo, chưa được xác thực. Tách biệt hoàn toàn
          khỏi tin dân báo.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Card style={{ width: 380, padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filters.trustLevel ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, trustLevel: e.target.value || undefined }))}
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="">Tất cả nguồn</option>
              <option value="verified_press">Báo chí</option>
              <option value="unverified_social">MXH — chưa xác thực</option>
            </select>
            <select
              value={filters.districtId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, districtId: e.target.value || undefined }))}
              aria-label="Địa bàn"
              style={{ flex: 1, minWidth: 140 }}
            >
              <option value="">Tất cả địa bàn</option>
              {districts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.tenXa}
                </option>
              ))}
            </select>
          </div>
          <hr className="divider" />
          {signals.isLoading ? (
            <ChartCardSkeleton height={200} />
          ) : signals.isError ? (
            <ChartCardError onRetry={() => signals.refetch()} height={200} />
          ) : signals.data!.length === 0 ? (
            <EmptyState icon={<RadioTower size={18} />} message="Không có tín hiệu nào." />
          ) : (
            <ul className="scroll-panel" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'calc(100vh - 320px)' }}>
              {signals.data!.map((signal) => {
                const selected = selectedId === signal.id;
                return (
                  <li key={signal.id}>
                    <button
                      onClick={() => setSelectedId(signal.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderRadius: 0,
                        borderBottom: '1px solid var(--border)',
                        background: selected ? 'var(--surface-sunken)' : 'transparent',
                      }}
                    >
                      <p style={{ fontSize: 13.5 }}>{signal.summary ?? '(Không có tóm tắt)'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <Badge color={trustLevelColor(signal.trustLevel)}>{trustLevelLabel(signal.trustLevel)}</Badge>
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{formatDate(signal.publishedAt)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card style={{ flex: 1, minHeight: 420 }}>
          {selectedId ? (
            <SignalDetailPane signalId={selectedId} />
          ) : (
            <EmptyState icon={<RadioTower size={18} />} message="Chọn 1 tín hiệu bên trái để xem chi tiết." />
          )}
        </Card>
      </div>
    </div>
  );
}

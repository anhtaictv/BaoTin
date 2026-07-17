import { useState } from 'react';
import { Inbox, Siren } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { statusColor, statusLabel, urgencyColor } from '../../core/theme';
import { useDistrictOptions } from '../dashboard/useDashboard';
import { ReportDetailPane } from './ReportDetailPane';
import { useReportList } from './useReports';
import type { ReportsFilters } from './reportsApi';

const STATUS_FILTERS: Record<string, string> = {
  pending: 'Chờ xử lý',
  verifying: 'Đang xác minh',
  confirmed_true: 'Đúng sự thật',
  confirmed_false: 'Tin sai',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportsFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const districts = useDistrictOptions();
  const reports = useReportList(filters);

  function toggleUrgency() {
    setFilters((f) => ({ ...f, urgency: f.urgency === 'emergency' ? undefined : 'emergency' }));
  }

  function toggleStatus(status: string) {
    setFilters((f) => ({ ...f, status: f.status === status ? undefined : status }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Tin báo" subtitle="Tin dân báo — có GPS + định danh, cần cán bộ xác minh trạng thái" />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Card style={{ width: 380, padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Tin báo mới</p>
            <button onClick={() => reports.refetch()} className="btn-sm btn-ghost">
              Làm mới
            </button>
          </div>
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={toggleUrgency} className="chip" data-active={filters.urgency === 'emergency'}
              style={filters.urgency === 'emergency' ? { background: urgencyColor('emergency'), borderColor: urgencyColor('emergency'), color: 'white' } : undefined}
            >
              <Siren size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Khẩn cấp
            </button>
            {Object.entries(STATUS_FILTERS).map(([value, label]) => (
              <button key={value} onClick={() => toggleStatus(value)} className="chip" data-active={filters.status === value}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ padding: '0 14px 12px' }}>
            <select
              value={filters.districtId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, districtId: e.target.value || undefined }))}
              aria-label="Địa bàn"
              style={{ width: '100%' }}
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
          {reports.isLoading ? (
            <ChartCardSkeleton height={200} />
          ) : reports.isError ? (
            <ChartCardError onRetry={() => reports.refetch()} height={200} />
          ) : reports.data!.length === 0 ? (
            <EmptyState icon={<Inbox size={18} />} message="Không có tin báo nào." />
          ) : (
            <ul className="scroll-panel" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'calc(100vh - 320px)' }}>
              {reports.data!.map((report) => {
                const selected = selectedId === report.id;
                return (
                  <li key={report.id}>
                    <button
                      onClick={() => setSelectedId(report.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        border: 'none',
                        borderRadius: 0,
                        borderBottom: '1px solid var(--border)',
                        background: selected ? 'var(--surface-sunken)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>
                          {report.urgency === 'emergency' && <span aria-label="khẩn cấp">⚠️ </span>}
                          {report.category ?? 'Khác'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{formatDate(report.createdAt)}</span>
                      </span>
                      <Badge color={statusColor(report.status)}>{statusLabel(report.status)}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card style={{ flex: 1, minHeight: 420 }}>
          {selectedId ? (
            <ReportDetailPane reportId={selectedId} />
          ) : (
            <EmptyState icon={<Inbox size={18} />} message="Chọn 1 tin báo bên trái để xem chi tiết." />
          )}
        </Card>
      </div>
    </div>
  );
}

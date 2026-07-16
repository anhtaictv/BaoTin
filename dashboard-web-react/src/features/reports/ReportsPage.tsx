import { useState } from 'react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
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
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Card style={{ width: 360, padding: 0 }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Tin báo mới</p>
          <button onClick={() => reports.refetch()}>Làm mới</button>
        </div>
        <div style={{ padding: '0 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={toggleUrgency}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: filters.urgency === 'emergency' ? urgencyColor('emergency') : 'white',
              color: filters.urgency === 'emergency' ? 'white' : 'var(--foreground)',
            }}
          >
            Khẩn cấp
          </button>
          {Object.entries(STATUS_FILTERS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleStatus(value)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: filters.status === value ? 'var(--primary)' : 'white',
                color: filters.status === value ? 'white' : 'var(--foreground)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 12px' }}>
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
        {reports.isLoading ? (
          <ChartCardSkeleton height={200} />
        ) : reports.isError ? (
          <ChartCardError onRetry={() => reports.refetch()} height={200} />
        ) : reports.data!.length === 0 ? (
          <p style={{ padding: 12 }}>Không có tin báo nào.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {reports.data!.map((report) => (
              <li key={report.id}>
                <button
                  onClick={() => setSelectedId(report.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 12,
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: selectedId === report.id ? 'rgba(30,64,175,0.06)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {report.urgency === 'emergency' && <span aria-label="khẩn cấp">⚠️ </span>}
                    {report.category ?? 'Khác'}
                    <br />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(report.createdAt)}</span>
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: `${statusColor(report.status)}1f`,
                      color: statusColor(report.status),
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {statusLabel(report.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={{ flex: 1 }}>
        {selectedId ? <ReportDetailPane reportId={selectedId} /> : <p>Chọn 1 tin báo bên trái để xem chi tiết.</p>}
      </Card>
    </div>
  );
}

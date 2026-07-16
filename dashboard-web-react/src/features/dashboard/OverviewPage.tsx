import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { statusColor, statusLabel } from '../../core/theme';
import {
  useCameraQueue,
  useDistrictOptions,
  useOverview,
  useResponseTimeByDistrict,
  useResponseTimeByOfficer,
  useVolumeTrend,
} from './useDashboard';
import type { DashboardFilters } from './dashboardApi';

const STATUS_ORDER = ['pending', 'verifying', 'confirmed_true', 'confirmed_false'];
const QUEUE_ORDER = ['pending', 'sent', 'fulfilled', 'rejected'];
const QUEUE_LABELS: Record<string, string> = {
  pending: 'Đang chờ',
  sent: 'Đã gửi',
  fulfilled: 'Đã xử lý',
  rejected: 'Từ chối',
};

function formatAvgResponseTime(seconds: number | null): string {
  if (seconds == null) return '—';
  return seconds >= 60 ? `${(seconds / 60).toFixed(1)} phút` : `${Math.round(seconds)} giây`;
}

export function OverviewPage() {
  const [districtId, setDistrictId] = useState<string | undefined>(undefined);
  const [days, setDays] = useState(30);
  const filters: DashboardFilters = { districtId, days };

  const districts = useDistrictOptions();
  const overview = useOverview(filters);
  const responseTimeByDistrict = useResponseTimeByDistrict(days);
  const responseTimeByOfficer = useResponseTimeByOfficer(filters);
  const volumeTrend = useVolumeTrend(filters);
  const cameraQueue = useCameraQueue();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <label>
          Địa bàn:{' '}
          <select value={districtId ?? ''} onChange={(e) => setDistrictId(e.target.value || undefined)}>
            <option value="">Tất cả</option>
            {districts.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.tenXa}
              </option>
            ))}
          </select>
        </label>
        <label>
          Khoảng ngày:{' '}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
        </label>
      </div>

      {overview.isLoading ? (
        <ChartCardSkeleton height={90} />
      ) : overview.isError ? (
        <ChartCardError onRetry={() => overview.refetch()} height={90} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Tổng số tin</p>
            <p style={{ fontSize: 24, fontWeight: 600 }}>{overview.data!.totalReports}</p>
          </Card>
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chờ xử lý / đang xác minh</p>
            <p style={{ fontSize: 24, fontWeight: 600 }}>
              {(overview.data!.byStatus.pending ?? 0) + (overview.data!.byStatus.verifying ?? 0)}
            </p>
          </Card>
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Đã xác nhận đúng</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: statusColor('confirmed_true') }}>
              {overview.data!.byStatus.confirmed_true ?? 0}
            </p>
          </Card>
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Thời gian phản hồi TB</p>
            <p style={{ fontSize: 24, fontWeight: 600 }}>{formatAvgResponseTime(overview.data!.avgResponseTimeSeconds)}</p>
          </Card>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Thời gian phản hồi TB theo địa bàn</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Luôn hiển thị tất cả địa bàn để so sánh</p>
          {responseTimeByDistrict.isLoading ? (
            <ChartCardSkeleton />
          ) : responseTimeByDistrict.isError ? (
            <ChartCardError onRetry={() => responseTimeByDistrict.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={responseTimeByDistrict.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="districtName" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgResponseTimeSeconds" fill="#1E40AF" name="Giây phản hồi TB" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Thời gian phản hồi TB theo cán bộ</p>
          {responseTimeByOfficer.isLoading ? (
            <ChartCardSkeleton />
          ) : responseTimeByOfficer.isError ? (
            <ChartCardError onRetry={() => responseTimeByOfficer.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={responseTimeByOfficer.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="officerName" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgResponseTimeSeconds" fill="#3B82F6" name="Giây phản hồi TB" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Xu hướng số tin</p>
          {volumeTrend.isLoading ? (
            <ChartCardSkeleton />
          ) : volumeTrend.isError ? (
            <ChartCardError onRetry={() => volumeTrend.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volumeTrend.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#D97706" name="Số tin" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Phân bổ trạng thái</p>
          {overview.isLoading ? (
            <ChartCardSkeleton />
          ) : overview.isError ? (
            <ChartCardError onRetry={() => overview.refetch()} />
          ) : (
            <StatusBreakdown byStatus={overview.data!.byStatus} />
          )}
        </Card>
      </div>

      {cameraQueue.isLoading ? (
        <ChartCardSkeleton height={120} />
      ) : cameraQueue.isError ? (
        <ChartCardError onRetry={() => cameraQueue.refetch()} height={120} />
      ) : (
        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Hàng đợi yêu cầu trích xuất camera</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {QUEUE_ORDER.map((status) => (
              <div
                key={status}
                style={{ width: 120, padding: 12, background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}
              >
                <p style={{ fontSize: 22, fontWeight: 600 }}>{cameraQueue.data?.[status] ?? 0}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{QUEUE_LABELS[status]}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBreakdown({ byStatus }: { byStatus: Record<string, number> }) {
  const total = STATUS_ORDER.reduce((sum, key) => sum + (byStatus[key] ?? 0), 0);
  if (total === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chưa có tin báo nào.</p>;

  return (
    <div>
      <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', marginTop: 16 }}>
        {STATUS_ORDER.filter((key) => (byStatus[key] ?? 0) > 0).map((key) => (
          <div
            key={key}
            title={`${statusLabel(key)}: ${byStatus[key]}`}
            style={{ flex: byStatus[key], background: statusColor(key) }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
        {STATUS_ORDER.map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(key), display: 'inline-block' }} />
            {statusLabel(key)} ({byStatus[key] ?? 0})
          </div>
        ))}
      </div>
    </div>
  );
}

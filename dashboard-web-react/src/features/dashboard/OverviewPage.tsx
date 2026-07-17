import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CircleCheckBig, Clock, Timer, Video } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
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

const GRID_STROKE = '#e1e6f0';
const AXIS_TICK = { fill: '#8b96b3', fontSize: 11 };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Tổng quan"
        subtitle="Số liệu tiếp nhận và xử lý tin báo trên toàn địa bàn"
        actions={
          <div className="toolbar">
            <label htmlFor="overview-district" className="field-inline">
              Địa bàn:
              <select id="overview-district" value={districtId ?? ''} onChange={(e) => setDistrictId(e.target.value || undefined)}>
                <option value="">Tất cả</option>
                {districts.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.tenXa}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="overview-days" className="field-inline">
              Khoảng ngày:
              <select id="overview-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
              </select>
            </label>
          </div>
        }
      />

      {overview.isLoading ? (
        <ChartCardSkeleton height={90} />
      ) : overview.isError ? (
        <ChartCardError onRetry={() => overview.refetch()} height={90} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <StatCard label="Tổng số tin" value={overview.data!.totalReports} icon={<BarChart3 size={15} />} />
          <StatCard
            label="Chờ xử lý / đang xác minh"
            value={(overview.data!.byStatus.pending ?? 0) + (overview.data!.byStatus.verifying ?? 0)}
            icon={<Clock size={15} />}
            accent={statusColor('verifying')}
          />
          <StatCard
            label="Đã xác nhận đúng"
            value={overview.data!.byStatus.confirmed_true ?? 0}
            icon={<CircleCheckBig size={15} />}
            accent={statusColor('confirmed_true')}
          />
          <StatCard
            label="Thời gian phản hồi TB"
            value={formatAvgResponseTime(overview.data!.avgResponseTimeSeconds)}
            icon={<Timer size={15} />}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Thời gian phản hồi TB theo địa bàn</p>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Luôn hiển thị tất cả địa bàn để so sánh</p>
          {responseTimeByDistrict.isLoading ? (
            <ChartCardSkeleton />
          ) : responseTimeByDistrict.isError ? (
            <ChartCardError onRetry={() => responseTimeByDistrict.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={responseTimeByDistrict.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="districtName" hide />
                <YAxis tick={AXIS_TICK} width={32} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e1e6f0', fontSize: 12 }} />
                <Bar dataKey="avgResponseTimeSeconds" fill="#1E40AF" name="Giây phản hồi TB" radius={[4, 4, 0, 0]} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="officerName" hide />
                <YAxis tick={AXIS_TICK} width={32} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e1e6f0', fontSize: 12 }} />
                <Bar dataKey="avgResponseTimeSeconds" fill="#3B82F6" name="Giây phản hồi TB" radius={[4, 4, 0, 0]} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis allowDecimals={false} tick={AXIS_TICK} width={28} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e1e6f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#D97706" strokeWidth={2.5} dot={false} name="Số tin" />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={15} style={{ color: 'var(--ink-faint)' }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Hàng đợi yêu cầu trích xuất camera</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            {QUEUE_ORDER.map((status) => (
              <div
                key={status}
                style={{ flex: '1 1 120px', padding: 14, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}
              >
                <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{cameraQueue.data?.[status] ?? 0}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{QUEUE_LABELS[status]}</p>
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
  if (total === 0) return <p style={{ color: 'var(--ink-muted)', fontSize: 12 }}>Chưa có tin báo nào.</p>;

  return (
    <div>
      <div style={{ display: 'flex', height: 20, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: 16 }}>
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
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(key), display: 'inline-block' }} />
            {statusLabel(key)} ({byStatus[key] ?? 0})
          </div>
        ))}
      </div>
    </div>
  );
}

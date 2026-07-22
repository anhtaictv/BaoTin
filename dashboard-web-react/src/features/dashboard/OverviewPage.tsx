import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CircleCheckBig, Clock, FileDown, Timer, Video } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/StatCard';
import { categoryLabel, statusColor, statusLabel } from '../../core/theme';
import {
  useByCategory,
  useCameraQueue,
  useDistrictOptions,
  useOverview,
  useReportCountByDistrict,
  useReportLocations,
  useResponseTimeByDistrict,
  useResponseTimeByOfficer,
  useVolumeTrend,
} from './useDashboard';
import { ReportsMap } from './ReportsMap';
import { exportDashboardPdf } from './exportDashboardPdf';
import type { DashboardFilters, TrendPeriod } from './dashboardApi';

const PERIOD_LABELS: Record<TrendPeriod, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };
const CATEGORY_COLORS = ['#1E40AF', '#D97706', '#DC2626', '#2E7D32', '#6A1B9A', '#64748B'];

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
  const [period, setPeriod] = useState<TrendPeriod>('day');
  const [exporting, setExporting] = useState(false);
  const filters: DashboardFilters = { districtId, days };
  const reportRef = useRef<HTMLDivElement>(null);

  const districts = useDistrictOptions();
  const overview = useOverview(filters);
  const responseTimeByDistrict = useResponseTimeByDistrict(days);
  const responseTimeByOfficer = useResponseTimeByOfficer(filters);
  const volumeTrend = useVolumeTrend(filters, period);
  const reportCountByDistrict = useReportCountByDistrict(days);
  const byCategory = useByCategory(filters);
  const reportLocations = useReportLocations(filters);
  const cameraQueue = useCameraQueue();

  async function handleExportPdf() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      await exportDashboardPdf(reportRef.current, 'Báo cáo tổng hợp tin báo');
    } finally {
      setExporting(false);
    }
  }

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
            <button className="btn-sm" onClick={handleExportPdf} disabled={exporting} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileDown size={14} /> {exporting ? 'Đang xuất...' : 'Xuất PDF'}
            </button>
          </div>
        }
      />

      <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Xu hướng số tin</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {(Object.keys(PERIOD_LABELS) as TrendPeriod[]).map((p) => (
                <button
                  key={p}
                  className="btn-sm"
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11.5,
                    background: period === p ? 'var(--primary)' : 'transparent',
                    color: period === p ? '#fff' : 'var(--ink-muted)',
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
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

        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Phân loại tin báo</p>
          {byCategory.isLoading ? (
            <ChartCardSkeleton />
          ) : byCategory.isError ? (
            <ChartCardError onRetry={() => byCategory.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory.data} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="category"
                  tickFormatter={categoryLabel}
                  tick={AXIS_TICK}
                  width={90}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e1e6f0', fontSize: 12 }}
                  formatter={(value) => [value, 'Số tin']}
                  labelFormatter={(label) => categoryLabel(String(label))}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(byCategory.data ?? []).map((entry, i) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Số tin theo xã/phường</p>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Xếp hạng địa bàn nhiều tin nhất</p>
          {reportCountByDistrict.isLoading ? (
            <ChartCardSkeleton />
          ) : reportCountByDistrict.isError ? (
            <ChartCardError onRetry={() => reportCountByDistrict.refetch()} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reportCountByDistrict.data?.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="districtName" hide />
                <YAxis allowDecimals={false} tick={AXIS_TICK} width={28} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e1e6f0', fontSize: 12 }} />
                <Bar dataKey="reportCount" fill="#2E7D32" name="Số tin" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <p style={{ fontWeight: 600, fontSize: 14 }}>Bản đồ tin báo</p>
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10 }}>Theo bộ lọc địa bàn/khoảng ngày phía trên</p>
        {reportLocations.isLoading ? (
          <ChartCardSkeleton height={320} />
        ) : reportLocations.isError ? (
          <ChartCardError onRetry={() => reportLocations.refetch()} height={320} />
        ) : (
          <ReportsMap locations={reportLocations.data ?? []} />
        )}
      </Card>

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

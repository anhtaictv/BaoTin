import { MapPin, User } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { statusColor, statusLabel, urgencyColor, urgencyLabel } from '../../core/theme';
import { NearbyCamerasSection } from '../cameras/NearbyCamerasSection';
import { StatusUpdateAction } from './StatusUpdateAction';
import { useReportDetail } from './useReports';

export function ReportDetailPane({ reportId }: { reportId: string }) {
  const detail = useReportDetail(reportId);

  if (detail.isLoading) return <ChartCardSkeleton height={300} />;
  if (detail.isError) return <ChartCardError onRetry={() => detail.refetch()} height={300} />;

  const report = detail.data!;
  const attachments = (report.attachments as { fileUrl?: string }[] | undefined) ?? [];
  const user = report.user as { anonymous?: boolean; fullName?: string; phoneNumber?: string } | null | undefined;
  const location = report.location as { lat: number; lng: number } | null | undefined;
  const urgency = (report.urgency as string) ?? 'normal';
  const status = (report.status as string) ?? 'pending';

  return (
    <div key={reportId} className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {urgency === 'emergency' && (
          <Badge color={urgencyColor('emergency')} solid>
            {urgencyLabel('emergency')}
          </Badge>
        )}
        <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
      </div>

      <div>
        <p style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{(report.category as string) ?? 'Khác'}</p>
        {typeof report.description === 'string' && report.description && (
          <p style={{ marginTop: 6, color: 'var(--ink-muted)', lineHeight: 1.6, maxWidth: '65ch' }}>{report.description}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {location && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)' }}>
            <MapPin size={13} /> Vị trí: {location.lat}, {location.lng}
          </p>
        )}
        {user && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)' }}>
            <User size={13} /> Người báo tin:{' '}
            {user.anonymous ? 'Ẩn danh (được bảo vệ)' : `${user.fullName ?? 'Không rõ tên'} — ${user.phoneNumber ?? ''}`}
          </p>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="scroll-panel" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {attachments.map((a, i) =>
            a.fileUrl ? (
              <img
                key={i}
                src={a.fileUrl}
                alt=""
                width={140}
                height={140}
                style={{ objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexShrink: 0 }}
              />
            ) : null,
          )}
        </div>
      )}

      <NearbyCamerasSection reportId={reportId} />
      <StatusUpdateAction reportId={reportId} />
    </div>
  );
}

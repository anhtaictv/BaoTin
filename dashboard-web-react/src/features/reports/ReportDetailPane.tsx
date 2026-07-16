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
    <div key={reportId} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {urgency === 'emergency' && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              background: urgencyColor('emergency'),
              color: 'white',
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {urgencyLabel('emergency')}
          </span>
        )}
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: `${statusColor(status)}1f`,
            color: statusColor(status),
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          {statusLabel(status)}
        </span>
      </div>

      <p style={{ fontSize: 18, fontWeight: 600 }}>{(report.category as string) ?? 'Khác'}</p>
      {typeof report.description === 'string' && report.description && <p>{report.description}</p>}

      {location && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Vị trí: {location.lat}, {location.lng}
        </p>
      )}
      {user && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Người báo tin:{' '}
          {user.anonymous ? 'Ẩn danh (được bảo vệ)' : `${user.fullName ?? 'Không rõ tên'} — ${user.phoneNumber ?? ''}`}
        </p>
      )}

      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {attachments.map((a, i) =>
            a.fileUrl ? (
              <img
                key={i}
                src={a.fileUrl}
                alt=""
                width={140}
                height={140}
                style={{ objectFit: 'cover', borderRadius: 10 }}
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

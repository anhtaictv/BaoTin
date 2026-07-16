import { ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { heatLevelColor, heatLevelLabel, statusColor, statusLabel, trustLevelColor, trustLevelLabel, urgencyColor } from '../../core/theme';
import { useSignalDetail } from './useSignals';

/** Ported from dashboard-web/lib/features/signals/widgets/signal_detail_pane.dart — read-only,
 * no status chips, no "duyệt"/verify action anywhere (CLAUDE.md #1/#2: a Signal never gets a
 * human-in-the-loop true/false verdict here, that concept only exists for Reports). */
export function SignalDetailPane({ signalId }: { signalId: string }) {
  const detail = useSignalDetail(signalId);

  if (detail.isLoading) return <ChartCardSkeleton height={300} />;
  if (detail.isError) return <ChartCardError onRetry={() => detail.refetch()} height={300} />;

  const signal = detail.data!;
  const heat = signal.heat as { score: number; level: string } | null;
  const heatNarrative = signal.heatNarrative as string | null;
  const relatedReports = (signal.relatedReports as Record<string, unknown>[] | undefined) ?? [];
  const trustLevel = (signal.trustLevel as string) ?? 'unverified_social';

  return (
    <div key={signalId} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Badge color={trustLevelColor(trustLevel)}>{trustLevelLabel(trustLevel)}</Badge>
        {heat && (
          <Badge color={heatLevelColor(heat.level)}>
            🔥 {heatLevelLabel(heat.level)} ({heat.score})
          </Badge>
        )}
      </div>

      <p style={{ fontSize: 18, fontWeight: 600 }}>{(signal.summary as string) || '(Không có tóm tắt)'}</p>

      <InfoRow label="Nguồn" value={(signal.sourceName as string) || 'Không rõ'} />
      {typeof signal.sourceUrl === 'string' && signal.sourceUrl && <InfoRow label="Liên kết" value={signal.sourceUrl} />}
      {typeof signal.detectedCategory === 'string' && signal.detectedCategory && (
        <InfoRow label="Loại vụ việc" value={signal.detectedCategory} />
      )}
      {signal.duplicateOfId != null && <InfoRow label="Ghi chú" value="Có thể trùng với 1 tín hiệu khác đã ghi nhận" />}

      {typeof signal.rawSnippet === 'string' && signal.rawSnippet && (
        <div>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Nội dung gốc</p>
          <p>{signal.rawSnippet}</p>
        </div>
      )}

      {heatNarrative && (
        <div style={{ background: '#fff3e0', borderRadius: 8, padding: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>✨ Diễn giải độ nóng (AI, chỉ tham khảo)</p>
          <p style={{ color: '#e65100', marginTop: 4 }}>{heatNarrative}</p>
        </div>
      )}

      {relatedReports.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Đối chiếu chéo — tin dân báo cùng địa bàn, gần thời điểm</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Chỉ mang tính tham khảo, không phải kết luận là cùng một vụ việc.
          </p>
          {relatedReports.map((report) => (
            <div
              key={report.id as string}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                {report.urgency === 'emergency' && <span style={{ color: urgencyColor('emergency') }}>⚠️ </span>}
                {(report.category as string) || 'Khác'}
              </span>
              <Badge color={statusColor(report.status as string)}>{statusLabel(report.status as string)}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: `${color}1f`,
        color,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      {value}
    </p>
  );
}

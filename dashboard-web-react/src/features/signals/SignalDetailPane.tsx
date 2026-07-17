import { Copy, Flame, Link2, Sparkles, Tag } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { heatLevelColor, heatLevelLabel, statusColor, statusLabel, theme, trustLevelColor, trustLevelLabel, urgencyColor } from '../../core/theme';
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
    <div key={signalId} className="rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Badge color={trustLevelColor(trustLevel)}>{trustLevelLabel(trustLevel)}</Badge>
        {heat && (
          <Badge color={heatLevelColor(heat.level)}>
            <Flame size={11} /> {heatLevelLabel(heat.level)} ({heat.score})
          </Badge>
        )}
      </div>

      <p style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{(signal.summary as string) || '(Không có tóm tắt)'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <InfoRow label="Nguồn" value={(signal.sourceName as string) || 'Không rõ'} />
        {typeof signal.sourceUrl === 'string' && signal.sourceUrl && (
          <InfoRow icon={<Link2 size={13} />} label="Liên kết" value={signal.sourceUrl} />
        )}
        {typeof signal.detectedCategory === 'string' && signal.detectedCategory && (
          <InfoRow icon={<Tag size={13} />} label="Loại vụ việc" value={signal.detectedCategory} />
        )}
        {signal.duplicateOfId != null && (
          <InfoRow icon={<Copy size={13} />} label="Ghi chú" value="Có thể trùng với 1 tín hiệu khác đã ghi nhận" />
        )}
      </div>

      {typeof signal.rawSnippet === 'string' && signal.rawSnippet && (
        <div className="surface-card" style={{ padding: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink-muted)' }}>Nội dung gốc</p>
          <p style={{ marginTop: 4, lineHeight: 1.6, maxWidth: '65ch' }}>{signal.rawSnippet}</p>
        </div>
      )}

      {heatNarrative && (
        <div style={{ background: `${theme.accent}14`, border: `1px solid ${theme.accent}33`, borderRadius: 'var(--radius-md)', padding: 12 }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: theme.accent }}>
            <Sparkles size={13} /> Diễn giải độ nóng (AI, chỉ tham khảo)
          </p>
          <p style={{ color: theme.accent, marginTop: 4, lineHeight: 1.6 }}>{heatNarrative}</p>
        </div>
      )}

      {relatedReports.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Đối chiếu chéo — tin dân báo cùng địa bàn, gần thời điểm</p>
          <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
            Chỉ mang tính tham khảo, không phải kết luận là cùng một vụ việc.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {relatedReports.map((report) => (
              <div
                key={report.id as string}
                className="surface-card"
                style={{
                  padding: 10,
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
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      {icon}
      <span style={{ color: 'var(--ink-muted)' }}>{label}: </span>
      {value}
    </p>
  );
}

import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Card } from '../../components/ChartCard';
import { statusColor } from '../../core/theme';
import { updateReportStatus } from './reportsApi';
import { useInvalidateReports } from './useReports';

const STATUS_OPTIONS = [
  { value: 'verifying', label: 'Đang xác minh' },
  { value: 'confirmed_true', label: 'Đúng sự thật' },
  { value: 'confirmed_false', label: 'Tin sai' },
];

/** CLAUDE.md non-negotiable #3: human-in-the-loop is mandatory — the reviewer must actively
 * pick one of the three statuses below. No default selection, no AI-suggested status.
 *
 * The title row below is a <span>, not a <div>, so the "Duyệt tin báo" text's nearest `<div>`
 * ancestor stays the Card root that also contains the action buttons — see
 * StatusUpdateAction.test.tsx / ReportsPage.test.tsx's `.closest('div')` + `within(...)` lookup. */
export function StatusUpdateAction({ reportId }: { reportId: string }) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const invalidateReports = useInvalidateReports();

  useEffect(() => {
    setSelectedStatus(null);
    setNote('');
    setError(null);
    setSaved(false);
  }, [reportId]);

  async function submit() {
    if (!selectedStatus) {
      setError('Hãy chọn một trạng thái xác minh.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateReportStatus(reportId, selectedStatus, note);
      invalidateReports(reportId);
      setSaved(true);
      setSelectedStatus(null);
      setNote('');
    } catch {
      setError('Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ClipboardCheck size={15} style={{ color: 'var(--ink-faint)' }} />
        <p style={{ fontWeight: 600, fontSize: 14 }}>Duyệt tin báo</p>
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {STATUS_OPTIONS.map((option) => {
          const active = selectedStatus === option.value;
          const color = statusColor(option.value);
          return (
            <button
              key={option.value}
              onClick={() => setSelectedStatus(option.value)}
              className="chip"
              data-active={active}
              style={active ? { background: color, borderColor: color, color: 'white' } : undefined}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <label htmlFor="status-note" style={{ marginTop: 12 }}>
        Ghi chú (tuỳ chọn)
        <textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13, marginTop: 8 }}>
          {error}
        </p>
      )}
      {saved && <p style={{ color: statusColor('confirmed_true'), fontSize: 13, marginTop: 8, fontWeight: 600 }}>Đã cập nhật trạng thái.</p>}
      <button disabled={submitting} onClick={submit} className="btn-primary" style={{ marginTop: 12 }}>
        {submitting ? 'Đang cập nhật...' : 'Xác nhận trạng thái'}
      </button>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Card } from '../../components/ChartCard';
import { updateReportStatus } from './reportsApi';
import { useInvalidateReports } from './useReports';

const STATUS_OPTIONS = [
  { value: 'verifying', label: 'Đang xác minh' },
  { value: 'confirmed_true', label: 'Đúng sự thật' },
  { value: 'confirmed_false', label: 'Tin sai' },
];

/** CLAUDE.md non-negotiable #3: human-in-the-loop is mandatory — the reviewer must actively
 * pick one of the three statuses below. No default selection, no AI-suggested status. */
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
      <p style={{ fontWeight: 600, fontSize: 14 }}>Duyệt tin báo</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedStatus(option.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: selectedStatus === option.value ? 'var(--primary)' : 'white',
              color: selectedStatus === option.value ? 'white' : 'var(--foreground)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <textarea
        placeholder="Ghi chú (tuỳ chọn)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ display: 'block', width: '100%', marginTop: 12 }}
      />
      {error && (
        <p role="alert" style={{ color: 'var(--destructive)' }}>
          {error}
        </p>
      )}
      {saved && <p>Đã cập nhật trạng thái.</p>}
      <button disabled={submitting} onClick={submit} style={{ marginTop: 8 }}>
        {submitting ? 'Đang cập nhật...' : 'Xác nhận trạng thái'}
      </button>
    </Card>
  );
}

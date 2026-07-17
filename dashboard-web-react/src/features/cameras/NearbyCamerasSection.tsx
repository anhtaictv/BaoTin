import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Camera as CameraIcon } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { EmptyState } from '../../components/EmptyState';
import { createExtractionRequest, getNearbyCameras } from './camerasApi';

/** Ported from mobile-app-officer/dashboard-web's NearbyCamerasSection (v1.9.0) — cameras
 * can be selected in bulk (e.g. several along a route) and submitted in one action, but that
 * only ever produces N separate administrative paperwork requests, one per camera's own
 * managing unit. No cross-camera recognition/tracking anywhere here (CLAUDE.md #8). */
export function NearbyCamerasSection({ reportId }: { reportId: string }) {
  const query = useQuery({ queryKey: ['nearby-cameras', reportId], queryFn: () => getNearbyCameras(reportId) });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggle(cameraId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) next.delete(cameraId);
      else next.add(cameraId);
      return next;
    });
  }

  async function submit() {
    if (!start || !end) return;
    setSubmitting(true);
    try {
      await createExtractionRequest(reportId, {
        cameraIds: [...selected],
        timeRangeStart: new Date(start).toISOString(),
        timeRangeEnd: new Date(end).toISOString(),
        note: note.trim() || undefined,
      });
      setFeedback(
        selected.size === 1
          ? 'Đã gửi yêu cầu trích xuất tới đơn vị quản lý camera.'
          : `Đã gửi ${selected.size} yêu cầu trích xuất tới các đơn vị quản lý camera liên quan.`,
      );
      setSelected(new Set());
      setShowForm(false);
      setStart('');
      setEnd('');
      setNote('');
    } catch {
      setFeedback('Gửi yêu cầu thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (query.isLoading) return <ChartCardSkeleton height={140} />;
  if (query.isError) return <ChartCardError onRetry={() => query.refetch()} height={140} />;

  const cameras = query.data ?? [];

  return (
    <Card>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CameraIcon size={15} style={{ color: 'var(--ink-faint)' }} />
        <p style={{ fontWeight: 600, fontSize: 14 }}>Camera an ninh gần hiện trường</p>
      </span>
      <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
        Tự động gợi ý camera gần vị trí tin báo — không tự xem/tải video. Chọn 1 hoặc nhiều camera
        (vd. dọc tuyến đường) để tạo yêu cầu gửi từng đơn vị quản lý xử lý thủ công — hệ thống
        không nhận diện hay theo dõi qua các camera.
      </p>
      {cameras.length === 0 ? (
        <EmptyState message="Không có camera nào được ghi nhận gần vị trí này." />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            {cameras.map((camera) => {
              const checked = selected.has(camera.id);
              return (
                <label
                  key={camera.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: checked ? 'var(--surface-sunken)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(camera.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                      {camera.name}
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 400 }}>
                        {camera.managingUnitName ?? 'Không rõ đơn vị'} — {camera.managingUnitContact ?? ''} • cách{' '}
                        {Math.round(camera.distanceMeters)}m
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <button disabled={selected.size === 0} onClick={() => setShowForm(true)} className="btn-primary btn-sm" style={{ marginTop: 10 }}>
            {selected.size === 0 ? 'Xin trích xuất' : `Xin trích xuất (${selected.size})`}
          </button>
          {showForm && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
              {selected.size > 1 && (
                <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                  Mỗi camera sẽ là 1 yêu cầu riêng gửi đúng đơn vị quản lý camera đó.
                </p>
              )}
              <label htmlFor="extraction-start">
                Từ thời điểm
                <input id="extraction-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label htmlFor="extraction-end">
                Đến thời điểm
                <input id="extraction-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label htmlFor="extraction-note">
                Ghi chú (tuỳ chọn)
                <textarea id="extraction-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)}>Huỷ</button>
                <button disabled={!start || !end || submitting} onClick={submit} className="btn-primary">
                  {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {feedback && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-muted)' }}>{feedback}</p>}
    </Card>
  );
}

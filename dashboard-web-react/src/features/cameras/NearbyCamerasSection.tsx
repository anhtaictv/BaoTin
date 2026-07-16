import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
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
      <p style={{ fontWeight: 600, fontSize: 14 }}>Camera an ninh gần hiện trường</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Tự động gợi ý camera gần vị trí tin báo — không tự xem/tải video. Chọn 1 hoặc nhiều camera
        (vd. dọc tuyến đường) để tạo yêu cầu gửi từng đơn vị quản lý xử lý thủ công — hệ thống
        không nhận diện hay theo dõi qua các camera.
      </p>
      {cameras.length === 0 ? (
        <p>Không có camera nào được ghi nhận gần vị trí này.</p>
      ) : (
        <>
          {cameras.map((camera) => (
            <label key={camera.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <input type="checkbox" checked={selected.has(camera.id)} onChange={() => toggle(camera.id)} />
              <span>
                {camera.name}
                <br />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {camera.managingUnitName ?? 'Không rõ đơn vị'} — {camera.managingUnitContact ?? ''} • cách{' '}
                  {Math.round(camera.distanceMeters)}m
                </span>
              </span>
            </label>
          ))}
          <button disabled={selected.size === 0} onClick={() => setShowForm(true)} style={{ marginTop: 8 }}>
            {selected.size === 0 ? 'Xin trích xuất' : `Xin trích xuất (${selected.size})`}
          </button>
          {showForm && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
              {selected.size > 1 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Mỗi camera sẽ là 1 yêu cầu riêng gửi đúng đơn vị quản lý camera đó.
                </p>
              )}
              <label>
                Từ thời điểm
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  style={{ display: 'block', width: '100%' }}
                />
              </label>
              <label>
                Đến thời điểm
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  style={{ display: 'block', width: '100%' }}
                />
              </label>
              <label>
                Ghi chú (tuỳ chọn)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ display: 'block', width: '100%' }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)}>Huỷ</button>
                <button disabled={!start || !end || submitting} onClick={submit}>
                  {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {feedback && <p style={{ marginTop: 8 }}>{feedback}</p>}
    </Card>
  );
}

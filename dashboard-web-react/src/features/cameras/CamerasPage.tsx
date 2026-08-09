import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera as CameraIcon, Plus } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../core/AuthContext';
import { CameraFormDialog } from './CameraFormDialog';
import { cameraConePolygon } from './cameraCone';
import {
  createCamera,
  deleteCamera,
  getDistrictCameras,
  updateCamera,
  type CameraInput,
  type DistrictCamera,
} from './camerasApi';

const DAKLAK_CENTER: [number, number] = [12.68, 108.05];
const CAMERA_COLOR = '#1976D2';
const CAMERA_MANAGE_ROLES = new Set(['admin', 'senior_officer']);

/**
 * Standalone "Camera" page: every camera in the officer's own district(s), not tied to any
 * one report — so an officer can browse coverage at any time. Cameras with a known
 * direction/field-of-view draw a translucent "cone" showing roughly what they can see;
 * cameras without that data (real cameras registered without a surveyed bearing) just show
 * as a plain dot. Never plays/downloads/streams anything (CLAUDE.md non-negotiable #8).
 */
export function CamerasPage() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['district-cameras'], queryFn: getDistrictCameras });
  const [formMode, setFormMode] = useState<'create' | DistrictCamera | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManage = CAMERA_MANAGE_ROLES.has(account?.role ?? '');

  async function handleFormSubmit(input: CameraInput) {
    if (formMode === 'create') {
      await createCamera(input);
    } else if (formMode) {
      await updateCamera(formMode.id, input);
    }
    await queryClient.invalidateQueries({ queryKey: ['district-cameras'] });
    setFormMode(null);
  }

  async function handleDelete(camera: DistrictCamera) {
    if (!window.confirm(`Xoá camera "${camera.name}"? Hành động này không thể hoàn tác.`)) return;
    setDeleteError(null);
    try {
      await deleteCamera(camera.id);
      await queryClient.invalidateQueries({ queryKey: ['district-cameras'] });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setDeleteError(
        status === 409
          ? 'Không thể xoá camera đã có yêu cầu trích xuất hoặc cảnh báo tai nạn liên quan.'
          : 'Xoá camera thất bại. Vui lòng thử lại.',
      );
    }
  }

  if (query.isLoading) return <ChartCardSkeleton height={420} />;
  if (query.isError) return <ChartCardError onRetry={() => query.refetch()} height={420} />;

  const cameras = query.data ?? [];
  const center: [number, number] = cameras.length > 0 ? [cameras[0]!.lat, cameras[0]!.lng] : DAKLAK_CENTER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Camera an ninh"
        subtitle="Toàn bộ camera trong địa bàn được phân công — hình quạt thể hiện hướng/góc nhìn ước lượng của camera"
        actions={
          canManage && (
            <button onClick={() => setFormMode('create')} className="btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Thêm camera
            </button>
          )
        }
      />

      {cameras.length === 0 ? (
        <Card>
          <EmptyState message="Chưa có camera nào được ghi nhận trong địa bàn của bạn." />
        </Card>
      ) : (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: 420, width: '100%' }}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {cameras.map((camera) => (
                <div key={camera.id}>
                  {camera.directionDegrees != null && (
                    <Polygon
                      positions={cameraConePolygon(camera, camera.directionDegrees, camera.fovDegrees ?? 90)}
                      pathOptions={{ color: CAMERA_COLOR, fillColor: CAMERA_COLOR, fillOpacity: 0.25, weight: 1 }}
                    />
                  )}
                  <CircleMarker
                    center={[camera.lat, camera.lng]}
                    radius={6}
                    pathOptions={{ color: CAMERA_COLOR, fillColor: CAMERA_COLOR, fillOpacity: 1, weight: 1 }}
                  >
                    <Popup>
                      <div style={{ fontSize: 12.5 }}>
                        <p style={{ fontWeight: 600 }}>{camera.name}</p>
                        <p>{camera.managingUnitName ?? 'Không rõ đơn vị'}</p>
                        <p style={{ color: '#8b96b3' }}>{camera.managingUnitContact ?? ''}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                </div>
              ))}
            </MapContainer>
          </Card>

          <Card>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CameraIcon size={15} style={{ color: 'var(--ink-faint)' }} />
              <p style={{ fontWeight: 600, fontSize: 14 }}>Danh sách camera ({cameras.length})</p>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {cameras.map((camera) => (
                <div
                  key={camera.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{camera.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                      {camera.managingUnitName ?? 'Không rõ đơn vị'} — {camera.managingUnitContact ?? ''}
                      {camera.directionDegrees != null ? ` • hướng ${camera.directionDegrees}°` : ' • chưa rõ hướng'}
                    </p>
                  </div>
                  {canManage && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setFormMode(camera)} className="btn-sm">
                        Sửa
                      </button>
                      <button onClick={() => handleDelete(camera)} className="btn-sm">
                        Xoá
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {deleteError && (
        <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
          {deleteError}
        </p>
      )}

      {formMode && (
        <CameraFormDialog
          initial={formMode === 'create' ? undefined : formMode}
          onSubmit={handleFormSubmit}
          onCancel={() => setFormMode(null)}
        />
      )}
    </div>
  );
}

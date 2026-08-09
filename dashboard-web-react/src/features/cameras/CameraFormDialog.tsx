import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useDistrictOptions } from '../dashboard/useDashboard';
import type { CameraInput, DistrictCamera } from './camerasApi';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: 'var(--ink-muted)' };
const DAKLAK_CENTER: [number, number] = [12.68, 108.05];

/** Reports a map click back to the parent — kept as its own component because
 * react-leaflet's useMapEvents hook must run inside a MapContainer's own subtree. */
function ClickToSetPosition({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Admin/senior_officer only (enforced server-side by cameras.routes.ts's CAMERA_MANAGE_ROLES).
 * Same form for create and edit — `initial` present means edit, and the edit PUT is a full
 * replace (not a partial patch), so this always collects every field regardless of mode.
 * Coordinates can be set either by typing lat/lng directly or by clicking the mini-map — both
 * write to the same state, so they always stay in sync. `directionDegrees`/`fovDegrees` are
 * optional: a camera registered without them just shows as a plain dot (no cone) everywhere
 * else in the app.
 */
export function CameraFormDialog({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: DistrictCamera;
  onSubmit: (input: CameraInput) => Promise<void>;
  onCancel: () => void;
}) {
  const districts = useDistrictOptions();
  const [name, setName] = useState(initial?.name ?? '');
  const [lat, setLat] = useState(initial ? String(initial.lat) : '');
  const [lng, setLng] = useState(initial ? String(initial.lng) : '');
  const [managingUnitName, setManagingUnitName] = useState(initial?.managingUnitName ?? '');
  const [managingUnitContact, setManagingUnitContact] = useState(initial?.managingUnitContact ?? '');
  const [districtId, setDistrictId] = useState(initial?.districtId ?? '');
  const [directionDegrees, setDirectionDegrees] = useState(initial?.directionDegrees != null ? String(initial.directionDegrees) : '');
  const [fovDegrees, setFovDegrees] = useState(initial?.fovDegrees != null ? String(initial.fovDegrees) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!name.trim() || lat.trim() === '' || lng.trim() === '' || Number.isNaN(latNum) || Number.isNaN(lngNum) || !districtId) {
      setError('Vui lòng nhập đủ tên, toạ độ hợp lệ và chọn địa bàn.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        lat: latNum,
        lng: lngNum,
        managingUnitName: managingUnitName.trim() || undefined,
        managingUnitContact: managingUnitContact.trim() || undefined,
        districtId,
        directionDegrees: directionDegrees.trim() ? Number(directionDegrees) : undefined,
        fovDegrees: fovDegrees.trim() ? Number(fovDegrees) : undefined,
      });
    } catch {
      setError('Lưu camera thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          padding: 22,
          width: 420,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ fontWeight: 700, fontSize: 15.5 }}>{initial ? 'Sửa camera' : 'Thêm camera'}</p>

        <label style={labelStyle}>
          Tên camera
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Vĩ độ (lat)
            <input style={inputStyle} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Kinh độ (lng)
            <input style={inputStyle} value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
          </label>
        </div>

        <div>
          <p style={{ ...labelStyle, marginBottom: 4 }}>Hoặc bấm vào bản đồ để chọn vị trí</p>
          <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <MapContainer
              center={initial ? [initial.lat, initial.lng] : DAKLAK_CENTER}
              zoom={initial ? 16 : 12}
              scrollWheelZoom={false}
              style={{ height: 180, width: '100%' }}
            >
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ClickToSetPosition onPick={(pickedLat, pickedLng) => { setLat(pickedLat.toFixed(6)); setLng(pickedLng.toFixed(6)); }} />
              {lat.trim() !== '' && lng.trim() !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) && (
                <CircleMarker center={[Number(lat), Number(lng)]} radius={7} pathOptions={{ color: '#1976D2', fillColor: '#1976D2', fillOpacity: 1, weight: 1 }} />
              )}
            </MapContainer>
          </div>
        </div>

        <label style={labelStyle}>
          Địa bàn
          <select style={inputStyle} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">-- Chọn địa bàn --</option>
            {(districts.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.tenXa}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Đơn vị quản lý (tuỳ chọn)
          <input style={inputStyle} value={managingUnitName} onChange={(e) => setManagingUnitName(e.target.value)} />
        </label>

        <label style={labelStyle}>
          Liên hệ đơn vị quản lý (tuỳ chọn)
          <input style={inputStyle} value={managingUnitContact} onChange={(e) => setManagingUnitContact(e.target.value)} />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Hướng camera 0-359° (tuỳ chọn)
            <input style={inputStyle} value={directionDegrees} onChange={(e) => setDirectionDegrees(e.target.value)} inputMode="numeric" />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Góc nhìn, độ (tuỳ chọn)
            <input style={inputStyle} value={fovDegrees} onChange={(e) => setFovDegrees(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--destructive)', fontSize: 12.5 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} disabled={submitting}>
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

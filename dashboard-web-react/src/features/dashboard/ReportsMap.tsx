import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { categoryLabel, statusColor, statusLabel } from '../../core/theme';
import type { ReportLocation } from './dashboardApi';

const HCM_CENTER: [number, number] = [10.7769, 106.7009];

export function ReportsMap({ locations }: { locations: ReportLocation[] }) {
  if (locations.length === 0) {
    return <p style={{ color: 'var(--ink-muted)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>Không có tin báo nào trong khoảng thời gian này.</p>;
  }

  const center: [number, number] =
    locations.length > 0 ? [locations[0]!.lat, locations[0]!.lng] : HCM_CENTER;

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: 320, width: '100%', borderRadius: 'var(--radius-sm)' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <CircleMarker
          key={loc.id}
          center={[loc.lat, loc.lng]}
          radius={7}
          pathOptions={{ color: statusColor(loc.status), fillColor: statusColor(loc.status), fillOpacity: 0.75, weight: 1 }}
        >
          <Popup>
            <div style={{ fontSize: 12.5 }}>
              <p style={{ fontWeight: 600 }}>{statusLabel(loc.status)}</p>
              <p>{categoryLabel(loc.category)}</p>
              <p style={{ color: '#8b96b3' }}>{new Date(loc.createdAt).toLocaleString('vi-VN')}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { ReportsMap } from './ReportsMap';
import type { ReportLocation } from './dashboardApi';

// jsdom has no real <canvas> 2D context, which the real leaflet.heat plugin needs to draw its
// gradient — swap in a harmless L.layerGroup() so this test exercises HeatLayer's own
// mount/unmount wiring, not the third-party plugin's canvas drawing (already relied on
// upstream, out of scope for this unit test).
vi.mock('leaflet.heat', () => {
  (L as unknown as { heatLayer: typeof L.layerGroup }).heatLayer = () => L.layerGroup();
  return {};
});

const locations: ReportLocation[] = [
  { id: 'r1', lat: 12.68, lng: 108.05, status: 'confirmed_true', category: 'tai_nan', urgency: 'normal', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'r2', lat: 12.7, lng: 108.06, status: 'pending', category: 'chay_no', urgency: 'emergency', createdAt: '2026-08-02T00:00:00Z' },
];

describe('ReportsMap', () => {
  it('renders markers by default and switches to the heat layer without crashing', () => {
    render(<ReportsMap locations={locations} />);

    const toggle = screen.getByText('Xem dạng bản đồ nhiệt');
    fireEvent.click(toggle);

    expect(screen.getByText('Đang xem: Bản đồ nhiệt')).toBeInTheDocument();
  });
});

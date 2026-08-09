import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { AuthProvider } from '../../core/AuthContext';
import { tokenStore } from '../../core/tokenStore';
import { CamerasPage } from './CamerasPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const CAMERAS = [
  {
    id: 'c1',
    name: 'Camera ngã tư 1',
    lat: 12.68,
    lng: 108.05,
    managingUnitName: 'Công an phường A',
    managingUnitContact: '0900000001',
    districtId: 'd1',
    directionDegrees: 135,
    fovDegrees: 80,
  },
  {
    id: 'c2',
    name: 'Camera chợ',
    lat: 12.682,
    lng: 108.048,
    managingUnitName: 'Ban quản lý chợ',
    managingUnitContact: '0900000003',
    districtId: 'd1',
    directionDegrees: null,
    fovDegrees: null,
  },
];

function mockLoggedInAs(role: 'officer' | 'admin' | 'senior_officer', cameras: unknown[] = CAMERAS) {
  tokenStore.saveTokens('access-1', 'refresh-1');
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/web-accounts/me') {
      return { data: { data: { username: '0900001111', mustChangePassword: false, lastLoginAt: null, fullName: '[DEMO] A', unitName: null, role, districts: [] } } };
    }
    if (url === '/officer/cameras') return { data: { data: cameras } };
    if (url === '/admin/dashboard/districts') return { data: { data: [{ id: 'd1', tenXa: 'Buôn Ma Thuột' }] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CamerasPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('CamerasPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.put).mockReset();
    vi.mocked(apiClient.delete).mockReset();
    tokenStore.clear();
  });

  it('lists every camera in the district, with direction shown only when known — no "Thêm camera" for a plain officer', async () => {
    mockLoggedInAs('officer');
    renderPage();

    expect(await screen.findByText('Danh sách camera (2)')).toBeInTheDocument();
    expect(screen.getByText(/hướng 135°/)).toBeInTheDocument();
    expect(screen.getByText(/chưa rõ hướng/)).toBeInTheDocument();
    expect(screen.queryByText('Thêm camera')).not.toBeInTheDocument();
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument();
  });

  it('shows an empty state when the district has no cameras', async () => {
    mockLoggedInAs('officer', []);
    renderPage();

    expect(await screen.findByText('Chưa có camera nào được ghi nhận trong địa bàn của bạn.')).toBeInTheDocument();
  });

  it('lets an admin register a new camera through the form', async () => {
    mockLoggedInAs('admin');
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { id: 'c3' } } });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Thêm camera'));
    await user.type(screen.getByLabelText(/Tên camera/), 'Camera mới');
    await user.type(screen.getByLabelText(/Vĩ độ/), '12.68');
    await user.type(screen.getByLabelText(/Kinh độ/), '108.05');
    await user.selectOptions(await screen.findByLabelText(/Địa bàn/), 'd1');
    await user.click(screen.getByText('Lưu'));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/officer/cameras', expect.objectContaining({ name: 'Camera mới', districtId: 'd1' })),
    );
  });

  it('lets an admin edit an existing camera, pre-filled with its current data', async () => {
    mockLoggedInAs('admin');
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { data: {} } });
    renderPage();
    const user = userEvent.setup();

    await user.click((await screen.findAllByText('Sửa'))[0]);
    expect(screen.getByDisplayValue('Camera ngã tư 1')).toBeInTheDocument();
    await user.click(screen.getByText('Lưu'));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith('/officer/cameras/c1', expect.objectContaining({ name: 'Camera ngã tư 1', districtId: 'd1' })),
    );
  });

  it('lets an admin delete a camera after confirming', async () => {
    mockLoggedInAs('admin');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: { data: null } });
    renderPage();
    const user = userEvent.setup();

    await user.click((await screen.findAllByText('Xoá'))[0]);

    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/officer/cameras/c1'));
  });

  it('shows a friendly message instead of crashing when deleting a camera still in use (409)', async () => {
    mockLoggedInAs('admin');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiClient.delete).mockRejectedValueOnce({ response: { status: 409 } });
    renderPage();
    const user = userEvent.setup();

    await user.click((await screen.findAllByText('Xoá'))[0]);

    expect(await screen.findByText(/Không thể xoá camera đã có yêu cầu trích xuất/)).toBeInTheDocument();
  });
});

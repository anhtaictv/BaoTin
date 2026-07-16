import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { NearbyCamerasSection } from './NearbyCamerasSection';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const CAMERAS = [
  { id: 'c1', name: 'Camera ngã tư 1', managingUnitName: 'Công an phường A', managingUnitContact: '0900000001', distanceMeters: 120 },
  { id: 'c2', name: 'Camera chợ', managingUnitName: 'Ban quản lý chợ', managingUnitContact: '0900000003', distanceMeters: 340 },
];

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NearbyCamerasSection reportId="r1" />
    </QueryClientProvider>,
  );
}

describe('NearbyCamerasSection', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('lists nearby cameras with checkboxes, submit disabled until one is selected', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: CAMERAS } });
    renderSection();

    expect(await screen.findByText('Camera ngã tư 1', { exact: false })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Xin trích xuất' });
    expect(button).toBeDisabled();
  });

  it('selecting two cameras and submitting sends one call with both cameraIds', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: CAMERAS } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { groupId: 'g1', requests: [] } } });
    renderSection();
    const user = userEvent.setup();

    await screen.findByText('Camera ngã tư 1', { exact: false });
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole('button', { name: 'Xin trích xuất (2)' }));
    expect(await screen.findByText('Mỗi camera sẽ là 1 yêu cầu riêng gửi đúng đơn vị quản lý camera đó.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Từ thời điểm'), '2026-01-01T08:00');
    await user.type(screen.getByLabelText('Đến thời điểm'), '2026-01-01T09:00');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/officer/reports/r1/camera-extraction-requests',
        expect.objectContaining({ cameraIds: expect.arrayContaining(['c1', 'c2']) }),
      ),
    );
    expect(await screen.findByText(/Đã gửi 2 yêu cầu trích xuất/)).toBeInTheDocument();
  });

  it('shows the plain singular feedback when only one camera is selected', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: CAMERAS } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: { groupId: null, requests: [] } } });
    renderSection();
    const user = userEvent.setup();

    await screen.findByText('Camera ngã tư 1', { exact: false });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: 'Xin trích xuất (1)' }));

    // No "mỗi camera..." disclaimer for a single-camera request.
    expect(screen.queryByText('Mỗi camera sẽ là 1 yêu cầu riêng gửi đúng đơn vị quản lý camera đó.')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Từ thời điểm'), '2026-01-01T08:00');
    await user.type(screen.getByLabelText('Đến thời điểm'), '2026-01-01T09:00');
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(await screen.findByText('Đã gửi yêu cầu trích xuất tới đơn vị quản lý camera.')).toBeInTheDocument();
  });

  it('shows an empty state when there are no nearby cameras', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: [] } });
    renderSection();

    expect(await screen.findByText('Không có camera nào được ghi nhận gần vị trí này.')).toBeInTheDocument();
  });
});

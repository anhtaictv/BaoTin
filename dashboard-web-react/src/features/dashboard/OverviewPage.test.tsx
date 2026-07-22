import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { OverviewPage } from './OverviewPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

function mockHappyPath() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/admin/dashboard/districts') {
      return { data: { data: [{ id: 'd1', tenXa: 'Buôn Ma Thuột' }] } };
    }
    if (url === '/admin/dashboard/overview') {
      return {
        data: {
          data: {
            totalReports: 12,
            byStatus: { pending: 3, verifying: 2, confirmed_true: 6, confirmed_false: 1 },
            avgResponseTimeSeconds: 145,
          },
        },
      };
    }
    if (url === '/admin/dashboard/response-time-by-district') {
      return { data: { data: [{ districtName: 'Buôn Ma Thuột', avgResponseTimeSeconds: 120, reportCount: 5 }] } };
    }
    if (url === '/admin/dashboard/response-time-by-officer') {
      return { data: { data: [{ officerName: '[DEMO] A', avgResponseTimeSeconds: 130, reportCount: 3 }] } };
    }
    if (url === '/admin/dashboard/volume-trend') {
      return { data: { data: [{ date: '2026-01-01', count: 4 }] } };
    }
    if (url === '/admin/dashboard/report-count-by-district') {
      return { data: { data: [{ districtId: 'd1', districtName: 'Buôn Ma Thuột', reportCount: 5 }] } };
    }
    if (url === '/admin/dashboard/by-category') {
      return { data: { data: [{ category: 'tai_nan', count: 4 }] } };
    }
    if (url === '/admin/dashboard/report-locations') {
      return { data: { data: [] } };
    }
    if (url === '/admin/dashboard/camera-queue') {
      return { data: { data: { pending: 2, sent: 1, fulfilled: 0, rejected: 0 } } };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderOverview() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewPage />
    </QueryClientProvider>,
  );
}

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('renders KPI cards and every chart section without throwing', async () => {
    mockHappyPath();
    renderOverview();

    expect(await screen.findByText('12')).toBeInTheDocument(); // totalReports
    expect(screen.getByText('5')).toBeInTheDocument(); // pending+verifying = 3+2
    expect(screen.getByText('6')).toBeInTheDocument(); // confirmed_true
    expect(screen.getByText('2.4 phút')).toBeInTheDocument(); // 145s -> (145/60).toFixed(1)

    expect(await screen.findByText('Thời gian phản hồi TB theo địa bàn')).toBeInTheDocument();
    expect(screen.getByText('Thời gian phản hồi TB theo cán bộ')).toBeInTheDocument();
    expect(screen.getByText('Xu hướng số tin')).toBeInTheDocument();
    expect(screen.getByText('Phân bổ trạng thái')).toBeInTheDocument();
    expect(screen.getByText('Phân loại tin báo')).toBeInTheDocument();
    expect(screen.getByText('Số tin theo xã/phường')).toBeInTheDocument();
    expect(screen.getByText('Bản đồ tin báo')).toBeInTheDocument();
    expect(await screen.findByText('Hàng đợi yêu cầu trích xuất camera')).toBeInTheDocument();
  });

  it('shows an error + retry state for a chart whose request fails, without blocking the others', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/admin/dashboard/response-time-by-district') {
        throw new Error('network down');
      }
      if (url === '/admin/dashboard/districts') return { data: { data: [] } };
      if (url === '/admin/dashboard/overview') {
        return { data: { data: { totalReports: 0, byStatus: {}, avgResponseTimeSeconds: null } } };
      }
      if (url === '/admin/dashboard/response-time-by-officer') return { data: { data: [] } };
      if (url === '/admin/dashboard/volume-trend') return { data: { data: [] } };
      if (url === '/admin/dashboard/report-count-by-district') return { data: { data: [] } };
      if (url === '/admin/dashboard/by-category') return { data: { data: [] } };
      if (url === '/admin/dashboard/report-locations') return { data: { data: [] } };
      if (url === '/admin/dashboard/camera-queue') return { data: { data: {} } };
      throw new Error(`unexpected GET ${url}`);
    });
    renderOverview();

    expect(await screen.findByText('Không tải được dữ liệu.')).toBeInTheDocument();
    // The KPI row (a separate, unrelated query) still renders fine.
    await waitFor(() => expect(screen.getByText('Chưa có tin báo nào.')).toBeInTheDocument());
  });

  it('changing the district filter re-fetches the district-scoped queries', async () => {
    mockHappyPath();
    renderOverview();
    await screen.findByText('12');

    const districtSelect = await screen.findByLabelText('Địa bàn:');
    vi.mocked(apiClient.get).mockClear();
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.selectOptions(districtSelect, 'd1');

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/admin/dashboard/overview',
        expect.objectContaining({ params: expect.objectContaining({ district_id: 'd1' }) }),
      ),
    );
  });
});

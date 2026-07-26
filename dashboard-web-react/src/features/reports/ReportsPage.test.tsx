import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { ReportsPage } from './ReportsPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const REPORTS = [
  { id: 'r1', category: 'Trộm cắp', status: 'pending', urgency: 'normal', createdAt: '2026-01-01T08:00:00Z' },
  { id: 'r2', category: 'Tai nạn', status: 'verifying', urgency: 'emergency', createdAt: '2026-01-01T09:00:00Z' },
];

const DETAIL_R1 = {
  id: 'r1',
  category: 'Trộm cắp',
  status: 'pending',
  urgency: 'normal',
  description: 'Mất xe máy trước nhà',
  location: { lat: 12.68, lng: 108.05 },
  user: { anonymous: false, fullName: '[DEMO] Người báo tin', phoneNumber: '0911111111' },
  attachments: [],
};

function mockCommon() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/admin/dashboard/districts') return { data: { data: [] } };
    if (url === '/officer/reports')
      return { data: { data: { reports: REPORTS, page: 1, pageSize: 20, total: REPORTS.length, hasMore: false } } };
    if (url === '/officer/reports/r1') return { data: { data: DETAIL_R1 } };
    if (url === '/officer/reports/r1/nearby-cameras') return { data: { data: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it('lists incoming reports and shows detail + duyệt action on selection', async () => {
    mockCommon();
    renderPage();

    expect(await screen.findByText('Trộm cắp')).toBeInTheDocument();
    expect(screen.getByText('Tai nạn')).toBeInTheDocument();
    expect(screen.getByText('Chọn 1 tin báo bên trái để xem chi tiết.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Trộm cắp'));

    expect(await screen.findByText('Mất xe máy trước nhà')).toBeInTheDocument();
    expect(screen.getByText(/Người báo tin/)).toBeInTheDocument();
    expect(screen.getByText('Duyệt tin báo')).toBeInTheDocument();
  });

  it('submitting a status update calls the API and shows a confirmation', async () => {
    mockCommon();
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { data: { reportId: 'r1', status: 'confirmed_true' } } });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Trộm cắp'));
    const statusCard = (await screen.findByText('Duyệt tin báo')).closest('div')!;

    await user.click(within(statusCard).getByRole('button', { name: 'Đúng sự thật' }));
    await user.click(within(statusCard).getByRole('button', { name: 'Xác nhận trạng thái' }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith('/officer/reports/r1/status', { status: 'confirmed_true', note: undefined }),
    );
    expect(await screen.findByText('Đã cập nhật trạng thái.')).toBeInTheDocument();
  });

  it("shows an error when submitting without picking a status first (human-in-the-loop, CLAUDE.md #3)", async () => {
    mockCommon();
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByText('Trộm cắp'));
    await screen.findByText('Duyệt tin báo');
    await user.click(screen.getByRole('button', { name: 'Xác nhận trạng thái' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy chọn một trạng thái xác minh.');
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('toggling the "Khẩn cấp" filter re-fetches the report list with the urgency param', async () => {
    mockCommon();
    renderPage();
    await screen.findByText('Trộm cắp');

    vi.mocked(apiClient.get).mockClear();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Khẩn cấp' }));

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/officer/reports',
        expect.objectContaining({ params: expect.objectContaining({ urgency: 'emergency' }) }),
      ),
    );
  });
});

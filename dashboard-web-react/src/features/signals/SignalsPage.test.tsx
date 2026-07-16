import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { SignalsPage } from './SignalsPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const SIGNALS = [
  {
    id: 's1',
    sourceName: '[DEMO] Báo Đắk Lắk Online',
    trustLevel: 'verified_press',
    summary: 'Công an đang xác minh vụ trộm xe máy.',
    publishedAt: '2026-01-01T08:00:00Z',
    heat: null,
  },
  {
    id: 's2',
    sourceName: '[DEMO] Facebook — Hội cư dân',
    trustLevel: 'unverified_social',
    summary: 'Người dân phản ánh nghi có cháy nhỏ gần chợ.',
    publishedAt: '2026-01-01T09:00:00Z',
    heat: { score: 6, level: 'high' },
  },
];

const DETAIL_S1 = {
  id: 's1',
  sourceName: '[DEMO] Báo Đắk Lắk Online',
  sourceUrl: 'https://example.com/tin-1',
  trustLevel: 'verified_press',
  summary: 'Công an đang xác minh vụ trộm xe máy.',
  rawSnippet: 'Theo nguồn tin từ công an địa phương...',
  detectedCategory: 'trom_cap',
  duplicateOfId: null,
  heat: { score: 6, level: 'high' },
  heatNarrative: null,
  relatedReports: [
    { id: 'r1', category: 'Trộm cắp tài sản', status: 'pending', urgency: 'normal', createdAt: '2026-01-01T08:30:00Z' },
  ],
};

function mockCommon() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/admin/dashboard/districts') return { data: { data: [] } };
    if (url === '/officer/signals') return { data: { data: SIGNALS } };
    if (url === '/officer/signals/s1') return { data: { data: DETAIL_S1 } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignalsPage />
    </QueryClientProvider>,
  );
}

describe('SignalsPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('lists signals with a distinct disclaimer + trust badge, shows detail on selection, no status UI', async () => {
    mockCommon();
    renderPage();

    expect(await screen.findByText(/chỉ để tham khảo, chưa được xác thực/)).toBeInTheDocument();
    expect(await screen.findByText('Công an đang xác minh vụ trộm xe máy.')).toBeInTheDocument();
    expect(screen.getByText('Người dân phản ánh nghi có cháy nhỏ gần chợ.')).toBeInTheDocument();
    expect(screen.getByText('Chọn 1 tín hiệu bên trái để xem chi tiết.')).toBeInTheDocument();
    expect(screen.queryByText('Đúng sự thật')).not.toBeInTheDocument();
    expect(screen.queryByText('Xác nhận trạng thái')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Công an đang xác minh vụ trộm xe máy.'));

    expect(await screen.findByText('Theo nguồn tin từ công an địa phương...')).toBeInTheDocument();
    expect(screen.getByText(/Nóng \(6\)/)).toBeInTheDocument();
    expect(screen.getByText(/Đối chiếu chéo/)).toBeInTheDocument();
    expect(screen.getByText('Trộm cắp tài sản')).toBeInTheDocument();
  });

  it('filtering by trust level re-fetches the list with the trust_level param', async () => {
    mockCommon();
    renderPage();
    await screen.findByText('Công an đang xác minh vụ trộm xe máy.');

    vi.mocked(apiClient.get).mockClear();
    const user = userEvent.setup();
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'verified_press');

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith(
        '/officer/signals',
        expect.objectContaining({ params: expect.objectContaining({ trust_level: 'verified_press' }) }),
      ),
    );
  });
});

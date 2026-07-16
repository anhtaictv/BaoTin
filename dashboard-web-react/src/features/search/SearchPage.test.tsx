import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { SearchPage } from './SearchPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

async function runSearch(query: string) {
  render(<SearchPage />);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Nhập câu hỏi...'), query);
  await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('shows the unavailable message when available is false', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { available: false, interpreted: null, reports: [], signals: [] } },
    });
    await runSearch('tin cháy nổ');

    expect(await screen.findByText(/Không hiểu được câu hỏi này/)).toBeInTheDocument();
  });

  it('shows interpreted filters and keeps reports/signals in separate sections', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: {
          available: true,
          interpreted: { districtName: 'Buôn Ma Thuột', sinceDays: 30, keyword: 'cháy nổ' },
          reports: [{ id: 'r1', category: 'chay_no', status: 'pending', urgency: 'normal', createdAt: '2026-01-01T08:00:00Z' }],
          signals: [{ id: 's1', sourceName: 'Báo A', summary: 'Cháy nhỏ gần chợ', trustLevel: 'verified_press' }],
        },
      },
    });
    await runSearch('tin cháy nổ ở Buôn Ma Thuột tháng trước');

    expect(await screen.findByText('Địa bàn: Buôn Ma Thuột')).toBeInTheDocument();
    expect(screen.getByText('30 ngày gần đây')).toBeInTheDocument();
    expect(screen.getByText('Từ khóa: cháy nổ')).toBeInTheDocument();
    expect(screen.getByText('Tin báo (1)')).toBeInTheDocument();
    expect(screen.getByText('Tín hiệu MXH/báo chí — chưa xác thực (1)')).toBeInTheDocument();
    expect(screen.getByText('Cháy nhỏ gần chợ')).toBeInTheDocument();
  });

  it('shows empty-state text for each section when there are no matches', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: { available: true, interpreted: { districtName: null, sinceDays: null, keyword: null }, reports: [], signals: [] },
      },
    });
    await runSearch('tin bất kỳ');

    expect(await screen.findByText('Không có tin báo phù hợp.')).toBeInTheDocument();
    expect(screen.getByText('Không có tín hiệu phù hợp.')).toBeInTheDocument();
  });

  it('shows a generic error message when the request fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network down'));
    await runSearch('tin bất kỳ');

    expect(await screen.findByText('Không thực hiện được tìm kiếm. Vui lòng thử lại.')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../core/apiClient';
import { LegalLookupPage } from './LegalLookupPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

async function runLookup(query: string) {
  render(<LegalLookupPage />);
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Nhập câu hỏi...'), query);
  await user.click(screen.getByRole('button', { name: 'Tra cứu' }));
}

describe('LegalLookupPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('shows the unavailable message when available is false', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { available: false, interpreted: null, results: [] } },
    });
    await runLookup('câu hỏi khó hiểu');

    expect(await screen.findByText(/Không hiểu được câu hỏi này/)).toBeInTheDocument();
  });

  it('shows the real article text returned by the backend, never AI-authored prose', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: {
          available: true,
          interpreted: { documentHint: 'bộ luật hình sự', articleNumber: 123, khoanNumber: 1, keyword: null },
          results: [
            {
              documentTitle: 'Bộ luật Hình sự',
              documentNumber: '100/2015/QH13',
              articleNumber: 123,
              articleTitle: 'Tội giết người',
              text: '1. Người nào giết người thuộc một trong các trường hợp sau đây...',
            },
          ],
        },
      },
    });
    await runLookup('khoản 1 điều 123 bộ luật hình sự');

    expect(await screen.findByText('Điều 123. Tội giết người')).toBeInTheDocument();
    expect(screen.getByText('Bộ luật Hình sự (100/2015/QH13)')).toBeInTheDocument();
    expect(screen.getByText(/Người nào giết người thuộc một trong các trường hợp/)).toBeInTheDocument();
  });

  it('shows an empty-state message when no matching article is found', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: { available: true, interpreted: { documentHint: null, articleNumber: 999, khoanNumber: null, keyword: null }, results: [] },
      },
    });
    await runLookup('điều 999');

    expect(await screen.findByText('Không tìm thấy điều luật phù hợp trong dữ liệu hiện có.')).toBeInTheDocument();
  });

  it('shows a generic error message when the request fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network down'));
    await runLookup('điều bất kỳ');

    expect(await screen.findByText('Không thực hiện được tra cứu. Vui lòng thử lại.')).toBeInTheDocument();
  });
});

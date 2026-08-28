import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../core/AuthContext';
import { apiClient } from '../../core/apiClient';
import { tokenStore } from '../../core/tokenStore';
import { CommuneAssignmentPage } from './CommuneAssignmentPage';

vi.mock('../../core/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  setOnSessionExpired: vi.fn(),
}));

const OLD_WARDS = [
  { oldDistrictId: 'ow1', tenXa: 'An Phú', tenHuyen: 'Tuy Hòa', tenTinh: 'Phú Yên', overlapRatio: 0.6 },
  { oldDistrictId: 'ow2', tenXa: 'Hòa Kiến', tenHuyen: 'Tuy Hòa', tenTinh: 'Phú Yên', overlapRatio: 0.4 },
];
const SUBORDINATES = [{ officerId: 's1', fullName: '[DEMO] Nguyễn Văn A', oldDistrictId: null, oldWardLabel: null }];

function mockAccount(role: 'officer' | 'senior_officer' | 'commune_head' | 'admin') {
  return {
    username: '0900001111',
    mustChangePassword: false,
    lastLoginAt: null,
    fullName: '[DEMO] Nguyễn Văn A',
    unitName: 'Công an phường Bình Kiến',
    role,
    districts: [{ id: 'd1', tenXa: 'Bình Kiến' }],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  tokenStore.saveTokens('access-1', 'refresh-1');
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CommuneAssignmentPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function mockGetByUrl(routes: Record<string, unknown>) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    for (const [pattern, data] of Object.entries(routes)) {
      if (url.includes(pattern)) return { data: { data: data } };
    }
    throw new Error(`unmocked GET ${url}`);
  });
}

describe('CommuneAssignmentPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('commune_head: shows own district, subordinates, and old-ward mapping, with an editable dropdown', async () => {
    mockGetByUrl({
      '/web-accounts/me': mockAccount('commune_head'),
      '/officer/commune/my-district': { districtId: 'd1', tenXa: 'Bình Kiến' },
      'old-wards': OLD_WARDS,
      'subordinates': SUBORDINATES,
    });
    renderPage();

    expect(await screen.findByText('Bình Kiến')).toBeInTheDocument();
    expect(await screen.findByText('[DEMO] Nguyễn Văn A')).toBeInTheDocument();
    expect(await screen.findByText('An Phú')).toBeInTheDocument();

    const row = screen.getByText('[DEMO] Nguyễn Văn A').closest('tr')!;
    expect(within(row).getByRole('combobox')).toBeInTheDocument();
  });

  it('commune_head: assigning an old ward posts the assignment and refetches', async () => {
    mockGetByUrl({
      '/web-accounts/me': mockAccount('commune_head'),
      '/officer/commune/my-district': { districtId: 'd1', tenXa: 'Bình Kiến' },
      'old-wards': OLD_WARDS,
      'subordinates': SUBORDINATES,
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { assigned: true }, error: null } });
    renderPage();

    const row = await screen.findByText('[DEMO] Nguyễn Văn A').then((el) => el.closest('tr')!);
    const select = within(row).getByRole('combobox');
    await userEvent.selectOptions(select, 'ow1');

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/officer/commune/d1/subordinates/s1/assignment', { oldDistrictId: 'ow1' });
    });
  });

  it('plain officer: read-only, uses their own district, no editable dropdown', async () => {
    mockGetByUrl({
      '/web-accounts/me': mockAccount('officer'),
      'old-wards': OLD_WARDS,
      'subordinates': SUBORDINATES,
    });
    renderPage();

    expect(await screen.findByText('Bình Kiến')).toBeInTheDocument();
    expect(await screen.findByText('[DEMO] Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('admin: sees a district picker instead of a fixed district', async () => {
    mockGetByUrl({
      '/web-accounts/me': mockAccount('admin'),
      '/admin/officers/districts': [{ id: 'd1', tenXa: 'Bình Kiến' }, { id: 'd2', tenXa: 'Hòa Xuân' }],
    });
    renderPage();

    expect(await screen.findByLabelText('Xã/phường (mới):')).toBeInTheDocument();
    expect(screen.getByText('Hòa Xuân')).toBeInTheDocument();
  });
});

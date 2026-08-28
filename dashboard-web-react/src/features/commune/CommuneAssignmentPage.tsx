import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MapPinned, Users } from 'lucide-react';
import { Card, ChartCardError, ChartCardSkeleton } from '../../components/ChartCard';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../core/AuthContext';
import {
  assignSubordinate,
  getMyCommuneDistrict,
  listAllDistricts,
  listOldWards,
  listSubordinates,
} from './communeApi';

function overlapPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Trưởng xã (commune_head) chia nhỏ xã/phường MỚI mình phụ trách thành các địa bàn con
 * theo ranh giới xã/phường CŨ (trước sáp nhập), rồi gán từng địa bàn con cho 1 tài khoản
 * cấp dưới — CLAUDE.md "phân quyền... theo địa bàn cũ để chính xác hơn". admin có bộ chọn
 * xã/phường để làm thay cho bất kỳ trưởng xã nào; các vai trò còn lại chỉ xem địa bàn của
 * chính mình (account.districts[0]), không có quyền sửa. */
export function CommuneAssignmentPage() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = account?.role === 'admin';
  const isCommuneHead = account?.role === 'commune_head';
  const canEdit = isAdmin || isCommuneHead;

  const allDistricts = useQuery({
    queryKey: ['commune', 'all-districts'],
    queryFn: listAllDistricts,
    enabled: isAdmin,
  });
  const myDistrict = useQuery({
    queryKey: ['commune', 'my-district'],
    queryFn: getMyCommuneDistrict,
    enabled: isCommuneHead,
  });

  const [pickedDistrictId, setPickedDistrictId] = useState<string | null>(null);
  const districtId = isAdmin ? pickedDistrictId : isCommuneHead ? (myDistrict.data?.districtId ?? null) : (account?.districts[0]?.id ?? null);
  const districtLabel = useMemo(() => {
    if (isCommuneHead) return myDistrict.data?.tenXa ?? null;
    if (isAdmin) return allDistricts.data?.find((d) => d.id === pickedDistrictId)?.tenXa ?? null;
    return account?.districts[0]?.tenXa ?? null;
  }, [isCommuneHead, myDistrict.data, isAdmin, allDistricts.data, pickedDistrictId, account]);

  const oldWards = useQuery({
    queryKey: ['commune', 'old-wards', districtId],
    queryFn: () => listOldWards(districtId!),
    enabled: !!districtId,
  });
  const subordinates = useQuery({
    queryKey: ['commune', 'subordinates', districtId],
    queryFn: () => listSubordinates(districtId!),
    enabled: !!districtId,
  });

  const [savingOfficerId, setSavingOfficerId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleAssign(officerId: string, oldDistrictId: string | null) {
    if (!districtId) return;
    setSavingOfficerId(officerId);
    setSaveError(null);
    try {
      await assignSubordinate(districtId, officerId, oldDistrictId);
      await queryClient.invalidateQueries({ queryKey: ['commune', 'subordinates', districtId] });
    } catch {
      setSaveError('Gán địa bàn thất bại. Vui lòng thử lại.');
    } finally {
      setSavingOfficerId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Phân địa bàn theo xã/phường cũ"
        subtitle="Chia nhỏ xã/phường mới (sau sáp nhập) theo ranh giới cũ để phân công cấp dưới chính xác hơn"
      />

      {isAdmin && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label htmlFor="district-picker" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)' }}>
            Xã/phường (mới):
          </label>
          {allDistricts.isLoading ? (
            <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Đang tải...</span>
          ) : (
            <select
              id="district-picker"
              value={pickedDistrictId ?? ''}
              onChange={(e) => setPickedDistrictId(e.target.value || null)}
              style={{ minWidth: 220 }}
            >
              <option value="">-- Chọn xã/phường --</option>
              {allDistricts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.tenXa}
                </option>
              ))}
            </select>
          )}
        </Card>
      )}

      {isCommuneHead && myDistrict.isSuccess && !myDistrict.data && (
        <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
          Tài khoản chưa được gán làm trưởng xã của xã/phường nào — liên hệ quản trị viên.
        </p>
      )}

      {!districtId && !isAdmin && !isCommuneHead && (
        <Card>
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Tài khoản chưa được gán địa bàn.</p>
        </Card>
      )}

      {districtId && (
        <>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPinned size={16} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 14, fontWeight: 600 }}>{districtLabel ?? '...'}</p>
          </Card>

          {saveError && (
            <p role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
              {saveError}
            </p>
          )}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 0' }}>
              <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Tài khoản cấp dưới
              </p>
            </div>
            {subordinates.isLoading ? (
              <ChartCardSkeleton height={160} />
            ) : subordinates.isError ? (
              <ChartCardError onRetry={() => subordinates.refetch()} height={160} />
            ) : (
              <div className="scroll-panel" style={{ maxHeight: 'calc(100vh - 420px)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cán bộ</th>
                      <th>Địa bàn phụ trách (xã/phường cũ)</th>
                      {canEdit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {subordinates.data!.map((s) => (
                      <tr key={s.officerId}>
                        <td>{s.fullName}</td>
                        <td>{s.oldWardLabel ?? 'Toàn bộ xã/phường mới'}</td>
                        {canEdit && (
                          <td>
                            <select
                              disabled={savingOfficerId === s.officerId}
                              value={s.oldDistrictId ?? ''}
                              onChange={(e) => handleAssign(s.officerId, e.target.value || null)}
                              style={{ minWidth: 260 }}
                            >
                              <option value="">Toàn bộ xã/phường mới</option>
                              {oldWards.data?.map((w) => (
                                <option key={w.oldDistrictId} value={w.oldDistrictId}>
                                  {w.tenXa} ({w.tenHuyen ?? '?'} cũ, {overlapPct(w.overlapRatio)} địa bàn)
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subordinates.data?.length === 0 && (
                  <p style={{ padding: 20, fontSize: 13, color: 'var(--ink-muted)', textAlign: 'center' }}>
                    Chưa có tài khoản cấp dưới nào trong xã/phường này.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 0' }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Xã/phường cũ trong địa bàn này (cũ → mới)</p>
            </div>
            {oldWards.isLoading ? (
              <ChartCardSkeleton height={140} />
            ) : oldWards.isError ? (
              <ChartCardError onRetry={() => oldWards.refetch()} height={140} />
            ) : (
              <div className="scroll-panel" style={{ maxHeight: 240 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Xã/phường cũ</th>
                      <th>Huyện cũ</th>
                      <th>Tỉnh cũ</th>
                      <th>% thuộc xã/phường mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oldWards.data!.map((w) => (
                      <tr key={w.oldDistrictId}>
                        <td>{w.tenXa}</td>
                        <td>{w.tenHuyen ?? '-'}</td>
                        <td>{w.tenTinh ?? '-'}</td>
                        <td>{overlapPct(w.overlapRatio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {oldWards.data?.length === 0 && (
                  <p style={{ padding: 20, fontSize: 13, color: 'var(--ink-muted)', textAlign: 'center' }}>
                    Không tìm thấy dữ liệu ranh giới cũ cho xã/phường này.
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

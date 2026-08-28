import { useState } from 'react';
import { useDistrictOptions } from '../dashboard/useDashboard';
import { roleLabel } from '../../core/theme';
import type { OfficerRole, WebAccountSummary } from './accountsAdminApi';

const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: 'var(--ink-muted)' };
const ROLE_OPTIONS: OfficerRole[] = ['officer', 'senior_officer', 'commune_head', 'admin'];

/**
 * Admin-only (AdminAccountsPage's route is already AdminOnlyRoute-gated). Đổi role +
 * (tuỳ chọn) gán xã/phường trong cùng 1 lần lưu — cần cả 2 vì một tài khoản mới nâng lên
 * `commune_head` mà chưa có địa bàn nào thì không phụ trách được gì (getCommuneHeadDistrict
 * trả về null). Địa bàn để trống nếu chỉ muốn đổi role, giữ nguyên địa bàn hiện có.
 */
export function ChangeRoleDialog({
  account,
  onSubmit,
  onCancel,
}: {
  account: WebAccountSummary;
  onSubmit: (role: OfficerRole, districtId: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const districts = useDistrictOptions();
  const [role, setRole] = useState<OfficerRole>(account.role as OfficerRole);
  const [districtId, setDistrictId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(role, districtId || null);
    } catch {
      setError('Cập nhật thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-md)',
          padding: 22,
          width: 380,
          maxWidth: '92vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <p style={{ fontWeight: 700, fontSize: 15.5 }}>Đổi vai trò — {account.fullName}</p>

        <label style={labelStyle}>
          Vai trò
          <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as OfficerRole)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Gán thêm xã/phường (tuỳ chọn — bỏ trống nếu chỉ đổi vai trò)
          <select style={inputStyle} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">-- Giữ nguyên địa bàn hiện có --</option>
            {(districts.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.tenXa}
              </option>
            ))}
          </select>
        </label>
        {role === 'commune_head' && account.districts.length === 0 && !districtId && (
          <p style={{ fontSize: 12, color: 'var(--accent)' }}>
            Tài khoản này chưa có xã/phường nào — chọn 1 xã/phường ở trên để trưởng xã có địa bàn phụ trách.
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--destructive)', fontSize: 12.5 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel} disabled={submitting}>
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

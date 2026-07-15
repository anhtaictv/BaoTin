/**
 * Already-decrypted identity fields — callers must decrypt phoneNumberEnc/fullNameEnc
 * (src/crypto/aesGcm.ts) *before* constructing this shape. Deliberately has no `*Enc`
 * fields, so a raw ciphertext blob accidentally passed in here is a type error, not a
 * silent bug that ships an unreadable string to a viewer who was supposed to see a name.
 */
export interface ReportUserIdentity {
  id: string;
  isAnonymousPublic: boolean;
  phoneNumber?: string;
  fullName?: string | null;
}

export interface ReportWithUser {
  user?: ReportUserIdentity | null;
  [key: string]: unknown;
}

const IDENTITY_VIEWER_ROLES = new Set(["senior_officer", "admin"]);

/**
 * SECURITY.md §2.3: a citizen report flagged "ẩn danh với đối tượng vi phạm"
 * (users.is_anonymous_public, default true) must not expose the reporter's identity to a
 * regular district officer — only senior_officer/admin may see it. This strips the
 * encrypted/hash identity fields at the serialization boundary rather than relying on the
 * client to hide them, per CLAUDE.md/SECURITY.md "kiểm tra ở tầng backend".
 */
export function serializeReportForViewer<T extends ReportWithUser>(
  report: T,
  viewerRole: string,
): { report: T; identityWasHidden: boolean } {
  if (!report.user || !report.user.isAnonymousPublic) {
    return { report, identityWasHidden: false };
  }
  if (IDENTITY_VIEWER_ROLES.has(viewerRole)) {
    return { report, identityWasHidden: false };
  }
  return {
    report: { ...report, user: { id: report.user.id, anonymous: true } } as T,
    identityWasHidden: true,
  };
}

/** True when a senior/admin viewer is about to see identity data that was anonymity-flagged — audit-log trigger. */
export function isSensitiveIdentityView(report: ReportWithUser, viewerRole: string): boolean {
  return Boolean(report.user?.isAnonymousPublic) && IDENTITY_VIEWER_ROLES.has(viewerRole);
}

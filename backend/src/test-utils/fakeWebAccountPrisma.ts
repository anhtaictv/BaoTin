import { randomUUID } from "node:crypto";

export interface FakeOfficerRow {
  id: string;
  fullNameEnc: string;
  unitName: string | null;
  role: string;
  phoneNumberEnc?: string;
}

export interface FakeDistrictRow {
  id: string;
  tenXa: string;
}

export interface FakeAssignmentRow {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

export interface FakeWebAccountRow {
  id: string;
  officerId: string;
  username: string;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Fake Prisma covering webAccountAuth.service.ts's needs: web_accounts, officers (read +
 * update for updateInfo), officer_district_assignments + districts (for getMyAccount/
 * listWebAccounts). No PostGIS/raw SQL involved — this service never touches geometry. */
export function createFakeWebAccountPrisma() {
  const webAccounts = new Map<string, FakeWebAccountRow>();
  const officers = new Map<string, FakeOfficerRow>();
  const districts = new Map<string, FakeDistrictRow>();
  const assignments: FakeAssignmentRow[] = [];

  function hydrateOfficer(officerId: string) {
    const officer = officers.get(officerId);
    if (!officer) throw new Error(`no seeded officer ${officerId}`);
    return {
      ...officer,
      assignments: assignments
        .filter((a) => a.officerId === officerId && a.isActive)
        .map((a) => ({ district: districts.get(a.districtId)! })),
    };
  }

  return {
    store: { webAccounts, officers, districts, assignments },
    seedOfficer(officer: FakeOfficerRow) {
      officers.set(officer.id, officer);
    },
    seedDistrict(district: FakeDistrictRow) {
      districts.set(district.id, district);
    },
    seedAssignment(assignment: FakeAssignmentRow) {
      assignments.push(assignment);
    },
    seedWebAccount(account: FakeWebAccountRow) {
      webAccounts.set(account.id, account);
    },
    webAccount: {
      async findUnique({ where }: any) {
        const row = where.id
          ? webAccounts.get(where.id)
          : where.username
            ? [...webAccounts.values()].find((a) => a.username === where.username)
            : where.officerId
              ? [...webAccounts.values()].find((a) => a.officerId === where.officerId)
              : undefined;
        if (!row) return null;
        return { ...row, officer: hydrateOfficer(row.officerId) };
      },
      async findMany() {
        return [...webAccounts.values()]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((row) => ({ ...row, officer: hydrateOfficer(row.officerId) }));
      },
      async update({ where, data }: any) {
        const row = webAccounts.get(where.id);
        if (!row) throw new Error("web account not found");
        // Mirrors Prisma's `{ increment: N }` numeric-field operator (used by
        // webAccountAuth.service.ts's login() for an atomic failedLoginCount bump) — the real
        // client compiles it to `SET x = x + N` at the DB, not a JS-side read-then-write.
        const resolved =
          data.failedLoginCount && typeof data.failedLoginCount === "object" && "increment" in data.failedLoginCount
            ? { ...data, failedLoginCount: row.failedLoginCount + data.failedLoginCount.increment }
            : data;
        const updated = { ...row, ...resolved };
        webAccounts.set(where.id, updated);
        return { ...updated, officer: hydrateOfficer(updated.officerId) };
      },
      async create({ data }: any) {
        const row: FakeWebAccountRow = {
          id: randomUUID(),
          officerId: data.officerId,
          username: data.username,
          passwordHash: data.passwordHash,
          mustChangePassword: data.mustChangePassword ?? true,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
        };
        webAccounts.set(row.id, row);
        return { ...row, officer: hydrateOfficer(row.officerId) };
      },
    },
    officer: {
      async update({ where, data }: any) {
        const row = officers.get(where.id);
        if (!row) throw new Error("officer not found");
        const updated = { ...row, ...data };
        officers.set(where.id, updated);
        return updated;
      },
      async findMany({ select }: any) {
        return [...officers.values()].map((o) => (select ? pick(o, select) : o));
      },
    },
  };
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

export type FakeWebAccountPrisma = ReturnType<typeof createFakeWebAccountPrisma>;

export function seedFullAccount(
  fakePrisma: FakeWebAccountPrisma,
  input: {
    officerId?: string;
    username: string;
    passwordHash: string;
    role?: string;
    fullNameEnc: string;
    unitName?: string | null;
    districtId?: string;
    districtName?: string;
    mustChangePassword?: boolean;
  },
) {
  const officerId = input.officerId ?? randomUUID();
  fakePrisma.seedOfficer({
    id: officerId,
    fullNameEnc: input.fullNameEnc,
    unitName: input.unitName ?? null,
    role: input.role ?? "officer",
  });
  if (input.districtId) {
    fakePrisma.seedDistrict({ id: input.districtId, tenXa: input.districtName ?? "Buôn Ma Thuột" });
    fakePrisma.seedAssignment({ officerId, districtId: input.districtId, isActive: true });
  }
  fakePrisma.seedWebAccount({
    id: randomUUID(),
    officerId,
    username: input.username,
    passwordHash: input.passwordHash,
    mustChangePassword: input.mustChangePassword ?? true,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
  });
  return officerId;
}

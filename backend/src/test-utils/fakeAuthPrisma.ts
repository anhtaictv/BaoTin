import { randomUUID } from "node:crypto";

/**
 * Minimal in-memory fake implementing only the Prisma delegate methods auth.service.ts
 * calls (user/officer/otpChallenge/refreshToken + $transaction). Shared by the service-level
 * and HTTP-level auth tests so both exercise identical fake semantics.
 */
export function createFakeAuthPrisma() {
  const users = new Map<string, any>();
  const officers = new Map<string, any>();
  const otpChallenges = new Map<string, any>();
  const refreshTokens = new Map<string, any>();

  return {
    store: { users, officers, otpChallenges, refreshTokens },
    user: {
      async upsert({ where, create }: any) {
        const existing = [...users.values()].find((u) => u.phoneHash === where.phoneHash);
        if (existing) return existing;
        const user = { id: randomUUID(), verifiedAt: null, ...create };
        users.set(user.id, user);
        return user;
      },
      async findUnique({ where }: any) {
        if (where.phoneHash) return [...users.values()].find((u) => u.phoneHash === where.phoneHash) ?? null;
        return users.get(where.id) ?? null;
      },
      async update({ where, data }: any) {
        const user = users.get(where.id);
        Object.assign(user, data);
        return user;
      },
    },
    officer: {
      async findUnique({ where }: any) {
        return [...officers.values()].find((o) => o.phoneHash === where.phoneHash) ?? null;
      },
      async findUniqueOrThrow({ where }: any) {
        const officer = officers.get(where.id);
        if (!officer) throw new Error("not found");
        return officer;
      },
    },
    otpChallenge: {
      async create({ data }: any) {
        const row = { id: randomUUID(), attemptCount: 0, consumedAt: null, createdAt: new Date(), ...data };
        otpChallenges.set(row.id, row);
        return row;
      },
      async findFirst({ where }: any) {
        const candidates = [...otpChallenges.values()]
          .filter(
            (c) =>
              c.subjectType === where.subjectType &&
              c.userId === where.userId &&
              c.officerId === where.officerId &&
              c.consumedAt === null &&
              c.expiresAt > new Date(),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return candidates[0] ?? null;
      },
      async update({ where, data }: any) {
        const row = otpChallenges.get(where.id);
        if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
        if ("consumedAt" in data) row.consumedAt = data.consumedAt;
        return row;
      },
      async updateMany({ where, data }: any) {
        const row = otpChallenges.get(where.id);
        if (!row) return { count: 0 };
        if (where.attemptCount?.lt !== undefined && !(row.attemptCount < where.attemptCount.lt)) {
          return { count: 0 };
        }
        if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
        return { count: 1 };
      },
    },
    refreshToken: {
      async create({ data }: any) {
        const row = { id: randomUUID(), revokedAt: null, ...data };
        refreshTokens.set(row.id, row);
        return row;
      },
      async findUnique({ where }: any) {
        return [...refreshTokens.values()].find((t) => t.tokenHash === where.tokenHash) ?? null;
      },
      async update({ where, data }: any) {
        const row = refreshTokens.get(where.id);
        Object.assign(row, data);
        return row;
      },
      async updateMany({ where, data }: any) {
        if (where.id) {
          const row = refreshTokens.get(where.id);
          if (!row || (where.revokedAt === null && row.revokedAt !== null)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        }
        let count = 0;
        for (const row of refreshTokens.values()) {
          const matchesSubject = where.userId ? row.userId === where.userId : row.officerId === where.officerId;
          if (matchesSubject && row.revokedAt === null) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
    },
    async $transaction(ops: Promise<unknown>[]) {
      return Promise.all(ops);
    },
  };
}

export type FakeAuthPrisma = ReturnType<typeof createFakeAuthPrisma>;

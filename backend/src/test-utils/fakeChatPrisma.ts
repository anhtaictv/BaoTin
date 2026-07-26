import { randomUUID } from "node:crypto";

export interface FakeChatOfficer {
  id: string;
  fullNameEnc: string;
  role: string;
  approvalStatus: string;
}

export interface FakeChatAssignment {
  officerId: string;
  districtId: string;
  isActive: boolean;
}

export interface FakeChatDistrict {
  id: string;
  tenXa: string;
}

export interface FakeChatMessage {
  id: string;
  channelType: string;
  districtId: string | null;
  senderId: string;
  content: string;
  createdAt: Date;
}

/** Fake Prisma covering chat.service.ts + districtScope.ts's needs. */
export function createFakeChatPrisma() {
  const officers = new Map<string, FakeChatOfficer>();
  const assignments: FakeChatAssignment[] = [];
  const districts = new Map<string, FakeChatDistrict>();
  const messages: FakeChatMessage[] = [];

  function joinSender(msg: FakeChatMessage, select?: Record<string, boolean>) {
    const officer = officers.get(msg.senderId);
    const sender = officer ? pick(officer, select ?? { fullNameEnc: true, role: true }) : null;
    return { ...msg, sender };
  }

  return {
    store: { officers, assignments, districts, messages },
    seedOfficer(officer: FakeChatOfficer) {
      officers.set(officer.id, officer);
    },
    seedAssignment(assignment: FakeChatAssignment) {
      assignments.push(assignment);
    },
    seedDistrict(district: FakeChatDistrict) {
      districts.set(district.id, district);
    },

    officer: {
      async findMany({ where, select }: any) {
        return [...officers.values()]
          .filter((o) => {
            if (where?.approvalStatus && o.approvalStatus !== where.approvalStatus) return false;
            if (where?.role?.in && !where.role.in.includes(o.role)) return false;
            if (typeof where?.role === "string" && o.role !== where.role) return false;
            return true;
          })
          .map((o) => (select ? pick(o, select) : o));
      },
    },

    officerDistrictAssignment: {
      async findMany({ where, select, distinct }: any) {
        let rows = assignments.filter((a) => {
          if (where?.officerId && a.officerId !== where.officerId) return false;
          if (where?.districtId && a.districtId !== where.districtId) return false;
          if (where?.isActive !== undefined && a.isActive !== where.isActive) return false;
          return true;
        });
        if (distinct?.includes("districtId")) {
          const seen = new Set<string>();
          rows = rows.filter((a) => (seen.has(a.districtId) ? false : (seen.add(a.districtId), true)));
        }
        return rows.map((a) => (select ? pick(a, select) : a));
      },
    },

    district: {
      async findMany({ where, select }: any) {
        const ids: string[] | undefined = where?.id?.in;
        return [...districts.values()]
          .filter((d) => !ids || ids.includes(d.id))
          .map((d) => (select ? pick(d, select) : d));
      },
      async findUnique({ where, select }: any) {
        const d = districts.get(where.id);
        return d ? (select ? pick(d, select) : d) : null;
      },
    },

    chatMessage: {
      async create({ data, include }: any) {
        const row: FakeChatMessage = {
          id: randomUUID(),
          channelType: data.channelType,
          districtId: data.districtId ?? null,
          senderId: data.senderId,
          content: data.content,
          // +messages.length keeps createdAt strictly increasing even when two messages are
          // created within the same millisecond (real Postgres timestamps are millisecond-
          // precision too, so this mirrors a real ordering guarantee, not just a test crutch).
          createdAt: new Date(Date.now() + messages.length),
        };
        messages.push(row);
        return include?.sender ? joinSender(row, include.sender.select) : row;
      },
      async findFirst({ where, orderBy, include }: any) {
        const matches = filterMessages(messages, where).sort(sortByCreatedAt(orderBy));
        const row = matches[0];
        if (!row) return null;
        return include?.sender ? joinSender(row, include.sender.select) : row;
      },
      async findMany({ where, orderBy, take, include }: any) {
        const matches = filterMessages(messages, where).sort(sortByCreatedAt(orderBy));
        const sliced = typeof take === "number" ? matches.slice(0, take) : matches;
        return sliced.map((row) => (include?.sender ? joinSender(row, include.sender.select) : row));
      },
    },
  };
}

function filterMessages(messages: FakeChatMessage[], where: any): FakeChatMessage[] {
  return messages.filter((m) => {
    if (where?.channelType && m.channelType !== where.channelType) return false;
    if ("districtId" in (where ?? {}) && m.districtId !== where.districtId) return false;
    if (where?.createdAt?.lt && !(m.createdAt < where.createdAt.lt)) return false;
    return true;
  });
}

function sortByCreatedAt(orderBy: any) {
  const dir = orderBy?.createdAt === "asc" ? 1 : -1;
  return (a: FakeChatMessage, b: FakeChatMessage) => dir * (a.createdAt.getTime() - b.createdAt.getTime());
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(select) as (keyof T)[]) {
    if (select[key as string]) out[key] = obj[key];
  }
  return out;
}

export type FakeChatPrisma = ReturnType<typeof createFakeChatPrisma>;

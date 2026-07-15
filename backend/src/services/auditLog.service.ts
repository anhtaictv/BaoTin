import type { PrismaClient } from "@prisma/client";

export interface AuditLogTarget {
  type: string;
  id: string;
}

/** SECURITY.md §1.4: "Admin có audit log riêng cho mọi thao tác nhạy cảm". */
export function createAuditLogService(prisma: PrismaClient) {
  async function record(
    officerId: string,
    action: string,
    target?: AuditLogTarget,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.adminAuditLog.create({
      data: {
        officerId,
        action,
        targetType: target?.type,
        targetId: target?.id,
        metadata: metadata ? (metadata as never) : undefined,
      },
    });
  }

  return { record };
}

export type AuditLogService = ReturnType<typeof createAuditLogService>;

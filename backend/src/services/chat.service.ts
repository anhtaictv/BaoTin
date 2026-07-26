import type { PrismaClient } from "@prisma/client";
import { decryptField } from "../crypto/aesGcm.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { DistrictScopeService, DistrictScopeSubject } from "../middleware/districtScope.js";
import type { NotificationService } from "../notifications/notification.service.js";

export type ChatChannelType = "general" | "district";

export interface ChatDeps {
  prisma: PrismaClient;
  districtScope: DistrictScopeService;
  notifications: NotificationService;
  piiEncryptionKey: string;
}

export interface ChatMessageResult {
  id: string;
  channelType: ChatChannelType;
  districtId: string | null;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: Date;
}

export interface ChatChannelSummary {
  channelType: ChatChannelType;
  districtId: string | null;
  /** null for the general channel — its label is a fixed string on the client ("Chung"). */
  districtName: string | null;
  lastMessage: Pick<ChatMessageResult, "content" | "senderName" | "createdAt"> | null;
}

export interface ListChatMessagesFilters {
  channelType: ChatChannelType;
  districtId?: string;
  before?: Date;
  limit?: number;
}

export interface SendChatMessageInput {
  channelType: ChatChannelType;
  districtId?: string;
  content: string;
}

const UNRESTRICTED_ROLES = new Set(["senior_officer", "admin"]);
const DEFAULT_MESSAGE_LIMIT = 50;

/**
 * Liên lạc giữa các đơn vị — "chat chung" (mọi cán bộ) + "chat riêng từng đơn vị" (đơn vị đó
 * + admin/senior_officer), CLAUDE.md-adjacent product ask from anh (2026-07-26): a bottom-nav
 * tab purely for cross-unit notification, not a report/evidence channel — never touches
 * Report/SocialMediaSignal. Access re-derives district assignment the same way as everything
 * else district-scoped (districtScope.ts) rather than trusting anything client-supplied.
 */
export function createChatService(deps: ChatDeps) {
  async function assertChannelAccess(
    subject: DistrictScopeSubject,
    channelType: ChatChannelType,
    districtId: string | null,
  ): Promise<void> {
    if (channelType === "general") return;
    if (!districtId) throw new HttpError(400, "VALIDATION_ERROR", "Thiếu districtId cho kênh riêng của đơn vị.");
    await deps.districtScope.assertDistrictAccess(subject, districtId);
  }

  /** Districts this subject may see a private channel for — every assigned district for a
   * regular officer, every district that currently has an assigned officer for admin/
   * senior_officer (an unbounded per-district channel list for the entire ward table would be
   * mostly noise otherwise). */
  async function accessibleDistrictIds(subject: DistrictScopeSubject): Promise<string[]> {
    if (!UNRESTRICTED_ROLES.has(subject.role)) {
      return deps.districtScope.getAllowedDistrictIds(subject.id);
    }
    const rows = await deps.prisma.officerDistrictAssignment.findMany({
      where: { isActive: true },
      select: { districtId: true },
      distinct: ["districtId"],
    });
    return rows.map((r) => r.districtId);
  }

  /** Every officer id allowed to read/write this channel — used to fan out the "new message"
   * push to everyone except the sender. */
  async function channelMemberIds(channelType: ChatChannelType, districtId: string | null): Promise<string[]> {
    if (channelType === "general") {
      const officers = await deps.prisma.officer.findMany({
        where: { approvalStatus: "approved" },
        select: { id: true },
      });
      return officers.map((o) => o.id);
    }

    const [assigned, unrestricted] = await Promise.all([
      deps.prisma.officerDistrictAssignment.findMany({
        where: { districtId: districtId!, isActive: true },
        select: { officerId: true },
      }),
      deps.prisma.officer.findMany({
        where: { approvalStatus: "approved", role: { in: ["admin", "senior_officer"] } },
        select: { id: true },
      }),
    ]);
    return [...new Set([...assigned.map((a) => a.officerId), ...unrestricted.map((o) => o.id)])];
  }

  function decryptSender(sender: { fullNameEnc: string; role: string }): { name: string; role: string } {
    return { name: decryptField(sender.fullNameEnc, deps.piiEncryptionKey), role: sender.role };
  }

  async function listChannels(subject: DistrictScopeSubject): Promise<ChatChannelSummary[]> {
    const districtIds = await accessibleDistrictIds(subject);
    const districts = districtIds.length
      ? await deps.prisma.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, tenXa: true } })
      : [];
    const nameById = new Map(districts.map((d) => [d.id, d.tenXa]));

    const channelKeys: Array<{ channelType: ChatChannelType; districtId: string | null }> = [
      { channelType: "general", districtId: null },
      ...districtIds.map((id) => ({ channelType: "district" as const, districtId: id })),
    ];

    const summaries = await Promise.all(
      channelKeys.map(async (key) => {
        const last = await deps.prisma.chatMessage.findFirst({
          where: { channelType: key.channelType, districtId: key.districtId },
          orderBy: { createdAt: "desc" },
          include: { sender: { select: { fullNameEnc: true, role: true } } },
        });
        const summary: ChatChannelSummary = {
          channelType: key.channelType,
          districtId: key.districtId,
          districtName: key.districtId ? (nameById.get(key.districtId) ?? null) : null,
          lastMessage: last
            ? { content: last.content, senderName: decryptSender(last.sender).name, createdAt: last.createdAt }
            : null,
        };
        return summary;
      }),
    );

    // Most recently active first; channels with no messages yet keep their original order
    // (general first, then districts) at the tail.
    return summaries.sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? -1) - (a.lastMessage?.createdAt.getTime() ?? -1));
  }

  async function listMessages(
    subject: DistrictScopeSubject,
    filters: ListChatMessagesFilters,
  ): Promise<ChatMessageResult[]> {
    await assertChannelAccess(subject, filters.channelType, filters.districtId ?? null);

    const rows = await deps.prisma.chatMessage.findMany({
      where: {
        channelType: filters.channelType,
        districtId: filters.channelType === "district" ? filters.districtId : null,
        ...(filters.before ? { createdAt: { lt: filters.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filters.limit ?? DEFAULT_MESSAGE_LIMIT, 100),
      include: { sender: { select: { fullNameEnc: true, role: true } } },
    });

    return rows.map((row) => {
      const sender = decryptSender(row.sender);
      return {
        id: row.id,
        channelType: row.channelType as ChatChannelType,
        districtId: row.districtId,
        senderId: row.senderId,
        senderName: sender.name,
        senderRole: sender.role,
        content: row.content,
        createdAt: row.createdAt,
      };
    });
  }

  async function sendMessage(subject: DistrictScopeSubject, input: SendChatMessageInput): Promise<ChatMessageResult> {
    const districtId = input.channelType === "district" ? (input.districtId ?? null) : null;
    await assertChannelAccess(subject, input.channelType, districtId);

    const row = await deps.prisma.chatMessage.create({
      data: { channelType: input.channelType, districtId, senderId: subject.id, content: input.content },
      include: { sender: { select: { fullNameEnc: true, role: true } } },
    });
    const sender = decryptSender(row.sender);

    const district = districtId
      ? await deps.prisma.district.findUnique({ where: { id: districtId }, select: { tenXa: true } })
      : null;
    const channelLabel = district?.tenXa ?? "Chung";

    const memberIds = await channelMemberIds(input.channelType, districtId);
    const preview = input.content.length > 120 ? `${input.content.slice(0, 117)}...` : input.content;
    await Promise.all(
      memberIds
        .filter((id) => id !== subject.id)
        .map((id) => deps.notifications.notifyOfficerOfChatMessage(id, sender.name, channelLabel, preview)),
    );

    return {
      id: row.id,
      channelType: row.channelType as ChatChannelType,
      districtId: row.districtId,
      senderId: row.senderId,
      senderName: sender.name,
      senderRole: sender.role,
      content: row.content,
      createdAt: row.createdAt,
    };
  }

  return { listChannels, listMessages, sendMessage };
}

export type ChatService = ReturnType<typeof createChatService>;

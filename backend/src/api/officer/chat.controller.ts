import type { Request, Response } from "express";
import type { ChatService, ChatChannelType } from "../../services/chat.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createChatController(service: ChatService) {
  return {
    async listChannels(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const channels = await service.listChannels(req.user);
      res.status(200).json({ success: true, data: channels, error: null });
    },

    async listMessages(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { channel_type, district_id, before, limit } = req.query as unknown as {
        channel_type: ChatChannelType;
        district_id?: string;
        before?: Date;
        limit?: number;
      };
      const messages = await service.listMessages(req.user, {
        channelType: channel_type,
        districtId: district_id,
        before,
        limit,
      });
      res.status(200).json({ success: true, data: messages, error: null });
    },

    async sendMessage(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { channelType, districtId, content } = req.body as {
        channelType: ChatChannelType;
        districtId?: string;
        content: string;
      };
      const message = await service.sendMessage(req.user, { channelType, districtId, content });
      res.status(201).json({ success: true, data: message, error: null });
    },
  };
}

export type ChatController = ReturnType<typeof createChatController>;

import type { Request, Response } from "express";
import type { EmergencyContactsService } from "../../services/emergencyContacts.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createEmergencyContactsController(service: EmergencyContactsService) {
  return {
    async get(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { lat, lng } = req.query as unknown as { lat: number; lng: number };
      const contacts = await service.getEmergencyContacts({ lat, lng });
      res.status(200).json({ success: true, data: contacts, error: null });
    },
  };
}

export type EmergencyContactsController = ReturnType<typeof createEmergencyContactsController>;

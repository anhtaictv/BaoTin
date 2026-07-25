import type { Request, Response } from "express";
import type { AccountRegistrationService } from "../../services/accountRegistration.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

type CccdFiles = { cccdFront?: Express.Multer.File[]; cccdBack?: Express.Multer.File[] };

export function createRegistrationController(service: AccountRegistrationService) {
  return {
    async registerCitizen(req: Request, res: Response) {
      const files = req.files as CccdFiles | undefined;
      const cccdFront = files?.cccdFront?.[0];
      const cccdBack = files?.cccdBack?.[0];
      if (!cccdFront || !cccdBack) {
        throw new HttpError(400, "MISSING_CCCD_PHOTO", "Vui lòng chụp đủ ảnh CCCD mặt trước và mặt sau.");
      }

      const { username, password, fullName, phoneNumber, cccdNumber, address } = req.body as {
        username: string;
        password: string;
        fullName: string;
        phoneNumber: string;
        cccdNumber: string;
        address: string;
      };

      const tokens = await service.registerCitizen({
        username,
        password,
        fullName,
        phoneNumber,
        cccdNumber,
        address,
        cccdFront: { buffer: cccdFront.buffer, mimetype: cccdFront.mimetype },
        cccdBack: { buffer: cccdBack.buffer, mimetype: cccdBack.mimetype },
      });

      res.status(201).json({ success: true, data: tokens, error: null });
    },

    async loginCitizen(req: Request, res: Response) {
      const { username, password } = req.body as { username: string; password: string };
      const tokens = await service.loginCitizen(username, password);
      res.status(200).json({ success: true, data: tokens, error: null });
    },

    async changeCitizenPassword(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
      await service.changeCitizenPassword(req.user.id, oldPassword, newPassword);
      res.status(200).json({ success: true, data: { changed: true }, error: null });
    },

    async registerOfficer(req: Request, res: Response) {
      const { username, password, fullName, phoneNumber, cccdNumber, address } = req.body as {
        username: string;
        password: string;
        fullName: string;
        phoneNumber: string;
        cccdNumber: string;
        address: string;
      };

      const result = await service.registerOfficer({ username, password, fullName, phoneNumber, cccdNumber, address });
      res.status(201).json({ success: true, data: result, error: null });
    },

    async loginOfficer(req: Request, res: Response) {
      const { username, password } = req.body as { username: string; password: string };
      const tokens = await service.loginOfficer(username, password);
      res.status(200).json({ success: true, data: tokens, error: null });
    },

    async changeOfficerPassword(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
      await service.changeOfficerPassword(req.user.id, oldPassword, newPassword);
      res.status(200).json({ success: true, data: { changed: true }, error: null });
    },
  };
}

export type RegistrationController = ReturnType<typeof createRegistrationController>;

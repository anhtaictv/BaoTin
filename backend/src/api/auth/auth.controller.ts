import type { Request, Response } from "express";
import type { AuthService } from "./auth.service.js";
import { HttpError } from "../../middleware/errorHandler.js";

export function createAuthController(authService: AuthService) {
  return {
    async requestOtp(req: Request, res: Response) {
      const { phoneNumber } = req.body as { phoneNumber: string };
      const result = await authService.requestOtpForUser(phoneNumber);
      res.status(200).json({ success: true, data: { otpRequested: true, ...result }, error: null });
    },

    async verifyOtp(req: Request, res: Response) {
      const { phoneNumber, otp } = req.body as { phoneNumber: string; otp: string };
      const tokens = await authService.verifyOtpForUser(phoneNumber, otp);
      res.status(200).json({ success: true, data: tokens, error: null });
    },

    async officerLogin(req: Request, res: Response) {
      const { phoneNumber, otp } = req.body as { phoneNumber: string; otp?: string };
      const result = await authService.officerLogin(phoneNumber, otp);
      res.status(200).json({ success: true, data: result, error: null });
    },

    async refresh(req: Request, res: Response) {
      const { refreshToken } = req.body as { refreshToken: string };
      const tokens = await authService.rotateRefreshToken(refreshToken);
      res.status(200).json({ success: true, data: tokens, error: null });
    },

    async revokeAllSessions(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const subjectType = req.user.role === "citizen" ? "user" : "officer";
      await authService.revokeAllSessions(subjectType, req.user.id);
      res.status(200).json({ success: true, data: { revoked: true }, error: null });
    },

    async registerDeviceToken(req: Request, res: Response) {
      if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Thiếu access token.");
      const { fcmToken } = req.body as { fcmToken: string };
      const subjectType = req.user.role === "citizen" ? "user" : "officer";
      await authService.registerDeviceToken(subjectType, req.user.id, fcmToken);
      res.status(200).json({ success: true, data: { registered: true }, error: null });
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;

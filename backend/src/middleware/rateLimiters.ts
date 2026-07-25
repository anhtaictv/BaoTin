import rateLimit from "express-rate-limit";
import type { Request } from "express";

function rateLimitedResponse(code: string, message: string) {
  return { success: false, data: null, error: { code, message } };
}

/** phone_number + IP key, so one abusive IP can't lock out unrelated phone numbers and vice versa. */
function phoneAndIpKey(req: Request): string {
  const phone = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : "unknown";
  return `${req.ip}:${phone}`;
}

/** SECURITY.md §1.2 — max 3 OTP sends / 10 min / phone number. */
export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: phoneAndIpKey,
  message: rateLimitedResponse(
    "OTP_REQUEST_RATE_LIMITED",
    "Đã gửi quá số lần OTP cho phép, vui lòng thử lại sau.",
  ),
});

/** SECURITY.md §1.2 — lockout after 5 wrong OTP attempts / 15 min / phone number. */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: phoneAndIpKey,
  message: rateLimitedResponse(
    "OTP_VERIFY_RATE_LIMITED",
    "Nhập sai OTP quá nhiều lần, tài khoản tạm khóa 15 phút.",
  ),
});

/** SECURITY.md §3 — rate limiting theo IP + theo tài khoản (phoneAndIpKey, not raw req.ip):
 * nhiều cán bộ cùng đăng nhập từ cùng 1 mạng cơ quan (chung 1 IP ra ngoài) không được dùng
 * chung 1 "ngân sách" 10 lần/15 phút — mỗi số điện thoại có ngân sách riêng, IP chỉ chặn khi
 * một số điện thoại cụ thể bị dò từ IP đó. */
export const officerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: phoneAndIpKey,
  message: rateLimitedResponse("LOGIN_RATE_LIMITED", "Đăng nhập sai quá nhiều lần, thử lại sau."),
});

/** dashboard-web-react's username/password login — same IP-based ceiling as officerLoginLimiter;
 * per-account lockout is handled separately in webAccountAuth.service.ts's login(). */
function usernameAndIpKey(req: Request): string {
  const username = typeof req.body?.username === "string" ? req.body.username : "unknown";
  return `${req.ip}:${username}`;
}

export const webLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: usernameAndIpKey,
  message: rateLimitedResponse("LOGIN_RATE_LIMITED", "Đăng nhập sai quá nhiều lần, thử lại sau."),
});

/** Citizen/officer self-registration (registration.routes.ts) — IP-keyed, generous enough for
 * a real user retrying a typo'd form but bounds spam account creation. */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: rateLimitedResponse("REGISTRATION_RATE_LIMITED", "Quá nhiều lần đăng ký, vui lòng thử lại sau."),
});

/**
 * SECURITY.md §3 — "mọi endpoint auth", including /auth/refresh. Refresh tokens are
 * high-entropy opaque values (tokenHash.ts: 256-bit random) so brute-forcing one is
 * infeasible regardless of this limit; this bounds request volume/DoS rather than guessing.
 * Generous relative to login (refresh happens automatically, often from multiple tabs/devices
 * per person) but still caps abuse from a single IP.
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: rateLimitedResponse("REFRESH_RATE_LIMITED", "Quá nhiều yêu cầu làm mới phiên đăng nhập, thử lại sau."),
});

/**
 * API_SPEC.md explicitly requires /reports/emergency NOT be slowed down by validation.
 * express-rate-limit's default MemoryStore check is an in-process counter increment —
 * no synchronous DB round-trip — so this adds negligible latency to the SOS path while
 * still bounding abuse. Deliberately generous (10/min/IP) — the cost of a false block on
 * a genuine emergency far outweighs the cost of a little spam tolerance.
 */
export const emergencyReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: rateLimitedResponse(
    "EMERGENCY_RATE_LIMITED",
    "Quá nhiều yêu cầu cấp cứu từ thiết bị này trong thời gian ngắn.",
  ),
});

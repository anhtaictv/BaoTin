import { isAxiosError } from 'axios';

/** Every backend error response follows `{ success: false, data: null, error: { code, message } }`
 * (see backend/src/middleware/errorHandler.ts) — this pulls out the Vietnamese message for
 * direct display, falling back to a generic string for network errors/unexpected shapes. */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

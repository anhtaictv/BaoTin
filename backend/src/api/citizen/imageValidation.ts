import exifr from "exifr";
import sharp from "sharp";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "heif"]);

export interface ImageValidationResult {
  valid: boolean;
  reason?: string;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Re-validates the *actual* image content (decodes via sharp) rather than trusting the
 * client-reported mimetype — SECURITY.md §5 "không tin metadata client gửi lên mà không
 * kiểm tra lại". Does not re-encode the buffer, so EXIF is untouched for the later
 * extraction step / the bytes we hand to MinIO are the citizen's original photo.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<ImageValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      return { valid: false, reason: `Định dạng ảnh không được hỗ trợ: ${metadata.format ?? "unknown"}` };
    }
    return { valid: true, width: metadata.width, height: metadata.height, format: metadata.format };
  } catch {
    return { valid: false, reason: "File không phải ảnh hợp lệ hoặc đã bị hỏng." };
  }
}

export interface ExifGps {
  lat: number;
  lng: number;
}

/**
 * Independently re-derives EXIF GPS server-side (never trusts only what the client
 * asserted as location_source) — see ARCHITECTURE.md / plan notes on report_attachments.
 * Many phones strip GPS from camera EXIF by default, so `null` is an expected, common
 * outcome, not an error — callers should fall back to the client-submitted device GPS.
 */
export async function extractExifGps(buffer: Buffer): Promise<ExifGps | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") {
      return null;
    }
    return { lat: gps.latitude, lng: gps.longitude };
  } catch {
    return null;
  }
}

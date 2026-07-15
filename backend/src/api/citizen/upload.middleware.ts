import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

/**
 * Memory storage only — files never touch disk before validateImageBuffer/extractExifGps
 * run, and nothing is written to MinIO until that validation passes. This is a client-
 * asserted mimetype filter only (fast reject of obviously wrong uploads); the authoritative
 * check is imageValidation.ts's sharp-based re-decode.
 */
export const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`Định dạng file không được hỗ trợ: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
}).array("attachments", MAX_FILES);

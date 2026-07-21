import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

/** Memory storage only, same rationale as citizen/upload.middleware.ts. */
export const uploadWantedNoticePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`Định dạng file không được hỗ trợ: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
}).single("photo");

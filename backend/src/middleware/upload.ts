import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads/docs";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Map allowed MIME types to safe file extensions so we never trust the
// user-supplied originalname extension (which could be .html, .svg, .exe, etc.)
const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        const ext = MIME_TO_EXT[file.mimetype] ?? path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB per file per PRD
        files: 10 // Maximum 10 files per request to prevent abuse
    },
    fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPG, PNG, WEBP, MP4, and WEBM are allowed.") as any);
        }
    }
});
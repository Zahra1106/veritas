const multer = require('multer');

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
  cb(null, true);
}

const maxSizeBytes = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 50) * 1024 * 1024;

// Memory storage (not disk) — required because Vercel's filesystem is
// read-only/ephemeral in production. The buffer is hashed, scanned for
// metadata, and then streamed straight to Cloudinary without ever
// touching local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: maxSizeBytes }
});

module.exports = upload;
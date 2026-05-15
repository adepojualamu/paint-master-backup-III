// ============================
// File upload middleware. Wraps multer (when installed) and applies our
// own size/type policy. Falls back to a no-op error if multer isn't present.
// To enable: `npm install multer`.
// ============================

const path   = require('path');
const config = require('../config');

let upload;
try {
  // eslint-disable-next-line node/no-missing-require
  const multer = require('multer');

  const storage = config.uploads.driver === 'local'
    ? multer.diskStorage({
        destination: config.uploads.localDir,
        filename: (_req, file, cb) => {
          const ext  = path.extname(file.originalname);
          const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
          cb(null, safe + ext.toLowerCase());
        },
      })
    : multer.memoryStorage();   // S3/R2 path: services/uploads.js streams it out

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 8 },   // 5 MB / max 8 per request
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      cb(allowed.includes(file.mimetype) ? null : new Error('Unsupported file type'), allowed.includes(file.mimetype));
    },
  });
} catch (_) {
  upload = {
    single: () => (_req, _res, next) => next(new Error('Uploads not enabled — run `npm install multer`.')),
    array:  () => (_req, _res, next) => next(new Error('Uploads not enabled — run `npm install multer`.')),
  };
}

module.exports = upload;

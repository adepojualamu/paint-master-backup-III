// ============================
// services/uploads.js — abstracted file storage.
// Three drivers: 'local' (default, for dev), 's3', 'r2'.
// Returns a public URL the client can render directly.
// STATUS: 'local' implemented; s3/r2 are skeletons.
// ============================

const fs     = require('fs');
const path   = require('path');
const config = require('../config');
const { badRequest } = require('../utils/errors');

async function store({ buffer, originalName, mimeType, prefix = 'misc' }) {
  if (!buffer && !originalName) throw badRequest('buffer or filename required');

  const ext  = path.extname(originalName || '').toLowerCase();
  const safe = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;

  if (config.uploads.driver === 'local') {
    const dest = path.join(config.uploads.localDir, safe);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (buffer) fs.writeFileSync(dest, buffer);
    return {
      url:  joinUrl(config.uploads.publicUrl || '/uploads', safe),
      key:  safe,
      driver: 'local',
    };
  }

  // TODO: s3 / r2
  //   const s3 = new S3Client({ region: config.uploads.s3Region });
  //   await s3.send(new PutObjectCommand({ Bucket: ..., Key: safe, Body: buffer, ContentType: mimeType }));
  void mimeType;
  throw new Error(`Uploads driver "${config.uploads.driver}" not implemented yet.`);
}

function joinUrl(base, key) {
  return base.replace(/\/$/, '') + '/' + key.replace(/^\//, '');
}

module.exports = { store };

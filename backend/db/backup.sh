#!/usr/bin/env bash
# ============================
# Nightly SQLite backup. Schedule via cron:
#   0 2 * * *  /opt/paintgh/backend/db/backup.sh >> /var/log/paintgh-backup.log 2>&1
# ============================

set -euo pipefail

DB_PATH="${DB_PATH:-./paintgh.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$BACKUP_DIR/paintgh-$STAMP.db"

# Use SQLite's online backup API — safe while server is running.
sqlite3 "$DB_PATH" ".backup '$DEST'"
gzip -9 "$DEST"

echo "Backed up to ${DEST}.gz"

# Prune anything older than RETAIN_DAYS
find "$BACKUP_DIR" -name 'paintgh-*.db.gz' -mtime "+$RETAIN_DAYS" -delete || true

# Optional: push to S3 if AWS_S3_BACKUP_BUCKET is set
if [ -n "${AWS_S3_BACKUP_BUCKET:-}" ]; then
  aws s3 cp "${DEST}.gz" "s3://${AWS_S3_BACKUP_BUCKET}/$(basename "${DEST}.gz")"
fi

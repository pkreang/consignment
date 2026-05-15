#!/usr/bin/env bash
# Daily Postgres backup with retention rotation. Designed to be cron'd:
#
#   0 2 * * *  /app/scripts/backup.sh
#
# Reads connection info from $DATABASE_URL. Writes a gzipped pg_dump to
# $BACKUP_DIR (default /var/backups/consignment), prunes anything older than
# $BACKUP_RETENTION_DAYS (default 14), and exits non-zero if pg_dump fails so
# the cron MTA reports the failure.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/consignment}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/consignment-$STAMP.sql.gz"

echo "==> pg_dump -> $OUT"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$OUT"

if [ ! -s "$OUT" ]; then
  echo "ERROR: backup file is empty" >&2
  rm -f "$OUT"
  exit 1
fi

echo "==> retention: deleting backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'consignment-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "==> done. current backups:"
ls -lh "$BACKUP_DIR" | tail -20

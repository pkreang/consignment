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

# Upload to Oracle Object Storage if oci-cli is configured. Skipped silently
# when OCI_BACKUP_BUCKET is unset (e.g. local dev runs).
if [ -n "${OCI_BACKUP_BUCKET:-}" ] && command -v oci >/dev/null 2>&1; then
  echo "==> upload to oci://$OCI_BACKUP_BUCKET/$(basename "$OUT")"
  oci os object put \
      --bucket-name "$OCI_BACKUP_BUCKET" \
      --name "$(basename "$OUT")" \
      --file "$OUT" \
      --force >/dev/null

  echo "==> bucket retention: deleting objects older than $RETENTION_DAYS days"
  CUTOFF="$(date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ)"
  oci os object list --bucket-name "$OCI_BACKUP_BUCKET" --all \
      --query "data[?\"time-created\" < '$CUTOFF'].name" --raw-output 2>/dev/null \
    | jq -r '.[]?' \
    | while read -r obj; do
        [ -z "$obj" ] && continue
        oci os object delete --bucket-name "$OCI_BACKUP_BUCKET" --name "$obj" --force >/dev/null
      done
fi

echo "==> done. current local backups:"
ls -lh "$BACKUP_DIR" | tail -20

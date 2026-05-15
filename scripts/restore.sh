#!/usr/bin/env bash
# Restore a gzipped pg_dump backup produced by ./backup.sh.
#
# DANGER: this DROPS the public schema before restoring. Run only when you
# really mean it. Confirms by requiring CONFIRM=yes in the environment.
#
# Usage:
#   CONFIRM=yes DATABASE_URL=postgres://... ./scripts/restore.sh path/to/backup.sql.gz

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
FILE="${1:?usage: restore.sh path/to/backup.sql.gz}"

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "Refusing to restore without CONFIRM=yes (this DROPS the public schema)." >&2
  exit 2
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: file not found: $FILE" >&2
  exit 1
fi

echo "==> dropping public schema in $DATABASE_URL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "==> restoring from $FILE"
gunzip -c "$FILE" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

echo "==> restore complete"

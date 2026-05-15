#!/bin/sh
set -e

# Wait until Postgres accepts connections (best effort; container linking should already
# resolve hostnames). Up to ~60 seconds.
if [ -n "${DATABASE_URL:-}" ]; then
  host=$(node -e "const u=new URL(process.env.DATABASE_URL.replace('postgresql','http'));console.log(u.hostname)")
  port=$(node -e "const u=new URL(process.env.DATABASE_URL.replace('postgresql','http'));console.log(u.port||5432)")
  i=0
  while [ "$i" -lt 60 ]; do
    if node -e "require('net').createConnection({host:'$host',port:$port}).on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))" >/dev/null 2>&1; then
      break
    fi
    echo "waiting for db at $host:$port ($i)..."
    sleep 1
    i=$((i + 1))
  done
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying prisma migrations..."
  npx --no-install prisma migrate deploy --schema prisma/schema.prisma
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Running seed..."
  node dist/prisma/seed.js || echo "(seed step failed; continuing)"
fi

echo "Starting: $*"
exec "$@"

#!/bin/sh
set -e
# Create/upgrade tables, seed reference data (idempotent), then start the server.
node scripts/set-provider.mjs
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
exec node node_modules/next/dist/bin/next start -p "${PORT:-3000}" -H 0.0.0.0

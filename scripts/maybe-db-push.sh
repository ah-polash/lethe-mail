#!/bin/sh
# Sync the Prisma schema to the database during deploys only.
#
# Local builds skip this on purpose: dev may point DATABASE_URL at the
# production database, and an unguarded `prisma db push` in `npm run build`
# would push the locally checked-out schema straight into production.
# Set FORCE_DB_PUSH=1 to run it deliberately.
set -e

if [ -n "$VERCEL" ] || [ "$FORCE_DB_PUSH" = "1" ]; then
  echo "[build] running prisma db push..."
  prisma db push
else
  echo "[build] skipping prisma db push (local build). Set FORCE_DB_PUSH=1 to override."
fi

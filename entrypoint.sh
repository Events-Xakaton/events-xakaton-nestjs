#!/bin/sh
set -e

echo "→ Applying database schema..."
npm run prisma:push -- --accept-data-loss

echo "→ Seeding database..."
npm run seed

echo "→ Starting application..."
exec node dist/main.js

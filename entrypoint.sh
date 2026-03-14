#!/bin/sh
set -e

echo "→ Applying database migrations..."
npm run prisma:deploy

echo "→ Seeding database..."
npm run seed

echo "→ Starting application..."
exec node dist/main.js

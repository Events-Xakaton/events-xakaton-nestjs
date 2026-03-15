#!/bin/sh
set -e

# Если volume примонтирован пустым (первый запуск), восстанавливаем seed-баннеры
if [ -z "$(ls -A /app/static/banners 2>/dev/null)" ]; then
  echo "→ Initializing banners volume from seed..."
  cp -r /app/static-seed/banners/. /app/static/banners/
fi

echo "→ Applying database schema..."
npm run prisma:push -- --accept-data-loss

echo "→ Starting application..."
exec node dist/main.js

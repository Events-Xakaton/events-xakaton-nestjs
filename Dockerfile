# ─── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

RUN npm config set strict-ssl false

COPY package*.json ./
# Принудительная установка всех зависимостей (включая devDeps для ts-node seed)
RUN npm install -f

# ─── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Генерируем Prisma Client под текущую платформу (Debian, native → debian-openssl-3.0.x)
RUN npm run prisma:generate
RUN npm run build

# ─── Stage 3: Runtime ──────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# libjemalloc2 — оптимизация аллокатора памяти (обязателен)
# openssl — нужен Prisma query engine на Debian
RUN apt-get update \
    && apt-get install -y --no-install-recommends libjemalloc2 openssl \
    && rm -rf /var/lib/apt/lists/*

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV NODE_ENV=production

# Скомпилированное приложение
COPY --from=build /app/dist ./dist

# Все node_modules: devDeps нужны для ts-node (npm run seed)
COPY --from=build /app/node_modules ./node_modules

# Исходники Prisma: schema (миграции) + seed.ts
COPY --from=build /app/src/prisma ./src/prisma

# tsconfig нужен ts-node для разрешения path aliases (@shared/*, и т.д.)
COPY --from=build /app/tsconfig.json ./tsconfig.json

# package.json нужен для npm run prisma:deploy и npm run seed
COPY --from=build /app/package.json ./package.json

# Статические файлы: иконки достижений + seed-баннеры
# static-seed/ — эталонная копия, не перекрывается volume-монтированием
COPY static/ static/
COPY static/ static-seed/

COPY entrypoint.sh ./entrypoint.sh
# Убираем Windows CRLF → LF, иначе #!/bin/sh не распознаётся на Linux
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/bin/sh", "entrypoint.sh"]
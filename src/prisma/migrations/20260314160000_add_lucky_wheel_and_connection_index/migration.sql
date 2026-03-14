-- Индекс для запросов "кто подписан на пользователя"
CREATE INDEX "Connection_followedUserId_idx" ON "Connection"("followedUserId");

-- Таблица дневного лимита механики "Мне повезёт"
CREATE TABLE "LuckyWheelUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "usedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LuckyWheelUsage_pkey" PRIMARY KEY ("id")
);

-- Уникальность: один запуск на пользователя в день
CREATE UNIQUE INDEX "LuckyWheelUsage_userId_dayKey_key" ON "LuckyWheelUsage"("userId", "dayKey");

CREATE INDEX "LuckyWheelUsage_userId_idx" ON "LuckyWheelUsage"("userId");

ALTER TABLE "LuckyWheelUsage" ADD CONSTRAINT "LuckyWheelUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

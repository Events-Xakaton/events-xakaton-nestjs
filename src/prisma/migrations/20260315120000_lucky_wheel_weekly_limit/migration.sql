-- Миграция: недельный лимит Lucky Wheel (dayKey → weekKey)
-- Существующие строки очищаем — тестовые данные, корректное weekKey не восстановить.

DELETE FROM "LuckyWheelUsage";

ALTER TABLE "LuckyWheelUsage" DROP COLUMN "dayKey";
ALTER TABLE "LuckyWheelUsage" ADD COLUMN "weekKey" TEXT NOT NULL DEFAULT '';

-- Убираем временный DEFAULT после добавления столбца
ALTER TABLE "LuckyWheelUsage" ALTER COLUMN "weekKey" DROP DEFAULT;

DROP INDEX IF EXISTS "LuckyWheelUsage_userId_dayKey_key";
CREATE UNIQUE INDEX "LuckyWheelUsage_userId_weekKey_key" ON "LuckyWheelUsage"("userId", "weekKey");

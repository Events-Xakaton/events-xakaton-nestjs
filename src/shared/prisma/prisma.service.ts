import { PrismaClient } from '@prisma/client';

/**
 * DI-токен для инжектирования Prisma в компоненты приложения.
 *
 * Реальный экземпляр создаётся фабрикой в PrismaModule через $extends (Prisma v5),
 * что позволяет перехватывать все запросы к БД для сбора метрик.
 * Класс намеренно пустой — используется только как тип и injection token.
 */
export class PrismaService extends PrismaClient {}

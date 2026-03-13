import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '@shared/prisma';

type AwardParams = {
  userId: string;
  ruleCode: string;
  deltaPoints: number;
  referenceId: string;
  eventId?: string;
  clubId?: string;
};

/**
 * Сервис для управления очками пользователей (Points Ledger).
 *
 * Работает по принципу append-only ledger: каждая транзакция — отдельная строка.
 * Для идемпотентности использует уникальный индекс (userId, ruleCode, referenceId).
 * Откат очков реализован через отрицательную запись (rollback entry).
 */
@Injectable()
export class PointsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Начисляет очки пользователю за действие.
   * Идемпотентен: повторный вызов с тем же referenceId игнорируется (upsert).
   *
   * @param params.ruleCode - код правила начисления (club_create, event_join и т.д.)
   * @param params.referenceId - уникальный ключ транзакции для идемпотентности
   */
  async award(params: AwardParams): Promise<void> {
    await this.prisma.pointsLedger.upsert({
      where: {
        userId_ruleCode_referenceId: {
          userId: params.userId,
          ruleCode: params.ruleCode,
          referenceId: params.referenceId,
        },
      },
      update: {},
      create: {
        userId: params.userId,
        ruleCode: params.ruleCode,
        deltaPoints: params.deltaPoints,
        eventId: params.eventId,
        clubId: params.clubId,
        referenceId: params.referenceId,
      },
    });
  }

  /**
   * Откатывает начисление очков по referenceId.
   * Создаёт отрицательную запись (сумма всех строк с этим referenceId * -1).
   * Идемпотентен: если откат уже выполнен — ничего не делает.
   *
   * @param userId
   * @param referenceId
   * @param rollbackRuleCode - код правила для записи отката (event_join_rollback и т.д.)
   */
  async rollbackByReference(
    userId: string,
    referenceId: string,
    rollbackRuleCode: string,
  ): Promise<void> {
    const rows = await this.prisma.pointsLedger.findMany({
      where: { userId, referenceId },
    });
    if (rows.length === 0) {
      return;
    }

    // Проверяем, не был ли откат уже выполнен ранее
    const alreadyRolledBack = await this.prisma.pointsLedger.findFirst({
      where: { userId, ruleCode: rollbackRuleCode, referenceId },
      select: { id: true },
    });
    if (alreadyRolledBack) {
      return;
    }

    const sum = rows.reduce((acc, row) => acc + row.deltaPoints, 0);
    if (sum === 0) {
      return;
    }

    const first = rows[0];
    await this.prisma.pointsLedger.create({
      data: {
        userId,
        ruleCode: rollbackRuleCode,
        deltaPoints: -sum,
        eventId: first.eventId ?? undefined,
        clubId: first.clubId ?? undefined,
        referenceId,
      },
    });
  }
}

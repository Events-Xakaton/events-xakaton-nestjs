import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AppRole } from '@shared/auth';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';

import { AdminUserResDto } from '../dto/response';
import { GetAdminUserQuery } from '../queries';

@QueryHandler(GetAdminUserQuery)
export class GetAdminUserHandler implements IQueryHandler<GetAdminUserQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetAdminUserQuery): Promise<AdminUserResDto> {
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(query.targetTelegramUserId) },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });

    if (!user) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Пользователь не найден',
      });
    }

    return {
      telegramUserId: user.telegramUserId.toString(),
      fullName: user.fullName,
      isVerified: user.isVerified,
      roles: user.roles.map((r) => r.role.code as AppRole),
    };
  }
}

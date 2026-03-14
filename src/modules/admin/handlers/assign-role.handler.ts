import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OkStatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { AssignRoleCommand } from '../commands';

@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  constructor(private readonly userContextService: UserContextService) {}

  async execute(
    command: AssignRoleCommand,
  ): Promise<OkStatusResDto> {
    await this.userContextService.assignRoleByTelegramUserId(
      command.targetTelegramUserId,
      command.role,
    );

    return {
      status: 'ok' as const,
    };
  }
}

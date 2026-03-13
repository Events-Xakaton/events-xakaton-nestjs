import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { OkStatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { AssignRoleCommand } from '../commands';

@CommandHandler(AssignRoleCommand)
export class AssignRoleHandler implements ICommandHandler<AssignRoleCommand> {
  constructor(private readonly userContextService: UserContextService) {}

  async execute(
    command: AssignRoleCommand,
  ): Promise<GeneralApiResponseDto<OkStatusResDto>> {
    await this.userContextService.assignRoleByTelegramUserId(
      command.targetTelegramUserId,
      command.role,
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'ok' as const,
      },
    );
  }
}

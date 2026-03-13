import { AppRole } from '@shared/auth';

export class AssignRoleCommand {
  constructor(
    readonly targetTelegramUserId: string,
    readonly role: AppRole,
  ) {}
}

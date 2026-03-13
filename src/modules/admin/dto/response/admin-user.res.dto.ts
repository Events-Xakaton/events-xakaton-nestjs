import { AppRole } from '@shared/auth';

export type AdminUserResDto = {
  telegramUserId: string;
  fullName: string;
  isVerified: boolean;
  roles: AppRole[];
};

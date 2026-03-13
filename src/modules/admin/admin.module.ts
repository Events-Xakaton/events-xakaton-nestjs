import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AdminController } from './admin.controller';
import {
  AssignRoleHandler,
  GetAdminUserHandler,
  GetOverviewReportHandler,
} from './handlers';

const handlers = [
  AssignRoleHandler,
  GetAdminUserHandler,
  GetOverviewReportHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [AdminController],
  providers: handlers,
})
export class AdminModule {}

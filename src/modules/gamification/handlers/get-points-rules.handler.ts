import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';

import { GetPointsRulesQuery } from '../queries';

@QueryHandler(GetPointsRulesQuery)
export class GetPointsRulesHandler implements IQueryHandler<GetPointsRulesQuery> {
  execute(): Promise<
    GeneralApiResponseDto<Array<{ rule: string; points: number }>>
  > {
    const rules = [
      { rule: 'club_create', points: 10 },
      { rule: 'event_create', points: 8 },
      { rule: 'club_join', points: 3 },
      { rule: 'event_join', points: 1 },
      { rule: 'attendance_feedback', points: 4 },
      { rule: 'club_new_member_bonus', points: 1 },
    ];
    return Promise.resolve(
      new GeneralApiResponseDto(
        HttpStatus.OK,
        HttpStatusDescriptions[HttpStatus.OK],
        rules,
      ),
    );
  }
}

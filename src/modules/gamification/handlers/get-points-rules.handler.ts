import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions, POINTS } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';

import { PointsRuleResDto } from '../dto/response';
import { GetPointsRulesQuery } from '../queries';

@QueryHandler(GetPointsRulesQuery)
export class GetPointsRulesHandler implements IQueryHandler<GetPointsRulesQuery> {
  execute(): Promise<GeneralApiResponseDto<PointsRuleResDto[]>> {
    const rules = [
      { rule: 'club_create', points: POINTS.CLUB_CREATE },
      { rule: 'event_create', points: POINTS.EVENT_CREATE },
      { rule: 'club_join', points: POINTS.CLUB_JOIN },
      { rule: 'event_join', points: POINTS.EVENT_JOIN },
      { rule: 'attendance_feedback', points: POINTS.ATTENDANCE_FEEDBACK },
      { rule: 'club_new_member_bonus', points: POINTS.CLUB_NEW_MEMBER_BONUS },
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

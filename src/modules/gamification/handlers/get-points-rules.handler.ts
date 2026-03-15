import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { POINTS } from '@shared/constants';

import { PointsRuleResDto } from '../dto/response';
import { GetPointsRulesQuery } from '../queries';

@QueryHandler(GetPointsRulesQuery)
export class GetPointsRulesHandler implements IQueryHandler<GetPointsRulesQuery> {
  execute(): Promise<PointsRuleResDto[]> {
    const rules = [
      { rule: 'club_create', points: POINTS.CLUB_CREATE },
      { rule: 'event_create', points: POINTS.EVENT_CREATE },
      { rule: 'club_join', points: POINTS.CLUB_JOIN },
      { rule: 'event_join', points: POINTS.EVENT_JOIN },
      { rule: 'attendance_feedback', points: POINTS.ATTENDANCE_FEEDBACK },
      { rule: 'club_new_member_bonus', points: POINTS.CLUB_NEW_MEMBER_BONUS },
      { rule: 'comment_create', points: POINTS.COMMENT_CREATE },
      { rule: 'follower_gained', points: POINTS.FOLLOWER_GAINED },
      { rule: 'first_event_join', points: POINTS.FIRST_EVENT_JOIN },
      { rule: 'profile_complete', points: POINTS.PROFILE_COMPLETE },
    ];
    return Promise.resolve(rules);
  }
}

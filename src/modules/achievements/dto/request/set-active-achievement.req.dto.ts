import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SetActiveAchievementReqDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'UUID достижения для применения иконки. null — снять активную иконку.',
  })
  @IsOptional()
  @IsUUID()
  achievementId: string | null = null;
}

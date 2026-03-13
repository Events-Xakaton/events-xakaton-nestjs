import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class LeaderboardQueryDto {
  @ApiProperty({
    description: 'Период лидерборда',
    enum: ['weekly', 'monthly'],
  })
  @IsIn(['weekly', 'monthly'])
  period!: 'weekly' | 'monthly';
}

import { ApiProperty } from '@nestjs/swagger';

export class LuckyWheelStreakResDto {
  @ApiProperty({ description: 'Текущая серия ежедневных входов' })
  declare currentStreak: number;

  @ApiProperty({ description: 'Дней до следующего фри-спина (1 или 2)' })
  declare daysUntilFreeSpin: number;

  @ApiProperty({ description: 'Накопленный баланс фри-спинов' })
  declare freeSpinBalance: number;

  @ApiProperty({
    description: 'Стандартный (недельный) спин уже использован на этой неделе',
  })
  declare hasUsedWeeklySpin: boolean;

  @ApiProperty({
    description:
      'Дата UTC-понедельника следующей недели — когда разблокируется стандартный спин',
    example: '2026-03-16',
  })
  declare nextWeekKey: string;
}

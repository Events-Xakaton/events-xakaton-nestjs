import { ApiProperty } from '@nestjs/swagger';

export class RandomEventResDto {
  @ApiProperty({ description: 'UUID выбранного события' })
  declare id: string;

  @ApiProperty({ description: 'true — использован фри-спин, false — стандартный суточный спин' })
  declare usedFreeSpin: boolean;
}

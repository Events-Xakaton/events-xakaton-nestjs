import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class CreateCommentReqDto {
  @ApiProperty({ description: 'Тип сущности', enum: ['club', 'event'] })
  @IsIn(['club', 'event'])
  entityType!: 'club' | 'event';

  @ApiProperty({ description: 'ID сущности' })
  @IsString()
  entityId!: string;

  @ApiProperty({ description: 'Текст комментария', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  text!: string;
}

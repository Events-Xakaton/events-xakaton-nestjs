import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateCommentReqDto {
  @ApiProperty({ description: 'Новый текст комментария', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  text!: string;
}

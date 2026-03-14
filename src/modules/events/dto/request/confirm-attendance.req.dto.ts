import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttendanceItemDto {
  @ApiProperty({ description: 'UUID участника' })
  @IsUUID()
  declare userId: string;

  @ApiPropertyOptional({
    description: 'Оценка участника от 1 до 5',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class ConfirmAttendanceReqDto {
  @ApiProperty({
    description: 'Список подтверждений присутствия',
    type: [AttendanceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  declare attendances: AttendanceItemDto[];
}

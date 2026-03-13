import { ApiProperty } from '@nestjs/swagger';

export class OtpRequestedResDto {
  @ApiProperty({ description: 'Статус отправки кода' })
  declare status: string;

  @ApiProperty({ description: 'Время жизни кода в секундах' })
  declare ttlSec: number;
}

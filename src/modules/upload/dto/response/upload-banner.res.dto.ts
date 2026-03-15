import { ApiProperty } from '@nestjs/swagger';

export class UploadBannerResDto {
  @ApiProperty({ description: 'Абсолютный URL загруженного баннера' })
  declare url: string;
}

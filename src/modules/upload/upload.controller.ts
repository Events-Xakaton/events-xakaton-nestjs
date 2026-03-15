import {
  Controller,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EnvVariableName } from '@shared/config';
import { AppRole, Roles } from '@shared/auth';

import { UploadBannerResDto } from './dto/response/upload-banner.res.dto';

@ApiTags('upload')
@Controller('upload')
@Roles(AppRole.Member)
export class UploadController {
  constructor(private readonly config: ConfigService) {}

  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: UploadBannerResDto })
  uploadBanner(
    @UploadedFile() file: Express.Multer.File,
  ): UploadBannerResDto {
    const baseUrl =
      this.config.get<string>(EnvVariableName.MINI_APP_URL) ??
      'http://localhost:4000';
    return { url: `${baseUrl}/api/static/banners/${file.filename}` };
  }
}

import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { StatusResDto } from '@shared/types';

import {
  RequestCodeCommand,
  ReverifyCommand,
  VerifyCodeCommand,
} from './commands';
import { RequestCodeDto } from './dto/request-code.dto';
import { OtpRequestedResDto } from './dto/response';
import { VerifyCodeDto } from './dto/verify-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('request-code')
  @ApiOperation({ summary: 'Запросить OTP-код через Reddy' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OtpRequestedResDto,
    description: 'Код отправлен',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Неверный запрос',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Нет Telegram-контекста',
  })
  requestCode(
    @Req() req: Request & { telegramUserId?: string },
    @Body() body: RequestCodeDto,
  ): Promise<OtpRequestedResDto> {
    const telegramUserId =
      req.telegramUserId ?? req.header('x-telegram-user-id');
    if (!telegramUserId) {
      throw new UnauthorizedException(
        'Отсутствует контекст пользователя Telegram',
      );
    }
    return this.commandBus.execute(
      new RequestCodeCommand(telegramUserId, body.reddyUserKey),
    );
  }

  @Post('verify-code')
  @ApiOperation({ summary: 'Подтвердить OTP-код' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Верификация прошла успешно',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Неверный или истёкший код',
  })
  verifyCode(
    @Req() req: Request & { telegramUserId?: string },
    @Body() body: VerifyCodeDto,
  ): Promise<StatusResDto> {
    const telegramUserId =
      req.telegramUserId ?? req.header('x-telegram-user-id');
    if (!telegramUserId) {
      throw new UnauthorizedException(
        'Отсутствует контекст пользователя Telegram',
      );
    }
    return this.commandBus.execute(
      new VerifyCodeCommand(telegramUserId, body.reddyUserKey, body.code),
    );
  }

  @Post('re-verify')
  @ApiOperation({
    summary: 'Повторно верифицировать привязанный Reddy-аккаунт',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OtpRequestedResDto,
    description: 'Новый код отправлен',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нет привязанного аккаунта',
  })
  reverify(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<OtpRequestedResDto> {
    const telegramUserId =
      req.telegramUserId ?? req.header('x-telegram-user-id');
    if (!telegramUserId) {
      throw new UnauthorizedException(
        'Отсутствует контекст пользователя Telegram',
      );
    }
    return this.commandBus.execute(new ReverifyCommand(telegramUserId));
  }
}

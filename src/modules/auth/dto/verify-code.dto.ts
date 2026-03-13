import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ description: '6-значный OTP-код из Reddy', example: '123456' })
  @IsNumberString({}, { message: 'Код должен содержать только цифры' })
  @Length(6, 6, { message: 'Код должен состоять из 6 цифр' })
  code!: string;

  @ApiProperty({
    description: 'Числовой ключ пользователя в системе Reddy',
    example: '123456',
  })
  @IsNumberString({}, { message: 'Ключ Reddy должен содержать только цифры' })
  @Length(6, 20, {
    message: 'Ключ Reddy должен быть длиной от 6 до 20 символов',
  })
  reddyUserKey!: string;
}

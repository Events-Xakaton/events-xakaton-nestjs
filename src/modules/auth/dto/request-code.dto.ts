import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, Length } from 'class-validator';

export class RequestCodeDto {
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

import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Проверка доступности сервиса.
   * Используется load balancer и Kubernetes readiness probe.
   */
  @Get()
  @ApiOperation({ summary: 'Проверка состояния сервиса' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Сервис работает' })
  getHealth(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

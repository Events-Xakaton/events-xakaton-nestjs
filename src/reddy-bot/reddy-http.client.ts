import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';

import { MetricsService } from '../observability/metrics.service';

// Расширяем тип конфига axios чтобы хранить metadata для метрик
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: bigint;
      operation?: string;
    };
  }
}

/**
 * HTTP-клиент для Reddy BotAPI.
 *
 * Конфигурируется через REDDY_BOT_BASE_URL и REDDY_BOT_TOKEN.
 * Если credentials не заданы — работает в mock-режиме:
 * - findUser возвращает фиктивного пользователя
 * - send логирует предупреждение и ничего не отправляет
 *
 * Автоматически ретраит запросы (3 попытки, exponential backoff) для
 * сетевых ошибок и 5xx ответов.
 */
@Injectable()
export class ReddyHttpClient {
  private readonly logger = new Logger(ReddyHttpClient.name);
  private readonly client: AxiosInstance;
  private readonly isMockMode: boolean;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Optional()
    @Inject(MetricsService)
    private readonly metricsService?: MetricsService,
  ) {
    const baseUrlRaw = this.configService.get<string>('REDDY_BOT_BASE_URL');
    const token = this.configService.get<string>('REDDY_BOT_TOKEN');

    this.isMockMode = !baseUrlRaw || !token || token === 'change_me';

    if (this.isMockMode) {
      this.logger.warn('Reddy credentials not configured, using mock mode');
    }

    const baseUrl = baseUrlRaw?.replace(/\/+$/, '') || 'http://mock';

    this.client = axios.create({
      baseURL: `${baseUrl}/v2${token || ''}`,
      timeout: 10000,
      headers: {
        'X-Bot-Token': token || '',
      },
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay.bind(axiosRetry),
      retryCondition: (error: AxiosError) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status ?? 0) >= 500
        );
      },
      onRetry: (retryCount, error) => {
        this.logger.warn(
          `Retrying Reddy API call (attempt ${retryCount}): ${error.message}`,
        );
      },
    });

    // Перехватчик для записи времени старта запроса
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.metadata = { startTime: process.hrtime.bigint() };
        return config;
      },
    );

    // Перехватчик для записи метрик после ответа
    this.client.interceptors.response.use(
      (response) => {
        this.recordMetrics(response.config, 'success');
        return response;
      },
      (error: AxiosError) => {
        this.recordMetrics(error.config, 'error');
        throw error;
      },
    );
  }

  private recordMetrics(
    config: InternalAxiosRequestConfig | undefined,
    outcome: 'success' | 'error',
  ): void {
    if (!config?.metadata?.startTime) return;

    const durationMs =
      Number(process.hrtime.bigint() - config.metadata.startTime) / 1_000_000;
    const operation = config.metadata.operation || 'unknown';

    this.metricsService?.observeIntegrationCall({
      integration: 'reddy_bot',
      operation,
      durationMs,
      outcome,
    });
  }

  /**
   * GET-запрос к Reddy API.
   * В mock-режиме всегда бросает ошибку (вызывающий код должен обработать это).
   */
  async get<T>(
    url: string,
    operation: string,
    options?: { timeoutMs?: number; disableRetries?: boolean },
  ): Promise<T> {
    if (this.isMockMode) {
      this.recordMockMetrics(operation);
      throw new Error('Reddy API is in mock mode');
    }

    const requestConfig: Record<string, unknown> = {
      metadata: { operation },
    };

    if (typeof options?.timeoutMs === 'number' && options.timeoutMs > 0) {
      requestConfig.timeout = options.timeoutMs;
    }
    if (options?.disableRetries) {
      requestConfig['axios-retry'] = { retries: 0 };
    }

    const response = await this.client.get<T>(
      url,
      requestConfig as unknown as InternalAxiosRequestConfig,
    );
    return response.data;
  }

  /**
   * POST-запрос к Reddy API.
   * В mock-режиме возвращает пустой объект без отправки.
   */
  async post<T>(url: string, data: unknown, operation: string): Promise<T> {
    if (this.isMockMode) {
      this.recordMockMetrics(operation);
      return {} as T;
    }

    const response = await this.client.post<T>(url, data, {
      metadata: { operation },
    } as InternalAxiosRequestConfig);
    return response.data;
  }

  private recordMockMetrics(operation: string): void {
    this.metricsService?.observeIntegrationCall({
      integration: 'reddy_bot',
      operation,
      durationMs: 0,
      outcome: 'success',
    });
  }

  /** true если Reddy credentials не настроены (dev/test окружение) */
  get mockMode(): boolean {
    return this.isMockMode;
  }
}

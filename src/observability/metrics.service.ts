import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Сервис Prometheus-метрик.
 *
 * Собирает метрики:
 * - HTTP: количество запросов и латентность по route/method/status
 * - Queue: enqueue/failed/completed/depth по имени очереди
 * - DB: латентность запросов по model/action
 * - Integration: латентность вызовов внешних API (Reddy)
 * - Redis: статус подключения
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationMs: Histogram<string>;
  private readonly queueEnqueueTotal: Counter<string>;
  private readonly queueFailedTotal: Counter<string>;
  private readonly queueCompletedTotal: Counter<string>;
  private readonly queueDepthGauge: Gauge<string>;
  private readonly dbQueryDurationMs: Histogram<string>;
  private readonly dbQueryTotal: Counter<string>;
  private readonly integrationCallDurationMs: Histogram<string>;
  private readonly integrationCallTotal: Counter<string>;
  private readonly redisConnected: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'tribe_events_' });

    this.httpRequestsTotal = new Counter({
      name: 'tribe_events_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_class'] as const,
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'tribe_events_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route'] as const,
      buckets: [20, 50, 100, 200, 350, 500, 900, 1500, 3000],
      registers: [this.registry],
    });

    this.queueEnqueueTotal = new Counter({
      name: 'tribe_events_queue_enqueue_total',
      help: 'Total enqueued jobs by queue',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.queueFailedTotal = new Counter({
      name: 'tribe_events_queue_failed_total',
      help: 'Total failed queue jobs by queue',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.queueCompletedTotal = new Counter({
      name: 'tribe_events_queue_completed_total',
      help: 'Total completed queue jobs by queue',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.queueDepthGauge = new Gauge({
      name: 'tribe_events_queue_depth',
      help: 'Current queue depth',
      labelNames: ['queue'] as const,
      registers: [this.registry],
    });

    this.dbQueryDurationMs = new Histogram({
      name: 'tribe_events_db_query_duration_ms',
      help: 'Database query duration in milliseconds',
      labelNames: ['model', 'action'] as const,
      buckets: [1, 3, 5, 10, 20, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.dbQueryTotal = new Counter({
      name: 'tribe_events_db_queries_total',
      help: 'Total database queries by model/action/outcome',
      labelNames: ['model', 'action', 'outcome'] as const,
      registers: [this.registry],
    });

    this.integrationCallDurationMs = new Histogram({
      name: 'tribe_events_integration_call_duration_ms',
      help: 'External integration call duration in milliseconds',
      labelNames: ['integration', 'operation'] as const,
      buckets: [5, 10, 20, 50, 100, 200, 350, 500, 900, 1500, 3000],
      registers: [this.registry],
    });

    this.integrationCallTotal = new Counter({
      name: 'tribe_events_integration_calls_total',
      help: 'Total integration calls by outcome',
      labelNames: ['integration', 'operation', 'outcome'] as const,
      registers: [this.registry],
    });

    this.redisConnected = new Gauge({
      name: 'tribe_events_redis_connected',
      help: 'Redis connectivity status (1 connected, 0 disconnected)',
      registers: [this.registry],
    });
  }

  observeHttp(params: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const statusClass = `${Math.floor(params.statusCode / 100)}xx`;
    this.httpRequestsTotal.inc({
      method: params.method,
      route: params.route,
      status_class: statusClass,
    });
    this.httpRequestDurationMs.observe(
      { method: params.method, route: params.route },
      params.durationMs,
    );
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  incQueueEnqueue(queue: string): void {
    this.queueEnqueueTotal.inc({ queue });
  }

  incQueueFailed(queue: string): void {
    this.queueFailedTotal.inc({ queue });
  }

  incQueueCompleted(queue: string): void {
    this.queueCompletedTotal.inc({ queue });
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepthGauge.set({ queue }, depth);
  }

  observeDbQuery(params: {
    model: string;
    action: string;
    durationMs: number;
    outcome: 'success' | 'error';
  }): void {
    this.dbQueryDurationMs.observe(
      { model: params.model, action: params.action },
      params.durationMs,
    );
    this.dbQueryTotal.inc({
      model: params.model,
      action: params.action,
      outcome: params.outcome,
    });
  }

  observeIntegrationCall(params: {
    integration: string;
    operation: string;
    durationMs: number;
    outcome: 'success' | 'error';
  }): void {
    this.integrationCallDurationMs.observe(
      { integration: params.integration, operation: params.operation },
      params.durationMs,
    );
    this.integrationCallTotal.inc({
      integration: params.integration,
      operation: params.operation,
      outcome: params.outcome,
    });
  }

  setRedisConnected(isConnected: boolean): void {
    this.redisConnected.set(isConnected ? 1 : 0);
  }
}

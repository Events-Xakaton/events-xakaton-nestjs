import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

/**
 * Инициализирует OpenTelemetry SDK.
 *
 * Вызывается первым в bootstrap() до NestFactory.create() — это критично,
 * так как OTel должен проинструментировать HTTP-клиенты и DB-драйверы
 * до того, как они начнут использоваться приложением.
 *
 * Включается через OTEL_ENABLED=true или при наличии OTEL_EXPORTER_OTLP_ENDPOINT.
 * По умолчанию отключён (OTEL_ENABLED=false).
 */
export function initOtel(): void {
  const explicitFlag = (process.env.OTEL_ENABLED ?? '').toLowerCase();

  if (explicitFlag === 'false' || explicitFlag === '0') {
    return;
  }

  const enabled =
    explicitFlag === 'true' ||
    explicitFlag === '1' ||
    Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

  if (!enabled) {
    return;
  }

  if ((process.env.OTEL_LOG_LEVEL ?? '').toLowerCase() === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const exporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'tribe-events-backend',
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
  } catch (error) {
    console.error('[otel] failed to start', error);
  }

  const shutdown = async (): Promise<void> => {
    try {
      await sdk.shutdown();
    } catch (error) {
      console.error('[otel] shutdown failed', error);
    }
  };

  process.once('SIGTERM', () => {
    void shutdown();
  });
  process.once('SIGINT', () => {
    void shutdown();
  });
}

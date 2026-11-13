// Loaded with `node --require` before the webhook server. Tracing is opt-in and configured purely through the standard
// OTEL_* environment variables: without OTEL_EXPORTER_OTLP_ENDPOINT (or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT), or with
// OTEL_SDK_DISABLED=true, this file does nothing and the @opentelemetry/api calls in the app are no-ops.
// No instrumentations on purpose: the only spans are the per-interaction ones in src/utils/tracing.ts. The HTTP instrumentation
// would record the webhook URL, whose path is the WEBHOOK_PATH_SECRET.
const enabled =
  (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) &&
  process.env.OTEL_SDK_DISABLED !== 'true';

if (enabled) {
  process.env.OTEL_SERVICE_NAME ||= 'hammertimebot';
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||= 'http/protobuf';
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const sdk = new NodeSDK({ instrumentations: [] });
  sdk.start();
  process.on('SIGTERM', () => {
    sdk.shutdown().catch(() => undefined);
  });
}

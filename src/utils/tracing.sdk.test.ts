import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withBackendRequestSpan, withInteractionSpan } from './tracing.js';

type SpanProcessor = NonNullable<NonNullable<ConstructorParameters<typeof NodeSDK>[0]>['spanProcessors']>[number];
type FinishedSpan = Parameters<SpanProcessor['onEnd']>[0];

/** Keeps finished spans in memory (the SDK version in use does not re-export an in-memory exporter). */
class CollectingProcessor implements SpanProcessor {
  spans: FinishedSpan[] = [];
  onStart(): void {}
  onEnd(span: FinishedSpan): void {
    this.spans.push(span);
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// Runs against a real SDK (in-memory exporter) so the propagation and span shape are checked, not just the no-op path.
describe('withBackendRequestSpan with tracing enabled', () => {
  const processor = new CollectingProcessor();
  const sdk = new NodeSDK({ spanProcessors: [processor], instrumentations: [] });

  beforeAll(() => sdk.start());
  afterAll(() => sdk.shutdown());

  it('creates a CLIENT child span of the interaction span and sends its context as a traceparent header', async () => {
    processor.spans = [];
    let traceparent: string | undefined;
    await withInteractionSpan({ kind: 'Command', name: 'at12' }, { receivedAt: Date.now() }, () =>
      withBackendRequestSpan({ method: 'GET', route: 'settings', host: 'hammertime.cyou', timeoutMs: 1000, attempt: 1 }, async ({ headers, setStatus }) => {
        traceparent = headers.traceparent;
        setStatus(200);
      }),
    );

    const spans = processor.spans;
    const client = spans.find((s) => s.kind === SpanKind.CLIENT)!;
    const parent = spans.find((s) => s.kind === SpanKind.SERVER)!;
    expect(client.name).toBe('GET settings');
    expect(client.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    expect(client.attributes).toMatchObject({ 'http.route': 'settings', 'server.address': 'hammertime.cyou', 'http.client.timeout_ms': 1000, 'http.response.status_code': 200 });
    expect(traceparent).toBe(`00-${client.spanContext().traceId}-${client.spanContext().spanId}-01`);
  });

  it('marks a timeout as an error on the span', async () => {
    processor.spans = [];
    await expect(
      withBackendRequestSpan({ method: 'GET', route: 'settings', attempt: 1 }, async () => {
        throw new Error('fetch GET /settings: Request timed out after 1000ms');
      }),
    ).rejects.toThrow('timed out');
    const [span] = processor.spans;
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['error.type']).toBe('timeout');
  });
});

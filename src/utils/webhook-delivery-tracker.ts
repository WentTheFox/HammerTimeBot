import { LoggerContext } from '../types/bot-interaction.js';
import { sendWebhookDeliveries, WebhookDeliveryRecord } from './backend-api-data-updaters.js';

// Buffers webhook delivery records (src/webhook.ts, one per incoming Discord interaction request)
// and flushes them to the backend in batches, rather than one HTTP call per interaction - matches
// how the old per-shard stats update worked (periodic, not per-event), just time- and size-bounded
// instead of a fixed 5-minute interval, since request volume here is bursty rather than steady.

const FLUSH_INTERVAL_MS = 60 * 1000;
const MAX_BUFFER_SIZE = 500;

let buffer: WebhookDeliveryRecord[] = [];

export const recordWebhookDelivery = (context: LoggerContext, record: WebhookDeliveryRecord): void => {
  buffer.push(record);
  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flush(context);
  }
};

const flush = async (context: LoggerContext): Promise<void> => {
  if (buffer.length === 0) return;
  const toSend = buffer;
  buffer = [];

  try {
    await sendWebhookDeliveries(context, toSend);
  } catch (e) {
    // Best-effort, matching the other backend-api-data-updaters callers (e.g.
    // updateBotCommandsInApi) - a failed flush drops this batch rather than growing the buffer
    // unbounded by retrying, since this is delivery-time telemetry, not something to guarantee.
    context.logger.warn(`Failed to flush ${toSend.length} webhook delivery record(s)`, e);
  }
};

/** Starts the periodic flush timer. Call once at webhook.ts startup. */
export const startWebhookDeliveryTracker = (context: LoggerContext): void => {
  const timer = setInterval(() => {
    void flush(context);
  }, FLUSH_INTERVAL_MS);
  timer.unref();
};

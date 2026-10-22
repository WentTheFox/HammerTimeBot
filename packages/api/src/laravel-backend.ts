import type { SettingsValue } from '@went.tf/hammertime-core';
import { z } from '@hono/zod-openapi';
import { Backend, BackendError, KeyContext, TelemetryRequest, TelemetryResponse } from './backend.js';
import { SettingsPatch, SettingsSchema } from './settings-schema.js';

const KeyResponseSchema = z.object({
  kind: z.enum(['user', 'service']),
  discord_user_id: z.string().nullable(),
  scopes: z.array(z.string()),
  key_id: z.string(),
});

const TelemetryResponseSchema = z.object({
  executionNumber: z.number().int(),
  privacyPolicyUrl: z.string(),
  commandName: z.string(),
  commandId: z.string(),
});

const ValidationErrorSchema = z.object({
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

/** Seconds to ask clients to wait when the backend is read-only for a deploy but does not say for how long */
const DEFAULT_RETRY_AFTER = 5;

export interface LaravelBackendOptions {
  /** Origin of the Laravel app, e.g. https://hammertime.cyou */
  baseUrl: string;
  /** Shared secret of the internal endpoints, sent as a bearer token */
  secret: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/**
 * The Laravel app is the system of record for keys, settings and telemetry. This talks to its internal
 * endpoints, which are only reachable with the shared secret:
 *
 * - POST /internal/keys/validate {token} -> {kind, discord_user_id, scopes, key_id}, 401 for an unknown key
 * - GET|PUT /internal/settings/{discordUserId} -> the settings (PUT takes the patch, a null resets a setting)
 * - POST /internal/command-telemetry -> {executionNumber, privacyPolicyUrl, commandName, commandId}
 */
export class LaravelBackend implements Backend {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: LaravelBackendOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async request(method: string, path: string, body?: unknown, timeoutMs = this.timeoutMs): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.options.secret}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BackendError(502, 'The backend could not be reached');
    }
  }

  /** Turns a failed response into the error the API should answer with */
  private async fail(response: Response): Promise<never> {
    if (response.status === 503) {
      throw new BackendError(503, 'The service is being deployed, retry shortly', Number(response.headers.get('Retry-After')) || DEFAULT_RETRY_AFTER);
    }
    if (response.status === 422) {
      const parsed = ValidationErrorSchema.safeParse(await response.json().catch(() => ({})));
      const errors = parsed.success ? parsed.data.errors : undefined;
      throw new BackendError(
        400,
        (parsed.success && parsed.data.message) || 'The request was rejected',
        undefined,
        Object.entries(errors ?? {}).flatMap(([path, messages]) => messages.map(message => ({ path, message }))),
      );
    }
    if (response.status === 404) {
      throw new BackendError(404, 'Not found');
    }
    throw new BackendError(502, `The backend answered with HTTP ${response.status}`);
  }

  private async parse<T extends z.ZodType>(response: Response, schema: T): Promise<z.infer<T>> {
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new BackendError(502, 'The backend sent an unexpected response');
    }
    return parsed.data;
  }

  async validateKey(token: string): Promise<KeyContext | null> {
    const response = await this.request('POST', '/internal/keys/validate', { token });
    if (response.status === 401) {
      return null;
    }
    if (!response.ok) {
      return this.fail(response);
    }
    const key = await this.parse(response, KeyResponseSchema);
    return { kind: key.kind, discordUserId: key.discord_user_id, scopes: key.scopes, keyId: key.key_id };
  }

  async getSettings(discordUserId: string): Promise<SettingsValue> {
    const response = await this.request('GET', `/internal/settings/${encodeURIComponent(discordUserId)}`);
    if (!response.ok) {
      return this.fail(response);
    }
    return await this.parse(response, SettingsSchema) as unknown as SettingsValue;
  }

  async updateSettings(discordUserId: string, patch: SettingsPatch): Promise<SettingsValue> {
    const response = await this.request('PUT', `/internal/settings/${encodeURIComponent(discordUserId)}`, patch);
    if (!response.ok) {
      return this.fail(response);
    }
    return await this.parse(response, SettingsSchema) as unknown as SettingsValue;
  }

  async recordTelemetry(request: TelemetryRequest): Promise<TelemetryResponse | null> {
    // Telemetry is best effort, so a shorter timeout than the other calls and no error for a read-only backend
    const response = await this.request('POST', '/internal/command-telemetry', request, Math.min(this.timeoutMs, 2000));
    if (response.status === 503) {
      return null;
    }
    if (!response.ok) {
      return this.fail(response);
    }
    return this.parse(response, TelemetryResponseSchema);
  }
}

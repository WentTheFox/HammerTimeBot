import type { SettingsValue } from '@went.tf/hammertime-core';
import type { SettingsPatch } from './settings-schema.js';

/** Where a request came from, recorded with the telemetry so it can be told apart from Discord usage */
export type RequestSource = 'discord-bot' | 'api' | 'mcp';

export const SCOPES = ['timestamps:create', 'settings:read', 'settings:write'] as const;
export type Scope = typeof SCOPES[number];

export interface KeyContext {
  /** A user key acts as the one Discord account it was created for, a service key (the bot) acts on behalf of whoever it names */
  kind: 'user' | 'service';
  discordUserId: string | null;
  scopes: string[];
  keyId: string;
}

export interface TelemetryRequest {
  commandName: string;
  locale: string;
  source: RequestSource;
  /** The options that were provided, with Discord's option type ids */
  options: { name: string; type: number }[];
}

export interface TelemetryResponse {
  executionNumber: number;
  privacyPolicyUrl: string;
  commandName: string;
  commandId: string;
}

/** A failure of the system of record, carrying the HTTP status the API should answer with */
export class BackendError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 422 | 502 | 503,
    message: string,
    /** Seconds, for a 503 caused by the backend being read-only during a deploy */
    public readonly retryAfter?: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Everything the API needs from the system of record (the Laravel app) */
export interface Backend {
  /** Resolves a presented API key, null when it is unknown, revoked or expired */
  validateKey(token: string): Promise<KeyContext | null>;
  getSettings(discordUserId: string): Promise<SettingsValue>;
  /** A null value resets the setting to its default */
  updateSettings(discordUserId: string, patch: SettingsPatch): Promise<SettingsValue>;
  /** Null when the backend declined to record it */
  recordTelemetry(request: TelemetryRequest): Promise<TelemetryResponse | null>;
}

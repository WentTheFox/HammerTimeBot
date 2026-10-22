import type { SettingsValue } from '@went.tf/hammertime-core';
import {
  Backend,
  BackendError,
  KeyContext,
  SCOPES,
  TelemetryRequest,
  TelemetryResponse,
} from '../backend.js';
import type { SettingsPatch } from '../settings-schema.js';

/** What the Laravel app answers for an account that never customised anything */
export const DEFAULT_SETTINGS = {
  ephemeral: true,
  timezone: 'GMT',
  header: true,
  boldPreview: true,
  columns: null,
  format: null,
  formatMinimalReply: true,
  telemetry: true,
  defaultAtHour: null,
  defaultAt12Hour: null,
  defaultAtMinute: null,
  defaultAtSecond: 0,
} as unknown as SettingsValue;

export const USER_TOKEN = 'user-key';
export const SERVICE_TOKEN = 'service-key';
export const DISCORD_USER_ID = '175928847299117063';

/** An in-memory stand-in for the Laravel app, with switches to simulate its failure modes */
export class FakeBackend implements Backend {
  readonly keys = new Map<string, KeyContext>();
  readonly settings = new Map<string, SettingsValue>();
  readonly telemetryCalls: TelemetryRequest[] = [];
  private readonly executions = new Map<string, number>();

  /** 'throw' rejects, 'hang' never answers, 'decline' answers null */
  telemetryMode: 'ok' | 'throw' | 'hang' | 'decline' = 'ok';
  readOnly = false;

  constructor() {
    this.keys.set(USER_TOKEN, { kind: 'user', discordUserId: DISCORD_USER_ID, scopes: [...SCOPES], keyId: 'key-1' });
    this.keys.set(SERVICE_TOKEN, { kind: 'service', discordUserId: null, scopes: ['timestamps:create'], keyId: 'bot' });
  }

  private assertWritable() {
    if (this.readOnly) {
      throw new BackendError(503, 'The service is read-only', 5);
    }
  }

  async validateKey(token: string) {
    return this.keys.get(token) ?? null;
  }

  async getSettings(discordUserId: string) {
    return { ...DEFAULT_SETTINGS, ...this.settings.get(discordUserId) };
  }

  async updateSettings(discordUserId: string, patch: SettingsPatch) {
    this.assertWritable();
    const next = { ...(await this.getSettings(discordUserId)) } as Record<string, unknown>;
    for (const [name, value] of Object.entries(patch)) {
      next[name] = value === null ? (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[name] : value;
    }
    this.settings.set(discordUserId, next as unknown as SettingsValue);
    return next as unknown as SettingsValue;
  }

  async recordTelemetry(request: TelemetryRequest): Promise<TelemetryResponse | null> {
    this.telemetryCalls.push(request);
    if (this.telemetryMode === 'throw') throw new Error('telemetry is down');
    if (this.telemetryMode === 'hang') return new Promise(() => undefined);
    if (this.telemetryMode === 'decline') return null;
    const executionNumber = (this.executions.get(request.commandName) ?? 0) + 1;
    this.executions.set(request.commandName, executionNumber);
    return {
      executionNumber,
      privacyPolicyUrl: 'https://hammertime.example/legal#telemetry-statistics',
      commandName: request.commandName,
      commandId: '1',
    };
  }
}

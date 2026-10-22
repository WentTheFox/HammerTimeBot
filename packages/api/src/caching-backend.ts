import { createHash } from 'node:crypto';
import type { SettingsValue } from '@went.tf/hammertime-core';
import type { Backend, KeyContext, TelemetryRequest, TelemetryResponse } from './backend.js';
import type { SettingsPatch } from './settings-schema.js';

export interface CachingBackendOptions {
  /** How long a valid key is trusted without asking the backend again, 0 turns the cache off */
  ttlMs?: number;
  /** How long an unknown key is remembered, so a flood of bad keys does not each cost a call */
  negativeTtlMs?: number;
  maxEntries?: number;
  /** Injectable for tests */
  now?: () => number;
}

interface Entry {
  key: KeyContext | null;
  expiresAt: number;
}

/**
 * Remembers who an API key belongs to for a short while, since every request would otherwise ask the Laravel
 * app. The price is that a key that was revoked (or whose account was unlinked) keeps working until its entry
 * expires, at most `ttlMs`. Nothing runs in the background: entries expire when they are looked up and the
 * oldest ones are dropped when the cache is full.
 */
export class CachingBackend implements Backend {
  private readonly ttlMs: number;
  private readonly negativeTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, Entry>();
  /** Lookups in progress, so concurrent requests with the same key share one call */
  private readonly inFlight = new Map<string, Promise<KeyContext | null>>();

  constructor(private readonly inner: Backend, { ttlMs = 30_000, negativeTtlMs = 5_000, maxEntries = 10_000, now = Date.now }: CachingBackendOptions = {}) {
    this.ttlMs = ttlMs;
    this.negativeTtlMs = Math.min(negativeTtlMs, ttlMs);
    this.maxEntries = maxEntries;
    this.now = now;
  }

  async validateKey(token: string): Promise<KeyContext | null> {
    if (this.ttlMs <= 0) {
      return this.inner.validateKey(token);
    }

    // The hash, so the keys themselves are never held in memory longer than a request
    const id = createHash('sha256').update(token).digest('hex');
    const cached = this.entries.get(id);
    if (cached && cached.expiresAt > this.now()) {
      return cached.key;
    }

    let lookup = this.inFlight.get(id);
    if (!lookup) {
      lookup = this.inner.validateKey(token).then((key) => {
        this.remember(id, key);
        return key;
      }).finally(() => this.inFlight.delete(id));
      this.inFlight.set(id, lookup);
    }

    return lookup;
  }

  private remember(id: string, key: KeyContext | null): void {
    // Delete first so a refreshed entry counts as the newest
    this.entries.delete(id);
    this.entries.set(id, { key, expiresAt: this.now() + (key ? this.ttlMs : this.negativeTtlMs) });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  getSettings(discordUserId: string): Promise<SettingsValue> {
    return this.inner.getSettings(discordUserId);
  }

  updateSettings(discordUserId: string, patch: SettingsPatch): Promise<SettingsValue> {
    return this.inner.updateSettings(discordUserId, patch);
  }

  recordTelemetry(request: TelemetryRequest): Promise<TelemetryResponse | null> {
    return this.inner.recordTelemetry(request);
  }
}

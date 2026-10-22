import { boolFromString, defineEnv } from '@went.tf/discord-bot-framework/env';
import { z } from 'zod';

/**
 * Type-safe process.env
 */
export const env = defineEnv({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  /** Ed25519 application public key (hex), from the Discord developer portal - only used by the webhook entrypoint (src/webhook.ts). */
  DISCORD_PUBLIC_KEY: z.string().optional().default(''),
  /** Port the webhook HTTP Interactions endpoint (src/webhook.ts) listens on. */
  WEBHOOK_PORT: z.coerce.number().optional().default(3939),
  /**
   * Address the webhook HTTP Interactions endpoint (src/webhook.ts) binds to. Loopback by default, so the
   * reverse proxy in front of it is the only way in; without a host Node listens on every interface and the
   * port is reachable from the internet directly, skipping the proxy's TLS and request rules.
   */
  WEBHOOK_HOST: z.string().min(1).optional().default('127.0.0.1'),
  /**
   * Long random URL-safe token the webhook entrypoint (src/webhook.ts) requires as the request
   * path (e.g. `/<token>`), instead of serving interactions on `/`. Set this as the Interactions
   * Endpoint URL on the Discord developer portal (`https://<host>/<token>`). Purely obscurity, not
   * a substitute for Ed25519 signature verification - it just keeps internet-scanner/health-check
   * noise (which will never know the path) out of the "invalid signature" logs, so those logs stay
   * meaningful for actual signature problems. Generate with `openssl rand -base64url 32` or
   * `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
   */
  WEBHOOK_PATH_SECRET: z.string().min(1),
  /** Enables discord-bot-framework's verboseSignatureDiagnostics for src/webhook.ts. */
  WEBHOOK_VERBOSE_DIAGNOSTICS: boolFromString().default(false),
  CROWDIN_PROJECT_IDENTIFIER: z.string().optional().default(''),
  LOCAL: boolFromString().default(false),
  DEBUG_I18N: boolFromString().default(false),
  DISABLE_SETTINGS: boolFromString().default(false),
  UA_STRING: z.string().min(1),
  DISCORD_INVITE_URL: z.string().min(1),
  API_URL: z.string().min(1),
  /** SledgeHammerTime backend auth token. Optional: unset means backend API calls run unauthenticated (and fail server-side, which is handled). */
  API_TOKEN: z.string().optional().default(''),
  /**
   * Origin of the HammerTime API (packages/api). Optional: unset means every command is resolved by this process, as before.
   * When set together with COMMANDS_API_KEY the timestamp commands are asked of the API, and handled here only when it does not answer.
   */
  COMMANDS_API_URL: z.string().optional().default(''),
  /** The bot's service key, created with `php artisan bot-token:generate --service` on the SledgeHammerTime backend. */
  COMMANDS_API_KEY: z.string().optional().default(''),
  /** How long to wait for the API before handling the command here instead. Interactions have to be answered within 3 seconds. */
  COMMANDS_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(2500).optional().default(1500),
  /** Server ID used to resolve role mentions in FAQ entries. Optional. */
  SUPPORT_SERVER_ID: z.string().optional().default(''),
  /** Discord webhook URL logs of warn level and above are fanned out to. Optional. */
  DISCORD_LOG_WEBHOOK_URL: z.string().optional().default(''),
});

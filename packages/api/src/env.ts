import { z } from '@hono/zod-openapi';

const EnvSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  /** Origin of the Laravel app */
  LARAVEL_URL: z.url(),
  /** Shared secret of the Laravel app's internal endpoints */
  INTERNAL_API_SECRET: z.string().min(16),
  /** How long an API key is trusted without asking the Laravel app again, a revoked key keeps working that long. 0 turns the cache off. */
  KEY_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(300).default(30),
  /** Requests per minute per API key (per Discord account for the bot's service key). 0 turns the limit off. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).max(100_000).default(60),
  /** How many requests may come at once before the average applies, half a minute's worth when not set */
  RATE_LIMIT_BURST: z.coerce.number().int().min(1).max(100_000).optional(),
  /** Failed authentications per minute per client address before it is turned away for a while. 0 turns the limit off. */
  AUTH_FAILURES_PER_MINUTE: z.coerce.number().int().min(0).max(100_000).default(20),
  /**
   * A header the reverse proxy sets to the client's address and overwrites whatever the client sent, such as X-Real-IP.
   * Only set it when the proxy really does that, otherwise anyone can choose the address they are counted under.
   * Without it every client behind the proxy is counted as one address.
   */
  CLIENT_IP_HEADER: z.string().optional().transform(value => value || undefined),
  /**
   * Where the rate limits are counted, so that every worker counts into the same ones. Without any Redis setting each worker counts
   * for itself, and a client can make as many requests as there are workers times the limit. Either a URL
   * (redis://user:password@host:6379/2, a password with special characters has to be escaped in it), or the settings one by one:
   * REDIS_HOST turns it on, the others have defaults. REDIS_URL wins when both are set.
   */
  REDIS_URL: z.string().optional().transform(value => value || undefined),
  REDIS_HOST: z.string().optional().transform(value => value || undefined),
  REDIS_PORT: z.coerce.number().int().min(1).max(65_535).default(6379),
  REDIS_USERNAME: z.string().optional().transform(value => value || undefined),
  REDIS_PASSWORD: z.string().optional().transform(value => value || undefined),
  /** The database of its own the limits live in, apart from the one of the Laravel app (the keys have a prefix in any case) */
  REDIS_DB: z.coerce.number().int().min(0).max(1_000).default(0),
  /** Connect with TLS, for a Redis that is not on this machine */
  REDIS_TLS: z.enum(['true', 'false', '1', '0']).default('false').transform(value => value === 'true' || value === '1'),
  /** In front of every key the limits have in Redis, which the other applications in that Redis have to stay clear of */
  REDIS_KEY_PREFIX: z.string().default('hammertime-api:'),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return parsed.data;
};

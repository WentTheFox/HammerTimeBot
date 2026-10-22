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
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return parsed.data;
};

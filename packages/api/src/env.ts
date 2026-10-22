import { z } from '@hono/zod-openapi';

const EnvSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  /** Origin of the Laravel app */
  LARAVEL_URL: z.url(),
  /** Shared secret of the Laravel app's internal endpoints */
  INTERNAL_API_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof EnvSchema>;

export const loadEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return parsed.data;
};

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { CachingBackend } from './caching-backend.js';
import { loadEnv } from './env.js';
import { LaravelBackend } from './laravel-backend.js';

const env = loadEnv();
const app = createApp({
  backend: new CachingBackend(
    new LaravelBackend({ baseUrl: env.LARAVEL_URL, secret: env.INTERNAL_API_SECRET }),
    { ttlMs: env.KEY_CACHE_TTL_SECONDS * 1000 },
  ),
});

serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, ({ address, port }) => {
  console.log(`HammerTime API listening on http://${address}:${port}`);
});

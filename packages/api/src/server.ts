import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { LaravelBackend } from './laravel-backend.js';

const env = loadEnv();
const app = createApp({
  backend: new LaravelBackend({ baseUrl: env.LARAVEL_URL, secret: env.INTERNAL_API_SECRET }),
});

serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, ({ address, port }) => {
  console.log(`HammerTime API listening on http://${address}:${port}`);
});

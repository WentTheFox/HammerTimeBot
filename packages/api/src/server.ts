import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { CachingBackend } from './caching-backend.js';
import { loadEnv } from './env.js';
import { announceReady, shutdownGracefully } from './graceful-shutdown.js';
import { LaravelBackend } from './laravel-backend.js';
import { loadEnvFile } from './load-env-file.js';
import { createRateLimits } from './rate-limit.js';
import { connectToRedis, redisLimiterFactory, redisTargetFromEnv } from './redis-rate-limit.js';

// Before anything reads the environment. By the location of the package, not the working directory, see load-env-file.ts
const envFile = loadEnvFile();
if (envFile) console.log(`Settings read from ${envFile}`);
const env = loadEnv();
const redisTarget = redisTargetFromEnv(env);
const redis = redisTarget ? connectToRedis(redisTarget, console.warn) : null;
console.log(redis ? 'Rate limits are counted in Redis, shared by every worker' : 'Rate limits are counted per worker, set REDIS_URL or REDIS_HOST to share them');
const app = createApp({
  backend: new CachingBackend(
    new LaravelBackend({ baseUrl: env.LARAVEL_URL, secret: env.INTERNAL_API_SECRET }),
    { ttlMs: env.KEY_CACHE_TTL_SECONDS * 1000 },
  ),
  limits: createRateLimits({
    requestsPerMinute: env.RATE_LIMIT_PER_MINUTE,
    requestsBurst: env.RATE_LIMIT_BURST,
    authFailuresPerMinute: env.AUTH_FAILURES_PER_MINUTE,
    clientIpHeader: env.CLIENT_IP_HEADER,
    limiterFactory: redis ? redisLimiterFactory(redis.client, { keyPrefix: env.REDIS_KEY_PREFIX, log: console.warn }) : undefined,
  }),
});

// Under pm2 this is one of several workers sharing the port, replaced one at a time on a deploy: pm2 waits for the ready
// message before it stops the worker that is being replaced, whose signal lets the requests in flight finish.
// What a worker keeps in memory is only a cache or a counter (see README.md), nothing a request needs from the one before.
const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, ({ address, port }) => {
  console.log(`HammerTime API listening on http://${address}:${port}`);
  announceReady();
});
shutdownGracefully(server as Server, { log: console.log });

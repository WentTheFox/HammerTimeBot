import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { errorBody, ResolvedKey } from './auth.js';
import { Backend, BackendError, RequestSource, Scope } from './backend.js';
import { guard } from './guard.js';
import { createMcpHandler } from './mcp.js';
import { createRateLimits, RateLimits } from './rate-limit.js';
import { commandNames, commandRequestSchemas, commandSummaries } from './generated/commands.js';
import { runCommand } from './run-command.js';
import { ErrorSchema, HealthSchema, KeyInfoSchema, TimestampSchema } from './schemas.js';
import { SettingsPatchSchema, SettingsSchema } from './settings-schema.js';
import { API_VERSION } from './version.js';

export interface AppDependencies {
  backend: Backend;
  /** Injectable for tests */
  now?: () => number;
  telemetryTimeoutMs?: number;
  /** Defaults to the standard limits */
  limits?: RateLimits;
}

export interface AppEnv {
  Variables: { key: ResolvedKey };
}

const pascalCase = (value: string): string => value.replace(/(^|[-_/])(\w)/g, (_, __, char: string) => char.toUpperCase());

/** Same scheme as Luna's OperationIdProcessor: the method plus the path, e.g. GET /settings becomes GetSettings */
const operationId = (method: string, path: string): string => `${pascalCase(method.toLowerCase())}${pascalCase(path)}`;

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

const authResponses = {
  401: json(ErrorSchema, 'The API key is missing, unknown, revoked or expired'),
  403: json(ErrorSchema, 'The API key does not have the scope this endpoint needs'),
  429: json(ErrorSchema, 'Too many requests for this key (or too many failed attempts from this address), wait the number of seconds in Retry-After. Every response carries RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset.'),
  503: json(ErrorSchema, 'The service is read-only while it is being deployed, retry after the number of seconds in Retry-After'),
};

export const createApp = ({ backend, now = Date.now, telemetryTimeoutMs = 1000, limits = createRateLimits({ now }) }: AppDependencies) => {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({
          error: {
            code: 'invalid_request',
            message: 'The request does not match the expected format',
            issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
          },
        }, 400);
      }
    },
  });

  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'An API key created on the HammerTime website, sent as `Authorization: Bearer <key>`',
  });

  app.onError((error, c) => {
    if (error instanceof BackendError) {
      // The failures of the backend that are not the client's doing (it could not be reached, or it answered something
      // unexpected, such as a refused secret), so a misconfiguration shows up in the log instead of as unexplained errors
      if (error.status === 502) {
        console.error(`Backend failure: ${error.message}`);
      }
      const headers: Record<string, string> = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {};
      const body = errorBody(error.status === 400 ? 'invalid_request' : 'backend_error', error.message);
      if (Array.isArray(error.details) && error.details.length > 0) {
        body.error.issues = error.details as { path: string; message: string }[];
      }
      return c.json(body, error.status, headers);
    }
    console.error(error);
    return c.json(errorBody('internal_error', 'Something went wrong'), 500);
  });

  /** The address of the connection, which is only known when running as a server */
  const socketAddress = (c: Context): string | undefined => {
    try {
      return getConnInfo(c).remote.address;
    } catch {
      return undefined;
    }
  };

  const requireScope = (scope: (method: string) => Scope): MiddlewareHandler<AppEnv> => async (c, next) => {
    const guarded = await guard({ backend, limits, request: c.req.raw, socketAddress: socketAddress(c) });
    if (!guarded.ok) {
      return c.json(guarded.body, guarded.status, guarded.headers);
    }
    for (const [name, value] of Object.entries(guarded.headers)) {
      c.header(name, value);
    }

    const needed = scope(c.req.method);
    if (!guarded.key.scopes.includes(needed)) {
      return c.json(errorBody('forbidden', `The API key needs the ${needed} scope`), 403);
    }

    c.set('key', guarded.key);
    await next();
  };

  const source = (key: ResolvedKey): RequestSource => (key.kind === 'service' ? 'discord-bot' : 'api');

  for (const name of commandNames) {
    const path = `/${name}`;
    app.use(path, requireScope(() => 'timestamps:create'));
    app.openapi(
      createRoute({
        method: 'post',
        path,
        operationId: operationId('post', path),
        tags: ['timestamps'],
        summary: commandSummaries[name],
        description: `Equivalent to the bot's /${name} command: the same options, and any option left out falls back to the account's saved settings.`,
        security: [{ BearerAuth: [] }],
        'x-required-scope': 'timestamps:create',
        request: {
          body: { required: true, content: { 'application/json': { schema: commandRequestSchemas[name] } } },
        },
        responses: {
          200: json(TimestampSchema, 'The timestamp, in every format or the requested one'),
          400: json(ErrorSchema, 'The input is invalid, see error.code'),
          ...authResponses,
        },
      }),
      async (c) => {
        const key = c.get('key');
        const result = await runCommand({
          backend,
          name,
          input: c.req.valid('json') as Record<string, unknown>,
          discordUserId: key.discordUserId,
          source: source(key),
          nowMs: now(),
          telemetryTimeoutMs,
        });
        return result.ok ? c.json(result.body, 200) : c.json(result.body, result.status);
      },
    );
  }

  app.use('/settings', requireScope(method => (method === 'GET' ? 'settings:read' : 'settings:write')));
  app.openapi(
    createRoute({
      method: 'get',
      path: '/settings',
      operationId: operationId('get', '/settings'),
      tags: ['settings'],
      summary: 'Read the settings',
      description: 'The saved settings of the account the key acts as. These are the defaults the timestamp endpoints fall back to.',
      security: [{ BearerAuth: [] }],
      'x-required-scope': 'settings:read',
      responses: { 200: json(SettingsSchema, 'The settings'), ...authResponses },
    }),
    async (c) => c.json(await backend.getSettings(c.get('key').discordUserId), 200),
  );
  app.openapi(
    createRoute({
      method: 'patch',
      path: '/settings',
      operationId: operationId('patch', '/settings'),
      tags: ['settings'],
      summary: 'Change the settings',
      description: 'Changes the given settings only. A null value resets a setting to its default.',
      security: [{ BearerAuth: [] }],
      'x-required-scope': 'settings:write',
      request: { body: { required: true, content: { 'application/json': { schema: SettingsPatchSchema } } } },
      responses: {
        200: json(SettingsSchema, 'The settings after the change'),
        400: json(ErrorSchema, 'A value is invalid'),
        ...authResponses,
      },
    }),
    async (c) => c.json(await backend.updateSettings(c.get('key').discordUserId, c.req.valid('json')), 200),
  );

  app.use('/me', requireScope(() => 'settings:read'));
  app.openapi(
    createRoute({
      method: 'get',
      path: '/me',
      operationId: operationId('get', '/me'),
      tags: ['keys'],
      summary: 'Show the key\'s account and permissions',
      description: 'Which account the key acts as and what it is allowed to do.',
      security: [{ BearerAuth: [] }],
      'x-required-scope': 'settings:read',
      responses: { 200: json(KeyInfoSchema, 'The key'), ...authResponses },
    }),
    (c) => {
      const { keyId, kind, discordUserId, scopes } = c.get('key');
      return c.json({ keyId, kind, discordUserId, scopes }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      operationId: operationId('get', '/health'),
      tags: ['server info'],
      summary: 'Check that the service is up',
      description: 'Whether the service is up.',
      security: [],
      responses: { 200: json(HealthSchema, 'The service is up') },
    }),
    (c) => c.json({ status: 'ok' as const }, 200),
  );

  app.doc('/generated/api-docs.json', {
    openapi: '3.0.0',
    info: {
      title: 'HammerTime API',
      version: API_VERSION,
      description: 'Generate Discord timestamps and manage the settings of the HammerTime bot. Every timestamp endpoint is the bot command of the same name. The same commands are available to AI assistants as tools of the MCP server at /mcp, with the same API keys.',
    },
    servers: [{ url: '/', description: 'Current Host' }],
    tags: [
      { name: 'timestamps', description: 'Bot commands as endpoints' },
      { name: 'settings', description: 'The bot settings of the account' },
      { name: 'keys', description: 'About the API key in use' },
      { name: 'server info', description: 'Service status' },
    ],
  });
  app.get('/', swaggerUI({ url: '/generated/api-docs.json' }));

  // The MCP endpoint is not REST, so it is not part of the OpenAPI document
  const mcp = createMcpHandler({ backend, limits, now, telemetryTimeoutMs });
  app.all('/mcp', (c) => mcp(c.req.raw, socketAddress(c)));

  return app;
};

export { API_VERSION };
export type App = ReturnType<typeof createApp>;

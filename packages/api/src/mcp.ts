import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorBody, ResolvedKey } from './auth.js';
import { Backend, BackendError, Scope } from './backend.js';
import { commandNames, commandRequestSchemas, commandSummaries } from './generated/commands.js';
import { guard } from './guard.js';
import type { RateLimits } from './rate-limit.js';
import { runCommand } from './run-command.js';
import type { ErrorBody, TimestampBody } from './schemas.js';
import { SettingsPatch, SettingsPatchSchema } from './settings-schema.js';
import { API_VERSION } from './version.js';

export interface McpDependencies {
  backend: Backend;
  limits: RateLimits;
  /** Injectable for tests */
  now?: () => number;
  telemetryTimeoutMs?: number;
}

const INSTRUCTIONS = [
  'Generates Discord timestamps and manages the HammerTime bot settings of one Discord account.',
  'Every timestamp tool is the HammerTime bot command of the same name with the same options, and any option left out falls back to',
  "the account's saved settings. The tool result is the reply the bot would send: markdown to paste into Discord, such as <t:1650802953:R>.",
].join(' ');

const text = (value: string, extra: Partial<CallToolResult> = {}): CallToolResult => ({ content: [{ type: 'text', text: value }], ...extra });

const failure = (body: ErrorBody): CallToolResult => text(body.error.message, { isError: true, structuredContent: body });

/** The reply of the bot, followed by the telemetry note when the account has not opted out */
const timestampText = ({ content, telemetry }: TimestampBody): string => (telemetry ? `${content}\n\n${telemetry.note}` : content);

/** A failure of the backend, e.g. the read-only window of a deploy, as the tool's error instead of a protocol error */
const backendFailure = (error: unknown): CallToolResult => {
  if (error instanceof BackendError) {
    const retry = error.retryAfter ? ` Try again in ${error.retryAfter} seconds.` : '';
    return failure(errorBody('backend_error', `${error.message}.${retry}`.replace('..', '.')));
  }
  throw error;
};

/**
 * One MCP server for one request. The endpoint is stateless, so what a key is allowed to do is decided here, per
 * request, and the key only sees the tools it can use.
 */
const createServer = (key: ResolvedKey, { backend, now = Date.now, telemetryTimeoutMs = 1000 }: McpDependencies): McpServer => {
  const server = new McpServer({ name: 'hammertime', version: API_VERSION }, { instructions: INSTRUCTIONS });
  const can = (scope: Scope) => key.scopes.includes(scope);

  if (can('timestamps:create')) {
    for (const name of commandNames) {
      server.registerTool(
        name,
        {
          title: `/${name}`,
          description: `${commandSummaries[name]}. Equivalent to the bot's /${name} command.`,
          // The same generated schemas as the REST endpoints, so the names, types and bounds are the command's options
          inputSchema: commandRequestSchemas[name].shape,
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (args: Record<string, unknown>) => {
          try {
            const result = await runCommand({
              backend,
              name,
              input: args,
              discordUserId: key.discordUserId,
              source: 'mcp',
              nowMs: now(),
              telemetryTimeoutMs,
            });
            return result.ok ? text(timestampText(result.body), { structuredContent: result.body }) : failure(result.body);
          } catch (error) {
            return backendFailure(error);
          }
        },
      );
    }
  }

  if (can('settings:read') || can('settings:write')) {
    server.registerTool(
      'settings',
      {
        title: '/settings',
        description: [
          'Reads the bot settings of the account, or changes them.',
          'Without arguments it returns the saved settings. With arguments it changes only those settings, and null resets one to its default.',
          'The saved settings are the defaults the timestamp tools fall back to.',
        ].join(' '),
        inputSchema: SettingsPatchSchema.shape,
      },
      async (args) => {
        const patch = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined)) as SettingsPatch;
        const changing = Object.keys(patch).length > 0;
        const needed: Scope = changing ? 'settings:write' : 'settings:read';
        if (!can(needed)) {
          return failure(errorBody('forbidden', `The API key needs the ${needed} scope`));
        }

        try {
          const settings = changing
            ? await backend.updateSettings(key.discordUserId, patch)
            : await backend.getSettings(key.discordUserId);
          return text(JSON.stringify(settings, null, 2), { structuredContent: { ...settings } });
        } catch (error) {
          return backendFailure(error);
        }
      },
    );
  }

  return server;
};

/**
 * The MCP endpoint (Streamable HTTP), with the same API keys as the REST endpoints. A key acts as the one Discord
 * account it was created for, so the bot's service key, which names the account per request, is not accepted here.
 */
export const createMcpHandler = (dependencies: McpDependencies) => async (request: Request, socketAddress?: string): Promise<Response> => {
  const guarded = await guard({
    backend: dependencies.backend,
    limits: dependencies.limits,
    request,
    socketAddress,
    allowServiceKeys: false,
  });
  if (!guarded.ok) {
    return Response.json(guarded.body, { status: guarded.status, headers: guarded.headers });
  }

  const server = createServer(guarded.key, dependencies);
  // Stateless, and answers with plain JSON: nothing is kept between requests, so there is nothing to clean up later
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    // A new response, the transport's headers are not necessarily ours to change
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(guarded.headers)) {
      headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } finally {
    await transport.close();
    await server.close();
  }
};

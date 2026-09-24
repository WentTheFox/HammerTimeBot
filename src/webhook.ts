import { createServer, IncomingMessage } from 'node:http';
import {
  createWebhookOnlyClient,
  handleWebhookInteractionRequest,
  interactionFromWebhookPayload,
} from '@went.tf/discord-bot-framework/webhook';
import {
  dispatchAutocomplete,
  dispatchChatInputCommand,
  dispatchComponent,
  dispatchContextMenu,
  OnDispatchError,
} from '@went.tf/discord-bot-framework/interactions';
import { APIInteraction, InteractionType, MessageFlags } from 'discord-api-types/v10';
import { RESTEvents } from '@discordjs/rest';
import { env } from './env.js';
import { initI18next } from './constants/locales.js';
import { getEmojiIdMap } from './utils/get-emoji-id-map.js';
import { getCommandIdMap } from './utils/get-command-id-map.js';
import { createAppLogger } from './utils/create-app-logger.js';
import { InteractionHandlerContext, UserInteractionContext } from './types/bot-interaction.js';
import { buildUserInteractionContext } from './utils/build-user-interaction-context.js';
import { handleInteractionError } from './utils/interaction-handlers/handle-interaction-error.js';
import { interactionReply } from './utils/interaction-reply.js';
import { chatInputCommandRegistry, componentRegistry, contextMenuCommandRegistry } from './utils/interactions/registries.js';
import { sendCommandTelemetry, sendWebhookDelivery } from './utils/backend-api-data-updaters.js';
import { addTelemetryNoteToReply } from './utils/add-telemetry-note-to-reply.js';
import { getUserIdentifier } from './utils/messaging.js';
import { trackFirstAckTimestamp } from './utils/track-first-ack-timestamp.js';
import { describeSlowWebhookDelivery, WebhookDeliveryTiming } from './utils/describe-slow-webhook-delivery.js';

// This is the bot's only entry point: an HTTP Interactions Endpoint, not a gateway connection, so
// there's no ShardingManager here - concurrency is whatever the process/PM2/nginx in front of it
// provides instead. See CLAUDE.md's ./webhook entry in discord-bot-framework for why this exists.

const readRawBody = (req: IncomingMessage): Promise<Buffer> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

(async () => {
  const logger = createAppLogger('Webhook');
  const [i18next, emojiIdMap, commandIdMap] = await Promise.all([
    initI18next(logger),
    getEmojiIdMap({ logger }),
    getCommandIdMap({ logger }),
  ]);
  const context: InteractionHandlerContext = { i18next, emojiIdMap, commandIdMap, logger, isWebhookMode: true };

  logger.log('Creating webhook-only client');
  const client = createWebhookOnlyClient({ token: env.DISCORD_BOT_TOKEN });
  // A rate-limit wait on the interaction-callback route would otherwise be invisible - it just shows
  // up as a slow reply()/respond(). Deliberately not logging `url`/`majorParameter`, which can carry
  // an interaction token.
  client.rest.on(RESTEvents.RateLimited, ({ method, route, scope, global, retryAfter, sublimitTimeout }) => {
    logger.warn(`REST rate limited: ${method.toUpperCase()} ${route} (scope=${scope}, global=${global}), retryAfter=${retryAfter}ms, sublimitTimeout=${sublimitTimeout}ms`);
  });

  const onError: OnDispatchError<UserInteractionContext> = async (interaction, dispatchContext) => {
    await handleInteractionError(interaction as Parameters<typeof handleInteractionError>[0], dispatchContext);
  };

  const createOnInteraction = (timing: WebhookDeliveryTiming) => async (data: APIInteraction) => {
    const interaction = interactionFromWebhookPayload(client, data);
    timing.interactionId = interaction.id;
    timing.interactionCreatedAt = interaction.createdTimestamp;
    timing.interactionDescription = [
      InteractionType[interaction.type],
      'commandName' in interaction ? `/${interaction.commandName}` : undefined,
      'customId' in interaction ? `customId=${interaction.customId}` : undefined,
    ].filter(Boolean).join(' ');
    trackFirstAckTimestamp(interaction, timing);
    const userInteractionContext = await buildUserInteractionContext(interaction, context);
    const { logger: interactionLogger } = userInteractionContext;

    if (interaction.isChatInputCommand()) {
      interactionLogger.log(`${getUserIdentifier(interaction.user)} ran /${interaction.commandName} (webhook)`);

      await dispatchChatInputCommand(interaction, userInteractionContext, {
        commands: chatInputCommandRegistry.byName,
        onUnknownCommand: async (i) => {
          await interactionReply(userInteractionContext, i, { content: `Unknown command ${i.commandName}` });
        },
        onError,
      });

      // sendCommandTelemetry never rejects on its own, but addTelemetryNoteToReply's own REST
      // call (interaction.editReply()) isn't similarly guarded - this is void-fired with no other
      // handler, so an unhandled rejection here would otherwise depend on Node's default behavior
      // rather than anything this codebase controls.
      void sendCommandTelemetry(userInteractionContext, interaction)
        .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse))
        .catch((error: unknown) => {
          interactionLogger.error('Failed to add telemetry note to reply', error);
        });
      return;
    }

    if (interaction.isAutocomplete()) {
      await dispatchAutocomplete(interaction, userInteractionContext, {
        commands: chatInputCommandRegistry.byName,
        onError,
      });
      return;
    }

    if (interaction.isMessageComponent()) {
      interactionLogger.log(`${getUserIdentifier(interaction.user)} interacted with component "${interaction.customId}" (webhook)`);

      await dispatchComponent(interaction, userInteractionContext, {
        components: componentRegistry.byName,
        onUnknownComponent: async (i) => {
          await interactionReply(userInteractionContext, i, {
            content: `Unsupported component interaction with customId ${i.customId}`,
            flags: MessageFlags.Ephemeral,
          });
        },
        onError,
      });
      return;
    }

    if (interaction.isMessageContextMenuCommand()) {
      interactionLogger.log(`${getUserIdentifier(interaction.user)} ran "${interaction.commandName}" (webhook)`);

      await dispatchContextMenu(interaction, userInteractionContext, {
        contextMenuCommands: contextMenuCommandRegistry.byName,
        onUnknownCommand: async (i) => {
          await interactionReply(userInteractionContext, i, {
            content: `Unsupported context menu interaction with name ${i.commandName}`,
            flags: MessageFlags.Ephemeral,
          });
        },
        onError,
      });

      // sendCommandTelemetry never rejects on its own, but addTelemetryNoteToReply's own REST
      // call (interaction.editReply()) isn't similarly guarded - this is void-fired with no other
      // handler, so an unhandled rejection here would otherwise depend on Node's default behavior
      // rather than anything this codebase controls.
      void sendCommandTelemetry(userInteractionContext, interaction)
        .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse))
        .catch((error: unknown) => {
          interactionLogger.error('Failed to add telemetry note to reply', error);
        });
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      await interactionReply(userInteractionContext, interaction, {
        content: `Unsupported command type ${interaction.commandType} when running ${interaction.commandName}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    throw new Error(`Unhandled interaction of type ${interaction.type}`);
  };

  const webhookPath = `/${env.WEBHOOK_PATH_SECRET}`;

  const server = createServer((req, res) => {
    // The path itself is the "is this actually Discord" check - keeps internet-scanner/health-check
    // noise that will never know the secret path out of the signature-rejection logs. See
    // WEBHOOK_PATH_SECRET's doc comment in env.ts.
    if (req.method !== 'POST' || req.url !== webhookPath) {
      res.writeHead(404).end();
      return;
    }

    const deliveryStartedAt = new Date();
    const signatureTimestamp = Number(req.headers['x-signature-timestamp']);
    // ackedAt is populated by trackFirstAckTimestamp the moment the interaction's
    // reply/deferReply/etc. resolves (a real REST call to Discord, independent of this response) -
    // see its doc comment. Falls back to "whenever we're done" for requests that never get that far
    // (signature rejections, a Ping, an error before any reply) so duration_ms still means something
    // for those. The rest of this is only for the slow-delivery breakdown logged below.
    const timing: WebhookDeliveryTiming = {
      receivedAt: deliveryStartedAt.getTime(),
      finishedAt: NaN,
      signedAtSeconds: Number.isFinite(signatureTimestamp) ? signatureTimestamp : undefined,
    };
    const durationMs = () => (timing.ackedAt ?? Date.now()) - deliveryStartedAt.getTime();
    const logIfSlow = () => {
      timing.finishedAt = Date.now();
      const slowDeliveryMessage = describeSlowWebhookDelivery(timing);
      if (slowDeliveryMessage) {
        logger.nest(`Interaction#${timing.interactionId}`).warn(slowDeliveryMessage);
      }
    };

    readRawBody(req)
      .then(async (rawBody) => {
        // Signature-rejection diagnostics (source IP, user-agent, header presence, lengths,
        // and - when WEBHOOK_VERBOSE_DIAGNOSTICS is set - the exact signature/timestamp, a
        // body hash, and type/id if the body parses as JSON) are logged by
        // handleWebhookInteractionRequest itself as of discord-bot-framework 2.7.0/2.8.0.
        // muteKnownConformanceCheckLogs (default true, as of 2.10.0) quiets that log for Discord's
        // own recurring signature-conformance check - still gets rejected exactly the same, just
        // without the expected, recurring WARN/DEBUG noise. applicationId narrows the match further.
        const { status, body } = await handleWebhookInteractionRequest({
          signature: req.headers['x-signature-ed25519'] as string | undefined,
          timestamp: req.headers['x-signature-timestamp'] as string | undefined,
          rawBody,
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]),
          ),
        }, {
          publicKey: env.DISCORD_PUBLIC_KEY,
          applicationId: env.DISCORD_CLIENT_ID,
          logger,
          onInteraction: createOnInteraction(timing),
          verboseSignatureDiagnostics: env.WEBHOOK_VERBOSE_DIAGNOSTICS,
        });

        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        logIfSlow();
        // Fire-and-forget: don't hold up the actual Discord response on this.
        void sendWebhookDelivery(context, {
          status_code: status,
          duration_ms: durationMs(),
          occurred_at: deliveryStartedAt.toISOString(),
        });
      })
      .catch((e: unknown) => {
        logger.error('Failed to handle webhook interaction request', e);
        res.writeHead(500).end();
        logIfSlow();
        void sendWebhookDelivery(context, {
          status_code: 500,
          duration_ms: durationMs(),
          occurred_at: deliveryStartedAt.toISOString(),
        });
      });
  });

  server.listen(env.WEBHOOK_PORT, () => {
    logger.log(`Listening on port ${env.WEBHOOK_PORT}`);
  });
})();

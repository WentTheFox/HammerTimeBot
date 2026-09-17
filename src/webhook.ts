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

// This is the HTTP Interactions Endpoint entrypoint - the webhook-mode counterpart to bot.ts, which
// gets its interactions over the gateway instead. No ShardingManager here: webhook mode has no
// gateway connection to shard, so concurrency is whatever the process/PM2/nginx in front of it
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

  const onError: OnDispatchError<UserInteractionContext> = async (interaction, dispatchContext) => {
    await handleInteractionError(interaction as Parameters<typeof handleInteractionError>[0], dispatchContext);
  };

  const onInteraction = async (data: APIInteraction) => {
    const interaction = interactionFromWebhookPayload(client, data);
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

      void sendCommandTelemetry(userInteractionContext, interaction)
        .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
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

      void sendCommandTelemetry(userInteractionContext, interaction)
        .then((telemetryResponse) => addTelemetryNoteToReply(userInteractionContext, interaction, telemetryResponse));
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

  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404).end();
      return;
    }

    const deliveryStartedAt = new Date();

    readRawBody(req)
      .then(async (rawBody) => {
        // Signature-rejection diagnostics (source IP, user-agent, header presence, lengths,
        // and - when WEBHOOK_VERBOSE_DIAGNOSTICS is set - the exact signature/timestamp, a
        // body hash, and type/id if the body parses as JSON) are logged by
        // handleWebhookInteractionRequest itself as of discord-bot-framework 2.7.0/2.8.0.
        const { status, body } = await handleWebhookInteractionRequest({
          signature: req.headers['x-signature-ed25519'] as string | undefined,
          timestamp: req.headers['x-signature-timestamp'] as string | undefined,
          rawBody,
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]),
          ),
        }, {
          publicKey: env.DISCORD_PUBLIC_KEY,
          logger,
          onInteraction,
          verboseSignatureDiagnostics: env.WEBHOOK_VERBOSE_DIAGNOSTICS,
        });

        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        // Fire-and-forget: don't hold up the actual Discord response on this.
        void sendWebhookDelivery(context, {
          status_code: status,
          duration_ms: Date.now() - deliveryStartedAt.getTime(),
          occurred_at: deliveryStartedAt.toISOString(),
        });
      })
      .catch((e: unknown) => {
        logger.error('Failed to handle webhook interaction request', e);
        res.writeHead(500).end();
        void sendWebhookDelivery(context, {
          status_code: 500,
          duration_ms: Date.now() - deliveryStartedAt.getTime(),
          occurred_at: deliveryStartedAt.toISOString(),
        });
      });
  });

  server.listen(env.WEBHOOK_PORT, () => {
    logger.log(`Listening on port ${env.WEBHOOK_PORT}`);
  });
})();

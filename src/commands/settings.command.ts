import { BotChatInputCommand } from '../types/bot-interaction.js';
import { getLocalizedObject } from '../utils/get-localized-object.js';
import {
  APIMessageTopLevelComponent,
  ApplicationCommandType,
  ButtonStyle,
  ComponentType,
  MessageFlags
} from 'discord-api-types/v10';
import { env } from '../env.js';
import { EmojiCharacters } from '../constants/emoji-characters.js';
import { MessageTimestamp, MessageTimestampFormat } from '../classes/message-timestamp.js';
import { backendApiRequest } from '../utils/backend-api-request.js';
import typia from 'typia';

interface LoginLinkResponse {
  loginUrl: string;
  expiresAt: number;
}

export const settingsCommand: BotChatInputCommand = {
  getDefinition: (t) => ({
    type: ApplicationCommandType.ChatInput,
    ...getLocalizedObject('description', (lng) => t('commands.settings.description', { lng })),
    ...getLocalizedObject('name', (lng) => t('commands.settings.name', { lng })),
  }),
  async handle(interaction, context) {
    const messageFlags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
    await interaction.deferReply({ flags: messageFlags });
    const { t } = context;
    const { locale, user } = interaction;

    const loginUrl = `${env.API_URL}/${locale}/login`;
    const settingsUrl = `${env.API_URL}/${locale}/settings`;
    const  { response, validation } = await backendApiRequest(context, {
      path: `/login-link/${user.id}/${locale}`,
      method: 'POST',
      body: {
        name: user.username,
        display_name: user.globalName,
        discriminator: user.discriminator,
        avatar: user.avatar,
      },
      validator: typia.createValidate<LoginLinkResponse>(),
      failOnInvalidResponse: false,
    });
    if (!validation.success) {
      await interaction.editReply({
        flags: messageFlags,
        components: [
          {
            type: ComponentType.TextDisplay,
            content: `${EmojiCharacters.WARNING_SIGN} ${t('commands.settings.responses.failedToCreateLink', {
              loginUrl,
              settingsUrl,
            })}`,
          },
        ],
      });
      return;
    }

    const magicLink = response.loginUrl;
    const expiresAt = MessageTimestamp.fromTimestamp(response.expiresAt, MessageTimestampFormat.RELATIVE);

    const contentLines = t('commands.settings.responses.linkCreated', { expiresAt, magicLink, loginUrl, settingsUrl }).split(/\n/g);

    await interaction.editReply({
      flags: messageFlags,
      components: contentLines.map((line): APIMessageTopLevelComponent => (
        line.includes(magicLink)
          ? {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                url: magicLink,
                label: t('commands.settings.components.openSettingsButton'),
                style: ButtonStyle.Link,
              },
            ],
          }
          : {
            type: ComponentType.TextDisplay,
            content: line,
          }
      )),
    });
  },
};

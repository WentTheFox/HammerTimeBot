import { DEFAULT_LANGUAGE } from '../../constants/locales.js';
import { InteractionHandlerContext } from '../../types/bot-interaction.js';

interface CreateTFunctionOptions {
  i18next: InteractionHandlerContext['i18next'];
  ephemeral: boolean | null;
  locale: string;
  guild: { preferredLocale?: string } | undefined | null;
}

export const createTFunction = ({ i18next, ephemeral, locale, guild }: CreateTFunctionOptions) => {
  return i18next.getFixedT(
    // Always use user's locale for ephemeral responses, otherwise use server's preferred locale when available
    ephemeral
      ? [locale, DEFAULT_LANGUAGE] :
      (
        guild?.preferredLocale
          ? [guild.preferredLocale, DEFAULT_LANGUAGE]
          : DEFAULT_LANGUAGE
      ),
  );
};

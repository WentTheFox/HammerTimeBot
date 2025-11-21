import path from 'path';
import { promises as fs } from 'fs';
import { LanguageConfigV1 } from '../../src/types/legacy.js';
import { LanguageConfigV2, LatestLanguageConfigType } from '../../src/types/language-config.js';
import { Locale } from 'discord-api-types/v10';
import { TranslationCreditOverride } from '../../src/types/translation-credit-override.js';
import { reportData } from './crowdin-types.js';

interface PublicLocalesConfig<V extends number = number> {
  version: V;
  languages: Record<Locale, V extends 1 ? LanguageConfigV1 : V extends 2 ? LanguageConfigV2 : LatestLanguageConfigType>;
}

export const forEachLanguage = (configContent: PublicLocalesConfig, iterator: (language: Locale) => void) => {
  const languages = Object.keys(configContent.languages) as Locale[];
  languages.forEach(iterator);
};

/**
 * @return whether any migrations were executed
 */
const runMigration = (currentConfig: PublicLocalesConfig): PublicLocalesConfig => {
  const { version, ...configContent } = currentConfig;
  let migratedConfigContent: PublicLocalesConfig = currentConfig;
  /* eslint-disable no-fallthrough */
  // noinspection FallThroughInSwitchStatementJS
  switch (version) {
    case undefined:
      migratedConfigContent = { version: 1, ...configContent };
    case 1: {
      const previousVersionContent = migratedConfigContent as unknown as PublicLocalesConfig<1>;
      migratedConfigContent = { version: 2, languages: {} } as PublicLocalesConfig<2>;
      forEachLanguage(previousVersionContent, (language) => {
        const { credits, ...rest } = previousVersionContent.languages[language];
        migratedConfigContent.languages[language] = rest;

        if (Array.isArray(credits) && credits.length > 0) {
          const creditOverrides: LanguageConfigV2['creditOverrides'] = {};
          credits.forEach((credit) => {
            if (!credit.url && !credit.displayName) {
              return;
            }
            const override: TranslationCreditOverride = {};
            if (credit.displayName) {
              override.displayName = credit.displayName;
            }
            if (credit.url) {
              override.url = credit.url;
            }

            const userDataEntry = Object.entries(reportData.users).find(([,u]) => u?.username === credit.crowdin);
            if (!userDataEntry) {
              throw new Error('No data found for user ' + credit.crowdin);
            }
            creditOverrides[userDataEntry[0]] = override;
          });
          if (Object.keys(creditOverrides).length > 0) {
            migratedConfigContent.languages[language].creditOverrides = creditOverrides;
          }
        }
      });
    }
    // Add new migrations here
  }
  /* eslint-enable no-fallthrough */

  return migratedConfigContent;
};

export async function migrateLanguageConfig(rootDir: string): Promise<void> {
  const localesConfigPath = path.join(rootDir, 'src', 'locales', 'config.json');
  const configContentString = await fs.readFile(localesConfigPath, 'utf8').then((r) => r.toString());
  const configContent = JSON.parse(configContentString) as PublicLocalesConfig;
  const version = configContent.version;
  console.info(`Migrating public locales config from version ${version}…`);
  const migratedConfigContent = runMigration(configContent);
  if (migratedConfigContent === configContent) {
    console.info('Locales config is already the latest version, no migration needed');
    return;
  }

  // Save migrated config
  console.info(`Writing migrated locale config with version ${migratedConfigContent.version}…`);
  // Add final newline for cleaner Git diffs
  const finalConfigContent = `${JSON.stringify(migratedConfigContent, null, 2)}\n`;
  await fs.writeFile(localesConfigPath, finalConfigContent, 'utf8');

  console.info('Public locales config migrated successfully.');
}

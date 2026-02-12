import { describe, expect, it } from 'vitest';
import { reformatCommandNamesInContent } from './interaction-reply.js';
import { createTFunction } from './interaction-handlers.js';
import { Locale } from 'discord-api-types/v10';
import { initI18next } from '../constants/locales.js';
import { DevNullLogger } from '../classes/dev-null-logger.js';

describe('reformatCommandNamesInContent', async () => {
  const t = createTFunction({
    i18next: await initI18next(new DevNullLogger()),
    ephemeral: null,
    locale: Locale.EnglishUS,
    guild: null,
  });
  it('should replace command names that it knows about', () => {
    const commandIdMap = { test: '42' };
    const result = reformatCommandNamesInContent('This is a `/test` command', { commandIdMap, t });
    expect(result).toEqual('This is a </test:42> command');
  });
  it('should not replace command names that it does not know about', () => {
    const commandIdMap = {};
    const content = 'This is a `/different` command';
    const result = reformatCommandNamesInContent(content, { commandIdMap, t });
    expect(result).toEqual(content);
  });
});

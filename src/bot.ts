import { createClient } from './utils/client.js';
import { initI18next } from './constants/locales.js';
import { getEmojiIdMap } from './utils/get-emoji-id-map.js';
import { createAppLogger } from './utils/create-app-logger.js';
import { getCommandIdMap } from './utils/get-command-id-map.js';

(async () => {
  const logger = createAppLogger(`Shard#${process.env.SHARDS ?? ''}`);
  const [i18next, emojiIdMap, commandIdMap] = await Promise.all([
    initI18next(logger),
    getEmojiIdMap({ logger }),
    getCommandIdMap({ logger }),
  ]);

  logger.log('Creating client');
  await createClient({ i18next, emojiIdMap, commandIdMap, logger });
})();

import moment from 'moment-timezone';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createClient } from './utils/client.js';
import { initI18next } from './constants/locales.js';
import { getApplicationEmojis } from './utils/get-application-emojis.js';
import { Logger } from './classes/logger.js';
import { createResolvablePromise } from './utils/resolvable-promise.js';

(async () => {
  const logger = Logger.fromShardInfo(process.env.SHARDS);
  const [, i18next, emojiIdMap] = await Promise.all([
    (async () => {
      const tzDataPath = join('.', 'node_modules', 'moment-timezone', 'data', 'packed', 'latest.json');
      logger.log(`Loading timezone data from ${tzDataPath}`);
      const data = await fs.readFile(tzDataPath).then((contents) => JSON.parse(contents.toString()));
      moment.tz.load(data);
    })(),
    initI18next(logger),
    getApplicationEmojis({ logger }),
  ]);

  logger.log('Creating client');
  const commandIdMap = createResolvablePromise<Record<string, string | undefined>>();
  await createClient({ i18next, emojiIdMap, commandIdMap, logger });
})();

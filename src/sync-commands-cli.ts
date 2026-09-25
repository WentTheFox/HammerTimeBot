import { syncStartupData } from './utils/sync-startup-data.js';
import { createAppLogger } from './utils/create-app-logger.js';

// Standalone entry point for the deploy hook: registers commands and syncs FAQ/timezone data
// without needing to touch the long-lived webhook.js process.
// `npm run sync-commands -- --force` re-registers commands even if they look unchanged.

await syncStartupData(createAppLogger('SyncCommandsCli'), {
  forceCommandUpdate: process.argv.includes('--force'),
});

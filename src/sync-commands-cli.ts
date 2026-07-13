import { syncStartupData } from './utils/sync-startup-data.js';
import { createAppLogger } from './utils/create-app-logger.js';

// Standalone entry point for the deploy hook: registers commands and syncs FAQ/timezone data
// without needing to touch the long-lived ShardingManager process.

await syncStartupData(createAppLogger('SyncCommandsCli'));

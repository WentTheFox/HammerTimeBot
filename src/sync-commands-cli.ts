import { Logger } from './classes/logger.js';
import { syncStartupData } from './utils/sync-startup-data.js';

// Standalone entry point for the deploy hook: registers commands and syncs FAQ/timezone data
// without needing to touch the long-lived ShardingManager process.

await syncStartupData(new Logger('SyncCommandsCli'));

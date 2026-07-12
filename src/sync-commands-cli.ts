import { Logger } from '@wentthefox-org/discord-bot-framework/logger';
import { syncStartupData } from './utils/sync-startup-data.js';

// Standalone entry point for the deploy hook: registers commands and syncs FAQ/timezone data
// without needing to touch the long-lived ShardingManager process.

await syncStartupData(new Logger('SyncCommandsCli'));

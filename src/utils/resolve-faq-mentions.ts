import { APIChannel, APIRole, APIUser, Routes } from 'discord-api-types/v10';
import { ILogger } from '../types/logger-types.js';
import { env } from '../env.js';
import { rest } from './rest.js';

const CHANNEL_RE = /<#(\d+)>/g;
const USER_RE = /<@!?(\d+)>/g;
const ROLE_RE = /<@&(\d+)>/g;

export interface MentionPair {
  id: string;
  name: string;
}

export interface ResolvedMentions {
  channels: MentionPair[];
  users: MentionPair[];
  roles: MentionPair[];
}

function extractIds(pattern: RegExp, texts: string[]): string[] {
  const ids = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

async function resolveChannels(ids: string[], logger: ILogger): Promise<MentionPair[]> {
  const results = await Promise.all(ids.map(async (id): Promise<MentionPair | null> => {
    try {
      const channel = await rest.get(Routes.channel(id)) as APIChannel;
      return { id, name: ('name' in channel && channel.name) ? channel.name : id };
    } catch (e) {
      logger.warn(`Failed to resolve channel ${id}:`, e);
      return null;
    }
  }));
  return results.filter((r): r is MentionPair => r !== null);
}

async function resolveUsers(ids: string[], logger: ILogger): Promise<MentionPair[]> {
  const results = await Promise.all(ids.map(async (id): Promise<MentionPair | null> => {
    try {
      const user = await rest.get(Routes.user(id)) as APIUser;
      return { id, name: user.global_name ?? user.username };
    } catch (e) {
      logger.warn(`Failed to resolve user ${id}:`, e);
      return null;
    }
  }));
  return results.filter((r): r is MentionPair => r !== null);
}

async function resolveRoles(ids: string[], logger: ILogger): Promise<MentionPair[]> {
  if (!env.SUPPORT_SERVER_ID || ids.length === 0) return [];
  try {
    const allRoles = await rest.get(Routes.guildRoles(env.SUPPORT_SERVER_ID)) as APIRole[];
    const roleMap = new Map(allRoles.map((r) => [r.id, r.name]));
    return ids.map((id) => ({ id, name: roleMap.get(id) ?? id }));
  } catch (e) {
    logger.warn('Failed to resolve roles:', e);
    return [];
  }
}

export async function resolveFaqMentions(texts: string[], logger: ILogger): Promise<ResolvedMentions> {
  const channelIds = extractIds(CHANNEL_RE, texts);
  const userIds = extractIds(USER_RE, texts);
  const roleIds = extractIds(ROLE_RE, texts);

  const [channels, users, roles] = await Promise.all([
    resolveChannels(channelIds, logger),
    resolveUsers(userIds, logger),
    resolveRoles(roleIds, logger),
  ]);

  return { channels, users, roles };
}

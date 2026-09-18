/**
 * Discord's own official system user - see
 * https://discord.com/developers/docs, sent as `user` on the payload this recognizes below.
 */
const DISCORD_SYSTEM_USER_ID = '643945264868098049';

/**
 * Recognizes a recurring, confirmed-benign pattern: a `Ping` (type 1) interaction payload,
 * "from" Discord's own official system user, deliberately signed with a signature that doesn't
 * verify against this app's public key. Everything else about it is genuine (real Discord source
 * IP, `Discord-Interactions/1.0` UA, correct `application_id`) - manually re-verifying a captured
 * sample confirmed the signature itself is the only thing wrong, and the app's public key has never
 * changed, so the most plausible explanation is Discord intentionally testing that this endpoint
 * actually rejects an invalid signature rather than trusting anything that looks like a Discord
 * request. Rejecting it is correct either way - this only exists to keep that expected, recurring
 * rejection out of the logs without touching how any other rejection is handled.
 *
 * Deliberately checks the interaction's shape, not just its size - a fixed byte length is
 * incidental and could shift if Discord adds/removes a field, but `type`+official system user is
 * what actually identifies this case.
 */
export function isDiscordSignatureConformanceCheck(rawBody: Buffer, applicationId: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return false;
  }

  if (typeof parsed !== 'object' || parsed === null) return false;
  const body = parsed as Record<string, unknown>;
  if (body.type !== 1) return false;
  if (body.application_id !== applicationId) return false;

  const user = body.user;
  if (typeof user !== 'object' || user === null) return false;
  const { id, system, bot } = user as Record<string, unknown>;
  return id === DISCORD_SYSTEM_USER_ID && system === true && bot === true;
}

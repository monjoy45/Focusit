import type { SessionState } from './session';

/** Matches exactly the two supported sites, same scope as the manifest's host_permissions. */
export const WATCHED_HOST_PATTERN = /^(www\.|m\.)?youtube\.com$|^(www\.)?instagram\.com$/;

/**
 * True once a planned session has ended (timed out or ended manually) and no new one has
 * started yet -- the "locked until you deliberately renew it" window the person asked for.
 * Never true before a session has ever run, so default/no-session browsing is unaffected.
 */
export function isLockedOut(session: Pick<SessionState, 'active' | 'endedAt'>): boolean {
  return !session.active && session.endedAt !== null;
}

/** Guards against a malformed URL (e.g. a non-http(s) scheme) rather than throwing. */
export function isWatchedUrl(url: string): boolean {
  try {
    return WATCHED_HOST_PATTERN.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

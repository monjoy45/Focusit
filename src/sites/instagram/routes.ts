export type InstagramRoute = 'home' | 'reels' | 'explore' | 'direct' | 'post' | 'stories' | 'accounts' | 'profile' | 'other';

/** First path segments that are app sections, not usernames. */
const RESERVED = new Set(['about', 'api', 'challenge', 'developer', 'directory', 'download', 'emails', 'graphql', 'legal', 'lite', 'nametag', 'press', 'privacy', 'session', 'tv', 'web']);

export function resolveInstagramRoute(pathname: string): InstagramRoute {
  const segs = pathname.split('/').filter(Boolean).map((s) => s.toLowerCase());
  const first = segs[0];
  if (first === undefined) return 'home';
  if (first === 'reels' || first === 'reel') return 'reels';
  if (first === 'explore') return 'explore';
  if (first === 'direct') return 'direct';
  if (first === 'p') return 'post';
  if (first === 'stories') return 'stories';
  if (first === 'accounts') return 'accounts';
  if (RESERVED.has(first)) return 'other';
  // Legacy per-user URLs: /<user>/reel/<id> and /<user>/p/<id>
  if (segs[1] === 'reel') return 'reels';
  if (segs[1] === 'p') return 'post';
  return 'profile';
}

export type YouTubeRoute = 'home' | 'watch' | 'shorts' | 'search' | 'subscriptions' | 'history' | 'playlist' | 'channel' | 'feed' | 'other';

export function resolveYouTubeRoute(pathname: string): YouTubeRoute {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  if (p === '/watch' || /^\/live\/[^/]+$/.test(p)) return 'watch';
  if (/^\/shorts(\/|$)/.test(p)) return 'shorts';
  if (p === '/results') return 'search';
  if (p === '/feed/subscriptions') return 'subscriptions';
  if (p === '/feed/history') return 'history';
  if (p.startsWith('/feed/')) return 'feed';
  if (p === '/playlist') return 'playlist';
  if (/^\/(@[^/]+|channel\/|c\/|user\/)/.test(p)) return 'channel';
  return 'other';
}

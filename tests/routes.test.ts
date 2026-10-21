import { describe, it, expect } from 'vitest';
import { resolveYouTubeRoute } from '../src/sites/youtube/routes';
import { resolveInstagramRoute } from '../src/sites/instagram/routes';

describe('YouTube route resolution', () => {
  it.each([
    ['/', 'home'], ['', 'home'],
    ['/watch', 'watch'], ['/live/abc123', 'watch'],
    ['/shorts/abc123', 'shorts'], ['/shorts/', 'shorts'],
    ['/results', 'search'],
    ['/feed/subscriptions', 'subscriptions'],
    ['/feed/history', 'history'],
    ['/feed/trending', 'feed'],
    ['/playlist', 'playlist'],
    ['/@someone', 'channel'], ['/channel/UC123', 'channel'], ['/c/Name', 'channel'], ['/user/Name', 'channel'],
    ['/about', 'other'],
  ] as const)('%s -> %s', (path, expected) => { expect(resolveYouTubeRoute(path)).toBe(expected); });

  it('ignores a trailing slash', () => { expect(resolveYouTubeRoute('/results/')).toBe('search'); });
});

describe('Instagram route resolution', () => {
  it.each([
    ['/', 'home'],
    ['/reels/', 'reels'], ['/reel/abc/', 'reels'],
    ['/explore/', 'explore'],
    ['/direct/inbox/', 'direct'],
    ['/p/abc123/', 'post'],
    ['/stories/someone/1/', 'stories'],
    ['/accounts/edit/', 'accounts'],
    ['/about/', 'other'], ['/legal/terms/', 'other'],
    ['/someuser/', 'profile'],
    ['/someuser/reel/abc/', 'reels'],
    ['/someuser/p/abc/', 'post'],
  ] as const)('%s -> %s', (path, expected) => { expect(resolveInstagramRoute(path)).toBe(expected); });

  it('is case-insensitive on the first segment', () => { expect(resolveInstagramRoute('/REELS/')).toBe('reels'); });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeAdapter } from '../src/sites/youtube/adapter';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Settings } from '../src/shared/types';

const s = (overrides: Partial<Settings> = {}, ytOverrides: Partial<Settings['youtube']> = {}): Settings => ({
  ...DEFAULT_SETTINGS, ...overrides, youtube: { ...DEFAULT_SETTINGS.youtube, ...ytOverrides },
});

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('YouTubeAdapter', () => {
  it('applies the Shorts style once active and settings say hideShorts: true', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    expect(document.getElementById('iw-yt-shorts-style')).not.toBeNull();
  });

  it('removes the Shorts style when hideShorts is turned off live', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.updateSettings(s({}, { hideShorts: false }));
    expect(document.getElementById('iw-yt-shorts-style')).toBeNull();
  });

  it('shows the block screen only on the shorts route with hideShorts on', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('watch');
    expect(document.getElementById('iw-yt-shorts-block')).toBeNull();
    a.handleRouteChange('shorts');
    expect(document.getElementById('iw-yt-shorts-block')).not.toBeNull();
  });

  it('does not block Shorts when hideShorts is off', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { hideShorts: false }));
    a.handleRouteChange('shorts');
    expect(document.getElementById('iw-yt-shorts-block')).toBeNull();
  });

  it('leaving the shorts route removes the block screen', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('shorts');
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-shorts-block')).toBeNull();
  });

  it('re-inserts the block screen if the page removes it while still on the shorts route', async () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('shorts');
    document.getElementById('iw-yt-shorts-block')?.remove();
    await new Promise((r) => queueMicrotask(() => queueMicrotask(r as () => void)));
    expect(document.getElementById('iw-yt-shorts-block')).not.toBeNull();
  });

  it('"Disable temporarily" on the block screen calls the injected callback', () => {
    const onDisableShorts = vi.fn();
    const a = new YouTubeAdapter({ onDisableShorts });
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('shorts');
    const shadow = document.getElementById('iw-yt-shorts-block')!.shadowRoot!;
    (shadow.querySelector('[data-action="disable"]') as HTMLElement).click();
    expect(onDisableShorts).toHaveBeenCalledTimes(1);
  });

  it('destroy() removes the style, the block screen, and stops the presence guard', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('shorts');
    a.destroy();
    expect(document.getElementById('iw-yt-shorts-style')).toBeNull();
    expect(document.getElementById('iw-yt-shorts-block')).toBeNull();
  });

  it('settings arriving before initialize are cached and applied once active', () => {
    const a = new YouTubeAdapter();
    a.updateSettings(s({}, { hideShorts: false }));
    a.initialize({ root: document.documentElement });
    a.handleRouteChange('shorts');
    // hideShorts was false at initialize time, so no block screen and no style yet.
    expect(document.getElementById('iw-yt-shorts-block')).toBeNull();
    expect(document.getElementById('iw-yt-shorts-style')).toBeNull();
  });

  it('collapses the home feed (calm level) on the home route only', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-recs-style')).not.toBeNull();
    expect(document.getElementById('iw-yt-recs-boundary')).not.toBeNull();
  });

  it('never applies recommendation reduction on watch, search, or subscriptions routes', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    for (const route of ['watch', 'search', 'subscriptions', 'channel', 'playlist']) {
      a.handleRouteChange(route);
      expect(document.getElementById('iw-yt-recs-style')).toBeNull();
      expect(document.getElementById('iw-yt-recs-boundary')).toBeNull();
    }
  });

  it('focus level hides the grid outright and off disables reduction entirely, both live', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { recommendations: 'focus' }));
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-recs-style')!.textContent).toMatch(/ytd-rich-grid-renderer\s*{\s*display:\s*none/);

    a.updateSettings(s({}, { recommendations: 'off' }));
    expect(document.getElementById('iw-yt-recs-style')).toBeNull();
    expect(document.getElementById('iw-yt-recs-boundary')).toBeNull();
  });

  it('"Show more" reveals the feed for this visit and does not re-collapse on a settings change', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    const shadow = document.getElementById('iw-yt-recs-boundary')!.shadowRoot!;
    (shadow.querySelector('[data-action="more"]') as HTMLElement).click();
    expect(document.getElementById('iw-yt-recs-style')).toBeNull();
    expect(document.getElementById('iw-yt-recs-boundary')).toBeNull();
    a.updateSettings(s({ debug: true })); // an unrelated settings change should not re-collapse the reveal
    expect(document.getElementById('iw-yt-recs-boundary')).toBeNull();
  });

  it('leaving and returning to home resets the "Show more" reveal', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    const shadow = document.getElementById('iw-yt-recs-boundary')!.shadowRoot!;
    (shadow.querySelector('[data-action="more"]') as HTMLElement).click();
    a.handleRouteChange('watch');
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-recs-boundary')).not.toBeNull();
  });

  it('"Search YouTube" focuses the search input if present, without throwing if absent', () => {
    document.body.innerHTML = '<input id="search" />';
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    const shadow = document.getElementById('iw-yt-recs-boundary')!.shadowRoot!;
    expect(() => (shadow.querySelector('[data-action="search"]') as HTMLElement).click()).not.toThrow();
    expect(document.activeElement?.id).toBe('search');
  });

  it('re-inserts the recommendations boundary if the page removes it while still collapsed', async () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    document.getElementById('iw-yt-recs-boundary')?.remove();
    await new Promise((r) => queueMicrotask(() => queueMicrotask(r as () => void)));
    expect(document.getElementById('iw-yt-recs-boundary')).not.toBeNull();
  });

  it('destroy() also cleans up recommendation reduction', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('home');
    a.destroy();
    expect(document.getElementById('iw-yt-recs-style')).toBeNull();
    expect(document.getElementById('iw-yt-recs-boundary')).toBeNull();
  });

  it('hides autoplay surfaces on the watch route only, and only when enabled', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('watch');
    expect(document.getElementById('iw-yt-autoplay-style')).not.toBeNull();
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-autoplay-style')).toBeNull();
    a.handleRouteChange('watch');
    a.updateSettings(s({}, { disableAutoplay: false }));
    expect(document.getElementById('iw-yt-autoplay-style')).toBeNull();
  });

  it('never applies autoplay-surface hiding on playlist, search, or subscriptions routes', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    for (const route of ['playlist', 'search', 'subscriptions']) {
      a.handleRouteChange(route);
      expect(document.getElementById('iw-yt-autoplay-style')).toBeNull();
    }
  });

  it('Subscriptions-feed collapse is off by default even on the subscriptions route', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('subscriptions');
    expect(document.getElementById('iw-yt-subs-style')).toBeNull();
    expect(document.getElementById('iw-yt-subs-boundary')).toBeNull();
  });

  it('Subscriptions-feed collapse applies only on the subscriptions route once enabled', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { limitSubscriptionsFeed: true }));
    a.handleRouteChange('home');
    expect(document.getElementById('iw-yt-subs-style')).toBeNull();
    a.handleRouteChange('subscriptions');
    expect(document.getElementById('iw-yt-subs-style')).not.toBeNull();
    expect(document.getElementById('iw-yt-subs-boundary')).not.toBeNull();
  });

  it('Subscriptions "Show more" reveals for this visit and resets when leaving and returning', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { limitSubscriptionsFeed: true }));
    a.handleRouteChange('subscriptions');
    const shadow = document.getElementById('iw-yt-subs-boundary')!.shadowRoot!;
    (shadow.querySelector('[data-action="more"]') as HTMLElement).click();
    expect(document.getElementById('iw-yt-subs-style')).toBeNull();
    expect(document.getElementById('iw-yt-subs-boundary')).toBeNull();
    a.handleRouteChange('home');
    a.handleRouteChange('subscriptions');
    expect(document.getElementById('iw-yt-subs-boundary')).not.toBeNull();
  });

  it('autoplay hiding and Subscriptions collapse are independent of Shorts/recs state and of each other', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { hideShorts: false, recommendations: 'off', limitSubscriptionsFeed: true }));
    a.handleRouteChange('watch');
    expect(document.getElementById('iw-yt-autoplay-style')).not.toBeNull();
    a.handleRouteChange('subscriptions');
    expect(document.getElementById('iw-yt-autoplay-style')).toBeNull();
    expect(document.getElementById('iw-yt-subs-style')).not.toBeNull();
  });

  it('applies watch focus (related rail + comments hidden) on the watch route only, and only when enabled', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('watch');
    expect(document.getElementById('iw-yt-watch-focus-style')).not.toBeNull();
    for (const route of ['home', 'search', 'subscriptions', 'playlist', 'channel']) {
      a.handleRouteChange(route);
      expect(document.getElementById('iw-yt-watch-focus-style')).toBeNull();
    }
    a.handleRouteChange('watch');
    a.updateSettings(s({}, { watchFocus: false }));
    expect(document.getElementById('iw-yt-watch-focus-style')).toBeNull();
  });

  it('destroy() also cleans up autoplay hiding and the Subscriptions collapse', () => {
    const a = new YouTubeAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { limitSubscriptionsFeed: true }));
    a.handleRouteChange('subscriptions');
    a.destroy();
    expect(document.getElementById('iw-yt-subs-style')).toBeNull();
    expect(document.getElementById('iw-yt-subs-boundary')).toBeNull();
    expect(document.getElementById('iw-yt-autoplay-style')).toBeNull();
  });
});

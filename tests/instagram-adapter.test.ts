import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstagramAdapter } from '../src/sites/instagram/adapter';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Settings } from '../src/shared/types';

const s = (overrides: Partial<Settings> = {}, igOverrides: Partial<Settings['instagram']> = {}): Settings => ({
  ...DEFAULT_SETTINGS, ...overrides, instagram: { ...DEFAULT_SETTINGS.instagram, ...igOverrides },
});

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('InstagramAdapter', () => {
  it('applies the Reels style once active and settings say hideReels: true', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    expect(document.getElementById('iw-ig-reels-style')).not.toBeNull();
  });

  it('removes the Reels style when hideReels is turned off live', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.updateSettings(s({}, { hideReels: false }));
    expect(document.getElementById('iw-ig-reels-style')).toBeNull();
  });

  it('shows the block screen only on the reels route with hideReels on', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('profile');
    expect(document.getElementById('iw-ig-reels-block')).toBeNull();
    a.handleRouteChange('reels');
    expect(document.getElementById('iw-ig-reels-block')).not.toBeNull();
  });

  it('does not block Reels when hideReels is off', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s({}, { hideReels: false }));
    a.handleRouteChange('reels');
    expect(document.getElementById('iw-ig-reels-block')).toBeNull();
  });

  it('leaving the reels route removes the block screen, and DMs/profile/post routes never trigger it', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('reels');
    for (const route of ['direct', 'profile', 'post', 'home', 'explore']) {
      a.handleRouteChange(route);
      expect(document.getElementById('iw-ig-reels-block')).toBeNull();
    }
  });

  it('re-inserts the block screen if the page removes it while still on the reels route', async () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('reels');
    document.getElementById('iw-ig-reels-block')?.remove();
    await new Promise((r) => queueMicrotask(() => queueMicrotask(r as () => void)));
    expect(document.getElementById('iw-ig-reels-block')).not.toBeNull();
  });

  it('"Disable temporarily" on the block screen calls the injected callback', () => {
    const onDisableReels = vi.fn();
    const a = new InstagramAdapter({ onDisableReels });
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('reels');
    const shadow = document.getElementById('iw-ig-reels-block')!.shadowRoot!;
    (shadow.querySelector('[data-action="disable"]') as HTMLElement).click();
    expect(onDisableReels).toHaveBeenCalledTimes(1);
  });

  it('destroy() removes the style, the block screen, and stops the presence guard', () => {
    const a = new InstagramAdapter();
    a.initialize({ root: document.documentElement });
    a.updateSettings(s());
    a.handleRouteChange('reels');
    a.destroy();
    expect(document.getElementById('iw-ig-reels-style')).toBeNull();
    expect(document.getElementById('iw-ig-reels-block')).toBeNull();
  });
});

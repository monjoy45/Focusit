import { describe, it, expect, vi } from 'vitest';
import { BaseAdapter } from '../src/sites/base-adapter';
import type { SiteId } from '../src/sites/types';
import type { Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { ROUTE_ATTR, SITE_ATTR } from '../src/shared/constants';

class TestAdapter extends BaseAdapter {
  readonly id: SiteId = 'youtube';
  protected readonly hostPattern = /^example\.com$/;
  calls: string[] = [];
  protected resolveRoute(pathname: string): string { return pathname; }
  protected onInitialize() { this.calls.push('init'); }
  protected onSettingsChange(s: Settings) { this.calls.push(`settings:${s.debug}`); }
  protected onRouteChange(r: string) { this.calls.push(`route:${r}`); }
  protected onApplyFilters() { this.calls.push('apply'); }
  protected onRemoveFilters() { this.calls.push('remove'); }
  protected onDestroy() { this.calls.push('destroy'); }
}

const root = () => document.createElement('html');

describe('BaseAdapter lifecycle', () => {
  it('matches only its own host pattern', () => {
    const a = new TestAdapter();
    expect(a.matches({ hostname: 'example.com' })).toBe(true);
    expect(a.matches({ hostname: 'other.com' })).toBe(false);
  });

  it('is idempotent: repeated initialize/applyFilters do not re-run hooks', () => {
    const a = new TestAdapter(); const r = root();
    a.initialize({ root: r }); a.initialize({ root: r });
    a.applyFilters(); a.applyFilters();
    expect(a.calls).toEqual(['init', 'apply']);
    expect(r.getAttribute(SITE_ATTR)).toBe('youtube');
  });

  it('tracks route and increments counters in debug state', () => {
    const a = new TestAdapter(); a.initialize({ root: root() });
    a.handleRouteChange('/x'); a.handleRouteChange('/y');
    const s = a.getDebugState();
    expect(s).toMatchObject({ site: 'youtube', initialized: true, route: '/y', routeChanges: 2, initCount: 1 });
  });

  it('ignores route changes before initialize', () => {
    const a = new TestAdapter();
    a.handleRouteChange('/x');
    expect(a.calls).toEqual([]);
  });

  it('destroy removes filters, calls hooks once, and clears attributes', () => {
    const a = new TestAdapter(); const r = root();
    a.initialize({ root: r }); a.handleRouteChange('/x'); a.applyFilters();
    a.destroy(); a.destroy();
    expect(a.calls).toEqual(['init', 'route:/x', 'apply', 'remove', 'destroy']);
    expect(r.hasAttribute(SITE_ATTR)).toBe(false);
    expect(r.hasAttribute(ROUTE_ATTR)).toBe(false);
    expect(a.getDebugState().initialized).toBe(false);
  });

  it('an onDestroy failure still clears attributes', () => {
    const a = new TestAdapter(); const r = root();
    a.initialize({ root: r });
    (a as unknown as { onDestroy: () => void }).onDestroy = () => { throw new Error('boom'); };
    expect(() => a.destroy()).toThrow('boom');
    expect(r.hasAttribute(SITE_ATTR)).toBe(false);
  });

  it('can be re-initialized on a fresh root after destroy', () => {
    const a = new TestAdapter();
    a.initialize({ root: root() }); a.destroy();
    a.initialize({ root: root() });
    expect(a.calls).toEqual(['init', 'destroy', 'init']);
  });

  it('caches settings before initialize without firing the hook, then fires it once active', () => {
    const a = new TestAdapter();
    a.updateSettings({ ...DEFAULT_SETTINGS, debug: true });
    expect(a.calls).toEqual([]);
    a.initialize({ root: root() });
    expect(a.calls).toEqual(['init']); // cached settings are available via this.settings, but the hook only fires on a new call
    a.updateSettings({ ...DEFAULT_SETTINGS, debug: false } satisfies Settings);
    expect(a.calls).toEqual(['init', 'settings:false']);
  });
});

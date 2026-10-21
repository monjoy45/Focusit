import { describe, it, expect, vi } from 'vitest';
import { SiteManager } from '../src/core/site-manager';
import type { AdapterDebugState, LocationLike, SiteAdapter } from '../src/sites/types';
import type { Settings } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { createLogger } from '../src/core/logger';

function fakeAdapter(id: 'youtube' | 'instagram', host: RegExp, overrides: Partial<SiteAdapter> = {}): SiteAdapter & { calls: string[] } {
  const calls: string[] = [];
  let route = 'unknown';
  const base: SiteAdapter = {
    id,
    matches: (loc) => host.test(loc.hostname),
    getRoute: (loc) => loc.pathname,
    updateSettings: () => { calls.push('updateSettings'); },
    initialize: () => { calls.push('initialize'); },
    handleRouteChange: (r) => { calls.push(`route:${r}`); route = r; },
    applyFilters: () => { calls.push('applyFilters'); },
    removeFilters: () => { calls.push('removeFilters'); },
    destroy: () => { calls.push('destroy'); },
    getDebugState: (): AdapterDebugState => ({ site: id, initialized: true, route, filtersApplied: true, initCount: 1, routeChanges: 0 }),
    ...overrides,
  };
  return Object.assign(base, { calls });
}

const silentLog = createLogger('test', () => false);
const loc = (overrides: Partial<LocationLike> = {}): LocationLike => ({ hostname: 'youtube.com', pathname: '/', search: '', href: '', ...overrides });
const settings = (overrides: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...overrides });

describe('SiteManager', () => {
  it('picks the matching adapter and runs the startup sequence in order', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const ig = fakeAdapter('instagram', /instagram/);
    const m = new SiteManager([yt, ig], { log: silentLog, getLocation: () => loc() });
    m.enable();
    expect(yt.calls).toEqual(['updateSettings', 'initialize', 'route:/', 'applyFilters']);
    expect(ig.calls).toEqual([]);
    expect(m.getDebugState().state).toBe('running');
  });

  it('is no-adapter (not an error) on an unsupported host', () => {
    const m = new SiteManager([fakeAdapter('youtube', /youtube/)], { log: silentLog, getLocation: () => loc({ hostname: 'example.com' }) });
    m.enable();
    expect(m.getDebugState().state).toBe('no-adapter');
  });

  it('enable() is idempotent while already running', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc() });
    m.enable(); m.enable();
    expect(yt.calls.filter((c) => c === 'initialize')).toHaveLength(1);
  });

  it('disable() tears down and enable() can start again cleanly', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc() });
    m.enable(); m.disable();
    expect(yt.calls).toEqual(['updateSettings', 'initialize', 'route:/', 'applyFilters', 'removeFilters', 'destroy']);
    expect(m.getDebugState().state).toBe('stopped');
    yt.calls.length = 0;
    m.enable();
    expect(yt.calls).toEqual(['updateSettings', 'initialize', 'route:/', 'applyFilters']);
  });

  it('disable() before enable() is a harmless no-op', () => {
    const m = new SiteManager([fakeAdapter('youtube', /youtube/)], { log: silentLog, getLocation: () => loc() });
    expect(() => m.disable()).not.toThrow();
  });

  it('contains an adapter startup failure: state becomes failed, teardown still runs', () => {
    const yt = fakeAdapter('youtube', /youtube/, { initialize: () => { throw new Error('boom'); } });
    const log = createLogger('test', () => false); const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = new SiteManager([yt], { log, getLocation: () => loc() });
    m.enable();
    expect(m.getDebugState().state).toBe('failed');
    expect(yt.calls).toContain('destroy');
    expect(err).toHaveBeenCalled();
  });

  it('contains a matches() failure by skipping that adapter instead of throwing', () => {
    const broken = fakeAdapter('youtube', /x/, { matches: () => { throw new Error('boom'); } });
    const ig = fakeAdapter('instagram', /youtube/);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = new SiteManager([broken, ig], { log: silentLog, getLocation: () => loc() });
    m.enable();
    expect(m.getDebugState().adapter?.site).toBe('instagram');
    expect(err).toHaveBeenCalled();
  });

  it('routes to the running adapter on watcher change and counts route errors without stopping', () => {
    vi.useFakeTimers();
    const yt = fakeAdapter('youtube', /youtube/);
    let path = '/';
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc({ pathname: path }), pollMs: 10 });
    m.enable(); yt.calls.length = 0;
    path = '/shorts/1';
    vi.advanceTimersByTime(20);
    expect(yt.calls).toContain('route:/shorts/1');
    vi.useRealTimers();
  });

  it('a route-handling failure is isolated and counted, adapter keeps running', () => {
    vi.useFakeTimers();
    let fail = false;
    const yt = fakeAdapter('youtube', /youtube/, {
      handleRouteChange: (r) => { if (fail) throw new Error('boom'); },
    });
    let path = '/';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc({ pathname: path }), pollMs: 10 });
    m.enable();
    fail = true; path = '/x';
    vi.advanceTimersByTime(20);
    expect(m.getDebugState().routeErrors).toBe(1);
    expect(m.getDebugState().state).toBe('running');
    expect(err).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('caches settings before an adapter is picked, and delivers them at startup', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc() });
    m.updateSettings(settings({ debug: true }));
    m.enable();
    expect(yt.calls[0]).toBe('updateSettings');
  });

  it('forwards live settings changes to the running adapter', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc() });
    m.enable(); yt.calls.length = 0;
    m.updateSettings(settings({ debug: true }));
    expect(yt.calls).toEqual(['updateSettings']);
  });

  it('does not forward settings to an adapter that is not running', () => {
    const yt = fakeAdapter('youtube', /youtube/);
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc({ hostname: 'example.com' }) });
    m.enable();
    m.updateSettings(settings());
    expect(yt.calls).toEqual([]);
  });

  it('isolates an updateSettings failure and counts it without stopping the adapter', () => {
    let fail = false;
    const yt = fakeAdapter('youtube', /youtube/, { updateSettings: () => { if (fail) throw new Error('boom'); } });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = new SiteManager([yt], { log: silentLog, getLocation: () => loc() });
    m.enable();
    fail = true;
    m.updateSettings(settings({ debug: true }));
    expect(m.getDebugState().settingsErrors).toBe(1);
    expect(m.getDebugState().state).toBe('running');
    expect(err).toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { buildDebugSnapshot } from '../src/core/debug-snapshot';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import { DEFAULT_SESSION } from '../src/core/session';
import type { ManagerDebugState } from '../src/core/site-manager';

const idleManager: ManagerDebugState = { state: 'no-adapter', adapter: null, routeErrors: 0, settingsErrors: 0 };

describe('buildDebugSnapshot', () => {
  it('reports no site/route when no adapter is running', () => {
    const snap = buildDebugSnapshot(DEFAULT_SETTINGS, idleManager, DEFAULT_SESSION);
    expect(snap.site).toBeNull();
    expect(snap.route).toBeNull();
    expect(snap.manager.state).toBe('no-adapter');
  });

  it('surfaces the detected site and active route from the running adapter', () => {
    const manager: ManagerDebugState = {
      state: 'running',
      adapter: { site: 'youtube', route: 'shorts', initialized: true, filtersApplied: true, initCount: 1, routeChanges: 2 },
      routeErrors: 0, settingsErrors: 0,
    };
    const snap = buildDebugSnapshot(DEFAULT_SETTINGS, manager, DEFAULT_SESSION);
    expect(snap.site).toBe('youtube');
    expect(snap.route).toBe('shorts');
  });

  it('surfaces the active feature flags for both sites', () => {
    const settings = { ...DEFAULT_SETTINGS, youtube: { ...DEFAULT_SETTINGS.youtube, hideShorts: false, recommendations: 'focus' as const }, instagram: { hideReels: false } };
    const snap = buildDebugSnapshot(settings, idleManager, DEFAULT_SESSION);
    expect(snap.flags.youtube).toMatchObject({ hideShorts: false, recommendations: 'focus' });
    expect(snap.flags.instagram).toEqual({ hideReels: false });
  });

  it('surfaces route/settings error counts', () => {
    const manager: ManagerDebugState = { ...idleManager, routeErrors: 3, settingsErrors: 1 };
    const snap = buildDebugSnapshot(DEFAULT_SETTINGS, manager, DEFAULT_SESSION);
    expect(snap.manager).toMatchObject({ routeErrors: 3, settingsErrors: 1 });
  });

  it('surfaces session state including live remaining time', () => {
    const session = { ...DEFAULT_SESSION, active: true, startedAt: Date.now(), durationMinutes: 10, warningShown: true };
    const snap = buildDebugSnapshot(DEFAULT_SETTINGS, idleManager, session);
    expect(snap.session.active).toBe(true);
    expect(snap.session.warningShown).toBe(true);
    expect(snap.session.remainingMs).toBeGreaterThan(9 * 60_000);
  });

  it('reports a never-started session as inactive with zero remaining time', () => {
    const snap = buildDebugSnapshot(DEFAULT_SETTINGS, idleManager, DEFAULT_SESSION);
    expect(snap.session).toEqual({ active: false, remainingMs: 0, warningShown: false });
  });
});

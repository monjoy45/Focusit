import type { Settings } from '../shared/types';
import type { Logger } from './logger';
import { createRouteWatcher, type RouteWatcher } from './route-watcher';
import type { AdapterDebugState, LocationLike, SiteAdapter } from '../sites/types';
import { DEFAULT_SETTINGS } from '../shared/constants';

export type ManagerState = 'stopped' | 'running' | 'no-adapter' | 'failed';

export interface ManagerOptions {
  log: Logger;
  getLocation: () => LocationLike;
  root?: HTMLElement;
  win?: Window;
  pollMs?: number;
}

export interface ManagerDebugState {
  state: ManagerState;
  adapter: AdapterDebugState | null;
  routeErrors: number;
  settingsErrors: number;
}

/**
 * Owns the adapter lifecycle for one page: pick, initialize, follow SPA navigation, tear down,
 * and forward settings changes to whichever adapter is currently running.
 * Adapter failures are contained here and never propagate to the rest of the extension.
 */
export class SiteManager {
  private adapter: SiteAdapter | null = null;
  private watcher: RouteWatcher | null = null;
  private state: ManagerState = 'stopped';
  private routeErrors = 0;
  private settingsErrors = 0;
  private latestSettings: Settings = DEFAULT_SETTINGS;

  constructor(private readonly adapters: SiteAdapter[], private readonly opts: ManagerOptions) {}

  enable(): void {
    if (this.state === 'running') return;
    const { log, getLocation } = this.opts;
    const loc = getLocation();
    const adapter = this.adapters.find((a) => {
      try { return a.matches(loc); } catch (err) { log.error(`adapter ${a.id} matches() failed`, err); return false; }
    });
    if (!adapter) { this.state = 'no-adapter'; log.info('no adapter for this host'); return; }

    try {
      adapter.updateSettings(this.latestSettings);
      adapter.initialize({ root: this.opts.root ?? document.documentElement });
      adapter.handleRouteChange(adapter.getRoute(loc));
      adapter.applyFilters();
    } catch (err) {
      log.error(`adapter ${adapter.id} failed to start`, err);
      this.teardown(adapter);
      this.state = 'failed';
      return;
    }

    this.adapter = adapter;
    this.state = 'running';
    this.watcher = createRouteWatcher(() => { const l = getLocation(); return l.pathname + l.search; }, () => this.onRoute(), { win: this.opts.win, pollMs: this.opts.pollMs });
    this.watcher.start();
    log.info(`adapter ${adapter.id} running`, adapter.getDebugState());
  }

  disable(): void {
    this.watcher?.stop();
    this.watcher = null;
    if (this.adapter) this.teardown(this.adapter);
    this.adapter = null;
    this.state = 'stopped';
  }

  /** Caches the latest settings for the next enable(), and forwards them live to a running adapter. */
  updateSettings(settings: Settings): void {
    this.latestSettings = settings;
    if (!this.adapter) return;
    try {
      this.adapter.updateSettings(settings);
    } catch (err) {
      this.settingsErrors++;
      this.opts.log.error(`adapter ${this.adapter.id} updateSettings failed`, err);
    }
  }

  getDebugState(): ManagerDebugState {
    return { state: this.state, adapter: this.adapter?.getDebugState() ?? null, routeErrors: this.routeErrors, settingsErrors: this.settingsErrors };
  }

  private onRoute(): void {
    const a = this.adapter;
    if (!a) return;
    try {
      a.handleRouteChange(a.getRoute(this.opts.getLocation()));
      a.applyFilters();
      this.opts.log.debug('route changed', a.getDebugState().route);
    } catch (err) {
      this.routeErrors++;
      this.opts.log.error(`adapter ${a.id} route handling failed`, err);
    }
  }

  private teardown(a: SiteAdapter): void {
    for (const step of [() => a.removeFilters(), () => a.destroy()]) {
      try { step(); } catch (err) { this.opts.log.error(`adapter ${a.id} teardown step failed`, err); }
    }
  }
}

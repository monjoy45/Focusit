import { ROUTE_ATTR, SITE_ATTR, DEFAULT_SETTINGS } from '../shared/constants';
import type { Settings } from '../shared/types';
import type { AdapterContext, AdapterDebugState, LocationLike, SiteAdapter, SiteId } from './types';

/**
 * Shared lifecycle for site adapters. Every method is idempotent, so initialize/destroy
 * can be repeated safely (settings toggled, adapter re-created after a failure).
 * Site-specific behaviour goes in the protected hooks.
 */
export abstract class BaseAdapter implements SiteAdapter {
  abstract readonly id: SiteId;
  protected abstract readonly hostPattern: RegExp;
  protected abstract resolveRoute(pathname: string, search: string): string;

  private root: HTMLElement | null = null;
  protected route = 'unknown';
  protected settings: Settings = DEFAULT_SETTINGS;
  private filters = false;
  private initCount = 0;
  private routeChanges = 0;

  matches(loc: Pick<LocationLike, 'hostname'>): boolean {
    return this.hostPattern.test(loc.hostname);
  }

  getRoute(loc: Pick<LocationLike, 'pathname' | 'search'>): string {
    return this.resolveRoute(loc.pathname, loc.search);
  }

  initialize(ctx: AdapterContext): void {
    if (this.root) return;
    this.root = ctx.root;
    this.route = 'unknown';
    this.initCount++;
    ctx.root.setAttribute(SITE_ATTR, this.id);
    this.onInitialize();
  }

  /** Caches settings even before initialize(); only invokes the site hook once active. */
  updateSettings(settings: Settings): void {
    this.settings = settings;
    if (this.root) this.onSettingsChange(settings);
  }

  handleRouteChange(route: string): void {
    if (!this.root) return;
    this.route = route;
    this.routeChanges++;
    this.root.setAttribute(ROUTE_ATTR, route);
    this.onRouteChange(route);
  }

  applyFilters(): void {
    if (!this.root || this.filters) return;
    this.filters = true;
    this.onApplyFilters();
  }

  removeFilters(): void {
    if (!this.filters) return;
    this.filters = false;
    this.onRemoveFilters();
  }

  destroy(): void {
    const root = this.root;
    if (!root) return;
    try {
      this.removeFilters();
      this.onDestroy();
    } finally {
      root.removeAttribute(SITE_ATTR);
      root.removeAttribute(ROUTE_ATTR);
      this.root = null;
    }
  }

  getDebugState(): AdapterDebugState {
    return { site: this.id, initialized: this.root !== null, route: this.route, filtersApplied: this.filters, initCount: this.initCount, routeChanges: this.routeChanges };
  }

  protected onInitialize(): void {}
  protected onSettingsChange(_settings: Settings): void {}
  protected onRouteChange(_route: string): void {}
  protected onApplyFilters(): void {}
  protected onRemoveFilters(): void {}
  protected onDestroy(): void {}
}

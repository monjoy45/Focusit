import type { Settings } from '../shared/types';

export type SiteId = 'youtube' | 'instagram';

export interface LocationLike {
  hostname: string;
  pathname: string;
  search: string;
  href: string;
}

export interface AdapterContext {
  root: HTMLElement;
}

export interface AdapterDebugState {
  site: SiteId;
  initialized: boolean;
  route: string;
  filtersApplied: boolean;
  initCount: number;
  routeChanges: number;
}

/** One adapter per website. Adding a site means adding an adapter and one registry line. */
export interface SiteAdapter {
  readonly id: SiteId;
  matches(loc: Pick<LocationLike, 'hostname'>): boolean;
  getRoute(loc: Pick<LocationLike, 'pathname' | 'search'>): string;
  initialize(ctx: AdapterContext): void;
  /** Called on init and again whenever extension settings change while this adapter is active. */
  updateSettings(settings: Settings): void;
  handleRouteChange(route: string): void;
  applyFilters(): void;
  removeFilters(): void;
  destroy(): void;
  getDebugState(): AdapterDebugState;
}

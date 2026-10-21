import type { ManagerDebugState } from './site-manager';
import type { Settings } from '../shared/types';
import type { SessionState } from './session';
import { getRemainingMs } from './session';

/**
 * A single structured object for `window.__intentionalWeb.getDebugState()` in DevTools,
 * covering what Phase 9 asks debug mode to surface: detected site, active route, active
 * feature flags, errors, and observer state (via `manager.state`). Deliberately leaves out
 * "rule execution" and "target counts" in the literal sense (e.g. counting exactly how many
 * elements a CSS rule currently hides) -- that would mean querying the page's DOM from here,
 * which risks exactly the fragile-selector coupling the rest of this codebase avoids; the
 * active-flags list already shows which rules are in effect.
 */
export interface DebugSnapshot {
  enabled: boolean;
  calmUI: boolean;
  site: string | null;
  route: string | null;
  flags: {
    youtube: { hideShorts: boolean; recommendations: string; disableAutoplay: boolean; watchFocus: boolean; limitSubscriptionsFeed: boolean };
    instagram: { hideReels: boolean };
  };
  manager: { state: ManagerDebugState['state']; routeErrors: number; settingsErrors: number };
  session: { active: boolean; remainingMs: number; warningShown: boolean };
}

export function buildDebugSnapshot(settings: Settings, manager: ManagerDebugState, session: SessionState): DebugSnapshot {
  return {
    enabled: settings.enabled,
    calmUI: settings.calmUI,
    site: manager.adapter?.site ?? null,
    route: manager.adapter?.route ?? null,
    flags: {
      youtube: {
        hideShorts: settings.youtube.hideShorts,
        recommendations: settings.youtube.recommendations,
        disableAutoplay: settings.youtube.disableAutoplay,
        watchFocus: settings.youtube.watchFocus,
        limitSubscriptionsFeed: settings.youtube.limitSubscriptionsFeed,
      },
      instagram: { hideReels: settings.instagram.hideReels },
    },
    manager: { state: manager.state, routeErrors: manager.routeErrors, settingsErrors: manager.settingsErrors },
    session: { active: session.active, remainingMs: getRemainingMs(session), warningShown: session.warningShown },
  };
}

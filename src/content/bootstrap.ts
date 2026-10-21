import { ACTIVE_ATTR, CALM_ATTR, DEFAULT_SETTINGS, SESSION_CONTINUE_MINUTES } from '../shared/constants';
import type { Settings } from '../shared/types';
import { createLogger } from '../core/logger';
import { safely } from '../core/safe';
import { getSettings, onSettingsChanged, updateSettings } from '../core/storage';
import { insertCalmStyle, removeCalmStyle } from '../core/calm-mode';
import { SiteManager } from '../core/site-manager';
import { createAdapters } from '../sites/registry';
import { type SessionState, extendSession, getRemainingMs, getSession, onSessionChanged } from '../core/session';
import {
  mountSessionEndScreen, mountWarningToast, unmountSessionEndScreen, unmountWarningToast,
  SESSION_END_SCREEN_ID,
} from '../core/session-overlay';
import { createPresenceGuard, type PresenceGuard } from '../core/presence-guard';
import { buildDebugSnapshot } from '../core/debug-snapshot';
import { DEFAULT_SESSION } from '../core/session';

let current: Settings = { ...DEFAULT_SETTINGS };
let currentSession: SessionState = { ...DEFAULT_SESSION };
const log = createLogger('content', () => current.debug);
const manager = new SiteManager(
  createAdapters({
    youtube: {
      onDisableShorts: () => {
        void safely('disable shorts', log, () => updateSettings({ youtube: { hideShorts: false } }));
      },
    },
    instagram: {
      onDisableReels: () => {
        void safely('disable reels', log, () => updateSettings({ instagram: { hideReels: false } }));
      },
    },
  }),
  { log, getLocation: () => location },
);

export const getManagerDebugState = () => manager.getDebugState();
/** Structured snapshot for DevTools (`window.__intentionalWeb.getDebugState()`): detected site, active route, active feature flags, errors, and session state. */
export const getDebugSnapshot = () => buildDebugSnapshot(current, manager.getDebugState(), currentSession);
// Manual inspection only (e.g. `window.__intentionalWeb` in DevTools console). Read-only, never used by the extension itself.
(window as unknown as { __intentionalWeb?: unknown }).__intentionalWeb = { getDebugState: getDebugSnapshot };

/** Idempotent: safe to call any number of times with the same settings. */
export function applySettings(s: Settings, root: HTMLElement = document.documentElement): void {
  current = s;
  manager.updateSettings(s);
  if (s.enabled) {
    root.setAttribute(ACTIVE_ATTR, 'true');
    manager.enable();
  } else {
    root.removeAttribute(ACTIVE_ATTR);
    manager.disable();
  }
  if (s.enabled && s.calmUI) {
    root.setAttribute(CALM_ATTR, 'true');
    insertCalmStyle(document);
  } else {
    root.removeAttribute(CALM_ATTR);
    removeCalmStyle(document);
  }
  log.info('settings applied', { enabled: s.enabled, host: location.hostname });
}

// The session timer is a cross-site concern, independent of the master enable switch and of
// which (if any) site adapter matched -- a person might want a break reminder even with
// content filtering turned off.
let endScreenGuard: PresenceGuard | null = null;

/** Idempotent: re-renders cleanly from the same session state any number of times. `navigate` is injectable for tests; defaults to a real page navigation. */
export function applySession(s: SessionState, doc: Document = document, navigate: (url: string) => void = (url) => { doc.defaultView!.location.href = url; }): void {
  currentSession = s;
  if (s.active && s.warningShown) {
    const minutesLeft = Math.max(1, Math.ceil(getRemainingMs(s) / 60_000));
    mountWarningToast(doc, minutesLeft, () => unmountWarningToast(doc));
  } else {
    unmountWarningToast(doc);
  }

  const ended = !s.active && s.endedAt !== null;
  if (ended) {
    const mount = () => mountSessionEndScreen(doc, {
      continueMinutes: SESSION_CONTINUE_MINUTES,
      onLeave: () => { unmountWarningToast(doc); navigate('about:blank'); },
      onContinue: () => { void safely('extend session', log, () => extendSession(SESSION_CONTINUE_MINUTES)); },
    });
    mount();
    if (!endScreenGuard) {
      endScreenGuard = createPresenceGuard(doc, SESSION_END_SCREEN_ID, mount);
      endScreenGuard.start();
    }
  } else {
    endScreenGuard?.stop();
    endScreenGuard = null;
    unmountSessionEndScreen(doc);
  }
}

export async function start(): Promise<void> {
  await safely('initial settings', log, async () => applySettings(await getSettings()));
  onSettingsChanged((s) => void safely('settings change', log, () => applySettings(s)));

  await safely('initial session', log, async () => applySession(await getSession()));
  onSessionChanged((s) => void safely('session change', log, () => applySession(s)));
}

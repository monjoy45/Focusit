import { createLogger } from '../core/logger';
import { safely } from '../core/safe';
import { ensureSettings } from '../core/storage';
import { SESSION_ALARM_END, SESSION_ALARM_WARNING, getSession, markSessionEnded, markWarningShown, reconcileSession } from '../core/session';
import { isLockedOut, isWatchedUrl } from '../core/tab-lockout';

const log = createLogger('background', () => false);

/**
 * "Open a new tab to YouTube after my session ended, and it goes blank until I start a new
 * one." Only ever acts on a *navigation* (changeInfo.url set -- a fresh load or an in-tab
 * navigation), and only while locked out; a session that's active, or one that's never run,
 * is untouched. A tab already sitting on the site when the session ends is instead handled by
 * the content script's own reactive end-screen overlay (applySession in content/bootstrap.ts)
 * -- blanking an already-rendered tab out from under the person would be jarring, whereas
 * pre-empting a fresh navigation before it paints is not.
 */
function registerTabLockout(): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url || !isWatchedUrl(changeInfo.url)) return;
    void safely('tab lockout check', log, async () => {
      const session = await getSession();
      if (isLockedOut(session)) await chrome.tabs.update(tabId, { url: 'about:blank' });
    });
  });
}

export function registerBackground(): void {
  chrome.runtime.onInstalled.addListener(() => {
    void safely('init settings', log, ensureSettings);
    void safely('reconcile session on install', log, reconcileSession);
  });

  // Fires even after the service worker was suspended -- this is the whole point of
  // chrome.alarms over setInterval. The timestamps in core/session.ts remain the real source
  // of truth; this listener just reacts promptly when it's running.
  chrome.runtime.onStartup.addListener(() => {
    void safely('reconcile session on startup', log, reconcileSession);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SESSION_ALARM_WARNING) void safely('mark session warning shown', log, markWarningShown);
    else if (alarm.name === SESSION_ALARM_END) void safely('mark session ended', log, markSessionEnded);
  });

  registerTabLockout();
}

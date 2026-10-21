import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installFakeChrome } from './helpers/fake-chrome';
import { applySession, getDebugSnapshot, start } from '../src/content/bootstrap';
import { updateSettings } from '../src/core/storage';
import { ACTIVE_ATTR, CALM_ATTR, CALM_STYLE_ID, SETTINGS_KEY } from '../src/shared/constants';
import { DEFAULT_SESSION, SESSION_KEY, endSession, startSession } from '../src/core/session';
import { SESSION_END_SCREEN_ID, SESSION_WARNING_TOAST_ID } from '../src/core/session-overlay';

const active = () => document.documentElement.getAttribute(ACTIVE_ATTR);
const calm = () => document.documentElement.getAttribute(CALM_ATTR);

describe('content bootstrap', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute(ACTIVE_ATTR);
    document.documentElement.removeAttribute(CALM_ATTR);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('marks the page active by default and reacts live to the master switch', async () => {
    installFakeChrome();
    await start();
    expect(active()).toBe('true');
    await updateSettings({ enabled: false });
    expect(active()).toBeNull();
    await updateSettings({ enabled: true });
    expect(active()).toBe('true');
  });
  it('honours a stored disabled state at startup', async () => {
    installFakeChrome({ [SETTINGS_KEY]: { enabled: false } });
    await start();
    expect(active()).toBeNull();
  });
  it('does not throw when storage fails', async () => {
    const { fake } = installFakeChrome();
    fake.storage.local.get.mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(start()).resolves.toBeUndefined();
  });

  it('exposes a structured debug snapshot reflecting live settings and session state', async () => {
    installFakeChrome();
    await start();
    expect(getDebugSnapshot()).toMatchObject({ enabled: true, flags: { youtube: { hideShorts: true } }, session: { active: false } });
    const { startSession } = await import('../src/core/session');
    await startSession(10);
    expect(getDebugSnapshot().session.active).toBe(true);
  });

  it('applies the calm-mode layer by default and reacts live to its own toggle', async () => {
    installFakeChrome();
    await start();
    expect(calm()).toBe('true');
    expect(document.getElementById(CALM_STYLE_ID)).not.toBeNull();
    await updateSettings({ calmUI: false });
    expect(calm()).toBeNull();
    expect(document.getElementById(CALM_STYLE_ID)).toBeNull();
    await updateSettings({ calmUI: true });
    expect(calm()).toBe('true');
  });

  it('turns off calm mode when the master switch is off, even if calmUI itself is on', async () => {
    installFakeChrome();
    await start();
    await updateSettings({ enabled: false });
    expect(calm()).toBeNull();
    expect(document.getElementById(CALM_STYLE_ID)).toBeNull();
  });

  describe('session overlay', () => {
    it('applySession shows nothing for a session that has never run', () => {
      applySession(DEFAULT_SESSION);
      expect(document.getElementById(SESSION_WARNING_TOAST_ID)).toBeNull();
      expect(document.getElementById(SESSION_END_SCREEN_ID)).toBeNull();
    });
    it('applySession shows the warning toast once warningShown is set, and nothing once dismissed', () => {
      applySession({ ...DEFAULT_SESSION, active: true, startedAt: Date.now(), warningShown: true });
      const toast = document.getElementById(SESSION_WARNING_TOAST_ID)!;
      expect(toast).not.toBeNull();
      toast.shadowRoot!.querySelector<HTMLElement>('[data-action="dismiss"]')!.click();
      expect(document.getElementById(SESSION_WARNING_TOAST_ID)).toBeNull();
    });
    it('applySession shows the end screen once a session has ended, and hides the toast at the same time', () => {
      applySession({ ...DEFAULT_SESSION, active: false, startedAt: Date.now() - 1000, endedAt: Date.now() });
      expect(document.getElementById(SESSION_END_SCREEN_ID)).not.toBeNull();
      expect(document.getElementById(SESSION_WARNING_TOAST_ID)).toBeNull();
    });
    it('"Continue" on the end screen extends the session, which then hides the end screen on the next render', async () => {
      installFakeChrome();
      await startSession(10, 2);
      applySession({ ...DEFAULT_SESSION, active: false, startedAt: Date.now() - 1000, endedAt: Date.now() });
      const shadow = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!;
      shadow.querySelector<HTMLElement>('[data-action="continue"]')!.click();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      applySession({ ...DEFAULT_SESSION, active: true, startedAt: Date.now(), durationMinutes: 15 });
      expect(document.getElementById(SESSION_END_SCREEN_ID)).toBeNull();
    });
    it('"Leave" navigates the current tab to a neutral page', () => {
      const navigate = vi.fn();
      applySession({ ...DEFAULT_SESSION, active: false, startedAt: Date.now() - 1000, endedAt: Date.now() }, document, navigate);
      const shadow = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!;
      shadow.querySelector<HTMLElement>('[data-action="leave"]')!.click();
      expect(navigate).toHaveBeenCalledWith('about:blank');
    });
    it('is wired end-to-end through start(): starting and ending a real session renders and clears the end screen', async () => {
      installFakeChrome({ [SESSION_KEY]: undefined });
      await start();
      expect(document.getElementById(SESSION_END_SCREEN_ID)).toBeNull();
      await startSession(10);
      await endSession();
      expect(document.getElementById(SESSION_END_SCREEN_ID)).not.toBeNull();
    });
  });
});

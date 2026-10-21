import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFakeChrome } from './helpers/fake-chrome';
import { registerBackground } from '../src/background/worker';
import { SETTINGS_KEY } from '../src/shared/constants';
import { updateSettings } from '../src/core/storage';
import { SESSION_ALARM_END, SESSION_ALARM_WARNING, SESSION_KEY, endSession, startSession } from '../src/core/session';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); });

describe('background worker', () => {
  it('writes default settings on install without clobbering existing ones', async () => {
    const ctx = installFakeChrome();
    registerBackground();
    ctx.fireInstalled(); await flush();
    expect(ctx.store[SETTINGS_KEY]).toMatchObject({ enabled: true });
    await updateSettings({ enabled: false });
    ctx.fireInstalled(); await flush();
    expect(ctx.store[SETTINGS_KEY]).toMatchObject({ enabled: false });
  });

  it('marks the session warning shown when the warning alarm fires', async () => {
    const ctx = installFakeChrome();
    registerBackground();
    await startSession(10, 2);
    ctx.fireAlarm(SESSION_ALARM_WARNING); await flush();
    expect(ctx.store[SESSION_KEY]).toMatchObject({ warningShown: true, active: true });
  });

  it('marks the session ended when the end alarm fires', async () => {
    const ctx = installFakeChrome();
    registerBackground();
    await startSession(10);
    ctx.fireAlarm(SESSION_ALARM_END); await flush();
    expect(ctx.store[SESSION_KEY]).toMatchObject({ active: false });
  });

  it('ignores an alarm name it does not recognize', async () => {
    const ctx = installFakeChrome();
    registerBackground();
    await startSession(10);
    expect(() => ctx.fireAlarm('some-other-alarm')).not.toThrow();
  });

  it('reconciles a stale session on install and on browser startup', async () => {
    const ctx = installFakeChrome();
    const started = await startSession(10);
    vi.advanceTimersByTime(11 * 60_000); // the alarm "never fired" (e.g. browser was closed)
    registerBackground();
    ctx.fireInstalled(); await flush();
    expect(ctx.store[SESSION_KEY]).toMatchObject({ active: false, endedAt: started.startedAt! + 10 * 60_000 });
  });

  it('reconciles on startup independently of install', async () => {
    const ctx = installFakeChrome();
    const started = await startSession(5);
    vi.advanceTimersByTime(6 * 60_000);
    registerBackground();
    ctx.fireStartup(); await flush();
    expect(ctx.store[SESSION_KEY]).toMatchObject({ active: false, endedAt: started.startedAt! + 5 * 60_000 });
  });

  describe('post-session tab lockout', () => {
    it('blanks a new navigation to YouTube once a session has ended', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      await endSession();
      ctx.fireTabUpdated(42, 'https://www.youtube.com/watch?v=abc');
      await flush();
      expect(ctx.fake.tabs.update).toHaveBeenCalledWith(42, { url: 'about:blank' });
    });

    it('blanks a new navigation to Instagram too', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      await endSession();
      ctx.fireTabUpdated(7, 'https://www.instagram.com/');
      await flush();
      expect(ctx.fake.tabs.update).toHaveBeenCalledWith(7, { url: 'about:blank' });
    });

    it('does not interfere while a session is actively running', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      ctx.fireTabUpdated(42, 'https://www.youtube.com/watch?v=abc');
      await flush();
      expect(ctx.fake.tabs.update).not.toHaveBeenCalled();
    });

    it('does not interfere when no session has ever been started (default browsing)', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      ctx.fireTabUpdated(42, 'https://www.youtube.com/watch?v=abc');
      await flush();
      expect(ctx.fake.tabs.update).not.toHaveBeenCalled();
    });

    it('ignores navigation to an unrelated site even while locked out', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      await endSession();
      ctx.fireTabUpdated(99, 'https://www.wikipedia.org/');
      await flush();
      expect(ctx.fake.tabs.update).not.toHaveBeenCalled();
    });

    it('ignores tab updates with no url change (e.g. a title or favicon update)', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      await endSession();
      (ctx as unknown as { fireTabUpdated: (id: number, url?: string) => void }).fireTabUpdated(1, undefined);
      await flush();
      expect(ctx.fake.tabs.update).not.toHaveBeenCalled();
    });

    it('starting a new session lifts the lockout for the next navigation', async () => {
      const ctx = installFakeChrome();
      registerBackground();
      await startSession(10);
      await endSession();
      await startSession(10); // renewed
      ctx.fireTabUpdated(42, 'https://www.youtube.com/watch?v=abc');
      await flush();
      expect(ctx.fake.tabs.update).not.toHaveBeenCalled();
    });
  });
});

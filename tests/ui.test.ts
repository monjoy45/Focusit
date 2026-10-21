import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installFakeChrome } from './helpers/fake-chrome';
import { initPopup } from '../src/popup/popup';
import { initOptions } from '../src/options/options';
import { getSettings, updateSettings } from '../src/core/storage';
import { endSession, getSession, startSession } from '../src/core/session';

const load = (file: string) => {
  const html = readFileSync(`public/${file}`, 'utf8').replace(/<script[^>]*><\/script>/g, '');
  document.documentElement.innerHTML = html;
};
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const flip = (el: HTMLInputElement) => { el.checked = !el.checked; el.dispatchEvent(new Event('change')); };
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('popup', () => {
  let ctx: ReturnType<typeof installFakeChrome>;
  beforeEach(() => { ctx = installFakeChrome(); load('popup.html'); });

  it('shows real stored state and persists toggles', async () => {
    await updateSettings({ enabled: false });
    await initPopup();
    expect($<HTMLInputElement>('iw-enabled').checked).toBe(false);
    expect($('iw-status').textContent).toBe('Paused');
    flip($<HTMLInputElement>('iw-enabled')); await tick();
    expect((await getSettings()).enabled).toBe(true);
  });
  it('stays in sync when settings change elsewhere', async () => {
    await initPopup();
    await updateSettings({ enabled: false });
    expect($<HTMLInputElement>('iw-enabled').checked).toBe(false);
  });
  it('opens the options page', async () => {
    await initPopup();
    $('iw-open-options').click();
    expect(ctx.fake.runtime.openOptionsPage).toHaveBeenCalled();
  });
  it('reports a storage failure instead of showing a fake state', async () => {
    ctx.fake.storage.local.get.mockRejectedValueOnce(new Error('down'));
    await initPopup();
    expect($('iw-status').textContent).toMatch(/Could not read settings/);
  });
});

describe('popup session timer', () => {
  let ctx: ReturnType<typeof installFakeChrome>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    ctx = installFakeChrome();
    load('popup.html');
  });
  afterEach(() => { vi.useRealTimers(); });

  const seg = (minutes: string) => document.querySelector<HTMLButtonElement>(`.seg[data-minutes="${minutes}"]`)!;
  const pressed = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.seg')).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.minutes);

  it('shows "Not running", the start controls, and 30m preselected by default', async () => {
    await initPopup();
    expect($('iw-session-status').textContent).toBe('Not running');
    expect($('iw-session-start-row').hidden).toBe(false);
    expect($('iw-session-active').hidden).toBe(true);
    expect(pressed()).toEqual(['30']);
  });

  it('selecting a preset marks only that one pressed; Custom reveals the minutes input', async () => {
    await initPopup();
    seg('10').click();
    expect(pressed()).toEqual(['10']);
    expect($<HTMLInputElement>('iw-session-custom').hidden).toBe(true);
    seg('custom').click();
    expect(pressed()).toEqual(['custom']);
    expect($<HTMLInputElement>('iw-session-custom').hidden).toBe(false);
  });

  it('starting a session switches to the countdown view with an MM:SS display that ticks down live', async () => {
    await initPopup();
    seg('10').click();
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    expect($('iw-session-start-row').hidden).toBe(true);
    expect($('iw-session-active').hidden).toBe(false);
    expect($('iw-session-time').textContent).toBe('10:00');
    vi.advanceTimersByTime(1000);
    expect($('iw-session-time').textContent).toBe('09:59');
    vi.advanceTimersByTime(60_000);
    expect($('iw-session-time').textContent).toBe('08:59');
  });

  it('the progress ring depletes as time passes and shifts to the low-time style near the end', async () => {
    await initPopup();
    seg('10').click();
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    const ring = document.getElementById('iw-ring-progress') as unknown as SVGCircleElement;
    const full = 2 * Math.PI * 52;
    expect(Number(ring.style.strokeDashoffset)).toBeCloseTo(0, 1); // full ring at the start
    expect(ring.classList.contains('low')).toBe(false);
    vi.advanceTimersByTime(5 * 60_000);
    expect(Number(ring.style.strokeDashoffset)).toBeCloseTo(full / 2, 0); // half gone at the halfway point
    vi.advanceTimersByTime(4 * 60_000 + 30_000); // 30s left of 10 min -- under 20%
    expect(ring.classList.contains('low')).toBe(true);
  });

  it('formats sessions of an hour or more as H:MM:SS', async () => {
    await initPopup();
    seg('custom').click();
    $<HTMLInputElement>('iw-session-custom').value = '90';
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    expect($('iw-session-time').textContent).toBe('1:30:00');
  });

  it('starting with a custom duration uses the typed value', async () => {
    await initPopup();
    seg('custom').click();
    $<HTMLInputElement>('iw-session-custom').value = '7';
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    expect((await getSession())).toMatchObject({ active: true, durationMinutes: 7 });
  });

  it('refuses to start with an empty or non-positive custom value, and says why', async () => {
    await initPopup();
    seg('custom').click();
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    expect((await getSession()).active).toBe(false);
    expect($('iw-session-status').textContent).toMatch(/above 0/);
  });

  it('"End session" ends the running session and switches back to the start controls', async () => {
    await initPopup();
    await startSession(10);
    await flush();
    $<HTMLButtonElement>('iw-session-end').click();
    await flush();
    expect($('iw-session-start-row').hidden).toBe(false);
    expect($('iw-session-active').hidden).toBe(true);
    expect((await getSession()).active).toBe(false);
  });

  it('reflects a session started in another context (e.g. a different tab\'s popup)', async () => {
    await initPopup();
    await startSession(20);
    await flush();
    expect($('iw-session-active').hidden).toBe(false);
    expect($('iw-session-time').textContent).toBe('20:00');
  });

  it('remembers the last-used duration across popup reopens, including a custom value', async () => {
    await initPopup();
    await startSession(7);
    await endSession();
    document.documentElement.innerHTML = '';
    load('popup.html');
    await initPopup();
    expect(pressed()).toEqual(['custom']);
    expect($<HTMLInputElement>('iw-session-custom').value).toBe('7');
  });

  it('remembers a preset duration across popup reopens', async () => {
    await initPopup();
    await startSession(45);
    await endSession();
    document.documentElement.innerHTML = '';
    load('popup.html');
    await initPopup();
    expect(pressed()).toEqual(['45']);
  });

  it('uses the warning lead time configured in Options rather than a hardcoded value', async () => {
    const { setDefaultWarningMinutes } = await import('../src/core/session');
    await setDefaultWarningMinutes(2);
    await initPopup();
    seg('10').click();
    $<HTMLButtonElement>('iw-session-start').click();
    await flush();
    expect((await getSession())).toMatchObject({ warningMinutes: 2 });
  });

  it('reports a storage failure instead of showing a fake session state', async () => {
    // Reject only the session-state read so the (unrelated) settings read above it still succeeds.
    ctx.fake.storage.local.get.mockImplementation(async (key: string) => {
      if (key === 'iw:session') throw new Error('down');
      return key in ctx.store ? { [key]: ctx.store[key] } : {};
    });
    await initPopup();
    expect($('iw-session-status').textContent).toMatch(/Could not read session/);
  });
});

describe('options', () => {
  beforeEach(() => { installFakeChrome(); load('options.html'); });

  it('persists both toggles and resets to defaults', async () => {
    await initOptions();
    flip($<HTMLInputElement>('iw-debug')); flip($<HTMLInputElement>('iw-enabled')); await tick();
    expect(await getSettings()).toMatchObject({ enabled: false, debug: true });
    $('iw-reset').click(); await tick();
    expect(await getSettings()).toMatchObject({ enabled: true, debug: false });
    expect($<HTMLInputElement>('iw-debug').checked).toBe(false);
    expect($('iw-note').textContent).toMatch(/reset/i);
  });
  it('persists per-site toggles independently and shows their current state', async () => {
    await initOptions();
    expect($<HTMLInputElement>('iw-yt-hide-shorts').checked).toBe(true);
    expect($<HTMLInputElement>('iw-ig-hide-reels').checked).toBe(true);
    flip($<HTMLInputElement>('iw-yt-hide-shorts')); await tick();
    expect(await getSettings()).toMatchObject({ youtube: { hideShorts: false }, instagram: { hideReels: true } });
    flip($<HTMLInputElement>('iw-ig-hide-reels')); await tick();
    expect(await getSettings()).toMatchObject({ youtube: { hideShorts: false }, instagram: { hideReels: false } });
  });
  it('shows and persists the Calm UI toggle, on by default', async () => {
    await initOptions();
    expect($<HTMLInputElement>('iw-calm-ui').checked).toBe(true);
    flip($<HTMLInputElement>('iw-calm-ui')); await tick();
    expect(await getSettings()).toMatchObject({ calmUI: false });
  });
  it('shows and persists the home recommendations level, defaulting to calm', async () => {
    await initOptions();
    const select = $<HTMLSelectElement>('iw-yt-recs');
    expect(select.value).toBe('calm');
    select.value = 'focus';
    select.dispatchEvent(new Event('change'));
    await tick();
    expect(await getSettings()).toMatchObject({ youtube: { recommendations: 'focus' } });
  });
  it('reflects a recommendations-level change made elsewhere', async () => {
    await initOptions();
    await updateSettings({ youtube: { recommendations: 'off' } });
    expect($<HTMLSelectElement>('iw-yt-recs').value).toBe('off');
  });
  it('shows and persists autoplay (on by default) and Subscriptions-limit (off by default) independently', async () => {
    await initOptions();
    expect($<HTMLInputElement>('iw-yt-autoplay').checked).toBe(true);
    expect($<HTMLInputElement>('iw-yt-subs').checked).toBe(false);
    flip($<HTMLInputElement>('iw-yt-autoplay')); await tick();
    flip($<HTMLInputElement>('iw-yt-subs')); await tick();
    expect(await getSettings()).toMatchObject({ youtube: { disableAutoplay: false, limitSubscriptionsFeed: true } });
  });

  it('shows and persists the watch-focus toggle, on by default', async () => {
    await initOptions();
    expect($<HTMLInputElement>('iw-yt-watch-focus').checked).toBe(true);
    flip($<HTMLInputElement>('iw-yt-watch-focus')); await tick();
    expect(await getSettings()).toMatchObject({ youtube: { watchFocus: false } });
  });

  it('shows the default session warning lead time (5 min) and persists a change to it', async () => {
    const { getSession } = await import('../src/core/session');
    await initOptions();
    expect($<HTMLInputElement>('iw-session-warning').value).toBe('5');
    const input = $<HTMLInputElement>('iw-session-warning');
    input.value = '10'; input.dispatchEvent(new Event('change'));
    await tick();
    expect((await getSession())).toMatchObject({ warningMinutes: 10 });
  });

  it('rejects a negative warning value without persisting it', async () => {
    const { getSession } = await import('../src/core/session');
    await initOptions();
    const input = $<HTMLInputElement>('iw-session-warning');
    input.value = '-3'; input.dispatchEvent(new Event('change'));
    await tick();
    expect((await getSession())).toMatchObject({ warningMinutes: 5 });
  });

  it('reflects a warning-minutes change made elsewhere (e.g. from the popup starting a session)', async () => {
    const { startSession } = await import('../src/core/session');
    await initOptions();
    await startSession(10, 3);
    expect($<HTMLInputElement>('iw-session-warning').value).toBe('3');
  });

  it('disables the warning input instead of crashing if session state cannot be read', async () => {
    const ctx = installFakeChrome();
    load('options.html');
    ctx.fake.storage.local.get.mockImplementation(async (key: string) => {
      if (key === 'iw:session') throw new Error('down');
      return key in ctx.store ? { [key]: ctx.store[key] } : {};
    });
    await initOptions();
    expect($<HTMLInputElement>('iw-session-warning').disabled).toBe(true);
  });
});

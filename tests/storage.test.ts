import { describe, it, expect, beforeEach } from 'vitest';
import { installFakeChrome } from './helpers/fake-chrome';
import { ensureSettings, getSettings, normalizeSettings, onSettingsChanged, resetSettings, updateSettings } from '../src/core/storage';
import { SETTINGS_KEY } from '../src/shared/constants';

describe('settings storage', () => {
  beforeEach(() => { installFakeChrome(); });

  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual({ schemaVersion: 1, enabled: true, debug: false, calmUI: true, youtube: { hideShorts: true, recommendations: 'calm', disableAutoplay: true, watchFocus: true, limitSubscriptionsFeed: false }, instagram: { hideReels: true } });
  });
  it('normalizes junk and keeps valid fields', () => {
    expect(normalizeSettings({ enabled: 'yes', debug: true, extra: 1 })).toEqual({ schemaVersion: 1, enabled: true, debug: true, calmUI: true, youtube: { hideShorts: true, recommendations: 'calm', disableAutoplay: true, watchFocus: true, limitSubscriptionsFeed: false }, instagram: { hideReels: true } });
    expect(normalizeSettings(null)).toEqual({ schemaVersion: 1, enabled: true, debug: false, calmUI: true, youtube: { hideShorts: true, recommendations: 'calm', disableAutoplay: true, watchFocus: true, limitSubscriptionsFeed: false }, instagram: { hideReels: true } });
  });
  it('persists updates and merges patches', async () => {
    await updateSettings({ enabled: false });
    await updateSettings({ debug: true });
    expect(await getSettings()).toMatchObject({ enabled: false, debug: true });
  });
  it('resets to defaults', async () => {
    await updateSettings({ enabled: false, debug: true });
    expect(await resetSettings()).toMatchObject({ enabled: true, debug: false });
  });
  it('ensureSettings writes defaults once and never overwrites', async () => {
    const { store } = installFakeChrome();
    await ensureSettings();
    expect(store[SETTINGS_KEY]).toBeDefined();
    await updateSettings({ enabled: false });
    await ensureSettings();
    expect((await getSettings()).enabled).toBe(false);
  });
  it('notifies subscribers on change and stops after unsubscribe', async () => {
    const seen: boolean[] = [];
    const off = onSettingsChanged((s) => seen.push(s.enabled));
    await updateSettings({ enabled: false });
    off();
    await updateSettings({ enabled: true });
    expect(seen).toEqual([false]);
  });
  it('merges a youtube patch one level deep instead of replacing the whole sub-object', async () => {
    await updateSettings({ youtube: { hideShorts: false } });
    await updateSettings({ debug: true }); // unrelated patch must not reset youtube back to defaults
    expect(await getSettings()).toMatchObject({ debug: true, youtube: { hideShorts: false } });
  });
  it('migrates pre-versioned data (no schemaVersion field) through the v0 step and normalizes it', () => {
    expect(normalizeSettings({ enabled: false })).toMatchObject({ schemaVersion: 1, enabled: false, youtube: { hideShorts: true } });
  });
  it('falls back to the default recommendation level for an invalid stored value', () => {
    expect(normalizeSettings({ youtube: { recommendations: 'nonsense' } })).toMatchObject({ youtube: { recommendations: 'calm' } });
  });
  it('persists a valid recommendation level and leaves hideShorts untouched', async () => {
    await updateSettings({ youtube: { recommendations: 'focus' } });
    expect(await getSettings()).toMatchObject({ youtube: { recommendations: 'focus', hideShorts: true } });
  });
  it('merges an instagram patch one level deep, independently of the youtube sub-object', async () => {
    await updateSettings({ youtube: { hideShorts: false } });
    await updateSettings({ instagram: { hideReels: false } });
    expect(await getSettings()).toMatchObject({ youtube: { hideShorts: false }, instagram: { hideReels: false } });
  });
  it('persists disableAutoplay and limitSubscriptionsFeed independently of other youtube fields', async () => {
    await updateSettings({ youtube: { disableAutoplay: false } });
    await updateSettings({ youtube: { limitSubscriptionsFeed: true } });
    expect(await getSettings()).toMatchObject({ youtube: { disableAutoplay: false, limitSubscriptionsFeed: true, hideShorts: true } });
  });
});

describe('concurrent updates', () => {
  it('does not lose a change when two updates overlap', async () => {
    installFakeChrome();
    await Promise.all([updateSettings({ debug: true }), updateSettings({ enabled: false })]);
    expect(await getSettings()).toMatchObject({ enabled: false, debug: true });
  });
});

import { DEFAULT_SETTINGS, SCHEMA_VERSION, SETTINGS_KEY } from '../shared/constants';
import type { InstagramSettings, RecommendationLevel, Settings, YouTubeSettings } from '../shared/types';
import { migrate, type Migration } from './migrate';

const RECOMMENDATION_LEVELS: RecommendationLevel[] = ['off', 'calm', 'focus'];

/**
 * No real migrations exist yet -- schemaVersion has only ever been 1. This is the scaffolding
 * Phase 9 asks for ("support future migrations") so a future schema change has a tested path
 * to land in, rather than only graceful field-by-field defaulting. Step 0 covers data written
 * before schemaVersion tracking existed at all (or with no schemaVersion field); since the
 * shape hasn't changed since then, it's an identity step today. When a real shape change
 * happens, add `1: (d) => ({ ...d, renamedField: d.oldField })`-style steps here and bump
 * SCHEMA_VERSION in shared/constants.ts.
 */
const SETTINGS_MIGRATIONS: Record<number, Migration> = {
  0: (d) => ({ ...d }),
};

function normalizeYouTube(raw: unknown): YouTubeSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    hideShorts: typeof r.hideShorts === 'boolean' ? r.hideShorts : DEFAULT_SETTINGS.youtube.hideShorts,
    recommendations: RECOMMENDATION_LEVELS.includes(r.recommendations as RecommendationLevel)
      ? (r.recommendations as RecommendationLevel)
      : DEFAULT_SETTINGS.youtube.recommendations,
    disableAutoplay: typeof r.disableAutoplay === 'boolean' ? r.disableAutoplay : DEFAULT_SETTINGS.youtube.disableAutoplay,
    watchFocus: typeof r.watchFocus === 'boolean' ? r.watchFocus : DEFAULT_SETTINGS.youtube.watchFocus,
    limitSubscriptionsFeed: typeof r.limitSubscriptionsFeed === 'boolean' ? r.limitSubscriptionsFeed : DEFAULT_SETTINGS.youtube.limitSubscriptionsFeed,
  };
}

function normalizeInstagram(raw: unknown): InstagramSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { hideReels: typeof r.hideReels === 'boolean' ? r.hideReels : DEFAULT_SETTINGS.instagram.hideReels };
}

/** Accepts anything from storage; migrates it forward if it's an old shape, then keeps only valid known fields, filling the rest with defaults. */
export function normalizeSettings(raw: unknown): Settings {
  const r = migrate(raw, SCHEMA_VERSION, SETTINGS_MIGRATIONS);
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_SETTINGS.enabled,
    debug: typeof r.debug === 'boolean' ? r.debug : DEFAULT_SETTINGS.debug,
    calmUI: typeof r.calmUI === 'boolean' ? r.calmUI : DEFAULT_SETTINGS.calmUI,
    youtube: normalizeYouTube(r.youtube),
    instagram: normalizeInstagram(r.instagram),
  };
}

export async function getSettings(): Promise<Settings> {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(res[SETTINGS_KEY]);
}

export interface SettingsPatch extends Partial<Omit<Settings, 'schemaVersion' | 'youtube' | 'instagram'>> {
  youtube?: Partial<YouTubeSettings>;
  instagram?: Partial<InstagramSettings>;
}

/** Serializes writes within one context so overlapping read-modify-write updates cannot drop each other. */
let writeQueue: Promise<unknown> = Promise.resolve();

export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const run = async () => {
    const cur = await getSettings();
    // Per-site settings are merged one level deep so a single-field patch never clobbers the rest of that sub-object.
    const next = normalizeSettings({
      ...cur,
      ...patch,
      youtube: { ...cur.youtube, ...patch.youtube },
      instagram: { ...cur.instagram, ...patch.instagram },
    });
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  };
  const result = writeQueue.then(run, run);
  writeQueue = result.catch(() => undefined);
  return result;
}

export async function resetSettings(): Promise<Settings> {
  const next = normalizeSettings({});
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

/** Writes defaults only if nothing is stored yet. Never overwrites user choices. */
export async function ensureSettings(): Promise<Settings> {
  const res = await chrome.storage.local.get(SETTINGS_KEY);
  if (res[SETTINGS_KEY] === undefined) return resetSettings();
  return normalizeSettings(res[SETTINGS_KEY]);
}

/** Subscribes to settings changes from any extension context. Returns an unsubscribe function. */
export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(SETTINGS_KEY in changes)) return;
    cb(normalizeSettings(changes[SETTINGS_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

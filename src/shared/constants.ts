import type { Settings } from './types';

export const APP_NAME = 'Intentional Web';
export const SETTINGS_KEY = 'iw:settings';
export const SCHEMA_VERSION = 1;
/** Attribute set on <html> while the extension is active on a page. */
export const ACTIVE_ATTR = 'data-iw-active';
/** Set on <html> by the active site adapter; later phases can key CSS off these. */
export const SITE_ATTR = 'data-iw-site';
export const ROUTE_ATTR = 'data-iw-route';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  debug: false,
  youtube: Object.freeze({ hideShorts: true, recommendations: 'calm', disableAutoplay: true, watchFocus: true, limitSubscriptionsFeed: false }),
  instagram: Object.freeze({ hideReels: true }),
  calmUI: true,
});

/** <style> element id carrying the Shorts-hiding CSS rules. */
export const YT_SHORTS_STYLE_ID = 'iw-yt-shorts-style';
/** Host element id for the calm Shorts-route replacement screen. */
export const YT_SHORTS_BLOCK_ID = 'iw-yt-shorts-block';
/** <style> element id carrying the Reels-hiding CSS rules. */
export const IG_REELS_STYLE_ID = 'iw-ig-reels-style';
/** Host element id for the calm Reels-route replacement screen. */
export const IG_REELS_BLOCK_ID = 'iw-ig-reels-block';

/** Attribute set on <html> while the cross-site low-stimulation layer is active. */
export const CALM_ATTR = 'data-iw-calm';
/** <style> element id carrying the calm-mode CSS. */
export const CALM_STYLE_ID = 'iw-calm-style';

/** <style> element id carrying the home-feed recommendation-reduction CSS. */
export const YT_RECS_STYLE_ID = 'iw-yt-recs-style';
/** Host element id for the "end of your intentional feed" boundary card. */
export const YT_RECS_BOUNDARY_ID = 'iw-yt-recs-boundary';

/** <style> element id carrying the autoplay-surface-hiding CSS (watch route only). */
export const YT_AUTOPLAY_STYLE_ID = 'iw-yt-autoplay-style';
/** <style> element id carrying the watch-page focus CSS (related rail + comments hidden). */
export const YT_WATCH_FOCUS_STYLE_ID = 'iw-yt-watch-focus-style';
/** <style> element id carrying the Subscriptions-feed collapse CSS. */
export const YT_SUBS_STYLE_ID = 'iw-yt-subs-style';
/** Host element id for the Subscriptions-feed "Show more" boundary card. */
export const YT_SUBS_BOUNDARY_ID = 'iw-yt-subs-boundary';

/**
 * Centralized configurable constants (no magic numbers scattered through the codebase --
 * every value below is referenced from at least two places, or would silently drift out of
 * sync with a user-visible label if duplicated).
 */

/** Highest valid CSS z-index, used by every full-screen/toast overlay so they always sit above page content regardless of what the page itself does with z-index. */
export const OVERLAY_Z_INDEX = 2147483647;

/** How many items/shelves the home-feed and Subscriptions-feed collapses leave visible (per renderer tag, since :nth-of-type counts each tag separately) before collapsing the rest behind "Show more". */
export const FEED_COLLAPSE_VISIBLE_ITEMS = 8;

/**
 * Minutes added when the person clicks "Continue N min" on the session-end screen. Also
 * used as-is in that button's own label, so the two can never drift out of sync with each
 * other the way two separately-hardcoded literals could.
 */
export const SESSION_CONTINUE_MINUTES = 5;

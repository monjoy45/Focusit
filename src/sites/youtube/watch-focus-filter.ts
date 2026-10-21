import { YT_WATCH_FOCUS_STYLE_ID } from '../../shared/constants';

/**
 * "Netflix-style" watch page: you chose a video, so the page is the video -- no related-videos
 * rail pulling you into the next one, and no comment thread. Applied on the watch route only
 * (the adapter gates that), so Home, Search, Subscriptions, and playlists are untouched.
 *
 * The player, its controls, the title, and the description are deliberately left alone. Hidden
 * with display:none (never removed), so turning the setting off restores everything instantly.
 *
 * NOT VERIFIED against a live YouTube DOM. These are long-standing watch-page elements; each
 * rule is inert if its element doesn't exist, so a wrong selector fails safe (nothing hidden).
 * Tradeoff worth knowing: with the sidebar hidden, picking a different video means going back
 * to Home/Search/Subscriptions -- intentional, since that rail is the rabbit hole.
 */
const WATCH_FOCUS_CSS = `
ytd-watch-flexy #secondary,
ytd-watch-next-secondary-results-renderer { display: none !important; }
ytd-comments#comments { display: none !important; }
`.trim();

export function insertWatchFocusStyle(doc: Document): void {
  if (doc.getElementById(YT_WATCH_FOCUS_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = YT_WATCH_FOCUS_STYLE_ID;
  style.textContent = WATCH_FOCUS_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeWatchFocusStyle(doc: Document): void {
  doc.getElementById(YT_WATCH_FOCUS_STYLE_ID)?.remove();
}

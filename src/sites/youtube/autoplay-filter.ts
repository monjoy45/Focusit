import { YT_AUTOPLAY_STYLE_ID } from '../../shared/constants';

/**
 * Hides the player's autoplay-driving overlays on the watch route: the "up next" countdown
 * that appears before a video ends and auto-advances, the in-video end-card suggestion
 * overlays, and the full-grid endscreen shown after a video finishes.
 *
 * Deliberately does NOT touch the <video> element or the playback control bar
 * (`.ytp-chrome-bottom`: play/pause, seek, volume, fullscreen) -- only overlay/suggestion
 * layers are targeted, so play, pause, seek, volume, fullscreen, and manually picking a
 * different video from the watch-page sidebar all keep working exactly as before. No
 * synthetic clicks are used anywhere (e.g. to flip YouTube's own autoplay toggle) -- that
 * risked landing on the wrong control without a live DOM to verify against, so this stays
 * CSS-only and reversible.
 *
 * NOT VERIFIED against a live YouTube DOM. These are long-standing YouTube player class
 * names; each rule is inert if the element doesn't exist.
 */
const AUTOPLAY_CSS = `
.ytp-upnext,
.ytp-ce-element,
.ytp-ce-covering-overlay,
.ytp-endscreen-content { display: none !important; }
`.trim();

export function insertAutoplayStyle(doc: Document): void {
  if (doc.getElementById(YT_AUTOPLAY_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = YT_AUTOPLAY_STYLE_ID;
  style.textContent = AUTOPLAY_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeAutoplayStyle(doc: Document): void {
  doc.getElementById(YT_AUTOPLAY_STYLE_ID)?.remove();
}

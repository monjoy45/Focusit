import { FEED_COLLAPSE_VISIBLE_ITEMS, YT_SUBS_BOUNDARY_ID, YT_SUBS_STYLE_ID } from '../../shared/constants';

/**
 * Optional, off-by-default: collapses the Subscriptions feed behind a reversible "Show more"
 * boundary, the same "collapse, don't destroy" pattern as the home-feed recommendation
 * reduction (items are hidden with display:none, never removed). The adapter only applies
 * this when the route is 'subscriptions', so Home, Watch, Search, playlists, and channels are
 * never touched by it.
 *
 * NOT VERIFIED against a live YouTube DOM. Scoped with the `page-subtype="subscriptions"`
 * attribute YouTube sets on its `ytd-browse` element for this page -- a long-stable, documented
 * attribute -- as a defense-in-depth measure: even if the route-detection logic above this
 * module ever had a bug, these rules still could not fire on a different page. Covers both
 * list-view (`ytd-video-renderer`) and grid-view (`ytd-grid-video-renderer`) items since the
 * person can switch between those view modes.
 */
const SUBS_CSS = `
ytd-browse[page-subtype="subscriptions"] ytd-video-renderer:nth-of-type(n+${FEED_COLLAPSE_VISIBLE_ITEMS + 1}),
ytd-browse[page-subtype="subscriptions"] ytd-grid-video-renderer:nth-of-type(n+${FEED_COLLAPSE_VISIBLE_ITEMS + 1}) { display: none !important; }
`.trim();

export function applySubsStyle(doc: Document, enabled: boolean): void {
  if (!enabled) { removeSubsStyle(doc); return; }
  if (doc.getElementById(YT_SUBS_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = YT_SUBS_STYLE_ID;
  style.textContent = SUBS_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeSubsStyle(doc: Document): void {
  doc.getElementById(YT_SUBS_STYLE_ID)?.remove();
}

export interface SubsBoundaryOptions {
  onShowMore: () => void;
}

/** Idempotent: a second call while already mounted does nothing. Inline, not a full-screen overlay. */
export function mountSubsBoundary(doc: Document, opts: SubsBoundaryOptions): void {
  if (doc.getElementById(YT_SUBS_BOUNDARY_ID)) return;

  const host = doc.createElement('div');
  host.id = YT_SUBS_BOUNDARY_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .card { display: block; box-sizing: border-box; margin: 24px auto; max-width: 460px; padding: 22px; text-align: center;
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d2a29; background: #e8eeec; border-radius: 10px; }
    @media (prefers-color-scheme: dark) { .card { color: #eef3f1; background: #222d2b; } }
    p { margin: 0 0 14px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #5d6e6b55; background: transparent; color: inherit; padding: 8px 12px; }
    button:focus-visible { outline: 2px solid #3a6d66; outline-offset: 2px; }
  `;

  const card = doc.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'note');
  card.innerHTML = `
    <p>You've reached the end of your intentional feed.</p>
    <button type="button" data-action="more">Show more</button>
  `;
  card.querySelector('[data-action="more"]')?.addEventListener('click', () => opts.onShowMore());
  shadow.append(style, card);

  const grid = doc.querySelector('ytd-browse[page-subtype="subscriptions"]');
  (grid?.parentElement ?? doc.body).insertBefore(host, grid?.nextSibling ?? null);
}

export function unmountSubsBoundary(doc: Document): void {
  doc.getElementById(YT_SUBS_BOUNDARY_ID)?.remove();
}

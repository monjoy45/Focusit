import { FEED_COLLAPSE_VISIBLE_ITEMS, YT_RECS_BOUNDARY_ID, YT_RECS_STYLE_ID } from '../../shared/constants';
import type { RecommendationLevel } from '../../shared/types';

/**
 * Reduces -- never fully deletes -- the YouTube home-page recommendation grid. The adapter
 * only calls this when the route is 'home', so watch pages, search results, Subscriptions,
 * and every other route are untouched by construction (Phase 6's "don't break direct
 * navigation" / "don't hide the user's search result" requirements).
 *
 * CALM keeps roughly the first couple of rows visible and collapses the rest; FOCUS collapses
 * from the start. Both are reversible in one click ("Show more") -- items are hidden with
 * `display: none`, never removed, so nothing is lost and revealing is instant.
 *
 * NOT VERIFIED against a live YouTube DOM. `ytd-rich-grid-renderer` is the real, documented
 * home-feed container; `:nth-of-type` is an approximation (it counts each tag separately, so
 * CALM shows roughly the first ~8 of each renderer type rather than an exact combined count)
 * -- an acceptable conservative trade-off given the DOM can't be checked here, and it only
 * ever shows *more* than a precise count would, never less.
 */
const CSS_BY_LEVEL: Record<'calm' | 'focus', string> = {
  calm: `
ytd-rich-grid-renderer #contents > ytd-rich-item-renderer:nth-of-type(n+${FEED_COLLAPSE_VISIBLE_ITEMS + 1}),
ytd-rich-grid-renderer #contents > ytd-rich-shelf-renderer:nth-of-type(n+${FEED_COLLAPSE_VISIBLE_ITEMS + 1}) { display: none !important; }
`.trim(),
  focus: `
ytd-rich-grid-renderer { display: none !important; }
`.trim(),
};

/** level 'off' removes the style entirely; otherwise injects (or updates in place) the level's CSS. */
export function applyRecsStyle(doc: Document, level: RecommendationLevel): void {
  if (level === 'off') { removeRecsStyle(doc); return; }
  let style = doc.getElementById(YT_RECS_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = YT_RECS_STYLE_ID;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  style.textContent = CSS_BY_LEVEL[level];
}

export function removeRecsStyle(doc: Document): void {
  doc.getElementById(YT_RECS_STYLE_ID)?.remove();
}

export interface RecsBoundaryOptions {
  onSearch: () => void;
  onShowMore: () => void;
}

/**
 * Idempotent: a second call while already mounted does nothing. Placed inline right after the
 * recommendation grid -- not a full-screen overlay -- so it never covers or blocks anything
 * still on the page.
 */
export function mountRecsBoundary(doc: Document, opts: RecsBoundaryOptions): void {
  if (doc.getElementById(YT_RECS_BOUNDARY_ID)) return;

  const host = doc.createElement('div');
  host.id = YT_RECS_BOUNDARY_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .card { display: block; box-sizing: border-box; margin: 24px auto; max-width: 460px; padding: 22px; text-align: center;
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d2a29; background: #e8eeec; border-radius: 10px; }
    @media (prefers-color-scheme: dark) { .card { color: #eef3f1; background: #222d2b; } }
    p { margin: 0 0 14px; }
    .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #5d6e6b55; background: transparent; color: inherit; padding: 8px 12px; }
    button:focus-visible { outline: 2px solid #3a6d66; outline-offset: 2px; }
  `;

  const card = doc.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'note');
  card.innerHTML = `
    <p>You've reached the end of your intentional feed.</p>
    <div class="row">
      <button type="button" data-action="search">Search YouTube</button>
      <button type="button" data-action="more">Show more</button>
    </div>
  `;
  card.querySelector('[data-action="search"]')?.addEventListener('click', () => opts.onSearch());
  card.querySelector('[data-action="more"]')?.addEventListener('click', () => opts.onShowMore());
  shadow.append(style, card);

  const grid = doc.querySelector('ytd-rich-grid-renderer');
  (grid?.parentElement ?? doc.body).insertBefore(host, grid?.nextSibling ?? null);
}

export function unmountRecsBoundary(doc: Document): void {
  doc.getElementById(YT_RECS_BOUNDARY_ID)?.remove();
}

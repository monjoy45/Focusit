import { OVERLAY_Z_INDEX, YT_SHORTS_BLOCK_ID, YT_SHORTS_STYLE_ID } from '../../shared/constants';
export { pausePlayingVideos } from '../media';

/**
 * Hides Shorts shelves/cards/recommendations across YouTube (home, search, watch sidebar,
 * channel grids, the sidebar nav entry point itself, and the mini-player variant) using CSS
 * `:has()` so it also covers content YouTube injects later — no MutationObserver needed for
 * this part. Chrome 105+ supports `:has()`; the manifest already requires Chrome 110+.
 *
 * Also included: a calmer, grid-first presentation (hiding the horizontal category "chips"
 * bar that drives algorithmic category-hopping, and a touch more breathing room between
 * cards) so what remains reads more like a deliberate catalog to browse than an endless,
 * algorithmically-driven feed.
 *
 * NOT VERIFIED against a live YouTube DOM (no browser was available while building this).
 * Every selector below targets a real, documented YouTube custom element or an href pattern;
 * each rule is independently inert if that element doesn't exist, so a wrong or outdated
 * selector fails safe (nothing hidden) rather than hiding the wrong thing. Selectors are
 * deliberately scoped to named custom elements, never a bare `div`/`li`, so a false match
 * can't take out an unrelated part of the page. The newer "view model" element names below
 * (YouTube's 2023+ web-component redesign) are included on a best-effort basis since they
 * can't be verified here either -- if Shorts still slip through on your install, the most
 * likely reason is a selector that needs updating; the element's tag name from DevTools is
 * exactly what's needed to add it.
 */
const SHORTS_CSS = `
/* Shorts shelf on Home / Subscriptions, including the newer "view model" shelf variant */
ytd-reel-shelf-renderer,
ytd-rich-shelf-renderer[is-shorts],
grid-shelf-view-model:has(a[href^="/shorts/"]) { display: none !important; }
/* Individual Shorts item inside a shelf, in any renderer generation */
ytd-reel-item-renderer,
ytm-shorts-lockup-view-model,
ytm-shorts-lockup-view-model-v2,
shorts-lockup-view-model { display: none !important; }
/* Shorts appearing in search results and list-style feeds */
ytd-video-renderer:has(a[href^="/shorts/"]) { display: none !important; }
/* Shorts in the watch-page "up next" / related sidebar, and the floating mini-player */
ytd-compact-video-renderer:has(a[href^="/shorts/"]),
ytd-miniplayer:has(a[href^="/shorts/"]) { display: none !important; }
/* Shorts in grid views (channel pages, etc.) */
ytd-grid-video-renderer:has(a[href^="/shorts/"]),
ytd-rich-item-renderer:has(a[href^="/shorts/"]) { display: none !important; }
/* The "Shorts" entry point in the left sidebar nav, expanded and collapsed */
ytd-guide-entry-renderer:has(a[title="Shorts"]),
ytd-mini-guide-entry-renderer:has(a[aria-label="Shorts"]) { display: none !important; }
/* Calmer, catalog-style browsing: hide the algorithmic category-chip bar that drives
   endless category-hopping. (A "larger cards, more breathing room" grid restyle was
   considered too, but doing that safely needs to know YouTube's actual grid CSS --
   guessing at it risked either doing nothing or breaking the grid's responsive layout,
   so it's left out rather than shipped as an unverifiable guess.) */
ytd-feed-filter-chip-bar-renderer { display: none !important; }
`.trim();

export function insertShortsStyle(doc: Document): void {
  if (doc.getElementById(YT_SHORTS_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = YT_SHORTS_STYLE_ID;
  style.textContent = SHORTS_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeShortsStyle(doc: Document): void {
  doc.getElementById(YT_SHORTS_STYLE_ID)?.remove();
}


export interface BlockScreenOptions {
  /** Called when the person clicks "Disable temporarily". */
  onDisable: () => void;
  /** Injectable for tests; defaults to a real page navigation. */
  navigate?: (url: string) => void;
}

const defaultNavigate = (url: string) => { window.location.href = url; };

/** Idempotent: a second call while the screen is already mounted does nothing. */
export function mountBlockScreen(doc: Document, opts: BlockScreenOptions): void {
  if (doc.getElementById(YT_SHORTS_BLOCK_ID)) return;
  const navigate = opts.navigate ?? defaultNavigate;

  const host = doc.createElement('div');
  host.id = YT_SHORTS_BLOCK_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset: 0; z-index: ${OVERLAY_Z_INDEX}; display: flex; align-items: center; justify-content: center;
      background: #17211f; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eef3f1; }
    .card { max-width: 380px; padding: 32px; text-align: center; }
    h1 { font-size: 19px; font-weight: 600; margin: 0 0 10px; }
    p { margin: 0 0 20px; color: #a9bab5; }
    form { display: flex; gap: 8px; margin-bottom: 12px; }
    input { flex: 1; min-width: 0; padding: 9px 10px; border-radius: 6px; border: 1px solid #35443f; background: #1f2a27; color: inherit; font: inherit; }
    input:focus-visible, button:focus-visible { outline: 2px solid #7fb5ac; outline-offset: 2px; }
    button, .btn { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #35443f; background: #24312d; color: inherit; padding: 9px 12px; }
    .row { display: flex; flex-direction: column; gap: 8px; }
    .quiet { background: none; border: none; color: #a9bab5; text-decoration: underline; padding: 6px; }
  `;

  const wrap = doc.createElement('div');
  wrap.className = 'wrap';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', 'Short-form feed hidden');
  wrap.innerHTML = `
    <div class="card">
      <h1>Short-form feed hidden</h1>
      <p>This extension hides endless short-form feeds. You can still watch regular videos and search intentionally.</p>
      <form>
        <input type="text" placeholder="Search YouTube" aria-label="Search YouTube" />
        <button type="submit">Search</button>
      </form>
      <div class="row">
        <button type="button" class="btn" data-action="subscriptions">Go to Subscriptions</button>
        <button type="button" class="quiet" data-action="disable">Disable temporarily</button>
      </div>
    </div>
  `;

  wrap.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (wrap.querySelector('input') as HTMLInputElement | null)?.value.trim() ?? '';
    if (q) navigate(`/results?search_query=${encodeURIComponent(q)}`);
  });
  wrap.querySelector('[data-action="subscriptions"]')?.addEventListener('click', () => navigate('/feed/subscriptions'));
  wrap.querySelector('[data-action="disable"]')?.addEventListener('click', () => opts.onDisable());

  shadow.append(style, wrap);
  doc.body.appendChild(host);
  // Moves keyboard/screen-reader focus onto the screen without trapping it -- Tab still
  // cycles normally and nothing blocks leaving via the browser's own navigation.
  (wrap.querySelector('input, button') as HTMLElement | null)?.focus();
}

export function unmountBlockScreen(doc: Document): void {
  doc.getElementById(YT_SHORTS_BLOCK_ID)?.remove();
}

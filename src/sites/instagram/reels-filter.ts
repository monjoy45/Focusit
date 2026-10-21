import { OVERLAY_Z_INDEX, IG_REELS_BLOCK_ID, IG_REELS_STYLE_ID } from '../../shared/constants';

/**
 * Hides the Reels nav entry and Reels-linked posts in the feed using CSS `:has()`, the same
 * approach as the YouTube Shorts filter (see that file for why `:has()` needs no
 * MutationObserver here).
 *
 * NOT VERIFIED against a live Instagram DOM (no browser was available while building this).
 * Instagram's class names are obfuscated and change often, so this deliberately avoids them:
 * - The nav entry is matched by an exact href (`/reels/`, no id after it), not a class.
 * - Feed posts are matched by `article:has(a[href^="/reel/"])`. `<article>` is the semantic
 *   element Instagram's web app uses to wrap one feed post, so this only removes a post that
 *   itself links to a reel — never a generic container — and fails safe (nothing hidden) if
 *   that assumption is wrong for a given layout.
 * Selectors are deliberately scoped this way, never a bare `div`, so a false match can't take
 * out an unrelated part of the page.
 */
const REELS_CSS = `
/* Reels entry point in the side/tab navigation */
a[href="/reels/"] { display: none !important; }
/* A feed post that is itself a Reel (or reshares one) */
article:has(a[href^="/reel/"]) { display: none !important; }
`.trim();

export function insertReelsStyle(doc: Document): void {
  if (doc.getElementById(IG_REELS_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = IG_REELS_STYLE_ID;
  style.textContent = REELS_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeReelsStyle(doc: Document): void {
  doc.getElementById(IG_REELS_STYLE_ID)?.remove();
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
  if (doc.getElementById(IG_REELS_BLOCK_ID)) return;
  const navigate = opts.navigate ?? defaultNavigate;

  const host = doc.createElement('div');
  host.id = IG_REELS_BLOCK_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset: 0; z-index: ${OVERLAY_Z_INDEX}; display: flex; align-items: center; justify-content: center;
      background: #17211f; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eef3f1; }
    .card { max-width: 380px; padding: 32px; text-align: center; }
    h1 { font-size: 19px; font-weight: 600; margin: 0 0 10px; }
    p { margin: 0 0 20px; color: #a9bab5; }
    .row { display: flex; flex-direction: column; gap: 8px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #35443f; background: #24312d; color: inherit; padding: 9px 12px; }
    button:focus-visible { outline: 2px solid #7fb5ac; outline-offset: 2px; }
    .quiet { background: none; border: none; color: #a9bab5; text-decoration: underline; padding: 6px; }
  `;

  const wrap = doc.createElement('div');
  wrap.className = 'wrap';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', 'Reels hidden');
  wrap.innerHTML = `
    <div class="card">
      <h1>Reels hidden</h1>
      <p>Intentional browsing is still available.</p>
      <div class="row">
        <button type="button" data-action="search">Search Instagram</button>
        <button type="button" data-action="messages">Messages</button>
        <button type="button" data-action="profiles">Profiles</button>
        <button type="button" class="quiet" data-action="disable">Disable temporarily</button>
      </div>
    </div>
  `;

  // Instagram's web search opens as an in-page overlay rather than a URL, and there is no
  // generic "browse profiles" route, so both buttons land on the routes that get you there:
  // Explore carries the search entry point, and Home is where profile links (following,
  // suggested accounts) live. Not verified against a live page.
  wrap.querySelector('[data-action="search"]')?.addEventListener('click', () => navigate('/explore/'));
  wrap.querySelector('[data-action="messages"]')?.addEventListener('click', () => navigate('/direct/inbox/'));
  wrap.querySelector('[data-action="profiles"]')?.addEventListener('click', () => navigate('/'));
  wrap.querySelector('[data-action="disable"]')?.addEventListener('click', () => opts.onDisable());

  shadow.append(style, wrap);
  doc.body.appendChild(host);
  // Moves keyboard/screen-reader focus onto the screen without trapping it.
  (wrap.querySelector('button') as HTMLElement | null)?.focus();
}

export function unmountBlockScreen(doc: Document): void {
  doc.getElementById(IG_REELS_BLOCK_ID)?.remove();
}

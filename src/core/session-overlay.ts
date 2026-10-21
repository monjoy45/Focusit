import { OVERLAY_Z_INDEX } from '../shared/constants';

const WARNING_ID = 'iw-session-warning';
const END_ID = 'iw-session-end';

/** Idempotent: a second call while already mounted does nothing. Small, dismissible, non-blocking -- the person can keep doing what they're doing. */
export function mountWarningToast(doc: Document, minutesLeft: number, onDismiss: () => void): void {
  if (doc.getElementById(WARNING_ID)) return;
  const host = doc.createElement('div');
  host.id = WARNING_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .toast { position: fixed; right: 16px; bottom: 16px; z-index: ${OVERLAY_Z_INDEX}; display: flex; align-items: center; gap: 10px;
      max-width: 320px; padding: 12px 14px; border-radius: 10px; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #1d2a29; background: #e8eeec; box-shadow: 0 4px 16px rgba(0,0,0,.18); }
    @media (prefers-color-scheme: dark) { .toast { color: #eef3f1; background: #222d2b; } }
    p { margin: 0; flex: 1; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #5d6e6b55; background: transparent; color: inherit; padding: 6px 10px; }
    button:focus-visible { outline: 2px solid #3a6d66; outline-offset: 2px; }
  `;
  const toast = doc.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<p>${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} left in your session.</p><button type="button" data-action="dismiss">Dismiss</button>`;
  toast.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => onDismiss());
  shadow.append(style, toast);
  doc.body.appendChild(host);
}

export function unmountWarningToast(doc: Document): void {
  doc.getElementById(WARNING_ID)?.remove();
}

export interface SessionEndOptions {
  onLeave: () => void;
  onContinue: () => void;
  continueMinutes: number;
}

/** Full-screen, calm -- deliberately avoids guilt-tripping language ("Your planned session is over", not "you wasted N minutes"). Idempotent. */
export function mountSessionEndScreen(doc: Document, opts: SessionEndOptions): void {
  if (doc.getElementById(END_ID)) return;
  const host = doc.createElement('div');
  host.id = END_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .wrap { position: fixed; inset: 0; z-index: ${OVERLAY_Z_INDEX}; display: flex; align-items: center; justify-content: center;
      background: #17211f; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eef3f1; }
    .card { max-width: 380px; padding: 32px; text-align: center; }
    h1 { font-size: 19px; font-weight: 600; margin: 0 0 10px; }
    .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #35443f; background: #24312d; color: inherit; padding: 9px 14px; }
    button:focus-visible { outline: 2px solid #7fb5ac; outline-offset: 2px; }
  `;
  const wrap = doc.createElement('div');
  wrap.className = 'wrap';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', 'Session ended');
  wrap.innerHTML = `
    <div class="card">
      <h1>Your planned session is over.</h1>
      <div class="row">
        <button type="button" data-action="leave">Leave</button>
        <button type="button" data-action="continue">Continue ${opts.continueMinutes} min</button>
      </div>
    </div>
  `;
  wrap.querySelector('[data-action="leave"]')?.addEventListener('click', () => opts.onLeave());
  wrap.querySelector('[data-action="continue"]')?.addEventListener('click', () => opts.onContinue());
  shadow.append(style, wrap);
  doc.body.appendChild(host);
  // Moves keyboard/screen-reader focus onto the screen without trapping it.
  (wrap.querySelector('button') as HTMLElement | null)?.focus();
}

export function unmountSessionEndScreen(doc: Document): void {
  doc.getElementById(END_ID)?.remove();
}

export { WARNING_ID as SESSION_WARNING_TOAST_ID, END_ID as SESSION_END_SCREEN_ID };

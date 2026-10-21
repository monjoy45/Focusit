export interface RouteWatcher {
  start(): void;
  stop(): void;
  /** Compare now against the last seen route key; fires onChange only if it differs. */
  check(): void;
}

interface Options {
  win?: Window;
  /** Fallback poll interval. Content scripts cannot see the page's history.pushState calls, so polling backs up the events. */
  pollMs?: number;
}

/**
 * Detects SPA navigation without patching page globals. Sources: popstate (back/forward),
 * YouTube's yt-navigate-finish, the Navigation API when present, tab visibility, and a light poll.
 * Fires only when getKey() actually changes, so overlapping signals never cause duplicate work.
 */
export function createRouteWatcher(getKey: () => string, onChange: () => void, opts: Options = {}): RouteWatcher {
  const win = opts.win ?? window;
  const doc = win.document;
  const pollMs = opts.pollMs ?? 800;
  const nav = (win as unknown as { navigation?: EventTarget }).navigation;
  let running = false;
  let last = '';
  let timer: number | undefined;

  const check = () => {
    if (!running) return;
    const key = getKey();
    if (key === last) return;
    last = key;
    onChange();
  };
  const poll = () => { if (!doc.hidden) check(); };

  return {
    check,
    start() {
      if (running) return;
      running = true;
      last = getKey();
      win.addEventListener('popstate', check);
      doc.addEventListener('yt-navigate-finish', check);
      doc.addEventListener('visibilitychange', check);
      nav?.addEventListener('currententrychange', check);
      timer = win.setInterval(poll, pollMs);
    },
    stop() {
      if (!running) return;
      running = false;
      win.removeEventListener('popstate', check);
      doc.removeEventListener('yt-navigate-finish', check);
      doc.removeEventListener('visibilitychange', check);
      nav?.removeEventListener('currententrychange', check);
      win.clearInterval(timer);
      timer = undefined;
    },
  };
}

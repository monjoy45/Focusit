export interface PresenceGuard {
  start(): void;
  stop(): void;
}

interface SharedWatcher {
  observer: MutationObserver;
  checks: Set<() => void>;
}

/**
 * One MutationObserver per document, shared by every guard watching it. Several features can
 * have a guard running at once (Shorts block screen, home-feed boundary, Subscriptions
 * boundary, session-end screen); previously each created its own observer on document.body,
 * so every body mutation woke up to four callbacks. Now it wakes one, which runs each
 * registered check. The observer disconnects when the last guard stops.
 */
const watchers = new WeakMap<Document, SharedWatcher>();

function register(doc: Document, check: () => void): void {
  let w = watchers.get(doc);
  if (!w) {
    const checks = new Set<() => void>();
    const observer = new MutationObserver(() => {
      // Snapshot first: a check may call stop() on its own guard, mutating the set mid-loop.
      for (const c of [...checks]) {
        // One failing check must never stop the others from running.
        try { c(); } catch { /* the guard's ensure() already reports its own errors where relevant */ }
      }
    });
    // childList only, no subtree: we only care whether our own direct child of <body> vanished.
    observer.observe(doc.body, { childList: true });
    w = { observer, checks };
    watchers.set(doc, w);
  }
  w.checks.add(check);
}

function unregister(doc: Document, check: () => void): void {
  const w = watchers.get(doc);
  if (!w) return;
  w.checks.delete(check);
  if (w.checks.size === 0) {
    w.observer.disconnect();
    watchers.delete(doc);
  }
}

/**
 * Keeps one element present in the document. An SPA re-render can remove nodes we injected
 * (e.g. the Shorts block screen) without the extension asking for it; this notices and
 * re-inserts. Self-terminating: it only acts when the element is actually missing, so
 * re-inserting (which itself triggers a childList mutation) never causes a second re-insert.
 */
export function createPresenceGuard(doc: Document, elementId: string, ensure: () => void): PresenceGuard {
  const check = () => { if (!doc.getElementById(elementId)) ensure(); };
  let running = false;
  return {
    start() {
      if (running) return;
      running = true;
      register(doc, check);
    },
    stop() {
      if (!running) return;
      running = false;
      unregister(doc, check);
    },
  };
}

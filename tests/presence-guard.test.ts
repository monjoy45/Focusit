import { describe, it, expect, vi } from 'vitest';
import { createPresenceGuard } from '../src/core/presence-guard';

const flush = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r as () => void)));

describe('presence guard', () => {
  it('re-inserts the element if it is removed from the document', async () => {
    document.body.innerHTML = '';
    const el = document.createElement('div'); el.id = 'target';
    document.body.appendChild(el);
    const ensure = vi.fn(() => { document.body.appendChild(document.getElementById('target') ?? Object.assign(document.createElement('div'), { id: 'target' })); });
    const guard = createPresenceGuard(document, 'target', ensure);
    guard.start();
    document.getElementById('target')?.remove();
    await flush();
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(document.getElementById('target')).not.toBeNull();
    guard.stop();
  });

  it('does not call ensure() when the element is present and other mutations happen', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const ensure = vi.fn();
    const guard = createPresenceGuard(document, 'target', ensure);
    guard.start();
    document.body.appendChild(document.createElement('span'));
    await flush();
    expect(ensure).not.toHaveBeenCalled();
    guard.stop();
  });

  it('stops observing after stop(), and start()/stop() are idempotent', async () => {
    document.body.innerHTML = '<div id="target"></div>';
    const ensure = vi.fn();
    const guard = createPresenceGuard(document, 'target', ensure);
    guard.start(); guard.start();
    guard.stop(); guard.stop();
    document.getElementById('target')?.remove();
    await flush();
    expect(ensure).not.toHaveBeenCalled();
  });
});

describe('shared observer', () => {
  it('creates a single MutationObserver no matter how many guards watch the same document', () => {
    document.body.innerHTML = '';
    const Original = globalThis.MutationObserver;
    let constructed = 0;
    class Counting extends Original { constructor(cb: MutationCallback) { super(cb); constructed++; } }
    globalThis.MutationObserver = Counting as unknown as typeof MutationObserver;
    try {
      const guards = ['a', 'b', 'c', 'd'].map((id) => createPresenceGuard(document, id, () => {}));
      guards.forEach((g) => g.start());
      expect(constructed).toBe(1);
      guards.forEach((g) => g.stop());
    } finally {
      globalThis.MutationObserver = Original;
    }
  });

  it('keeps watching for the remaining guards after one stops, and disconnects after the last', async () => {
    document.body.innerHTML = '<div id="keep"></div><div id="drop"></div>';
    const ensureKeep = vi.fn(); const ensureDrop = vi.fn();
    const keep = createPresenceGuard(document, 'keep', ensureKeep);
    const drop = createPresenceGuard(document, 'drop', ensureDrop);
    keep.start(); drop.start();
    drop.stop();
    document.getElementById('keep')?.remove();
    document.getElementById('drop')?.remove();
    await flush();
    expect(ensureKeep).toHaveBeenCalledTimes(1);
    expect(ensureDrop).not.toHaveBeenCalled();
    keep.stop();
  });

  it('a throwing check does not stop the other guards from running', async () => {
    document.body.innerHTML = '<div id="x"></div><div id="y"></div>';
    const ensureY = vi.fn();
    const bad = createPresenceGuard(document, 'x', () => { throw new Error('boom'); });
    const good = createPresenceGuard(document, 'y', ensureY);
    bad.start(); good.start();
    document.getElementById('x')?.remove();
    document.getElementById('y')?.remove();
    await flush();
    expect(ensureY).toHaveBeenCalledTimes(1);
    bad.stop(); good.stop();
  });

  it('a guard can stop itself from inside its own ensure() without breaking the others', async () => {
    document.body.innerHTML = '<div id="self"></div><div id="other"></div>';
    const ensureOther = vi.fn();
    const self: { g?: ReturnType<typeof createPresenceGuard> } = {};
    self.g = createPresenceGuard(document, 'self', () => self.g!.stop());
    const other = createPresenceGuard(document, 'other', ensureOther);
    self.g.start(); other.start();
    document.getElementById('self')?.remove();
    document.getElementById('other')?.remove();
    await flush();
    expect(ensureOther).toHaveBeenCalledTimes(1);
    other.stop();
  });
});

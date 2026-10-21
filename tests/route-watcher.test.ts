import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRouteWatcher } from '../src/core/route-watcher';

describe('route watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires only when the key actually changes', () => {
    let key = '/a'; const onChange = vi.fn();
    const w = createRouteWatcher(() => key, onChange, { pollMs: 100 });
    w.start();
    key = '/a'; w.check(); expect(onChange).not.toHaveBeenCalled();
    key = '/b'; w.check(); expect(onChange).toHaveBeenCalledTimes(1);
    w.check(); expect(onChange).toHaveBeenCalledTimes(1);
    w.stop();
  });

  it('reacts to popstate, a custom navigation event, and polling', () => {
    let key = '/start'; const onChange = vi.fn();
    const w = createRouteWatcher(() => key, onChange, { pollMs: 50 });
    w.start();
    key = '/pop'; window.dispatchEvent(new Event('popstate'));
    expect(onChange).toHaveBeenCalledTimes(1);
    key = '/yt'; document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(onChange).toHaveBeenCalledTimes(2);
    key = '/polled'; vi.advanceTimersByTime(60);
    expect(onChange).toHaveBeenCalledTimes(3);
    w.stop();
  });

  it('does not poll while the document is hidden', () => {
    let key = '/a'; const onChange = vi.fn();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    const w = createRouteWatcher(() => key, onChange, { pollMs: 50 });
    w.start();
    key = '/b'; vi.advanceTimersByTime(60);
    expect(onChange).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    w.stop();
  });

  it('stops listening after stop(), and start()/stop() are idempotent', () => {
    let key = '/a'; const onChange = vi.fn();
    const w = createRouteWatcher(() => key, onChange, { pollMs: 50 });
    w.start(); w.start();
    w.stop(); w.stop();
    key = '/b'; window.dispatchEvent(new Event('popstate')); vi.advanceTimersByTime(60);
    expect(onChange).not.toHaveBeenCalled();
  });
});

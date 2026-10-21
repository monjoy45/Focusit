import { describe, it, expect, beforeEach } from 'vitest';
import { YT_WATCH_FOCUS_STYLE_ID } from '../src/shared/constants';
import { insertWatchFocusStyle, removeWatchFocusStyle } from '../src/sites/youtube/watch-focus-filter';

beforeEach(() => { document.head.innerHTML = ''; });

describe('watch-focus style', () => {
  it('injects once and is idempotent', () => {
    insertWatchFocusStyle(document); insertWatchFocusStyle(document);
    expect(document.querySelectorAll(`#${YT_WATCH_FOCUS_STYLE_ID}`)).toHaveLength(1);
  });
  it('removes cleanly and is a no-op if already absent', () => {
    insertWatchFocusStyle(document);
    removeWatchFocusStyle(document); removeWatchFocusStyle(document);
    expect(document.getElementById(YT_WATCH_FOCUS_STYLE_ID)).toBeNull();
  });
  it('hides the related rail and comments but never the player, its controls, or the video element', () => {
    insertWatchFocusStyle(document);
    const css = document.getElementById(YT_WATCH_FOCUS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/#secondary/);
    expect(css).toMatch(/ytd-comments/);
    expect(css).not.toMatch(/ytp-/);
    expect(css).not.toMatch(/(^|[^-\w])video\b/i);
    expect(css).not.toMatch(/#player/);
  });
});

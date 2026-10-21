import { describe, it, expect, beforeEach } from 'vitest';
import { YT_AUTOPLAY_STYLE_ID } from '../src/shared/constants';
import { insertAutoplayStyle, removeAutoplayStyle } from '../src/sites/youtube/autoplay-filter';

beforeEach(() => { document.head.innerHTML = ''; });

describe('autoplay-surface style', () => {
  it('injects once and is idempotent on repeated calls', () => {
    insertAutoplayStyle(document); insertAutoplayStyle(document);
    expect(document.querySelectorAll(`#${YT_AUTOPLAY_STYLE_ID}`)).toHaveLength(1);
  });
  it('removeAutoplayStyle removes it and is a no-op if already absent', () => {
    insertAutoplayStyle(document);
    removeAutoplayStyle(document); removeAutoplayStyle(document);
    expect(document.getElementById(YT_AUTOPLAY_STYLE_ID)).toBeNull();
  });
  it('targets only known overlay/suggestion surfaces, never the playback control bar or the video element', () => {
    insertAutoplayStyle(document);
    const css = document.getElementById(YT_AUTOPLAY_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/ytp-upnext/);
    expect(css).toMatch(/ytp-endscreen-content/);
    expect(css).not.toMatch(/ytp-chrome-bottom/);
    expect(css).not.toMatch(/(^|[^-\w])video\b/i);
  });
});

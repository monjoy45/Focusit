import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YT_SHORTS_BLOCK_ID, YT_SHORTS_STYLE_ID } from '../src/shared/constants';
import { insertShortsStyle, removeShortsStyle, mountBlockScreen, unmountBlockScreen, pausePlayingVideos } from '../src/sites/youtube/shorts-filter';

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('Shorts CSS style', () => {
  it('injects once and is idempotent on repeated calls', () => {
    insertShortsStyle(document); insertShortsStyle(document);
    expect(document.querySelectorAll(`#${YT_SHORTS_STYLE_ID}`)).toHaveLength(1);
  });
  it('targets only named custom elements, never a bare div/li', () => {
    insertShortsStyle(document);
    const css = document.getElementById(YT_SHORTS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/ytd-reel-shelf-renderer/);
    expect(css).not.toMatch(/(^|\s)div(:has)?\s*[,{]/);
    expect(css).not.toMatch(/(^|\s)li(:has)?\s*[,{]/);
  });
  it('covers the sidebar nav entry point, the mini-player, newer view-model elements, and the chips bar', () => {
    insertShortsStyle(document);
    const css = document.getElementById(YT_SHORTS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/ytd-guide-entry-renderer/);
    expect(css).toMatch(/ytd-mini-guide-entry-renderer/);
    expect(css).toMatch(/ytd-miniplayer/);
    expect(css).toMatch(/shorts-lockup-view-model/);
    expect(css).toMatch(/ytd-feed-filter-chip-bar-renderer/);
  });
  it('removeShortsStyle removes it and is a no-op if already absent', () => {
    insertShortsStyle(document);
    removeShortsStyle(document); removeShortsStyle(document);
    expect(document.getElementById(YT_SHORTS_STYLE_ID)).toBeNull();
  });
});

describe('pausePlayingVideos', () => {
  it('pauses a video reporting as playing and ignores a video that throws', () => {
    const ok = document.createElement('video'); Object.defineProperty(ok, 'paused', { value: false });
    const pause = vi.fn(); ok.pause = pause;
    const bad = document.createElement('video'); Object.defineProperty(bad, 'paused', { value: false });
    bad.pause = () => { throw new Error('boom'); };
    document.body.append(ok, bad);
    expect(() => pausePlayingVideos(document)).not.toThrow();
    expect(pause).toHaveBeenCalled();
  });
  it('does not call pause on an already-paused video', () => {
    const v = document.createElement('video'); Object.defineProperty(v, 'paused', { value: true });
    const pause = vi.fn(); v.pause = pause;
    document.body.appendChild(v);
    pausePlayingVideos(document);
    expect(pause).not.toHaveBeenCalled();
  });
});

describe('Shorts block screen', () => {
  it('mounts once with the expected copy and controls, idempotent on repeat', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    mountBlockScreen(document, { onDisable: () => {} });
    expect(document.querySelectorAll(`#${YT_SHORTS_BLOCK_ID}`)).toHaveLength(1);
    const shadow = document.getElementById(YT_SHORTS_BLOCK_ID)!.shadowRoot!;
    expect(shadow.textContent).toContain('Short-form feed hidden');
    expect(shadow.textContent).not.toMatch(/shame|weak|addict/i);
  });

  it('unmounts and is a no-op if already absent', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    unmountBlockScreen(document); unmountBlockScreen(document);
    expect(document.getElementById(YT_SHORTS_BLOCK_ID)).toBeNull();
  });

  it('search submits navigate to a results URL with the query encoded', () => {
    const navigate = vi.fn();
    mountBlockScreen(document, { onDisable: () => {}, navigate });
    const shadow = document.getElementById(YT_SHORTS_BLOCK_ID)!.shadowRoot!;
    const input = shadow.querySelector('input') as HTMLInputElement;
    input.value = 'cats & dogs';
    shadow.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(navigate).toHaveBeenCalledWith('/results?search_query=cats%20%26%20dogs');
  });

  it('an empty search does not navigate', () => {
    const navigate = vi.fn();
    mountBlockScreen(document, { onDisable: () => {}, navigate });
    const shadow = document.getElementById(YT_SHORTS_BLOCK_ID)!.shadowRoot!;
    shadow.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('"Go to Subscriptions" navigates to the subscriptions feed', () => {
    const navigate = vi.fn();
    mountBlockScreen(document, { onDisable: () => {}, navigate });
    const shadow = document.getElementById(YT_SHORTS_BLOCK_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="subscriptions"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith('/feed/subscriptions');
  });

  it('is marked as a modal dialog and moves focus to its first control without trapping it', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    const shadow = document.getElementById('iw-yt-shorts-block')!.shadowRoot!;
    const wrap = shadow.querySelector('[role="dialog"]')!;
    expect(wrap.getAttribute('aria-modal')).toBe('true');
    expect(wrap.getAttribute('aria-label')).toBeTruthy();
    expect(shadow.activeElement).toBe(shadow.querySelector('input'));
  });
  it('"Disable temporarily" calls onDisable', () => {
    const onDisable = vi.fn();
    mountBlockScreen(document, { onDisable, navigate: vi.fn() });
    const shadow = document.getElementById(YT_SHORTS_BLOCK_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="disable"]') as HTMLElement).click();
    expect(onDisable).toHaveBeenCalledTimes(1);
  });
});

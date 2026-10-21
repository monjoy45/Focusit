import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IG_REELS_BLOCK_ID, IG_REELS_STYLE_ID } from '../src/shared/constants';
import { insertReelsStyle, removeReelsStyle, mountBlockScreen, unmountBlockScreen } from '../src/sites/instagram/reels-filter';

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('Reels CSS style', () => {
  it('injects once and is idempotent on repeated calls', () => {
    insertReelsStyle(document); insertReelsStyle(document);
    expect(document.querySelectorAll(`#${IG_REELS_STYLE_ID}`)).toHaveLength(1);
  });
  it('targets the exact Reels nav href and article posts, never a bare div', () => {
    insertReelsStyle(document);
    const css = document.getElementById(IG_REELS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/a\[href="\/reels\/"\]/);
    expect(css).toMatch(/article:has\(a\[href\^="\/reel\/"\]\)/);
    expect(css).not.toMatch(/(^|\s)div(:has)?\s*[,{]/);
  });
  it('removeReelsStyle removes it and is a no-op if already absent', () => {
    insertReelsStyle(document);
    removeReelsStyle(document); removeReelsStyle(document);
    expect(document.getElementById(IG_REELS_STYLE_ID)).toBeNull();
  });
});

describe('Reels block screen', () => {
  it('mounts once with the expected copy and controls, idempotent on repeat', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    mountBlockScreen(document, { onDisable: () => {} });
    expect(document.querySelectorAll(`#${IG_REELS_BLOCK_ID}`)).toHaveLength(1);
    const shadow = document.getElementById(IG_REELS_BLOCK_ID)!.shadowRoot!;
    expect(shadow.textContent).toContain('Reels hidden');
    expect(shadow.textContent).not.toMatch(/shame|weak|addict/i);
  });

  it('unmounts and is a no-op if already absent', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    unmountBlockScreen(document); unmountBlockScreen(document);
    expect(document.getElementById(IG_REELS_BLOCK_ID)).toBeNull();
  });

  it.each([
    ['search', '/explore/'],
    ['messages', '/direct/inbox/'],
    ['profiles', '/'],
  ] as const)('"%s" navigates to %s', (action, url) => {
    const navigate = vi.fn();
    mountBlockScreen(document, { onDisable: () => {}, navigate });
    const shadow = document.getElementById(IG_REELS_BLOCK_ID)!.shadowRoot!;
    (shadow.querySelector(`[data-action="${action}"]`) as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(url);
  });

  it('is marked as a modal dialog and moves focus to its first control without trapping it', () => {
    mountBlockScreen(document, { onDisable: () => {} });
    const shadow = document.getElementById(IG_REELS_BLOCK_ID)!.shadowRoot!;
    const wrap = shadow.querySelector('[role="dialog"]')!;
    expect(wrap.getAttribute('aria-modal')).toBe('true');
    expect(shadow.activeElement).toBe(shadow.querySelector('[data-action="search"]'));
  });

  it('"Disable temporarily" calls onDisable', () => {
    const onDisable = vi.fn();
    mountBlockScreen(document, { onDisable, navigate: vi.fn() });
    const shadow = document.getElementById(IG_REELS_BLOCK_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="disable"]') as HTMLElement).click();
    expect(onDisable).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YT_RECS_BOUNDARY_ID, YT_RECS_STYLE_ID } from '../src/shared/constants';
import { applyRecsStyle, removeRecsStyle, mountRecsBoundary, unmountRecsBoundary } from '../src/sites/youtube/recommendations-filter';

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('recommendations style', () => {
  it('off removes any existing style', () => {
    applyRecsStyle(document, 'calm');
    applyRecsStyle(document, 'off');
    expect(document.getElementById(YT_RECS_STYLE_ID)).toBeNull();
  });
  it('injects once per level and switching levels updates the same element in place', () => {
    applyRecsStyle(document, 'calm');
    const calmCss = document.getElementById(YT_RECS_STYLE_ID)!.textContent;
    applyRecsStyle(document, 'focus');
    expect(document.querySelectorAll(`#${YT_RECS_STYLE_ID}`)).toHaveLength(1);
    const focusCss = document.getElementById(YT_RECS_STYLE_ID)!.textContent;
    expect(focusCss).not.toEqual(calmCss);
  });
  it('focus hides the whole grid; calm only hides items past the nth', () => {
    applyRecsStyle(document, 'focus');
    expect(document.getElementById(YT_RECS_STYLE_ID)!.textContent).toMatch(/ytd-rich-grid-renderer\s*{\s*display:\s*none/);
    applyRecsStyle(document, 'calm');
    const css = document.getElementById(YT_RECS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/nth-of-type\(n\+9\)/);
    expect(css).not.toMatch(/^ytd-rich-grid-renderer\s*{/m); // never hides the whole grid outright in calm mode
  });
  it('removeRecsStyle is a no-op if already absent', () => {
    removeRecsStyle(document); removeRecsStyle(document);
    expect(document.getElementById(YT_RECS_STYLE_ID)).toBeNull();
  });
});

describe('recommendations boundary card', () => {
  it('mounts once, placed right after the grid, idempotent on repeat', () => {
    document.body.innerHTML = '<ytd-rich-grid-renderer></ytd-rich-grid-renderer><div id="after"></div>';
    mountRecsBoundary(document, { onSearch: () => {}, onShowMore: () => {} });
    mountRecsBoundary(document, { onSearch: () => {}, onShowMore: () => {} });
    expect(document.querySelectorAll(`#${YT_RECS_BOUNDARY_ID}`)).toHaveLength(1);
    const grid = document.querySelector('ytd-rich-grid-renderer')!;
    expect(grid.nextElementSibling?.id).toBe(YT_RECS_BOUNDARY_ID);
    const shadow = document.getElementById(YT_RECS_BOUNDARY_ID)!.shadowRoot!;
    expect(shadow.textContent).toContain("You've reached the end of your intentional feed.");
  });
  it('falls back to appending to body when no grid is present', () => {
    mountRecsBoundary(document, { onSearch: () => {}, onShowMore: () => {} });
    expect(document.body.lastElementChild?.id).toBe(YT_RECS_BOUNDARY_ID);
  });
  it('unmounts and is a no-op if already absent', () => {
    mountRecsBoundary(document, { onSearch: () => {}, onShowMore: () => {} });
    unmountRecsBoundary(document); unmountRecsBoundary(document);
    expect(document.getElementById(YT_RECS_BOUNDARY_ID)).toBeNull();
  });
  it('"Search YouTube" calls onSearch, "Show more" calls onShowMore', () => {
    const onSearch = vi.fn(); const onShowMore = vi.fn();
    mountRecsBoundary(document, { onSearch, onShowMore });
    const shadow = document.getElementById(YT_RECS_BOUNDARY_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="search"]') as HTMLElement).click();
    (shadow.querySelector('[data-action="more"]') as HTMLElement).click();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });
  it('does not use a full-screen overlay (no fixed inset positioning), unlike the Shorts block screen', () => {
    mountRecsBoundary(document, { onSearch: () => {}, onShowMore: () => {} });
    const css = document.getElementById(YT_RECS_BOUNDARY_ID)!.shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/inset:\s*0/);
  });
});

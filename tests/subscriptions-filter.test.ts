import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YT_SUBS_BOUNDARY_ID, YT_SUBS_STYLE_ID } from '../src/shared/constants';
import { applySubsStyle, removeSubsStyle, mountSubsBoundary, unmountSubsBoundary } from '../src/sites/youtube/subscriptions-filter';

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('subscriptions-feed style', () => {
  it('enabled: true injects once and is idempotent; enabled: false removes it', () => {
    applySubsStyle(document, true); applySubsStyle(document, true);
    expect(document.querySelectorAll(`#${YT_SUBS_STYLE_ID}`)).toHaveLength(1);
    applySubsStyle(document, false);
    expect(document.getElementById(YT_SUBS_STYLE_ID)).toBeNull();
  });
  it('scopes every rule to the subscriptions page-subtype, never a bare tag', () => {
    applySubsStyle(document, true);
    const css = document.getElementById(YT_SUBS_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/page-subtype="subscriptions"/);
    expect(css).not.toMatch(/^ytd-video-renderer/m);
  });
  it('removeSubsStyle is a no-op if already absent', () => {
    removeSubsStyle(document); removeSubsStyle(document);
    expect(document.getElementById(YT_SUBS_STYLE_ID)).toBeNull();
  });
});

describe('subscriptions boundary card', () => {
  it('mounts once, right after the subscriptions feed, idempotent on repeat', () => {
    document.body.innerHTML = '<ytd-browse page-subtype="subscriptions"></ytd-browse><div id="after"></div>';
    mountSubsBoundary(document, { onShowMore: () => {} });
    mountSubsBoundary(document, { onShowMore: () => {} });
    expect(document.querySelectorAll(`#${YT_SUBS_BOUNDARY_ID}`)).toHaveLength(1);
    const browse = document.querySelector('ytd-browse')!;
    expect(browse.nextElementSibling?.id).toBe(YT_SUBS_BOUNDARY_ID);
  });
  it('falls back to appending to body when the subscriptions container is absent', () => {
    mountSubsBoundary(document, { onShowMore: () => {} });
    expect(document.body.lastElementChild?.id).toBe(YT_SUBS_BOUNDARY_ID);
  });
  it('unmounts and is a no-op if already absent', () => {
    mountSubsBoundary(document, { onShowMore: () => {} });
    unmountSubsBoundary(document); unmountSubsBoundary(document);
    expect(document.getElementById(YT_SUBS_BOUNDARY_ID)).toBeNull();
  });
  it('"Show more" calls onShowMore', () => {
    const onShowMore = vi.fn();
    mountSubsBoundary(document, { onShowMore });
    const shadow = document.getElementById(YT_SUBS_BOUNDARY_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="more"]') as HTMLElement).click();
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });
});

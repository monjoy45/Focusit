import { describe, it, expect, beforeEach } from 'vitest';
import { CALM_STYLE_ID } from '../src/shared/constants';
import { insertCalmStyle, removeCalmStyle } from '../src/core/calm-mode';

beforeEach(() => { document.head.innerHTML = ''; });

describe('calm-mode style', () => {
  it('injects once and is idempotent on repeated calls', () => {
    insertCalmStyle(document); insertCalmStyle(document);
    expect(document.querySelectorAll(`#${CALM_STYLE_ID}`)).toHaveLength(1);
  });

  it('removeCalmStyle removes it and is a no-op if already absent', () => {
    insertCalmStyle(document);
    removeCalmStyle(document); removeCalmStyle(document);
    expect(document.getElementById(CALM_STYLE_ID)).toBeNull();
  });

  it('never hides, resizes, or removes anything from keyboard/tab order (acceptance: no layout catastrophes, a11y and keyboard nav preserved)', () => {
    insertCalmStyle(document);
    const css = document.getElementById(CALM_STYLE_ID)!.textContent ?? '';
    expect(css).not.toMatch(/display\s*:\s*none/i);
    expect(css).not.toMatch(/visibility\s*:\s*hidden/i);
    expect(css).not.toMatch(/pointer-events\s*:\s*none/i);
    expect(css).not.toMatch(/tabindex/i);
    expect(css).not.toMatch(/outline\s*:\s*none/i);
    expect(css).not.toMatch(/width\s*:|height\s*:/i);
  });

  it('only dims (never hides) the notification badge it targets', () => {
    insertCalmStyle(document);
    const css = document.getElementById(CALM_STYLE_ID)!.textContent ?? '';
    expect(css).toMatch(/ytd-notification-topbar-button-renderer\s*{\s*opacity:\s*0\.55/);
  });
});

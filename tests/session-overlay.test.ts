import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SESSION_END_SCREEN_ID, SESSION_WARNING_TOAST_ID,
  mountSessionEndScreen, mountWarningToast, unmountSessionEndScreen, unmountWarningToast,
} from '../src/core/session-overlay';

beforeEach(() => { document.body.innerHTML = ''; });

describe('warning toast', () => {
  it('mounts once, idempotent on repeat, shows the minute count (singular vs plural)', () => {
    mountWarningToast(document, 1, () => {});
    expect(document.querySelectorAll(`#${SESSION_WARNING_TOAST_ID}`)).toHaveLength(1);
    expect(document.getElementById(SESSION_WARNING_TOAST_ID)!.shadowRoot!.textContent).toContain('1 minute left');
    unmountWarningToast(document);
    mountWarningToast(document, 5, () => {});
    expect(document.getElementById(SESSION_WARNING_TOAST_ID)!.shadowRoot!.textContent).toContain('5 minutes left');
  });
  it('is non-blocking: no fixed full-viewport inset, unlike the session-end screen', () => {
    mountWarningToast(document, 5, () => {});
    const css = document.getElementById(SESSION_WARNING_TOAST_ID)!.shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).not.toMatch(/inset:\s*0/);
  });
  it('"Dismiss" calls onDismiss', () => {
    const onDismiss = vi.fn();
    mountWarningToast(document, 5, onDismiss);
    const shadow = document.getElementById(SESSION_WARNING_TOAST_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="dismiss"]') as HTMLElement).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
  it('unmountWarningToast is a no-op if already absent', () => {
    unmountWarningToast(document); unmountWarningToast(document);
    expect(document.getElementById(SESSION_WARNING_TOAST_ID)).toBeNull();
  });
});

describe('session end screen', () => {
  const opts = { onLeave: () => {}, onContinue: () => {}, continueMinutes: 5 };

  it('mounts once, idempotent on repeat, with calm (non-shaming) copy', () => {
    mountSessionEndScreen(document, opts);
    mountSessionEndScreen(document, opts);
    expect(document.querySelectorAll(`#${SESSION_END_SCREEN_ID}`)).toHaveLength(1);
    const text = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!.textContent ?? '';
    expect(text).toContain('Your planned session is over.');
    expect(text).not.toMatch(/wasted|addict|weak/i);
  });
  it('shows the configured continue-minutes value on the button', () => {
    mountSessionEndScreen(document, { ...opts, continueMinutes: 10 });
    expect(document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!.textContent).toContain('Continue 10 min');
  });
  it('"Leave" calls onLeave, "Continue" calls onContinue', () => {
    const onLeave = vi.fn(); const onContinue = vi.fn();
    mountSessionEndScreen(document, { ...opts, onLeave, onContinue });
    const shadow = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!;
    (shadow.querySelector('[data-action="leave"]') as HTMLElement).click();
    (shadow.querySelector('[data-action="continue"]') as HTMLElement).click();
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
  it('is marked as a modal dialog and moves focus to its first control without trapping it', () => {
    mountSessionEndScreen(document, opts);
    const shadow = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!;
    const wrap = shadow.querySelector('[role="dialog"]')!;
    expect(wrap.getAttribute('aria-modal')).toBe('true');
    expect(shadow.activeElement).toBe(shadow.querySelector('[data-action="leave"]'));
  });
  it('is a full-screen overlay (fixed, inset 0), unlike the warning toast', () => {
    mountSessionEndScreen(document, opts);
    const css = document.getElementById(SESSION_END_SCREEN_ID)!.shadowRoot!.querySelector('style')!.textContent ?? '';
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/inset:\s*0/);
  });
  it('unmountSessionEndScreen is a no-op if already absent', () => {
    unmountSessionEndScreen(document); unmountSessionEndScreen(document);
    expect(document.getElementById(SESSION_END_SCREEN_ID)).toBeNull();
  });
});

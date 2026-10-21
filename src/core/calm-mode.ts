import { CALM_STYLE_ID } from '../shared/constants';

/**
 * Cross-site low-stimulation layer, applied independently of which (if any) site adapter is
 * active. Deliberately narrow for a first pass, per this phase's "start with a small number
 * of carefully chosen distractions; do not hide everything" guidance: nothing here hides,
 * resizes, or removes content, so it cannot cause a layout shift or take anything out of
 * keyboard/tab order.
 */
const CALM_CSS = `
/* Reduce animation/transition motion everywhere (the same reset pattern sites use for
   prefers-reduced-motion). Purely temporal -- no element is hidden or resized -- so this
   cannot break layout, keyboard navigation, or accessibility. */
*, *::before, *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
  scroll-behavior: auto !important;
}

/* Tone down, not hide, the YouTube notification bell so it's less visually dominant.
   Opacity only -- stays fully visible, clickable, and keyboard-focusable.
   NOT VERIFIED against a live YouTube DOM; inert on any other page or if this element
   doesn't exist. */
ytd-notification-topbar-button-renderer { opacity: 0.55; }
ytd-notification-topbar-button-renderer:hover,
ytd-notification-topbar-button-renderer:focus-within { opacity: 1; }
`.trim();

export function insertCalmStyle(doc: Document): void {
  if (doc.getElementById(CALM_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = CALM_STYLE_ID;
  style.textContent = CALM_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

export function removeCalmStyle(doc: Document): void {
  doc.getElementById(CALM_STYLE_ID)?.remove();
}

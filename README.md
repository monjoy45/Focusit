# Intentional Web

A Chrome (Manifest V3) extension that makes YouTube and Instagram calmer and easier to use on purpose: Shorts and Reels are hidden, feeds are collapsed, the watch page is stripped down to the video, and a session timer ends your browsing when you said it would. Everything runs locally; nothing leaves your machine.

## What it does
- **Hides Shorts** everywhere it can (shelves, search results, related lists, the sidebar entry, the mini-player) and replaces a direct `/shorts/…` link with a calm screen.
- **Hides Reels** on Instagram the same way.
- **Collapses the YouTube home feed** (Off / Calm / Focus) behind a reversible "Show more", and optionally the Subscriptions feed.
- **Focus on the video**: on watch pages the related-videos list and comments are hidden so the video is the page. Autoplay "up next" and end-screen suggestions are hidden too.
- **Calm UI**: reduced motion everywhere, a dimmed notification bell, no category-chip bar.
- **Session timer**: pick a length in the popup and watch a live countdown ring. A heads-up appears before the end; at the end a full-screen "Your planned session is over" card appears on open tabs.
- **Post-session lockout**: once a session has ended, any new navigation to YouTube/Instagram is sent to a blank page until you start a new session (or press "Continue 5 min"). Before you ever start a session, and while one is running, nothing is blocked.

## Supported websites
youtube.com (www and m) and instagram.com. Nothing else is touched.

## Installation
1. `npm install && npm run build`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
3. Reload any open YouTube/Instagram tabs (Chrome does not re-inject into tabs that were open before the extension loaded).

## Development
`npm run check` runs typecheck, all tests, the build, and a manifest/security validation of `dist/`.

## Build
`npm run build` bundles each entry point (background, content, popup, options) with esbuild into self-contained scripts in `dist/`, copying `public/` alongside.

## Debugging
Turn on **Debug logging** in Options. In DevTools on a YouTube/Instagram tab run `window.__intentionalWeb.getDebugState()` for one structured snapshot: detected site, active route, every feature flag, error counts, and session state.

## Architecture
- `src/sites/<site>/` — one adapter per website plus small single-purpose filter modules (CSS injection + optional calm overlay). Adding a feature means adding a module and one line in the adapter's `sync()`.
- `src/core/` — storage and migrations, session timer, route watching, the shared presence guard, tab lockout, logging.
- Filtering is **CSS-first**: injected `<style>` rules using `:has()` and named elements, so newly loaded content is handled by the browser with no DOM scanning. Nothing on the page is ever deleted, only `display:none`d.
- All visible extension UI on the page lives in Shadow DOM, so page styles can't leak in and ours can't leak out.
- State is shared through `chrome.storage.local` + change events; there is no message passing.
- The session timer stores `startedAt` + duration and recomputes remaining time on every read; `chrome.alarms` only makes open contexts notice promptly. A missed alarm self-corrects the next time anything reads the state.

## Adding a new site
Add an adapter extending `BaseAdapter` (host pattern + route resolver + `onSettingsChange`/`onRouteChange` hooks), register it in `src/sites/registry.ts`, add its origin to `content_scripts.matches` **and** `host_permissions`, and update the allow-list in `scripts/validate-dist.mjs`.

## Privacy
No network requests, no analytics, no remote code. Data stored (settings and session timestamps) stays in `chrome.storage.local`. Debug logs include only the hostname, never URLs, page text, or what you type in the block-screen search box.

## Phase 10 hardening audit
**Security.** Permissions are `storage` and `alarms`, plus `host_permissions` scoped to exactly the three supported origins — deliberately *not* the blanket `tabs` permission, which would expose every open tab's URL. `innerHTML` appears only for the extension's own static templates (the only interpolated values are numbers it computes itself). There is no `runtime.sendMessage`/`onMessage` surface. No remote scripts or fetches, and no `eval`/`new Function`; the build validator fails if any appear, if a permission outside the allow-list is added, or if `tabs` is requested.
**Performance.** Found and fixed: up to four separate `MutationObserver`s on `document.body` (one per guard) are now a single shared observer per document, `childList` only, disconnected when the last guard stops. Filtering does no scanning; the route poll runs only while the tab is visible and stops when the extension is paused; the popup's countdown interval exists only while the popup is open.
**Compatibility.** Manifest V3 service worker; `minimum_chrome_version` 110 (for `:has()`); no service-worker assumptions beyond alarms + persisted timestamps.
**Bugs found by the audit.** (1) "Continue 5 min" on the end screen never worked — it tried to extend a session that had already ended; it now starts a fresh one. (2) The default session length (25) matched no popup preset, so a fresh install showed "Custom: 25"; it is now 30. (3) Several duplicated magic numbers (overlay z-index, the Continue length shown on the button vs. used by the action, the feed-collapse count) are now single named constants.

## Known limitations
- **Selectors are unverified against live pages.** This was built without browser access to YouTube or Instagram. Every rule fails safe (does nothing if its element doesn't exist), but that also means a renamed element silently stops being hidden. If something slips through, the element's tag name from DevTools is exactly what's needed to fix it.
- **"Netflix-style" is partial.** Watch-page focus, hidden Shorts/chips, and collapsed feeds are in. A full poster-grid restyle of the home page is not: doing it safely needs YouTube's real grid CSS, and a guess risks breaking its responsive layout.
- **The lockout is a self-control nudge, not a lock.** It acts on new navigations, so a brief flash of the page before it blanks is possible; a tab already open when time runs out gets the full-screen card instead. It can be bypassed (incognito, another browser, disabling the extension), and is only as strong as your intent.
- **"Leave" goes to a blank page**, because extensions can't close a tab they didn't open.
- After reloading the extension during development, already-open tabs keep an orphaned script until the tab itself is reloaded (a Chrome behavior).
- Instagram Explore is not reduced, and the session timer's on-page interruptions only appear on YouTube/Instagram tabs.

## Manual checks worth doing on real pages
- Hide Shorts on: no Shorts in Home, Search, the watch sidebar, or the left nav; `/shorts/…` shows the calm card.
- Open a video: the video fills the page; the related list and comments are gone; play/pause/seek/volume/fullscreen all work. Turn **Focus on the video** off and they return.
- Start a short session: the ring depletes and the clock ticks in seconds; close and reopen the popup and it is still correct.
- Let it end: the end card appears; open a new tab to youtube.com — it should go blank; press **Continue 5 min** (or start a session from the popup) and it loads normally again.

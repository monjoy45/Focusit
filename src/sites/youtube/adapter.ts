import { createPresenceGuard, type PresenceGuard } from '../../core/presence-guard';
import { YT_RECS_BOUNDARY_ID, YT_SHORTS_BLOCK_ID, YT_SUBS_BOUNDARY_ID } from '../../shared/constants';
import type { RecommendationLevel, Settings } from '../../shared/types';
import { BaseAdapter } from '../base-adapter';
import type { SiteId } from '../types';
import { resolveYouTubeRoute } from './routes';
import { insertShortsStyle, mountBlockScreen, pausePlayingVideos, removeShortsStyle, unmountBlockScreen } from './shorts-filter';
import { applyRecsStyle, mountRecsBoundary, removeRecsStyle, unmountRecsBoundary } from './recommendations-filter';
import { insertAutoplayStyle, removeAutoplayStyle } from './autoplay-filter';
import { insertWatchFocusStyle, removeWatchFocusStyle } from './watch-focus-filter';
import { applySubsStyle, mountSubsBoundary, removeSubsStyle, unmountSubsBoundary } from './subscriptions-filter';

export interface YouTubeAdapterDeps {
  doc?: Document;
  /** Called when the person clicks "Disable temporarily" on the Shorts block screen. */
  onDisableShorts?: () => void;
}

export class YouTubeAdapter extends BaseAdapter {
  readonly id: SiteId = 'youtube';
  protected readonly hostPattern = /^(www\.|m\.)?youtube\.com$/;

  private readonly doc: Document;
  private readonly onDisableShorts: () => void;
  private guard: PresenceGuard | null = null;
  private recsGuard: PresenceGuard | null = null;
  private subsGuard: PresenceGuard | null = null;
  /** A one-click "Show more" reveals the feed for this visit only; a route change resets it. */
  private recsRevealed = false;
  private subsRevealed = false;

  constructor(deps: YouTubeAdapterDeps = {}) {
    super();
    this.doc = deps.doc ?? document;
    this.onDisableShorts = deps.onDisableShorts ?? (() => {});
  }

  protected resolveRoute(pathname: string): string {
    return resolveYouTubeRoute(pathname);
  }

  protected onSettingsChange(settings: Settings): void {
    this.sync(settings, this.route);
  }

  protected onRouteChange(route: string): void {
    this.recsRevealed = false;
    this.subsRevealed = false;
    this.sync(this.settings, route);
  }

  protected onDestroy(): void {
    this.guard?.stop();
    this.guard = null;
    removeShortsStyle(this.doc);
    unmountBlockScreen(this.doc);
    this.recsGuard?.stop();
    this.recsGuard = null;
    removeRecsStyle(this.doc);
    unmountRecsBoundary(this.doc);
    this.subsGuard?.stop();
    this.subsGuard = null;
    removeSubsStyle(this.doc);
    unmountSubsBoundary(this.doc);
    removeAutoplayStyle(this.doc);
    removeWatchFocusStyle(this.doc);
  }

  /** Single source of truth for "what should the page look like right now", driven by the latest settings and route. Safe to call repeatedly with the same inputs. */
  private sync(settings: Settings, route: string): void {
    if (settings.youtube.hideShorts) insertShortsStyle(this.doc);
    else removeShortsStyle(this.doc);

    const shouldBlock = settings.youtube.hideShorts && route === 'shorts';
    if (shouldBlock) {
      pausePlayingVideos(this.doc);
      this.mount();
      if (!this.guard) {
        this.guard = createPresenceGuard(this.doc, YT_SHORTS_BLOCK_ID, () => this.mount());
        this.guard.start();
      }
    } else {
      this.guard?.stop();
      this.guard = null;
      unmountBlockScreen(this.doc);
    }

    // Recommendation reduction only ever applies on the home route: watch pages, search
    // results, Subscriptions, etc. are never touched, regardless of the chosen level.
    const recLevel: RecommendationLevel = route === 'home' && !this.recsRevealed ? settings.youtube.recommendations : 'off';
    applyRecsStyle(this.doc, recLevel);
    if (recLevel !== 'off') {
      this.mountRecsBoundary();
      if (!this.recsGuard) {
        this.recsGuard = createPresenceGuard(this.doc, YT_RECS_BOUNDARY_ID, () => this.mountRecsBoundary());
        this.recsGuard.start();
      }
    } else {
      this.recsGuard?.stop();
      this.recsGuard = null;
      unmountRecsBoundary(this.doc);
    }

    // Autoplay-surface hiding only ever applies on the watch route -- playlists, search,
    // Subscriptions, and manually picking a video from a list are all untouched by it.
    if (route === 'watch' && settings.youtube.disableAutoplay) insertAutoplayStyle(this.doc);
    else removeAutoplayStyle(this.doc);

    // Netflix-style watch page: related rail + comments hidden, watch route only.
    if (route === 'watch' && settings.youtube.watchFocus) insertWatchFocusStyle(this.doc);
    else removeWatchFocusStyle(this.doc);

    // Optional, off by default: Subscriptions-feed collapse, only on the subscriptions route.
    const limitSubs = route === 'subscriptions' && settings.youtube.limitSubscriptionsFeed && !this.subsRevealed;
    applySubsStyle(this.doc, limitSubs);
    if (limitSubs) {
      this.mountSubsBoundary();
      if (!this.subsGuard) {
        this.subsGuard = createPresenceGuard(this.doc, YT_SUBS_BOUNDARY_ID, () => this.mountSubsBoundary());
        this.subsGuard.start();
      }
    } else {
      this.subsGuard?.stop();
      this.subsGuard = null;
      unmountSubsBoundary(this.doc);
    }
  }

  private mount(): void {
    mountBlockScreen(this.doc, { onDisable: () => this.onDisableShorts() });
  }

  private mountRecsBoundary(): void {
    mountRecsBoundary(this.doc, {
      onSearch: () => this.focusSearch(),
      onShowMore: () => this.revealRecommendations(),
    });
  }

  private mountSubsBoundary(): void {
    mountSubsBoundary(this.doc, { onShowMore: () => this.revealSubscriptions() });
  }

  /** "Show more": a page-local reveal, not a settings change -- the chosen level still shows correctly in Options, and returns next time the person lands on this route. */
  private revealRecommendations(): void {
    this.recsRevealed = true;
    removeRecsStyle(this.doc);
    unmountRecsBoundary(this.doc);
    this.recsGuard?.stop();
    this.recsGuard = null;
  }

  private revealSubscriptions(): void {
    this.subsRevealed = true;
    removeSubsStyle(this.doc);
    unmountSubsBoundary(this.doc);
    this.subsGuard?.stop();
    this.subsGuard = null;
  }

  private focusSearch(): void {
    try { this.doc.defaultView?.scrollTo({ top: 0, behavior: 'auto' }); } catch { /* ignore */ }
    try { (this.doc.querySelector('input#search') as HTMLElement | null)?.focus(); } catch { /* ignore */ }
  }
}

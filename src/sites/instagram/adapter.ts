import { createPresenceGuard, type PresenceGuard } from '../../core/presence-guard';
import { IG_REELS_BLOCK_ID } from '../../shared/constants';
import type { Settings } from '../../shared/types';
import { pausePlayingVideos } from '../media';
import { BaseAdapter } from '../base-adapter';
import type { SiteId } from '../types';
import { resolveInstagramRoute } from './routes';
import { insertReelsStyle, mountBlockScreen, removeReelsStyle, unmountBlockScreen } from './reels-filter';

export interface InstagramAdapterDeps {
  doc?: Document;
  /** Called when the person clicks "Disable temporarily" on the Reels block screen. */
  onDisableReels?: () => void;
}

export class InstagramAdapter extends BaseAdapter {
  readonly id: SiteId = 'instagram';
  protected readonly hostPattern = /^(www\.)?instagram\.com$/;

  private readonly doc: Document;
  private readonly onDisableReels: () => void;
  private guard: PresenceGuard | null = null;

  constructor(deps: InstagramAdapterDeps = {}) {
    super();
    this.doc = deps.doc ?? document;
    this.onDisableReels = deps.onDisableReels ?? (() => {});
  }

  protected resolveRoute(pathname: string): string {
    return resolveInstagramRoute(pathname);
  }

  protected onSettingsChange(settings: Settings): void {
    this.sync(settings, this.route);
  }

  protected onRouteChange(route: string): void {
    this.sync(this.settings, route);
  }

  protected onDestroy(): void {
    this.guard?.stop();
    this.guard = null;
    removeReelsStyle(this.doc);
    unmountBlockScreen(this.doc);
  }

  /** Single source of truth for "what should the page look like right now", driven by the latest settings and route. Safe to call repeatedly with the same inputs. */
  private sync(settings: Settings, route: string): void {
    if (settings.instagram.hideReels) insertReelsStyle(this.doc);
    else removeReelsStyle(this.doc);

    const shouldBlock = settings.instagram.hideReels && route === 'reels';
    if (shouldBlock) {
      pausePlayingVideos(this.doc);
      this.mount();
      if (!this.guard) {
        this.guard = createPresenceGuard(this.doc, IG_REELS_BLOCK_ID, () => this.mount());
        this.guard.start();
      }
    } else {
      this.guard?.stop();
      this.guard = null;
      unmountBlockScreen(this.doc);
    }
  }

  private mount(): void {
    mountBlockScreen(this.doc, { onDisable: () => this.onDisableReels() });
  }
}

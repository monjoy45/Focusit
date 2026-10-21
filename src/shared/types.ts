export type RecommendationLevel = 'off' | 'calm' | 'focus';

export interface YouTubeSettings {
  /** Hide the Shorts shelf/cards/recommendations and show a calm replacement on the Shorts route. */
  hideShorts: boolean;
  /** How much of the home-page recommendation grid to show before collapsing the rest behind "Show more". Only ever applied on the home route. */
  recommendations: RecommendationLevel;
  /** Hide the in-player "up next" countdown and end-screen suggestion overlays on the watch route. Never touches the video or playback controls. */
  disableAutoplay: boolean;
  /** "Netflix-style" watch page: hide the related-videos rail and comments so the video is the page. Watch route only. */
  watchFocus: boolean;
  /** Optional: collapse the Subscriptions feed behind a reversible "Show more" boundary, the same way home recommendations collapse. Off by default. */
  limitSubscriptionsFeed: boolean;
}

export interface InstagramSettings {
  /** Hide the Reels nav entry and Reels-linked posts, and show a calm replacement on the Reels route. */
  hideReels: boolean;
}

export interface Settings {
  schemaVersion: number;
  /** Master switch. When false the extension does nothing on any page. */
  enabled: boolean;
  /** Verbose console logging (info/debug). Warnings and errors always log. */
  debug: boolean;
  /** Cross-site low-stimulation layer (reduced motion, toned-down notification badges). Independent of the per-site filters below. */
  calmUI: boolean;
  youtube: YouTubeSettings;
  instagram: InstagramSettings;
}

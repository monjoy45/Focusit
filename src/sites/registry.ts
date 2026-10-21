import { InstagramAdapter, type InstagramAdapterDeps } from './instagram/adapter';
import type { SiteAdapter } from './types';
import { YouTubeAdapter, type YouTubeAdapterDeps } from './youtube/adapter';

export interface AdapterDeps {
  youtube?: YouTubeAdapterDeps;
  instagram?: InstagramAdapterDeps;
}

/** Fresh adapter instances (adapters hold per-page state). Register new sites here. */
export function createAdapters(deps: AdapterDeps = {}): SiteAdapter[] {
  return [new YouTubeAdapter(deps.youtube), new InstagramAdapter(deps.instagram)];
}

/** Pauses any playing <video> so a hidden route (Shorts, Reels) doesn't keep making noise behind the block screen. Best-effort, generic, and safe on any page. */
export function pausePlayingVideos(doc: Document): void {
  for (const v of doc.querySelectorAll('video')) {
    try { if (!v.paused) v.pause(); } catch { /* ignore: a single video failing to pause should not block the rest */ }
  }
}

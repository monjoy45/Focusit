import { describe, it, expect, vi } from 'vitest';
import { pausePlayingVideos } from '../src/sites/media';

describe('pausePlayingVideos', () => {
  it('pauses playing videos, skips already-paused ones, and isolates a video that throws', () => {
    document.body.innerHTML = '';
    const playing = document.createElement('video'); Object.defineProperty(playing, 'paused', { value: false });
    const pause = vi.fn(); playing.pause = pause;
    const paused = document.createElement('video'); Object.defineProperty(paused, 'paused', { value: true });
    const pausedPause = vi.fn(); paused.pause = pausedPause;
    const broken = document.createElement('video'); Object.defineProperty(broken, 'paused', { value: false });
    broken.pause = () => { throw new Error('boom'); };
    document.body.append(playing, paused, broken);
    expect(() => pausePlayingVideos(document)).not.toThrow();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(pausedPause).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from 'vitest';
import { isLockedOut, isWatchedUrl } from '../src/core/tab-lockout';
import { DEFAULT_SESSION } from '../src/core/session';

describe('isLockedOut', () => {
  it('is false when no session has ever run', () => {
    expect(isLockedOut(DEFAULT_SESSION)).toBe(false);
  });
  it('is false while a session is actively running', () => {
    expect(isLockedOut({ active: true, endedAt: null })).toBe(false);
  });
  it('is true once a session has ended and none has started since', () => {
    expect(isLockedOut({ active: false, endedAt: Date.now() })).toBe(true);
  });
  it('is false again once a new session is started (active again, even with a stale endedAt in a malformed object)', () => {
    expect(isLockedOut({ active: true, endedAt: 12345 })).toBe(false);
  });
});

describe('isWatchedUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://m.youtube.com/shorts/abc',
    'https://youtube.com/',
    'https://www.instagram.com/reels/',
    'https://instagram.com/',
  ])('matches %s', (url) => { expect(isWatchedUrl(url)).toBe(true); });

  it.each([
    'https://www.google.com/',
    'https://notyoutube.com/',
    'https://youtube.com.evil.com/',
    'https://www.netflix.com/',
  ])('does not match %s', (url) => { expect(isWatchedUrl(url)).toBe(false); });

  it('does not throw on a malformed URL', () => {
    expect(isWatchedUrl('not a url')).toBe(false);
  });
});

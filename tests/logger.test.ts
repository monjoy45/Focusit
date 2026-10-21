import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from '../src/core/logger';
import { safely } from '../src/core/safe';

afterEach(() => vi.restoreAllMocks());

describe('logger', () => {
  it('gates info/debug on debug flag but always logs warn/error', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let debug = false;
    const log = createLogger('t', () => debug);
    log.info('a'); log.warn('b');
    expect(info).not.toHaveBeenCalled(); expect(warn).toHaveBeenCalledTimes(1);
    debug = true; log.info('c');
    expect(info).toHaveBeenCalledTimes(1);
  });
  it('safely swallows and logs errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('t', () => false);
    expect(await safely('boom', log, () => { throw new Error('x'); })).toBeUndefined();
    expect(err).toHaveBeenCalled();
    expect(await safely('ok', log, () => 5)).toBe(5);
  });
});

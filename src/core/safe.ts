import type { Logger } from './logger';

/** Error isolation: run a unit of work; a failure is logged, never thrown. */
export async function safely<T>(name: string, log: Logger, fn: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    log.error(`${name} failed`, err);
    return undefined;
  }
}

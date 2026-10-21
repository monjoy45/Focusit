export interface Logger {
  debug(...a: unknown[]): void;
  info(...a: unknown[]): void;
  warn(...a: unknown[]): void;
  error(...a: unknown[]): void;
}

/** Errors and warnings always print; info/debug only when debug mode is on. */
export function createLogger(scope: string, isDebug: () => boolean): Logger {
  const tag = `[IntentionalWeb:${scope}]`;
  return {
    debug: (...a) => { if (isDebug()) console.debug(tag, ...a); },
    info: (...a) => { if (isDebug()) console.info(tag, ...a); },
    warn: (...a) => console.warn(tag, ...a),
    error: (...a) => console.error(tag, ...a),
  };
}

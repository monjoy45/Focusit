import { migrate, type Migration } from './migrate';

export interface SessionState {
  schemaVersion: number;
  active: boolean;
  /** epoch ms when the current session was started; null when no session has ever run. */
  startedAt: number | null;
  /** Total planned length, extended by extendSession(); the person's last-used value is kept as the default for next time even while inactive. */
  durationMinutes: number;
  warningMinutes: number;
  /** Set once the warning threshold has been reached for the current session, so it isn't re-shown after a reload. */
  warningShown: boolean;
  /** epoch ms when the session ended (naturally or via endSession()); null while active or before the first session. */
  endedAt: number | null;
}

export const SESSION_KEY = 'iw:session';
const SESSION_SCHEMA_VERSION = 1;
export const SESSION_ALARM_WARNING = 'iw-session-warning';
export const SESSION_ALARM_END = 'iw-session-end';

// durationMinutes matches the popup's pre-selected "30 min" preset, so a fresh install (no
// session has ever run) shows that clean preset rather than an arbitrary value that doesn't
// match any preset and would render as "Custom" the first time the popup opens.
export const DEFAULT_SESSION: Readonly<SessionState> = Object.freeze({
  schemaVersion: SESSION_SCHEMA_VERSION,
  active: false,
  startedAt: null,
  durationMinutes: 30,
  warningMinutes: 5,
  warningShown: false,
  endedAt: null,
});

/** No real migrations exist yet -- see the matching note in core/storage.ts. Step 0 is an identity mapping, ready for a future shape change. */
const SESSION_MIGRATIONS: Record<number, Migration> = {
  0: (d) => ({ ...d }),
};

export function normalizeSession(raw: unknown): SessionState {
  const r = migrate(raw, SESSION_SCHEMA_VERSION, SESSION_MIGRATIONS);
  // durationMinutes must be positive (a 0-minute session is meaningless); warningMinutes may
  // be exactly 0, which is a valid, meaningful value ("no warning") -- scheduleAlarms()
  // already treats 0 specially, so normalization must not silently discard it.
  const positive = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback);
  const nonNegative = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    active: typeof r.active === 'boolean' ? r.active : DEFAULT_SESSION.active,
    startedAt: typeof r.startedAt === 'number' ? r.startedAt : DEFAULT_SESSION.startedAt,
    durationMinutes: positive(r.durationMinutes, DEFAULT_SESSION.durationMinutes),
    warningMinutes: nonNegative(r.warningMinutes, DEFAULT_SESSION.warningMinutes),
    warningShown: typeof r.warningShown === 'boolean' ? r.warningShown : DEFAULT_SESSION.warningShown,
    endedAt: typeof r.endedAt === 'number' ? r.endedAt : DEFAULT_SESSION.endedAt,
  };
}

/**
 * The source of truth is always "elapsed time since startedAt", recomputed fresh on every
 * read -- never a decrementing in-memory counter. This is what makes the timer correct
 * regardless of service-worker suspension, browser sleep, popup close/reopen, or a system
 * clock change: whichever context asks, whenever it asks, gets the right answer from the
 * same two timestamps. chrome.alarms (below) is only an optimization so contexts that are
 * already open find out promptly; it is never the only thing keeping time.
 */
export function getRemainingMs(session: SessionState, now = Date.now()): number {
  if (!session.active || session.startedAt === null) return 0;
  return Math.max(0, session.startedAt + session.durationMinutes * 60_000 - now);
}

/** True once a session's planned time is up, even if nothing has processed that yet. */
export function isExpired(session: SessionState, now = Date.now()): boolean {
  return session.active && session.startedAt !== null && getRemainingMs(session, now) <= 0;
}

async function readRaw(): Promise<SessionState> {
  const res = await chrome.storage.local.get(SESSION_KEY);
  return normalizeSession(res[SESSION_KEY]);
}

async function writeRaw(session: SessionState): Promise<SessionState> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

/**
 * Lazy reconciliation: if a session says it's active but the planned time has already
 * passed -- most likely because this context has only just woken up and missed the alarm --
 * this corrects it to ended right here, rather than trusting stale "active" state. Writes the
 * correction back so other contexts converge quickly too.
 */
export async function getSession(): Promise<SessionState> {
  const session = await readRaw();
  if (!isExpired(session)) return session;
  const ended: SessionState = { ...session, active: false, endedAt: session.startedAt! + session.durationMinutes * 60_000 };
  await clearAlarms();
  return writeRaw(ended);
}

async function clearAlarms(): Promise<void> {
  await chrome.alarms.clear(SESSION_ALARM_WARNING);
  await chrome.alarms.clear(SESSION_ALARM_END);
}

function scheduleAlarms(session: SessionState): void {
  const start = session.startedAt!;
  chrome.alarms.create(SESSION_ALARM_END, { when: start + session.durationMinutes * 60_000 });
  if (session.warningMinutes > 0 && session.warningMinutes < session.durationMinutes) {
    chrome.alarms.create(SESSION_ALARM_WARNING, { when: start + (session.durationMinutes - session.warningMinutes) * 60_000 });
  }
}

export async function startSession(durationMinutes: number, warningMinutes: number = DEFAULT_SESSION.warningMinutes): Promise<SessionState> {
  await clearAlarms();
  const session = normalizeSession({ active: true, startedAt: Date.now(), durationMinutes, warningMinutes, warningShown: false, endedAt: null });
  scheduleAlarms(session);
  return writeRaw(session);
}

/**
 * "Continue N min". While a session is still running: keeps the original startedAt so total
 * elapsed stays meaningful, extends the planned duration, and re-arms the warning. Once it has
 * ended: starts a fresh N-minute session from now.
 */
export async function extendSession(extraMinutes: number): Promise<SessionState> {
  const current = await readRaw();
  if (!current.active || current.startedAt === null) {
    // The session is already over -- which is exactly when the end screen's "Continue" button
    // is shown. The original window can't be stretched backwards, so begin a fresh short one
    // from now (this also lifts the post-session tab lockout). Never-run sessions stay a no-op.
    if (current.endedAt === null) return current;
    return startSession(extraMinutes, current.warningMinutes);
  }
  const elapsedMinutes = (Date.now() - current.startedAt) / 60_000;
  const session: SessionState = { ...current, durationMinutes: current.durationMinutes + extraMinutes, warningShown: false, endedAt: null, active: true };
  await clearAlarms();
  // Re-arm the warning relative to the new remaining time, not the original schedule.
  if (session.warningMinutes > 0 && elapsedMinutes + session.warningMinutes < session.durationMinutes) {
    scheduleAlarms(session);
  } else {
    chrome.alarms.create(SESSION_ALARM_END, { when: current.startedAt + session.durationMinutes * 60_000 });
  }
  return writeRaw(session);
}

/**
 * Lets Options configure the warning lead time used by the *next* session started from the
 * popup. If a session is currently running, this intentionally does not reschedule its
 * already-created alarm -- the change takes effect starting with the next session, not
 * retroactively on one already in flight.
 */
export async function setDefaultWarningMinutes(minutes: number): Promise<SessionState> {
  const current = await readRaw();
  return writeRaw(normalizeSession({ ...current, warningMinutes: minutes }));
}

export async function endSession(): Promise<SessionState> {
  await clearAlarms();
  const current = await readRaw();
  const session: SessionState = { ...current, active: false, endedAt: Date.now() };
  return writeRaw(session);
}

/** Marks the warning as shown for the current session (called when the ALARM_WARNING alarm fires). Safe to call even if the session already ended or was extended past the warning point. */
export async function markWarningShown(): Promise<SessionState> {
  const current = await readRaw();
  if (!current.active) return current;
  return writeRaw({ ...current, warningShown: true });
}

/** Called when the ALARM_END alarm fires. Idempotent: a no-op if the session already ended by other means. */
export async function markSessionEnded(): Promise<SessionState> {
  const current = await readRaw();
  if (!current.active) return current;
  return writeRaw({ ...current, active: false, endedAt: Date.now() });
}

export function onSessionChanged(cb: (s: SessionState) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(SESSION_KEY in changes)) return;
    cb(normalizeSession(changes[SESSION_KEY]?.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Run on background startup/install to correct any session that expired while nothing was listening. */
export async function reconcileSession(): Promise<void> {
  await getSession();
}

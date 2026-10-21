import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFakeChrome } from './helpers/fake-chrome';
import {
  DEFAULT_SESSION, SESSION_ALARM_END, SESSION_ALARM_WARNING, SESSION_KEY,
  endSession, extendSession, getRemainingMs, getSession, isExpired, markSessionEnded,
  markWarningShown, normalizeSession, onSessionChanged, setDefaultWarningMinutes, startSession,
} from '../src/core/session';
import { isLockedOut } from '../src/core/tab-lockout';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); });

describe('normalizeSession', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeSession(null)).toEqual(DEFAULT_SESSION);
    expect(normalizeSession({ durationMinutes: -5, warningMinutes: 'x' })).toMatchObject({ durationMinutes: 30, warningMinutes: 5 });
  });
  it('treats warningMinutes: 0 as a valid "no warning" value rather than falling back to the default', () => {
    expect(normalizeSession({ warningMinutes: 0 })).toMatchObject({ warningMinutes: 0 });
  });
  it('still rejects a negative or non-finite warningMinutes', () => {
    expect(normalizeSession({ warningMinutes: -1 })).toMatchObject({ warningMinutes: 5 });
    expect(normalizeSession({ warningMinutes: Number.NaN })).toMatchObject({ warningMinutes: 5 });
  });
  it('migrates pre-versioned data (no schemaVersion field) through the v0 step and normalizes it', () => {
    expect(normalizeSession({ durationMinutes: 15 })).toMatchObject({ schemaVersion: 1, durationMinutes: 15, active: false });
  });
});

describe('setDefaultWarningMinutes', () => {
  it('persists the new default without disturbing other fields when inactive', async () => {
    installFakeChrome();
    const result = await setDefaultWarningMinutes(10);
    expect(result).toMatchObject({ warningMinutes: 10, active: false });
  });
  it('does not reschedule an already-running session\'s alarm', async () => {
    const { fake } = installFakeChrome();
    await startSession(20, 5);
    fake.alarms.create.mockClear();
    const result = await setDefaultWarningMinutes(2);
    expect(result).toMatchObject({ warningMinutes: 2, active: true });
    expect(fake.alarms.create).not.toHaveBeenCalled();
  });
});

describe('getRemainingMs / isExpired', () => {
  it('is 0 and not expired when inactive', () => {
    expect(getRemainingMs(DEFAULT_SESSION)).toBe(0);
    expect(isExpired(DEFAULT_SESSION)).toBe(false);
  });
  it('counts down purely from timestamps, with no accumulating drift', () => {
    const session = { ...DEFAULT_SESSION, active: true, startedAt: Date.now(), durationMinutes: 10 };
    expect(getRemainingMs(session)).toBe(10 * 60_000);
    vi.advanceTimersByTime(4 * 60_000);
    expect(getRemainingMs(session)).toBe(6 * 60_000);
    expect(isExpired(session)).toBe(false);
  });
  it('is expired once the planned duration has passed, regardless of how time passed (e.g. a sleep gap)', () => {
    const session = { ...DEFAULT_SESSION, active: true, startedAt: Date.now(), durationMinutes: 10 };
    vi.advanceTimersByTime(11 * 60_000); // simulates any gap, including a sleeping machine
    expect(isExpired(session)).toBe(true);
    expect(getRemainingMs(session)).toBe(0);
  });
});

describe('startSession', () => {
  it('persists active state and schedules both alarms from the start timestamp', async () => {
    const { fake, store } = installFakeChrome();
    const session = await startSession(10, 2);
    expect(session).toMatchObject({ active: true, durationMinutes: 10, warningMinutes: 2, warningShown: false, endedAt: null });
    expect(store[SESSION_KEY]).toEqual(session);
    expect(fake.alarms.create).toHaveBeenCalledWith(SESSION_ALARM_END, { when: session.startedAt! + 10 * 60_000 });
    expect(fake.alarms.create).toHaveBeenCalledWith(SESSION_ALARM_WARNING, { when: session.startedAt! + 8 * 60_000 });
  });
  it('does not schedule a warning alarm when warningMinutes is 0 or not less than the duration', async () => {
    const { fake } = installFakeChrome();
    await startSession(10, 0);
    expect(fake.alarms.create).toHaveBeenCalledTimes(1); // END only
    fake.alarms.create.mockClear();
    await startSession(10, 10);
    expect(fake.alarms.create).toHaveBeenCalledTimes(1);
  });
  it('clears any previous alarms before scheduling new ones (idempotent restart)', async () => {
    const { fake } = installFakeChrome();
    await startSession(10);
    await startSession(20);
    expect(fake.alarms.clear).toHaveBeenCalledWith(SESSION_ALARM_WARNING);
    expect(fake.alarms.clear).toHaveBeenCalledWith(SESSION_ALARM_END);
  });
});

describe('endSession', () => {
  it('clears alarms and marks the session inactive with an end timestamp', async () => {
    const { fake } = installFakeChrome();
    await startSession(10);
    const ended = await endSession();
    expect(ended).toMatchObject({ active: false, endedAt: Date.now() });
    expect(fake.alarms.clear).toHaveBeenCalledWith(SESSION_ALARM_END);
  });
});

describe('extendSession ("Continue N min")', () => {
  it('keeps the original startedAt, extends the duration, and re-arms the warning', async () => {
    const { fake } = installFakeChrome();
    const started = await startSession(10, 2);
    vi.advanceTimersByTime(9 * 60_000); // past the original warning, near the original end
    const extended = await extendSession(5);
    expect(extended.startedAt).toBe(started.startedAt);
    expect(extended.durationMinutes).toBe(15);
    expect(extended.warningShown).toBe(false);
    expect(extended.active).toBe(true);
    const endCalls = fake.alarms.create.mock.calls.filter((c) => c[0] === SESSION_ALARM_END);
    const lastEndCall = endCalls[endCalls.length - 1]!;
    expect(lastEndCall[1].when).toBe(started.startedAt! + 15 * 60_000);
  });
  it('after the session has ended (the end screen\'s Continue button), starts a fresh session from now', async () => {
    const { fake } = installFakeChrome();
    await startSession(10);
    vi.advanceTimersByTime(11 * 60_000);
    const ended = await getSession();
    expect(ended.active).toBe(false);
    const resumed = await extendSession(5);
    expect(resumed).toMatchObject({ active: true, durationMinutes: 5, endedAt: null, startedAt: Date.now() });
    const endCalls = fake.alarms.create.mock.calls.filter((c) => c[0] === SESSION_ALARM_END);
    expect(endCalls[endCalls.length - 1]![1].when).toBe(Date.now() + 5 * 60_000);
  });
  it('lifts the post-session lockout when Continue is used', async () => {
    installFakeChrome();
    await startSession(10);
    await endSession();
    expect(isLockedOut(await getSession())).toBe(true);
    await extendSession(5);
    expect(isLockedOut(await getSession())).toBe(false);
  });
  it('is a no-op when no session has ever run', async () => {
    installFakeChrome();
    const result = await extendSession(5);
    expect(result).toMatchObject({ active: false, endedAt: null });
  });
  it('is a no-op when there is no active session', async () => {
    installFakeChrome();
    const result = await extendSession(5);
    expect(result.active).toBe(false);
  });
});

describe('markWarningShown / markSessionEnded (alarm handlers)', () => {
  it('markWarningShown sets the flag only while active', async () => {
    installFakeChrome();
    await startSession(10, 2);
    const result = await markWarningShown();
    expect(result.warningShown).toBe(true);
  });
  it('markWarningShown is a no-op once the session already ended', async () => {
    installFakeChrome();
    await startSession(10);
    await endSession();
    const result = await markWarningShown();
    expect(result.warningShown).toBe(false);
  });
  it('markSessionEnded is idempotent -- ending an already-ended session changes nothing further', async () => {
    installFakeChrome();
    await startSession(10);
    const first = await markSessionEnded();
    const second = await markSessionEnded();
    expect(first.active).toBe(false);
    expect(second).toEqual(first);
  });
});

describe('getSession lazy reconciliation', () => {
  it('self-corrects and persists when a session is stale (e.g. the alarm never got to fire)', async () => {
    const { fake, store } = installFakeChrome();
    const started = await startSession(10);
    vi.advanceTimersByTime(11 * 60_000);
    const session = await getSession();
    expect(session.active).toBe(false);
    expect(session.endedAt).toBe(started.startedAt! + 10 * 60_000);
    expect(store[SESSION_KEY]).toEqual(session);
    expect(fake.alarms.clear).toHaveBeenCalledWith(SESSION_ALARM_END);
  });
  it('does not touch a session that is active and still within its planned time', async () => {
    installFakeChrome();
    await startSession(10);
    vi.advanceTimersByTime(2 * 60_000);
    const session = await getSession();
    expect(session.active).toBe(true);
  });
});

describe('onSessionChanged', () => {
  it('notifies subscribers and stops after unsubscribe', async () => {
    installFakeChrome();
    const seen: boolean[] = [];
    const off = onSessionChanged((s) => seen.push(s.active));
    await startSession(10);
    off();
    await endSession();
    expect(seen).toEqual([true]);
  });
});

import { vi } from 'vitest';

type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
type AlarmListener = (alarm: { name: string }) => void;
type TabUpdatedListener = (tabId: number, changeInfo: { url?: string }, tab?: unknown) => void;

/** In-memory stand-in for the chrome APIs used across the extension. Behaviour mirrors chrome.storage.local and chrome.alarms closely enough for unit tests. */
export function installFakeChrome(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  const listeners = new Set<Listener>();
  const installedListeners: Array<() => void> = [];
  const startupListeners: Array<() => void> = [];
  const alarmListeners = new Set<AlarmListener>();
  const alarms = new Map<string, { name: string; when: number }>();
  const tabUpdatedListeners = new Set<TabUpdatedListener>();
  const tabUrls = new Map<number, string>();

  const fake = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          for (const [k, v] of Object.entries(items)) { changes[k] = { oldValue: store[k], newValue: v }; store[k] = v; }
          listeners.forEach((l) => l(changes, 'local'));
        }),
      },
      onChanged: { addListener: (l: Listener) => listeners.add(l), removeListener: (l: Listener) => listeners.delete(l) },
    },
    runtime: {
      openOptionsPage: vi.fn(),
      onInstalled: { addListener: (l: () => void) => installedListeners.push(l) },
      onStartup: { addListener: (l: () => void) => startupListeners.push(l) },
    },
    alarms: {
      create: vi.fn((name: string, opts: { when: number }) => { alarms.set(name, { name, when: opts.when }); }),
      clear: vi.fn(async (name: string) => { const had = alarms.has(name); alarms.delete(name); return had; }),
      get: vi.fn(async (name: string) => alarms.get(name) ?? undefined),
      onAlarm: { addListener: (l: AlarmListener) => alarmListeners.add(l), removeListener: (l: AlarmListener) => alarmListeners.delete(l) },
    },
    tabs: {
      update: vi.fn(async (tabId: number, props: { url?: string }) => {
        if (props.url) tabUrls.set(tabId, props.url);
        return { id: tabId, url: tabUrls.get(tabId) };
      }),
      onUpdated: { addListener: (l: TabUpdatedListener) => tabUpdatedListeners.add(l), removeListener: (l: TabUpdatedListener) => tabUpdatedListeners.delete(l) },
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = fake;
  return {
    store, fake, listeners, alarms, tabUrls,
    fireInstalled: () => installedListeners.forEach((l) => l()),
    fireStartup: () => startupListeners.forEach((l) => l()),
    fireAlarm: (name: string) => alarmListeners.forEach((l) => l({ name })),
    fireTabUpdated: (tabId: number, url: string) => { tabUrls.set(tabId, url); tabUpdatedListeners.forEach((l) => l(tabId, { url })); },
  };
}

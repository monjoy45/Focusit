import { getSettings, onSettingsChanged, updateSettings } from '../core/storage';
import { bindSwitch } from '../shared/ui';
import { endSession, getRemainingMs, getSession, onSessionChanged, startSession, type SessionState } from '../core/session';

const PRESET_MINUTES = ['10', '20', '30', '45'];
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** Below this fraction of time remaining, the ring shifts to a gentle amber -- a quiet cue, not an alarm. */
const RING_LOW_THRESHOLD = 0.2;

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export async function initPopup(doc: Document = document): Promise<void> {
  const q = <T extends HTMLElement>(id: string) => doc.getElementById(id) as T;
  const status = q<HTMLElement>('iw-status');
  const render = bindSwitch(q<HTMLInputElement>('iw-enabled'), async (v) => { await updateSettings({ enabled: v }); });
  const paint = (enabled: boolean) => {
    render(enabled);
    status.textContent = enabled ? 'On for supported sites' : 'Paused';
  };
  q<HTMLButtonElement>('iw-open-options').addEventListener('click', () => void chrome.runtime.openOptionsPage());
  try {
    paint((await getSettings()).enabled);
    onSettingsChanged((s) => paint(s.enabled));
  } catch {
    status.textContent = 'Could not read settings. Reload the extension.';
  }

  // --- Session timer ---
  const sessionStatus = q<HTMLElement>('iw-session-status');
  const startRow = q<HTMLElement>('iw-session-start-row');
  const activeView = q<HTMLElement>('iw-session-active');
  const segButtons = Array.from(doc.querySelectorAll<HTMLButtonElement>('.seg'));
  const customInput = q<HTMLInputElement>('iw-session-custom');
  const startButton = q<HTMLButtonElement>('iw-session-start');
  const endButton = q<HTMLButtonElement>('iw-session-end');
  const timeEl = q<HTMLElement>('iw-session-time');
  const ring = doc.getElementById('iw-ring-progress') as unknown as SVGCircleElement;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;

  // The configured warning lead time (set in Options) is carried on the session object even
  // while inactive; remembered here so Start uses it instead of a hardcoded value.
  let warningMinutes = 5;
  let selectedPreset = '30';

  let tickHandle: ReturnType<typeof setInterval> | undefined;
  const stopTicking = () => { if (tickHandle !== undefined) { clearInterval(tickHandle); tickHandle = undefined; } };

  const selectSegment = (value: string) => {
    selectedPreset = value;
    for (const btn of segButtons) btn.setAttribute('aria-pressed', String(btn.dataset.minutes === value));
    customInput.hidden = value !== 'custom';
    if (value === 'custom') customInput.focus();
  };

  /** Reflects the person's last-used duration so reopening the popup doesn't reset their choice. */
  const paintDurationChoice = (minutes: number) => {
    const asString = String(minutes);
    if (PRESET_MINUTES.includes(asString)) {
      selectSegment(asString);
      customInput.value = '';
    } else {
      selectSegment('custom');
      customInput.value = asString;
    }
  };

  const paintRing = (remainingMs: number, totalMs: number) => {
    timeEl.textContent = formatClock(remainingMs);
    const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
    ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
    ring.classList.toggle('low', fraction < RING_LOW_THRESHOLD);
  };

  const paintSession = (session: SessionState) => {
    stopTicking();
    warningMinutes = session.warningMinutes;
    if (session.active) {
      startRow.hidden = true;
      activeView.hidden = false;
      const totalMs = session.durationMinutes * 60_000;
      const refresh = () => paintRing(getRemainingMs(session), totalMs);
      refresh();
      // A popup is short-lived UI, not the background service worker -- a plain interval here
      // is only ever cosmetic and is always recomputed from the same timestamps, so it can
      // never drift or need to "survive" anything.
      tickHandle = setInterval(refresh, 1000);
    } else {
      startRow.hidden = false;
      activeView.hidden = true;
      sessionStatus.textContent = 'Not running';
      paintDurationChoice(session.durationMinutes);
    }
  };

  for (const btn of segButtons) {
    btn.addEventListener('click', () => selectSegment(btn.dataset.minutes ?? '30'));
  }

  startButton.addEventListener('click', () => {
    const minutes = selectedPreset === 'custom' ? Number.parseInt(customInput.value, 10) : Number(selectedPreset);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      sessionStatus.textContent = 'Enter a number of minutes above 0.';
      return;
    }
    void startSession(minutes, warningMinutes);
  });
  endButton.addEventListener('click', () => void endSession());

  try {
    paintSession(await getSession());
    onSessionChanged(paintSession);
  } catch {
    sessionStatus.textContent = 'Could not read session state.';
  }
}

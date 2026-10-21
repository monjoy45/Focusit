import { getSettings, onSettingsChanged, resetSettings, updateSettings } from '../core/storage';
import type { RecommendationLevel, Settings } from '../shared/types';
import { bindSelect, bindSwitch } from '../shared/ui';
import { getSession, onSessionChanged, setDefaultWarningMinutes, type SessionState } from '../core/session';

export async function initOptions(doc: Document = document): Promise<void> {
  const q = <T extends HTMLElement>(id: string) => doc.getElementById(id) as T;
  const note = q<HTMLElement>('iw-note');
  const renderEnabled = bindSwitch(q<HTMLInputElement>('iw-enabled'), async (v) => { await updateSettings({ enabled: v }); });
  const renderDebug = bindSwitch(q<HTMLInputElement>('iw-debug'), async (v) => { await updateSettings({ debug: v }); });
  const renderCalmUI = bindSwitch(q<HTMLInputElement>('iw-calm-ui'), async (v) => { await updateSettings({ calmUI: v }); });
  const renderHideShorts = bindSwitch(q<HTMLInputElement>('iw-yt-hide-shorts'), async (v) => { await updateSettings({ youtube: { hideShorts: v } }); });
  const renderRecs = bindSelect<RecommendationLevel>(q<HTMLSelectElement>('iw-yt-recs'), async (v) => { await updateSettings({ youtube: { recommendations: v } }); });
  const renderAutoplay = bindSwitch(q<HTMLInputElement>('iw-yt-autoplay'), async (v) => { await updateSettings({ youtube: { disableAutoplay: v } }); });
  const renderWatchFocus = bindSwitch(q<HTMLInputElement>('iw-yt-watch-focus'), async (v) => { await updateSettings({ youtube: { watchFocus: v } }); });
  const renderSubs = bindSwitch(q<HTMLInputElement>('iw-yt-subs'), async (v) => { await updateSettings({ youtube: { limitSubscriptionsFeed: v } }); });
  const renderHideReels = bindSwitch(q<HTMLInputElement>('iw-ig-hide-reels'), async (v) => { await updateSettings({ instagram: { hideReels: v } }); });
  const paint = (s: Settings) => {
    renderEnabled(s.enabled); renderDebug(s.debug); renderCalmUI(s.calmUI);
    renderHideShorts(s.youtube.hideShorts); renderRecs(s.youtube.recommendations);
    renderAutoplay(s.youtube.disableAutoplay); renderWatchFocus(s.youtube.watchFocus); renderSubs(s.youtube.limitSubscriptionsFeed);
    renderHideReels(s.instagram.hideReels);
  };
  q<HTMLButtonElement>('iw-reset').addEventListener('click', () => {
    resetSettings().then(() => { note.textContent = 'Settings reset to defaults.'; })
      .catch(() => { note.textContent = 'Reset failed. Reload the extension and try again.'; });
  });
  try {
    paint(await getSettings());
    onSettingsChanged(paint);
  } catch {
    note.textContent = 'Could not read settings. Reload the extension.';
  }

  // --- Session: default warning lead time (independent of the Settings store above) ---
  const warningInput = q<HTMLInputElement>('iw-session-warning');
  const paintWarning = (s: SessionState) => { warningInput.value = String(s.warningMinutes); };
  warningInput.addEventListener('change', () => {
    const minutes = Number.parseInt(warningInput.value, 10);
    if (!Number.isFinite(minutes) || minutes < 0) { warningInput.value = ''; return; }
    void setDefaultWarningMinutes(minutes);
  });
  try {
    paintWarning(await getSession());
    onSessionChanged(paintWarning);
  } catch {
    warningInput.disabled = true;
  }
}

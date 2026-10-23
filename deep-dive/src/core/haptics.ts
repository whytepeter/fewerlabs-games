import { settings } from './settings';

/** Short vibration on devices that support it (Android Chrome); a no-op elsewhere, including iOS Safari. */
export function buzz(pattern: number | number[]) {
  if (!settings.haptics || typeof navigator.vibrate !== 'function') return;
  // Browsers reject (and log) vibration before the first tap on the page.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

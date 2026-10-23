// Per-device persistence. Storage can be unavailable (private mode, blocked site data),
// so every access is guarded and the game still runs without it.

// Each game lives at its own path (/deep-dive/, /ripple/, /skip/), so the first path
// segment namespaces its saved data; the hub at / uses 'hub'.
const firstSegment = location.pathname.split('/').filter(Boolean)[0] ?? '';
export const NAMESPACE = firstSegment && !firstSegment.includes('.') ? firstSegment : 'hub';
const PREFIX = `${NAMESPACE}:`;

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

export interface Settings { sound: boolean; music: boolean; haptics: boolean }
type Listener = (s: Settings) => void;

export const settings: Settings = {
  sound: store.get('sound', true),
  music: store.get('music', true),
  haptics: store.get('haptics', true),
};
const listeners: Listener[] = [];

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings[key] = value;
  store.set(key, value);
  listeners.forEach(fn => fn(settings));
}
export function onSettings(fn: Listener) {
  listeners.push(fn);
  fn(settings);
}

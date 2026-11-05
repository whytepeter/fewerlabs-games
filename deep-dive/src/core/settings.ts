// Per-device persistence. Storage can be unavailable (private mode, blocked site data),
// so every access is guarded and the game still runs without it.

// Saved data is namespaced so it never clashes with anything else on the same origin.
export const NAMESPACE = 'deep-dive';
export const PREFIX = `${NAMESPACE}:`;

type WriteListener = (key: string) => void;
const writeListeners: WriteListener[] = [];
/** Called after every successful store.set (cloud sync uses this to know what changed). */
export function onStoreWrite(fn: WriteListener) { writeListeners.push(fn); }

/** localStorage, or null when this browser won't give the page any (some third-party frames). */
const disk = (() => {
  try {
    const s = window.localStorage, probe = `${PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch { return null; }
})();
/** Without localStorage, saves live in memory for this visit (and Lagos Life's server keeps them). */
const memory = new Map<string, string>();

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = disk ? disk.getItem(PREFIX + key) : memory.get(PREFIX + key) ?? null;
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (disk) disk.setItem(PREFIX + key, JSON.stringify(value));
      else memory.set(PREFIX + key, JSON.stringify(value));
    } catch {
      return; // storage full or unavailable
    }
    writeListeners.forEach(fn => fn(key));
  },
  /** Every key this game saved (without the prefix). */
  keys(): string[] {
    try {
      const all = disk ? Array.from({ length: disk.length }, (_, i) => disk.key(i)) : [...memory.keys()];
      return all.filter((k): k is string => !!k?.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
    } catch { return []; }
  },
  /** Write a value without telling the listeners (a restore must not trigger another save). */
  quiet(key: string, value: unknown) {
    try {
      if (disk) disk.setItem(PREFIX + key, JSON.stringify(value));
      else memory.set(PREFIX + key, JSON.stringify(value));
    } catch { /* storage full or unavailable */ }
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

/**
 * Optional Firebase backend: anonymous sign-in, a cloud backup of saved progress and the global
 * leaderboard. Players start as guests (as in Subway Surfers or Crossy Road) and can link the guest
 * account to Google or email later to keep their progress on any device. Without the VITE_FIREBASE_* env vars it stays off and the game is purely local.
 * Firebase is imported lazily, so it never delays the first frame, and every failure is
 * swallowed: the game keeps working offline from localStorage.
 *
 * Firestore layout (rules in ../firebase/firestore.rules):
 *   players/{uid}/saves/{game}          { data: { key: value }, updatedAt }   cloud backup
 *   leaderboards/{game}/scores/{uid}    { name, best, updatedAt }             one row per player
 */
import type { Auth, AuthCredential, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { NAMESPACE, PREFIX, onStoreWrite, store } from './settings';

const env = import.meta.env;
const config = env.VITE_FIREBASE_PROJECT_ID ? {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
} : null;
/** Point at the local Firebase emulators instead (npm run emulators in ../firebase). */
const useEmulators = env.VITE_FIREBASE_EMULATORS === 'true';

const SAVED_AT = 'cloud:savedAt';
/** Keys that stay on this device: settings and the sync's own bookkeeping. */
const LOCAL_ONLY = new Set(['sound', 'music', 'haptics', SAVED_AT]);
const PUSH_DELAY = 2000;
const NAME_MAX = 16;

export interface Score { name: string; best: number; me: boolean }

/** Who is playing: a guest (anonymous) or a linked account. */
export interface Account { guest: boolean; email: string | null; provider: 'google' | 'password' | null }
/**
 * 'linked': the guest account now has a sign-in and keeps its progress.
 * 'exists': that sign-in already has its own account; call useExisting() to switch to it.
 * 'redirect': the page is leaving for Google's sign-in (popups blocked) and comes back signed in.
 */
export type LinkResult = 'linked' | 'exists' | 'redirect' | { error: string };

type Fb = {
  auth: Auth; db: Firestore; uid: string;
  fs: typeof import('firebase/firestore/lite');
  authMod: typeof import('firebase/auth');
};

let fb: Fb | null = null;
let starting: Promise<Fb | null> | null = null;
let merged = false;
let dirty = false;
let pushTimer = 0;
let submitted = 0;
const restoreListeners: (() => void)[] = [];
const accountListeners: ((a: Account) => void)[] = [];
/** A sign-in that belongs to another account, kept until the player decides to switch to it. */
let pending: AuthCredential | { email: string; password: string } | null = null;

function describe(user: User | null): Account {
  if (!user || user.isAnonymous) return { guest: true, email: null, provider: null };
  const google = user.providerData.some(p => p.providerId === 'google.com');
  return { guest: false, email: user.email, provider: google ? 'google' : 'password' };
}
const accountChanged = () => { const a = describe(fb?.auth.currentUser ?? null); accountListeners.forEach(fn => fn(a)); };

/** Firebase error codes in plain words. */
function explain(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const words: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn\u2019t look right.',
    'auth/weak-password': 'Use a password of at least 6 characters.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email yet. Create one instead.',
    'auth/popup-closed-by-user': 'Sign-in was closed before it finished.',
    'auth/cancelled-popup-request': 'Sign-in was closed before it finished.',
    'auth/network-request-failed': 'You\u2019re offline. Try again when you\u2019re connected.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/operation-not-allowed': 'This sign-in method isn\u2019t turned on yet.',
  };
  return words[code] ?? 'Something went wrong. Please try again.';
}

const ADJ = ['Brave', 'Swift', 'Lucky', 'Sunny', 'Bubbly', 'Quiet', 'Bold', 'Sly', 'Jolly', 'Deep', 'Salty', 'Zippy'];
const SEA = ['Otter', 'Squid', 'Puffer', 'Manta', 'Seal', 'Turtle', 'Urchin', 'Marlin', 'Krill', 'Narwhal', 'Shrimp', 'Clam'];
const pick = (a: string[]) => a[(Math.random() * a.length) | 0];

/** Trimmed, single-spaced, printable, at most NAME_MAX characters. */
export function cleanName(raw: string) {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** Everything this game saved, minus the device-only keys. */
function snapshot() {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX) || LOCAL_ONLY.has(k.slice(PREFIX.length))) continue;
      try { data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!); } catch { /* skip bad JSON */ }
    }
  } catch { /* storage unavailable */ }
  return data;
}

/** Write a cloud save into localStorage without triggering another push. */
function apply(data: Record<string, unknown>) {
  try {
    for (const [k, v] of Object.entries(data)) if (!LOCAL_ONLY.has(k)) localStorage.setItem(PREFIX + k, JSON.stringify(v));
  } catch { /* storage unavailable */ }
}

const warn = (what: string, e: unknown) => console.warn(`[cloud] ${what} failed`, e);

async function connect(): Promise<Fb | null> {
  if (!config) return null;
  try {
    const [{ initializeApp }, authMod, fs] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite'),
    ]);
    const app = initializeApp(config);
    const auth = authMod.getAuth(app);
    const db = fs.getFirestore(app);
    if (useEmulators) {
      authMod.connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
      fs.connectFirestoreEmulator(db, location.hostname, 8080);
    }
    await auth.authStateReady();
    // Coming back from a Google redirect (used when popups are blocked).
    try { await authMod.getRedirectResult(auth); } catch (e) {
      if ((e as { code?: string }).code === 'auth/credential-already-in-use') pending = authMod.GoogleAuthProvider.credentialFromError(e as never);
    }
    const user = auth.currentUser ?? (await authMod.signInAnonymously(auth)).user;
    return { auth, db, fs, authMod, uid: user.uid };
  } catch (e) {
    warn('sign-in', e);
    return null;
  }
}

/** Pull the cloud save; the newer of cloud and device wins (or the cloud, when `force`). */
async function merge(f: Fb, force = false) {
  const ref = f.fs.doc(f.db, 'players', f.uid, 'saves', NAMESPACE);
  const snap = await f.fs.getDoc(ref);
  const remote = snap.exists() ? (snap.data() as { data: Record<string, unknown>; updatedAt: number }) : null;
  const localAt = store.get(SAVED_AT, 0);
  merged = true;
  if (remote && (force || remote.updatedAt > localAt)) {
    apply(remote.data);
    store.set(SAVED_AT, remote.updatedAt);
    dirty = false;
    restoreListeners.forEach(fn => fn());
  } else if (!remote || localAt > remote.updatedAt || dirty) {
    if (!localAt) store.set(SAVED_AT, Date.now());
    await push();
  }
}

async function push() {
  clearTimeout(pushTimer);
  if (!fb || !merged) return;
  dirty = false;
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'players', fb.uid, 'saves', NAMESPACE), { data: snapshot(), updatedAt: store.get(SAVED_AT, Date.now()) });
  } catch (e) {
    dirty = true;
    warn('save', e);
  }
}

function scores(f: Fb) { return f.fs.collection(f.db, 'leaderboards', NAMESPACE, 'scores'); }

/** Clear this device's saved progress (settings stay). */
function wipeLocal() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && !LOCAL_ONLY.has(k.slice(PREFIX.length))) localStorage.removeItem(k);
  } catch { /* storage unavailable */ }
}

/** After signing in to a different account: adopt its id and load its progress. */
async function switchedTo(f: Fb, user: User) {
  f.uid = user.uid;
  submitted = 0;
  try { await merge(f, true); } catch (e) { warn('restore', e); }
  accountChanged();
}

export const cloud = {
  enabled: !!config,

  get account(): Account { return describe(fb?.auth.currentUser ?? null); },
  onAccount(fn: (a: Account) => void) { accountListeners.push(fn); },

  /** Keep this guest's progress under a Google account (popup, or a redirect if popups are blocked). */
  async linkGoogle(): Promise<LinkResult> {
    const f = await starting;
    if (!f?.auth.currentUser) return { error: 'You\u2019re offline. Try again when you\u2019re connected.' };
    const { GoogleAuthProvider, linkWithPopup, linkWithRedirect } = f.authMod;
    const provider = new GoogleAuthProvider();
    try {
      await linkWithPopup(f.auth.currentUser, provider);
      accountChanged();
      return 'linked';
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/credential-already-in-use') { pending = GoogleAuthProvider.credentialFromError(e as never); return 'exists'; }
      if (code === 'auth/popup-blocked') { await linkWithRedirect(f.auth.currentUser, provider); return 'redirect'; }
      return { error: explain(e) };
    }
  },

  /** Create an email account for this guest ('create'), or sign in to an existing one ('signin'). */
  async linkEmail(email: string, password: string, mode: 'create' | 'signin'): Promise<LinkResult> {
    const f = await starting;
    if (!f?.auth.currentUser) return { error: 'You\u2019re offline. Try again when you\u2019re connected.' };
    const { EmailAuthProvider, linkWithCredential } = f.authMod;
    email = email.trim();
    if (mode === 'signin') { pending = { email, password }; return 'exists'; }
    try {
      await linkWithCredential(f.auth.currentUser, EmailAuthProvider.credential(email, password));
      accountChanged();
      return 'linked';
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') { pending = { email, password }; return 'exists'; }
      return { error: explain(e) };
    }
  },

  /** Switch to the account that already existed: its saved progress replaces this device's. */
  async useExisting(): Promise<true | { error: string }> {
    const f = await starting;
    if (!f || !pending) return { error: 'Something went wrong. Please try again.' };
    try {
      const cred = 'email' in pending
        ? await f.authMod.signInWithEmailAndPassword(f.auth, pending.email, pending.password)
        : await f.authMod.signInWithCredential(f.auth, pending);
      pending = null;
      await switchedTo(f, cred.user);
      return true;
    } catch (e) {
      return { error: explain(e) };
    }
  },

  /** A sign-in from a Google redirect that turned out to belong to another account. */
  get hasPending() { return !!pending; },
  cancelPending() { pending = null; },

  /**
   * Sign out: progress stays safe in the account, and this device starts over as a new guest
   * (as most games do). Reloads the page so every screen starts clean.
   */
  async signOut() {
    const f = await starting;
    if (!f) return;
    await push();
    await f.authMod.signOut(f.auth);
    wipeLocal();
    location.reload();
  },

  /** Sign in and sync. Safe to call more than once; resolves false when the cloud is off or unreachable. */
  start(): Promise<boolean> {
    starting ??= (async () => {
      fb = await connect();
      if (!fb) return null;
      accountChanged();
      onStoreWrite(key => {
        if (LOCAL_ONLY.has(key)) return;
        dirty = true;
        if (!merged) return; // a restore may still overwrite this; stamp once we know
        store.set(SAVED_AT, Date.now());
        clearTimeout(pushTimer);
        pushTimer = window.setTimeout(() => void push(), PUSH_DELAY);
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) void push(); });
      try { await merge(fb); } catch (e) { warn('restore', e); merged = true; }
      const best = store.get('best', 0);
      if (best > 0) void this.submitBest(best);
      return fb;
    })();
    return starting.then(Boolean);
  },

  /** Called after a newer cloud save replaced this device's progress. */
  onRestore(fn: () => void) { restoreListeners.push(fn); },

  /** The name shown on the leaderboard (made up the first time, then saved and synced). */
  get name() {
    let n = store.get('playerName', '');
    if (!n) { n = `${pick(ADJ)} ${pick(SEA)}`; store.set('playerName', n); }
    return n;
  },

  /** Rename; returns the cleaned name, or null when it was empty. */
  async rename(raw: string) {
    const n = cleanName(raw);
    if (!n) return null;
    store.set('playerName', n);
    const best = Math.max(store.get('best', 0), submitted);
    if (best > 0) { submitted = 0; await this.submitBest(best); }
    return n;
  },

  /** Post a best depth. The rules only let a player's best go up. */
  async submitBest(best: number) {
    const f = await starting;
    if (!f || best <= submitted) return false;
    try {
      await f.fs.setDoc(f.fs.doc(scores(f), f.uid), { name: this.name, best: Math.floor(best), updatedAt: f.fs.serverTimestamp() });
      submitted = best;
      return true;
    } catch (e) {
      warn('score', e);
      return false;
    }
  },

  /** The top divers, best first. Null when offline or the cloud is off. */
  async top(n = 20): Promise<Score[] | null> {
    const f = await starting;
    if (!f) return null;
    try {
      const q = f.fs.query(scores(f), f.fs.orderBy('best', 'desc'), f.fs.limit(n));
      return (await f.fs.getDocs(q)).docs.map(d => ({ name: String(d.get('name')), best: Number(d.get('best')), me: d.id === f.uid }));
    } catch (e) {
      warn('leaderboard', e);
      return null;
    }
  },

  /** 1-based global rank for a depth (ties share a rank). */
  async rank(best: number): Promise<number | null> {
    const f = await starting;
    if (!f || best <= 0) return null;
    try {
      const snap = await f.fs.getCount(f.fs.query(scores(f), f.fs.where('best', '>', best)));
      return snap.data().count + 1;
    } catch (e) {
      warn('rank', e);
      return null;
    }
  },
};

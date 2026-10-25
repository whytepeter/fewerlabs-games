#!/usr/bin/env node
/**
 * Deep Dive play report from the analytics events (src/core/analytics.ts).
 *
 *   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/analytics-report.mjs [days=7]
 *
 * The key is the Firebase service-account JSON (console > Project settings > Service accounts).
 * GOOGLE_APPLICATION_CREDENTIALS=key.json works too. Reads only; prints plain tables.
 */
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const days = Number(process.argv[2] ?? 7);
const key = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: key ? cert(JSON.parse(key)) : applicationDefault() });

const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
const snap = await getFirestore().collection('analytics/deep-dive/events').where('day', '>=', since).get();
const events = snap.docs.map(d => d.data());
console.log(`\nDeep Dive, last ${days} days (since ${since}): ${events.length} events\n`);

const by = name => events.filter(e => e.name === name);
const count = (list, f) => list.reduce((m, e) => { const k = f(e); m[k] = (m[k] ?? 0) + 1; return m; }, {});
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p90 = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.9)] : 0; };
const table = rows => console.table(rows);

// Players and next-day return: of the players seen on a day, how many came back the day after.
const opens = by('app_open');
const daysByPlayer = {};
events.forEach(e => { (daysByPlayer[e.uid] ??= new Set()).add(e.day); });
const players = Object.keys(daysByPlayer).length;
const nextDay = d => new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
let could = 0, came = 0;
Object.values(daysByPlayer).forEach(ds => ds.forEach(d => { if (nextDay(d) <= new Date().toISOString().slice(0, 10)) { could++; if (ds.has(nextDay(d))) came++; } }));
console.log(`Players: ${players} · opens: ${opens.length} · installed app: ${pct(opens.filter(e => e.data.installed).length, opens.length)} · came back next day: ${pct(came, could)}\n`);

// Dives per cave: how deep, how long, and what ends them.
const dives = by('dive_end');
console.log('Dives by cave');
table(Object.entries(count(dives, e => e.data.cave)).map(([cave, n]) => {
  const ds = dives.filter(e => e.data.cave === cave);
  const causes = Object.entries(count(ds, e => e.data.cause)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, k]) => `${c} (${pct(k, ds.length)})`).join(', ');
  return { cave, dives: n, 'median m': median(ds.map(e => e.data.depth)), 'top 10% m': p90(ds.map(e => e.data.depth)), 'median s': median(ds.map(e => e.data.secs)), 'median coins': median(ds.map(e => e.data.coins)), 'ends by': causes };
}));

// Save me: what players chose when it came up.
const saves = by('save_me');
console.log('Save me choices');
table(Object.entries(count(saves, e => e.data.choice)).map(([choice, n]) => ({ choice, n, share: pct(n, saves.length) })));

// Ads: was one there to offer, and did players watch it through.
const ads = by('ad');
console.log('Rewarded ads');
table(Object.entries(count(ads, e => e.data.placement)).map(([placement]) => {
  const a = ads.filter(e => e.data.placement === placement), n = r => a.filter(e => e.data.result === r).length;
  return { placement, offered: n('offered'), 'no ad': n('none'), watched: n('watched'), skipped: n('skipped'), 'fill rate': pct(n('offered'), n('offered') + n('none')), 'watch rate': pct(n('watched'), n('offered')) };
}));

// Spending: what coins and Sea Hearts go on.
const spends = by('spend');
console.log('Spending');
table(Object.entries(count(spends, e => e.data.item)).sort((a, b) => b[1] - a[1]).map(([item, n]) => {
  const s = spends.filter(e => e.data.item === item);
  return { item, bought: n, currency: s[0].data.cur, total: s.reduce((t, e) => t + (e.data.price ?? 0), 0) };
}));

// Rare treasure found.
const finds = by('treasure');
console.log('Treasure found');
table(Object.entries(count(finds, e => e.data.id)).map(([id, n]) => ({ id, found: n, 'first finds': finds.filter(e => e.data.id === id && e.data.first).length })));

import { settings } from './settings';
import { sfx } from './sfx';
import { track } from './analytics';

/**
 * Rewarded ads only (Google H5 Games Ads, part of AdSense): the player chooses to watch one for a
 * prize. Never interstitials. Set VITE_ADSENSE_CLIENT (ca-pub-…) once AdSense approves the site;
 * VITE_ADS_TEST=true serves Google's test ads. Without a client id, the dev server shows a stand-in
 * "test ad" so the flows can be tried, and a production build simply offers no ads.
 */
const env = import.meta.env;
const CLIENT = env.VITE_ADSENSE_CLIENT as string | undefined;
const TEST = env.VITE_ADS_TEST === 'true';
/** How long to wait for Google to say a rewarded ad is ready before giving up on offering one. */
const READY_WAIT = 1500;

/** Plays the ad; true once it was watched to the end (the reward is earned), false if skipped or it failed. */
export type ShowAd = () => Promise<boolean>;

declare global { interface Window { adsbygoogle?: object[] } }
/** Google's adBreak() and adConfig() are both a push onto the adsbygoogle queue. */
const push = (o: object) => { (window.adsbygoogle ??= []).push(o); };

let mode: 'off' | 'google' | 'fake' = 'off';
let showing = false;

/** Music and sound go quiet while an ad plays. */
const quiet = () => sfx.suspend();
const loud = () => sfx.resume();

export const ads = {
  get enabled() { return mode !== 'off'; },

  /**
   * Load the ad script, once the player's age is known: under 13 every request is tagged
   * child-directed, under 16 as under the age of consent (EEA/UK), so those players only get
   * non-personalised ads.
   */
  init(age: number) {
    if (mode !== 'off') return;
    if (!CLIENT) { if (env.DEV) mode = 'fake'; return; }
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    s.dataset.adClient = CLIENT;
    if (age < 13) s.dataset.tagForChildDirectedTreatment = '1';
    if (age < 16) s.dataset.tagForUnderAgeOfConsent = '1';
    if (TEST) s.dataset.adbreakTest = 'on';
    document.head.append(s);
    push({ preloadAdBreaks: 'on', sound: settings.sound ? 'on' : 'off' }); // adConfig
    mode = 'google';
  },

  /**
   * Ask for a rewarded ad. Resolves with a function that plays it once one is ready, or null when
   * there's none to offer (no fill, blocked, offline, ads off). Offer the reward only on non-null.
   */
  rewarded(name: string): Promise<ShowAd | null> {
    if (mode === 'off' || showing) return Promise.resolve(null);
    // Analytics: whether an ad was there to offer, and whether the player watched it to the end.
    return this.request(name).then(show => {
      track('ad', { placement: name, result: show ? 'offered' : 'none' });
      return show && (() => show().then(watched => { track('ad', { placement: name, result: watched ? 'watched' : 'skipped' }); return watched; }));
    });
  },

  request(name: string): Promise<ShowAd | null> {
    if (mode === 'fake') return Promise.resolve(fakeAd);
    return new Promise(ready => {
      let settled = false, finish: (watched: boolean) => void = () => {};
      const give = (show: ShowAd | null) => { if (!settled) { settled = true; ready(show); } };
      window.setTimeout(() => give(null), READY_WAIT);
      push({
        type: 'reward', name,
        beforeAd: () => { showing = true; quiet(); },
        afterAd: () => { showing = false; loud(); },
        beforeReward: (showAdFn: () => void) => give(() => new Promise<boolean>(done => { finish = done; showAdFn(); })),
        adViewed: () => finish(true),
        adDismissed: () => finish(false),
        // No ad after all, or it was shown: either way, settle anything still waiting.
        adBreakDone: () => { give(null); finish(false); },
      });
    });
  },
};

/** The dev server's stand-in: a few seconds of a full-screen "test ad" with Skip and a countdown. */
function fakeAd(): Promise<boolean> {
  showing = true; quiet();
  const el = document.createElement('div');
  el.className = 'fake-ad';
  el.innerHTML = '<div><b>Test ad</b><span>Rewarded in <i>3</i>…</span><button type="button">Skip</button></div>';
  document.body.append(el);
  return new Promise(done => {
    let left = 3;
    const end = (watched: boolean) => { clearInterval(tick); el.remove(); showing = false; loud(); done(watched); };
    const tick = window.setInterval(() => { left--; el.querySelector('i')!.textContent = String(left); if (left <= 0) end(true); }, 1000);
    el.querySelector('button')!.addEventListener('click', () => end(false));
  });
}

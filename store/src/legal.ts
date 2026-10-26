import type { Page } from './pages';

/**
 * Privacy policy, About and Contact: plain pages the store serves at /privacy, /about and
 * /contact, linked from the footer here and on fewerlabs.dev (AdSense reviews these). Keep the
 * policy true to what the games actually do: if a game starts collecting something new, add it
 * here and bump UPDATED.
 */
export const CONTACT = 'fewerlabs@gmail.com';
const UPDATED = '26 October 2026';
const mail = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;

const doc = (title: string, body: string): Page => ({
  title: `${title} · Fewer Labs Games`,
  html: `<div class="wrap legal"><article>${body}</article></div>`,
});

export const privacyPage = (): Page => doc('Privacy Policy', `
  <h1>Privacy Policy</h1>
  <p class="legal-updated">Last updated ${UPDATED}</p>

  <p>Fewer Labs makes small, free games that play in your browser. This policy explains what our
  games store, what we collect, and the choices you have. It covers <a href="https://fewerlabs.dev">fewerlabs.dev</a>,
  the games store at games.fewerlabs.dev, and the games we host on fewerlabs.dev subdomains (Deep Dive,
  Ripple and Skip). Draw Am runs on its own site under its own policy.</p>

  <h2>Who we are</h2>
  <p>Fewer Labs is based in Nigeria. For anything about your data, email ${mail}.</p>

  <h2>What stays on your device</h2>
  <p>To work, the games save your progress, scores, settings and choices in your browser's local
  storage (similar to cookies). This stays on your device and isn't sent to us unless a game's
  cloud features are on (below). Clearing your browser's site data removes it. Ripple, Skip and the
  store itself only keep data on your device.</p>

  <h2>Deep Dive: cloud saves and the leaderboard</h2>
  <ul>
    <li><b>Anonymous account.</b> Deep Dive signs you in anonymously through Google Firebase, so your
    progress can be backed up. This gives your device a random ID; it doesn't identify you.</li>
    <li><b>Cloud save.</b> Your game progress (coins, divers, missions, best depths and the age you
    entered) is backed up to Firebase under that ID.</li>
    <li><b>Optional sign-in.</b> If you choose to save your progress with Google or an email and
    password, Firebase keeps that email so you can sign in on other devices.</li>
    <li><b>Leaderboard.</b> The name you choose and your best depth are shown publicly on the
    leaderboard. Please use a nickname, not your full name.</li>
  </ul>

  <h2>Your age</h2>
  <p>Deep Dive asks your age the first time you play. We use it only to keep the game suitable: players
  under 13 are never shown personalised ads, and ad requests for them are marked as child-directed.</p>

  <h2>Play analytics (only with your consent)</h2>
  <p>If you choose <b>Accept all</b> in the cookie banner, or turn on <b>Play analytics</b> in Settings,
  Deep Dive records anonymous events such as how deep a dive went and what ended it, whether you used
  "Save me", whether you watched an ad, what you spent in-game coins on, and treasure you found. Each
  event carries only the random ID and the date, never your name, email or age. We use them to balance
  the game, and keep them for up to two years. Choose <b>Essential only</b>, or turn the switch off,
  and nothing is recorded.</p>

  <h2>Ads</h2>
  <p>Deep Dive may show optional ads from Google (AdSense) that you choose to watch for a reward,
  such as continuing a dive. Google and its partners may use cookies or similar technology to show
  and measure ads. Ads are personalised only if you allow it, and never for players under 13.
  Without your consent you may still see ads, but they aren't based on your interests. You can learn
  how Google uses data at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses information from sites that use its services</a>,
  and manage ad personalisation at <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ad Settings</a>.
  In Europe and the UK, Google's own consent message may also ask for your choice.</p>

  <h2>Services we use</h2>
  <ul>
    <li><b>Vercel</b> hosts the sites. Like any web host, it handles your IP address and browser details to serve pages and keep them secure.</li>
    <li><b>Google Firebase</b> runs Deep Dive's anonymous sign-in, cloud saves, leaderboard and analytics.</li>
    <li><b>Google AdSense</b> provides ads in Deep Dive.</li>
  </ul>
  <p>We don't sell your personal information.</p>

  <h2>Children</h2>
  <p>Our games are made for everyone, including children. We don't ask children for their name,
  email or other contact details. If you're under 13, ask a parent or guardian before saving your
  progress with Google or an email. If you're a parent and believe your child has given us personal
  information, email ${mail} and we'll delete it.</p>

  <h2>Your choices and rights</h2>
  <ul>
    <li>Change your consent any time in Deep Dive under <b>Settings → Privacy</b>.</li>
    <li>Sign out, or clear your browser's site data, to remove what's stored on your device.</li>
    <li>Email ${mail} to ask for a copy of your data, or to have your account, cloud save or
    leaderboard entry deleted. Tell us your leaderboard name to help us find it.</li>
  </ul>
  <p>Depending on where you live (for example under Nigeria's Data Protection Act or the EU and UK GDPR),
  you may have further rights, such as to correct your data or to complain to your data protection
  authority.</p>

  <h2>Changes</h2>
  <p>If we change what we collect, we'll update this page and the date at the top.</p>

  <h2>Contact</h2>
  <p>Questions about this policy: ${mail}.</p>`);

export const aboutPage = (): Page => doc('About', `
  <h1>About Fewer Labs</h1>
  <p>Fewer Labs is a small independent studio based in Nigeria. We make short, friendly
  games that play instantly in your browser, on a phone or a computer, with nothing to install
  and no account needed.</p>
  <p>The games here are free to play. Some, like Deep Dive, offer optional rewarded ads you can choose
  to watch for a bonus. We never interrupt a game with an ad you didn't ask for.</p>
  <p>Fewer Labs also builds open-source developer tools. See everything at
  <a href="https://fewerlabs.dev">fewerlabs.dev</a>.</p>
  <p><a class="btn btn-primary" href="/" data-link>Browse the games</a></p>`);

export const contactPage = (): Page => doc('Contact', `
  <h1>Contact</h1>
  <p>We'd love to hear from you: bugs, ideas, questions, or anything about your data.</p>
  <p class="legal-mail"><a class="btn btn-primary" href="mailto:${CONTACT}">Email ${CONTACT}</a></p>
  <p>For a game problem, tell us which game, what you were doing, and your phone or browser.
  For data requests (a copy, or deleting your account, cloud save or leaderboard entry), include
  your leaderboard name if you have one. We reply as soon as we can.</p>
  <p>See also our <a href="/privacy" data-link>Privacy Policy</a>.</p>`);

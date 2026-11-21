# INCOMPLETE.md: Open Items and Gaps

Things still undecided or not yet specified. Resolve these before or during the build.

## Decisions Still Needed
| # | Item | Options | Needed by |
|---|---|---|---|
| 1 | Domain name (site name is decided: Shivam Das News; default author: Shivam Das) | Owner decides | Phase 1 |
| 2 | Hosting | Cloudflare Pages (recommended) or GitHub Pages | Phase 1 |
| 3 | Admin | Decided in v0.3.0: custom dashboard (Decap cannot do the live SEO score, previews or the image width block) | Done |
| 4 | Chat storage | Firebase or Cloudflare | Phase 7 |
| 5 | Date in URL | YYYY/MM/DD or YYYY/MM | Phase 1 |
| 6 | Ad strategy order | DECIDED by the owner (2026-11-16): Adsterra is APPROVED and goes first; AdSense and Google News are still being applied for (see "Open Items After v0.85.1") | Done |
| 7 | Comments | Giscus, none, or custom | Phase 3 |
| 8 | Publisher time zone | Decided by the owner, 2026-11-18 (T-0003): `America/New_York`, US readers, `en_US`. Do not change it after the first real post, because it sets the date in every address | Done |
| 9 | Push notifications: own system (PLAN 31, recommended) or a service such as OneSignal | Own system is free and keeps reader data on your own Cloudflare; a service is faster to set up but holds the data | Phase 9 |
| 10 | Push: default alert level and daily limits | Balanced with 4 a day (proposed), or lower | Phase 9 |
| 11 | Push: "Learn from what I read" default | On outside the consent countries and off inside them (proposed), or off everywhere | Phase 9 |
| 12 | Push: free plan or paid Workers plan | About 3,000 subscribers at 4 alerts a day fits the free plan by the estimate in PLAN 31.11; above that the paid plan | Phase 9 |
| 13 | Search listing limits: warn at 60 and 160 and stop at 70 and 320 (proposed), or stricter | Proposed values follow what Google shows and what Shopify allows | Phase 3b |
| 14 | Where file alt text is kept: `config/media.json` (proposed) or in each post only | One file for all images, the post value still wins | Phase 3b |
| 15 | Picture storage for auto hosting: the repo with Cloudflare Pages (proposed) or a Cloudflare R2 bucket | The repo is simple and free; R2 is better after about 3000 to 5000 pictures. Also answers the open item "Image storage" below | Phase 3c |
| 16 | Outside pictures at publish: warning only (proposed) or a hard block; and the agency host list that asks first | A hard block is stricter but can stop a story | Phase 3c |
| 17 | Repository: keep it public or make it private | A public repo shows drafts, scheduled and archived posts to everyone; Cloudflare Pages works with a private repo | Before the first real post |
| 18 | AI writes straight to `main` or only through pull requests | Pull requests with a green check are safer (proposed) | Phase 3d |
| 19 | Who may add scripts (Page JavaScript) | Admin only (proposed), or editor too | Phase 3e Part 5 |
| 20 | Code colours: at build (proposed, no JavaScript for readers) or in the browser | At build is faster and works with JavaScript off | Phase 3e Part 2 |
| 21 | The HTML tab: two way conversion with the automatic HTML block (proposed) or a read only raw view | Two way is friendlier; read only is simpler and safer | Phase 3e Part 3 |
| 22 | First allow list of iframe hosts for HTML blocks | YouTube no-cookie, Vimeo, Google Maps, Spotify (proposed); the owner adds more in Settings | Phase 3e Part 4 |
| 23 | How the Worker writes to GitHub for Connected apps | A GitHub App with one-hour tokens (proposed, limited to this one repo, not tied to a person) or a fine-grained token in a Worker secret (simpler, lives 90 days at most) | Phase 3f Part 4 |
| 24 | Write mode of Connected apps | Direct to `main` for content paths once the check of Phase 3d exists (proposed), or always a branch and a pull request | Phase 3f Part 5 |
| 25 | Delete rights of apps | Archive only; `delete_forever` is a separate scope, off by default (proposed), or no delete at all | Phase 3f Part 5 |
| 26 | Sign-in for the connector | A bearer token first (proposed) or OAuth from the start; some assistants accept only OAuth for custom connectors, check before Part 9 | Phase 3f Part 9 |
| 27 | Which assistant comes first | The owner's ChatGPT is Free and cannot add a custom connector (PLAN 38.2, check again). Options: Claude custom connector (one on Free), a paid ChatGPT plan, Codex or Claude Code with the plain API, or keep the GitHub connector (AI_OPERATIONS 15) | Phase 3f Part 9 |
| 28 | Where the sign-in Worker lives | On the site's own address through a Pages Function (proposed; needed for a first-party cookie) or stays on `workers.dev` (then no safe stay-signed-in, the token would have to sit in browser storage) | Phase 3g Part 2 |
| 29 | How long a device stays signed in | 30 days with a 7 day idle limit (proposed), 7 days, or always ask | Phase 3g Part 1 |
| 30 | GitHub permission of the dashboard token | `public_repo` while the repo is public (proposed; today it is `repo`, which reaches all private repos of the account), or a GitHub App user token (best, more work) | Phase 3g Part 6 |
| 31 | Automatic redirect sign-in on load | On, one try per tab (proposed), or button only | Phase 3g Part 4 |
| 32 | Helper link for browser robots | None (proposed; use Connected apps) or an editor-role one-time link (BETTER N41) | Later |
| 33 | Link types and limits | The list of PLAN 40.2, 10 links per author (proposed); `rel="me noopener"` for own pages and profiles, `nofollow` for Other (proposed) | Phase 3h Part 1 |
| 34 | Author page before the first post | A **Show author page now** switch with a complete profile (proposed), or only after the first published post (today) | Phase 3i Part 3 |
| 35 | The `/authors/` page | Only with two or more live authors (proposed), or always | Phase 3i Part 4 |
| 36 | Look of the site | Newsroom as the default, Playful kept as an option (proposed), only Newsroom, or keep today's look | Phase 3j Part 5 |
| 37 | Dark palette | The new `#0b1220` family of PLAN 42.3 (proposed) or only fix the current navy | Phase 3j Part 2 |
| 38 | Colour mode switch | Three states System, Light, Dark (proposed) or two | Phase 3j Part 4 |
| 39 | Headline font | Keep Lexend, or offer a self-hosted serif (proposed: decide after seeing both on a real article) | Phase 3j Part 6 |
| 40 | Category bar in the header | Top six categories on tablets and desktops, a chip row on phones (proposed), or keep them in the menu | Phase 3j Part 5 |
| 41 | Where tasks live | Files in `tasks/` with the Issue form as a second way in (proposed), only files, or only GitHub Issues | Phase 3k Part 7 |
| 42 | Who may do which risk | The table of `tasks/README.md` (proposed): green owner, editor, AI; yellow by pull request with a second key; red the owner, the AI only prepares | Phase 3k Part 2 |
| 43 | Document size budgets and the archive | AI_START_HERE 900, INCOMPLETE 8,000, CHANGELOG 20,000, others 25,000 words, old blocks moved to `docs/archive/` (proposed), or no limits | Task T-0008, Phase 3k Part 6 |
| 44 | Unanswered decisions | They wait for the owner and show as blocking (proposed), or the proposed value becomes final after 14 days | Phase 3k Part 7 |
| 45 | The second key for yellow tasks | A different AI session with the reviewer prompt (proposed) or always the owner | Phase 3k Part 5 |
| 46 | Live check after each deploy | On, report as a comment on the pull request or issue (proposed), or off | Phase 3k Part 4 |
| 47 | Limits of the file editor and the picture budget | Alt text warn at 125 (PLAN 33.3) and stop at 300, caption stop at 300, credit stop at 120, picture warning above 300 KB (all proposed), or other numbers | Phase 3b Part 7b |
| 48 | Should a stored alt text (`config/media.json`) satisfy the publish gate | Today a published post still needs its own `imageAlt` (proposed: keep it); or let the stored alt text count, so a post may leave `imageAlt` empty | Phase 3b Part 7c |
| 49 | Should a deleted picture get a redirect or a 410 | None (proposed: a picture that nothing names has no readers), or a 410 for the old address, or a redirect to a picture the owner picks | Phase 3b Part 8b |
| 50 | Replace a file: same address (PLAN 33.3) or a new name (BUGS U13, PLAN 34) | Same address (followed in v0.101.32, safe while `/media/*` has no immutable cache header); or a new name with the posts updated (that is the rename of 8d); if the immutable header is added later, a version stamp must be added first | Phase 3b Part 8c |
| 51 | Limit for a replacement picture | 5 MB hard stop, warning above 300 KB (both proposed), or other numbers | Phase 3b Part 8c |
| 52 | Where the dashboard finds the images Worker address | The optional key `imagesUrl` in `site/public/admin/config.json`, next to `authUrl` (proposed and built in v0.101.52; empty means off), or a new `config/images.json` (PLAN 34, Part 7) | Phase 3c Part 3c-8 |

## Not Yet Fully Defined
- Exact category list (owner chooses real categories; none are pre-filled).
- Real legal page text (owner details, address, company or individual).
- Author system: single author or team.
- Monetization of AMP beyond AdSense (limited).
- Newsletter provider and push notification provider.
- Analytics data retention period and privacy wording.
- Admin login method (GitHub OAuth) and who gets access.
- Image storage: inside repo or external bucket.
- Content license and image credit policy.
- Backup restore procedure (how to bring the site back).
- Monitoring and alert contact (email/Telegram).
- Budget: free-tier limits and when to move to paid plans.

## Risks to Verify Early
- Google News approval requires real original content and clear publisher info. This cannot be automated.
- AdSense approval needs enough quality content, required pages and a clean ad setup.
- Free-tier limits on Cloudflare D1/Workers and Firebase must be checked against expected traffic.
- Adsterra on AMP and Adsterra with AdSense may conflict with policies; test and review.

## Phase Status
| Phase | Status |
|---|---|
| 1 Base site and URLs | Code written and build tested (see site/) |
| 2 SEO engine | Code written and build tested (v0.2.0, see site/) |
| 3 Admin | Part 1 built (v0.3.0): sign in, posts, SEO score, media, authors, categories, settings, setup checklist. Still to do: pages editor, menus, logo upload screen, WYSIWYG, embeds |
| 3e Direct code writing | Plan written (v0.101.1, PLAN 37, LOGICS 25, BUGS group K). Nothing built yet. 7 small parts in CODING_PLAN Phase 3e. Decisions 19 to 22 are open (proposed values are in the table above). |
| 3f Connected apps | Plan written (v0.101.3, PLAN 38, LOGICS 26, BUGS group X, AI_OPERATIONS 16). Nothing built yet. 10 small parts in CODING_PLAN Phase 3f. Decisions 23 to 27 are open (proposed values are in the table above). |
| 3g Automatic sign-in | Plan written (v0.101.4, PLAN 39, LOGICS 27, BUGS group Y, AI_OPERATIONS 17). Nothing built yet. 7 small parts in CODING_PLAN Phase 3g. Decisions 28 to 32 are open. |
| 3h Link editor | Plan written (v0.101.4, PLAN 40, LOGICS 28, BUGS group Z). Nothing built yet. 6 small parts in CODING_PLAN Phase 3h. Decision 33 is open. |
| 3i Author pages | Plan written (v0.101.5, PLAN 41, LOGICS 29, BUGS group M, AI_OPERATIONS 18). Nothing built yet. 7 small parts in CODING_PLAN Phase 3i. Decisions 34 and 35 are open. |
| 3j Theme and dark mode | Plan written (v0.101.5, PLAN 42, LOGICS 30, BUGS group R, CSS.md). Nothing built yet. 9 small parts in CODING_PLAN Phase 3j. Decisions 36 to 40 are open. |
| 3k Task system | Part 7 built in v0.101.13 (read-only Tasks screen in the dashboard, `site/public/admin/js/tasks.js`). Part 5 gates built in v0.101.12 (`npm run tasks:gate`, workflow not built). Part 6 built in v0.101.11 (`npm run docs:archive`, not run yet). Part 4 script built in v0.101.10 (`npm run verify:live`; workflow not built). Part 3 built in v0.101.9 (`npm run preflight`). Part 2 built in v0.101.8 (`npm run tasks:check`). Part 1 delivered in v0.101.6 (docs only): `AI_START_HERE.md`, `tasks/` with nine cards, the Issue form, the pull request template. PLAN 43, LOGICS 31, BUGS group Q, AI_OPERATIONS 19. Parts 8 and 9 (Tasks screen write mode and Owner checklist, weekly report) not built. Decisions 41 to 46 are open. |
| 4 Redirects, links, XML | Parts 1 to 13 built (v0.4.0 to v0.16.0): redirect map, `_redirects` with real 301s, Redirect Manager screen with CSV, 410 for archived posts, related stories, auto links inside the text, Read next, orphan report, XML import with Markdown conversion, saving (posts, pages, redirects) image download and XML export (backup file). category rename with redirects. Trending block built in v0.41.0 (shows only when analytics is on and real data exists). Part 14 (v0.51.0): same-title match and lifetime redirects from the old Blogger blog (PLAN 32); the list ships empty and nothing changes until `scripts/title-match.mjs` is run |
| 5 Ads | Parts 1 to 14 built (v0.17.0 to v0.31.0; v0.25.0 adds the consent bar for EU, EEA, UK and Switzerland, v0.26.0 the "Ad choices" button to change the answer, v0.27.0 the answer expires after 180 days, v0.28.0 the number of days is a setting, v0.30.0 the bar text is a setting, v0.31.0 the button words are settings): `ads.txt` from `config/ads.json`, the Ads screen to edit it, the geo Worker, the ad loader (popunder, social bar, native banner since v0.22.0, smartlink since v0.23.0, one AdSense in-article unit since v0.24.0; off by default) and the Ad loader screen to switch it on. Still to do: AdSense display and multiplex units, auto ads, Google certified consent tool for AdSense in the EU and UK, AMP |
| 6 Analytics | Parts 1 to 9 built (v0.32.0 to v0.41.0): D1 schema, the rules that check one visit message, the Worker endpoint `POST /collect`, the beacon script in article pages (off until `config/analytics.json` has an endpoint), the hourly rollups with cleanup of raw events older than 7 days, the private `GET /stats` numbers endpoint, the Analytics screen in the dashboard, source names (Google, Facebook, X, Direct ...), the `GET /trending` numbers endpoint, and the Trending block on the home page and article pages (v0.41.0). Still to do: Discover as its own source, consent rule, per-post numbers |
| 7 Chat and pages | Parts 1 to 7 built (v0.43.0 to v0.49.0): the required pages generator (`npm run pages`, twelve pages since v0.46.0, from `config/publisher.json`), the HTML sitemap page `/sitemap/`, the contact Worker (v0.47.0) and the contact form on the Contact page (v0.48.0, off until `config/contact.json` is filled). v0.49.0 adds the private inbox endpoints of the contact Worker. Still to do: the inbox screen in the dashboard, the email notice, the chat |
| 8 QA and launch | Not started |
| 8b Bot protection | Plan written (v0.70.4, `BOT_PROTECTION.md`). Part 2 built (v0.71.0): `workers/shared/guard.js`, 38 tests. Part 3a built (v0.72.0): the contact Worker and form use it. Part 3b built (v0.73.0): the push Worker and its page script use it. Part 3c built (v0.74.0): the analytics Worker and the beacon use it. Part 3d built (v0.75.0): the Privacy page text about Turnstile and the stamp. Part 4a built (v0.76.0): the beacon sends `acted` and `webdriver`, the Worker stores them. Part 4b-1 built (v0.77.0): the datacenter flag `dc` and the verified and unverified counters in the totals and `/stats`. Part 4b-2 built (v0.78.0): one visit per 30 minutes and the 5-second rule. Part 4b-3 built (v0.79.0): the Analytics screen shows verified page views, the unverified share and a red note. Part 4b-4 built (v0.80.0): the red note per page, country and source. Part 5a built (v0.81.0): the ad loader waits for one real event. Part 5b built (v0.82.0): the geo Worker answers no ads for a datacenter network, from one shared list. Part 5c built (v0.84.0): the "my own browser" switch (`?own-browser=on`). Part 6a built (v0.85.0): the page headers (`nosniff`, `Permissions-Policy`, HSTS) and the referrer meta tag. Part 6b-1 built (v0.86.0): the content policy in report-only mode. Part 6b-2a built (v0.87.0): its own report-only policy for the Contact Us page, with the Turnstile host. Part 6b-2b built (v0.87.1): the dashboard has its own report-only policy (scripts from itself only). Part 6b-3a built (v0.88.0): article pages have their own report-only policy with the ad hosts. Part 7a built (v0.89.0): the trap rules as plain functions (`workers/trap/lib.js`, 18 tests), nothing connected. Part 7b built (v0.90.0): the trap Worker (`workers/trap/index.js`, 24 tests), kill switch OFF, nothing connected. Part 8a built (v0.91.0): the Security screen rules (`site/public/admin/js/security.js`, 10 tests), not connected. Part 8b-1 built (v0.92.0): the drawing of the screen and the last done times (21 tests in all), still not connected. Part 8b-2 built (v0.93.0): the Security screen is in the dashboard (`#/security`, admin only), with 8 jsdom tests written but NOT run yet. Still to do: Part 1 (owner), 6b-3b, 6b-3c, 7c, 7d, and running the new jsdom tests, 8, the guard for the chat when it exists |
| 9 Smart push notifications | Plan and algorithm written (v0.49.1). Part 1 built (v0.50.0): the rules in `workers/push/lib.js` and the database file `workers/push/schema.sql`, 91 unit tests. Nothing is connected to a page or a Worker yet, so no reader can see or receive anything. Part 2 built (v0.52.0): `workers/push/index.js` and `prefs.js` with subscribe, preferences (read and change, pause) and unsubscribe endpoints, 57 tests, the database ones on real SQLite. The Worker is not deployed and no page calls it. Part 3 built (v0.53.0): `workers/push/webpush.js` (RFC 8291 encryption, checked against the RFC example byte for byte, and `sendPush` with sent, gone, retry, rejected, bad_sub results) and `workers/push/vapid.js` (VAPID keys and signed token), `npm run vapid`, 43 tests. Nothing calls the send function yet. Part 4 built (v0.54.0): the service worker `public/push-sw.js`, the client `src/lib/push-client.js`, `config/push.json` (empty) and `public/badge-96.png`; nothing loads them yet. Part 5a built (v0.56.0): the soft prompt card at the end of article text, shown only by the PLAN 31.2 rules; its button points to `/notifications/`, which does not exist yet. Part 5b built (v0.57.0): the `/notifications/` page (core choices, iPhone Home Screen steps, blocked and unsupported messages) and the header bell link (both only when `config/push.json` is filled). Part 5c-1 built (v0.58.0): the "Keywords to follow" and "Keywords to mute" boxes on `/notifications/` (one keyword per line or separated by commas, up to 10 each, checked on the page and again by the Worker). Part 5c-2 built (v0.59.0): quiet hours (on or off, from, until) and "Let breaking news through during quiet hours" on `/notifications/`. Part 5c-3 built (v0.60.0): the digest (off, morning, evening, both, with the hours) and the pause (not paused, 1 day, 1 week, until the reader turns it back on) on `/notifications/`. Part 5c-4 built (v0.61.0): authors to follow (the block shows only when two or more authors have published stories; today the site has one author, so readers see no Authors block). Part 5c-5 built (v0.62.0): the test notification (`POST /test` in the push Worker, one a minute for each reader, never uses the daily limit; `sendTest` in the client; the button "Send me a test notification" on `/notifications/`, shown only while notifications are on). Part 5c-6 built (v0.63.0): the article bell button "Get alerts for this topic", a link that fills the story's category and focus keyword into `/notifications/` without saving; part 5 is complete. Part 6a built (v0.64.0): `POST /announce` in the push Worker (secret header, post checks, import guard, recorded in `push_posts`; sends nothing; off until `ANNOUNCE_SECRET` is set). Part 6b built (v0.65.0): the live check in `workers/push/livecheck.js` (the Worker opens the page, status 200, HTML, no noindex; a failure is not recorded). Part 6c built (v0.66.0): the audience search in `workers/push/audience.js` (finds the readers who may want a post through the indexes; scores nothing, sends nothing; nothing calls it yet). Part 6d built (v0.67.0): the delivery plan in `workers/push/plan.js` (scores each candidate, applies level, daily limit, minimum gap, quiet hours, digest and story threads, and writes the queue and the held stories; sends nothing; nothing calls it yet). Part 7a built (v0.68.0): the sender in `workers/push/sender.js` (one batch of at most 36 messages from the queue: send, retry, delete dead readers, write the result; nothing calls it yet). Next: part 7b, the cron, the kill switch and the call after `/announce`. Part 7b built (v0.69.0): `workers/push/control.js` (kill switch `PUSH_PAUSED`, plan after `/announce`, the cron tick), the `scheduled` handler and the every-minute cron in `wrangler.toml`; works only when the database and sender keys exist, 29 tests. Part 7c built (v0.83.0): `workers/push/cleanup.js`, the hourly clean-up of old rows by the retention rules of PLAN 31.3 (25 tests). Part 7d built (v0.94.0): the deploy job `.github/workflows/push.yml` with `site/scripts/push-announce.mjs` and its helpers (sends the posts of the last 2 hours to `POST /announce`, asks again only for pages not live yet; does nothing until the three secrets exist; 23 tests). Part 7e-1 built (v0.95.0): the post fields `push`, `pushTitle`, `pushBody` in the schema, the dashboard check and the front matter order (11 tests); the editor box was built in v0.96.0 (7e-2: the Notifications box, 17 tests). The source "Push notification" was built in v0.97.0 (7e-3). Part 7 is complete. Part 8a built (v0.98.0): `POST /feedback` and the weight rules in `workers/push/feedback.js` (18 tests). Part 8b built (v0.99.0): the weekly fade of the weights (`runFade`, 16 tests). Part 8c-1 built (v0.100.0): the count of "Less like this" taps (`push_less`) and `suggestRemove` in the read answer (18 tests). Part 8c-2 built (v0.101.0): the offer "Remove this topic?" with a one-tap button on `/notifications/`, and the counted taps are cleared when the topic is removed (32 tests). Still to do: parts 8d to 11. |

## Open Items After v0.101.180
- Phase 3c Part 8cb built: the build gate (`validate-html.mjs`) checks every built page for a paragraph written twice in a row (`repeat-check-lib.mjs`): a `<p>` of 8 or more words that has the same text as the `<p>` right before it (spacing and capitals do not matter) is a warning; nothing is an error, so the build never stops for it. Short paragraphs, a paragraph with another paragraph between, list items, headings, table cells and code are skipped. Card `T-0178` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted two times or an import that ran two times leaves the same paragraph twice; after the import the build prints a warning that names the page and how many places. Delete one copy. The warning never blocks publishing. The owner did not name this check: Claude chose it as the next small part, so say if you want another one instead.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0178 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.179
- Phase 3c Part 8ca built: the build gate (`validate-html.mjs`) checks the body text of every built page for a long run of words in capital letters (`allcaps-check-lib.mjs`): 10 or more words in a row are a warning; nothing is an error, so the build never stops for it. Shorter runs (`UNITED STATES OF AMERICA`), words with a dot, digit, hyphen or apostrophe inside (`U.S.`, `COVID-19`), code, and the title and headings (read by the older check) are skipped. Card `T-0177` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A notice pasted from a chat or an old page is sometimes typed all in capitals; after the import the build prints a warning that names the page and the first words. Write it in normal letters. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0177 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.178
- Phase 3c Part 8bz built: the build gate (`validate-html.mjs`) checks the text of every built page for a word typed with Caps Lock on by mistake (`capslock-check-lib.mjs`): `hELLO` and `cAPSLOCK` are warnings; nothing is an error, so the build never stops for it. Words of 4 letters or fewer (`mRNA`, `iOS`), names with a small letter after the capitals (`iPhone`, `eBay`), hashtags, handles, addresses and code are skipped. Card `T-0176` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story typed fast sometimes holds a word with Caps Lock on; after the import the build prints a warning that names the page and the first word. Retype it. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0176 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.177
- Phase 3c Part 8by built: the build gate (`validate-html.mjs`) checks the body text of every built page for a pile of exclamation or question marks (`exclaim-check-lib.mjs`): `Wow!!`, `Really???` and `What?!?!` are warnings; nothing is an error, so the build never stops for it. The single pair `?!` or `!?`, one mark alone, a web address, code, and the title and headings (read by the older check) are skipped. Card `T-0175` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted from a chat or a social post sometimes keeps `!!!` or `???`; after the import the build prints a warning that names the page and how many places. Keep one mark. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0175 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.176
- Phase 3c Part 8bx built: the build gate (`validate-html.mjs`) checks the text of every built page for a missing space after a colon (`colon-check-lib.mjs`): `Note:Read` and `He said:Then` are warnings; nothing is an error, so the build never stops for it. The scheme of an address, a time or a ratio, a smiley, a single letter before the colon, a word after the colon with one small letter, code and text in another script are skipped. Card `T-0174` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted from Word or typed fast sometimes has a colon glued to the next word; after the import the build prints a warning that names the page and how many places. Add the space. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0174 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.175
- Phase 3c Part 8bw built: the build gate (`validate-html.mjs`) checks the text of every built page for two hyphens where a dash belongs (`dash-check-lib.mjs`): `left--then`, `2020--2021` and `left -- then` are warnings; nothing is an error, so the build never stops for it. Three or more hyphens, a command option in a sentence, a pair at the start or end of a paragraph, a single hyphen, an en or em dash and code are skipped. Card `T-0173` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted from Word or typed fast sometimes has two hyphens for a dash; after the import the build prints a warning that names the page and how many places. Replace each pair with one dash. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0173 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.174
- Phase 3c Part 8bv built: the build gate (`validate-html.mjs`) checks the text of every built page for a missing space after the end of a sentence (`sentence-space-check-lib.mjs`): a full stop, question mark or exclamation mark that ends a word and is glued to a capital word (`left.Then`, `Why?Because`) is a warning; nothing is an error, so the build never stops for it. The short forms of titles and names (Mr, Mrs, Dr, St and the like), an address that starts with `www`, an e-mail address, an ellipsis, a single letter, a number, code and text in another script are skipped. Card `T-0172` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted from Word or imported from Blogger sometimes has two sentences glued together after the line breaks were lost; after the import the build prints a warning that names the page and how many places. Fix the gap. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0172 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.173
- Phase 3c Part 8bu built: the build gate (`validate-html.mjs`) checks the gaps around curly double quotes in the text of every built English page (`quote-space-check-lib.mjs`): a space just inside a quote, no space before an opening quote that follows a word and no space after a closing quote that is followed by a word are warnings; nothing is an error, so the build never stops for it. Straight quotes, single quotes, a German style quote, a gap written as `&nbsp;`, code and a page in another language are skipped. Card `T-0171` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story pasted from Word or imported from Blogger sometimes has a quote with a space inside it or a quote glued to the next word; after the import the build prints a warning that names the page and how many places. Fix the gap. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0171 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.172
- Phase 3c Part 8bt built: the build gate (`validate-html.mjs`) checks the gaps around brackets in the text of every built page (`bracket-space-check-lib.mjs`): a space just inside a bracket, no space before an opening bracket that follows a word and no space after a closing bracket that is followed by a word are warnings; nothing is an error, so the build never stops for it. A smiley, `word(s)`, `f(x)`, `Title(2020)`, `( ... )`, a gap written as `&nbsp;`, an address and code are skipped. Card `T-0170` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story typed fast or imported from Blogger sometimes has `( see below )` or `said(see below)`; after the import the build prints a warning that names the page and how many places. Fix the gap. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0170 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.171
- Phase 3c Part 8bs built: the build gate (`validate-html.mjs`) checks the text of every built page for brackets and double quotes that are opened and never closed (`bracket-check-lib.mjs`): a round or square bracket, a curly double quote and a straight double quote are warnings; nothing is an error, so the build never stops for it. A smiley, a list marker such as `1)`, a quotation over several paragraphs, `5'10"`, a German style quote and code are skipped. Card `T-0169` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story typed fast or imported from Blogger sometimes has `(see below` with no closing bracket or a quote that never ends; after the import the build prints a warning that names the page and how many places. Add the missing mark. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0169 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.170
- Phase 3c Part 8br built: the build gate (`validate-html.mjs`) checks the text of every built page for slips in punctuation (`punct-check-lib.mjs`): a space before a comma or full stop, repeated commas or dots and no space after a comma are warnings; nothing is an error, so the build never stops for it. An ellipsis of three dots, `&nbsp;` before a mark, numbers, times, web addresses, abbreviations and code are skipped. Card `T-0168` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story typed fast or imported from Blogger sometimes has `word ,` or `said,then`; after the import the build prints a warning that names the page and how many places. Fix the marks. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0168 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.169
- Phase 3c Part 8bq built: the build gate (`validate-html.mjs`) checks the text of every built page for broken characters (`garble-check-lib.mjs`): the replacement mark U+FFFD, text saved in one encoding and read in another (a curly apostrophe shown as three odd letters) and a hidden control character are warnings; nothing is an error, so the build never stops for it. Real accented text, `&nbsp;`, other scripts and code are skipped. Card `T-0167` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story imported from Blogger or pasted from Word sometimes shows odd letters instead of an apostrophe or a dash; after the import the build prints a warning that names the page and how many places. Retype the mark. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0167 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.168
- Phase 3c Part 8bp built: the build gate (`validate-html.mjs`) checks the text of every built page for a word of 3 or more letters repeated twice in a row (`doubled-check-lib.mjs`): `the the`, `and and` are warnings; nothing is an error, so the build never stops for it. `had had`, `that that`, a mark after the first word, a block tag between the words, and code or preformatted text are skipped. Card `T-0166` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A story typed fast or imported from Blogger sometimes has `the the`; after the import the build prints a warning that names the page and shows the first pair. Remove the extra word. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0166 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.167
- Phase 3c Part 8bo built: the build gate (`validate-html.mjs`) checks the title and the headings (`h1` to `h3`) of every built page for shouting (`shout-check-lib.mjs`): a title or heading of 12 or more letters with no small letter, and one with `!!`, `??` or three or more `!` and `?` in a row, are warnings; nothing is an error, so the build never stops for it. Card `T-0165` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. An old headline imported from Blogger is sometimes written in capitals or ends in `!!!`; after the import the build prints a warning that names the page. Rewrite the headline in normal case. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0165 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.166
- Phase 3c Part 8bn built: the build gate (`validate-html.mjs`) checks every built page for empty text boxes and gaps made by hand (`blank-check-lib.mjs`): an empty paragraph, list item, quote or caption, and two or more `&nbsp;` in a row are warnings; nothing is an error, so the build never stops for it. An empty box with a `role`, `aria-live`, `id` or `data-` attribute is skipped, because a script fills it later (the status lines of `/contact-us/` and `/notifications/`). Card `T-0164` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A post imported from Blogger often holds `<p>&nbsp;</p>` as a blank line; after the import the build prints a warning that names the page and how many places. Delete the empty paragraph and use spacing instead. The warning never blocks publishing.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0164 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.165
- Phase 3c Part 8bm built: the build gate (`validate-html.mjs`) checks the line breaks of every built page (`break-check-lib.mjs`): a stray `</br>` is an error; two or more `<br>` in a row, a paragraph that holds only a `<br>`, a `<br>` at the start or end of a paragraph, next to a block tag or directly inside a list or table, and an end tag of an empty element (`</img>`, `</input>`) are warnings. Card `T-0163` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: nothing changes today. A post imported from Blogger often holds `<br><br>` in place of a new paragraph; after the import the build prints a warning that names the page and how many places. Close the paragraph and open a new one. A stray `</br>` stops the build.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0163 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.164
- Phase 3c Part 8bl built: the build gate (`validate-html.mjs`) checks the media query of every `media` attribute on a link, picture source, style block and theme-colour tag of a built page (`media-query-check-lib.mjs`): unclosed or empty brackets, a missing `and`, a media type that is not real, a length with no unit, a resolution with no unit, a bad colour scheme, motion, orientation, hover or pointer value and a mistyped feature name are errors; a media type that matches nothing (`tv`, `handheld`) and a min-width larger than the max-width are warnings. Card `T-0162` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: no built page has a `media` attribute today, so nothing changes. If you paste a `<picture>` or a style sheet link by hand, a query a browser cannot read stops the build and the message names the page and the query.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0162 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.163
- Phase 3c Part 8bk built: the build gate (`validate-html.mjs`) checks the integrity fingerprint of every script and style sheet of a built page (`integrity-check-lib.mjs`): a word that is not a real `sha256`, `sha384` or `sha512` fingerprint and a fingerprint on a file from another website with no `crossorigin` attribute are errors; an empty integrity, one on a tag that does not read it, and a script or style sheet from a library host (cdnjs, jsDelivr, unpkg, jQuery, Google, Bootstrap) with no integrity are warnings. Card `T-0161` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you paste a library script by hand into a post or the Ads screen, give it the fingerprint and `crossorigin="anonymous"` or leave the fingerprint out. A wrong fingerprint stops the build and the message names the page and the address. Ad, analytics and Turnstile scripts need no fingerprint and give no message.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0161 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.162
- Phase 3c Part 8bj built: the build gate (`validate-html.mjs`) checks what the alt text of every picture of a built page says (`alt-text-lib.mjs`): an alt that is only a file name or a camera or screenshot name is an error; an alt that is one empty word (`image`, `photo`), one that starts with `image of`, one over 125 characters and one of blanks or marks only are warnings. Card `T-0160` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a post with a picture whose alt is a file name (a phone upload, an old Blogger import) stops the build when it is published. The message names the page and the alt. Write what the picture shows, or `alt=""` if it is only decoration.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0160 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.161
- Phase 3c Part 8bi built: the build gate (`validate-html.mjs`) checks the skeleton of every built page (`structure-check-lib.mjs`): a second `<html>`, `<head>` or `<body>`, a `<head>` after the `<body>` starts, a tag or text in the head that a head may not hold (it ends the head early), a canonical link in the body and a `<title>` only in the body are errors; a second `<title>` in the body, a `<meta>` with `name`, `property`, `http-equiv` or `charset` in the body, content after `</body>` or `</html>` and a page with no `<head>` or no `<body>` tag are warnings. Card `T-0159` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a whole HTML page pasted into a post, a tag pasted by hand into the head (an analytics snippet with a `<div>` or a picture) or a script added after `</body>` stops the build or prints a warning when it is published, because the browser would end the head early or ignore the tags, with no message. The message names the page. Move the pasted part into the body or remove the extra page tags.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0159 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.160
- Phase 3c Part 8bh built: the build gate (`validate-html.mjs`) checks the `<noscript>` blocks of every built page (`noscript-check-lib.mjs`): a `<noscript>` in the head that holds anything but `link`, `style` and `meta` (or text) and a `<noscript>` that is never closed are errors; an empty `<noscript>`, a `<script>` inside a `<noscript>` and a `</noscript>` with no opening one are warnings. Card `T-0158` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a snippet pasted by hand into the head (an analytics or pixel code with a `<noscript><img ...></noscript>` part) or an old Blogger page with a `<noscript>` never closed stops the build when it is published, because the head would end early or the rest of the page would turn into text, with no message. Move the picture part of the snippet into the body; the message names the page. An empty `<noscript>` only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0158 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.159
- Phase 3c Part 8bg built: the build gate (`validate-html.mjs`) checks the address attributes `action`, `formaction`, `cite`, `ping`, `poster` and `longdesc` of every built page (`url-attr-check-lib.mjs`): a `javascript:`, `file:` or `data:` address (`data:` is fine in a poster) and a `formaction` to `http://` are errors; a `ping` to `http://` and one of these attributes on a tag that ignores it are warnings. Card `T-0157` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a snippet pasted by hand or an old Blogger post with `formaction="javascript:..."` or a `file:` address in one of these attributes stops the build when it is published, because that address would run code or point to the reader's own disk. Write a real https address; the message names the page. An attribute on a tag that ignores it only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0157 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.158
- Phase 3c Part 8bf built: the build gate (`validate-html.mjs`) checks the doctype of every built page (`doctype-check-lib.mjs`): no `<!doctype html>`, a mistyped one (`<!doctyp html>`, `<doctype html>`), one that does not come first and one with a name other than `html` are errors; an old identifier, a second doctype and a comment before it are warnings. Card `T-0156` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a page pasted by hand or an old Blogger page without `<!doctype html>` on its first line stops the build when it is published, because the browser would draw it in quirks mode with no message. Put `<!doctype html>` first; the message names the page. An old identifier or a comment before the doctype only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0156 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.157
- Phase 3c Part 8be built: the build gate (`validate-html.mjs`) checks the event handler attributes of every built page (`handler-check-lib.mjs`): an `on...` attribute that is a typo of a real event (`onclik`) and handler code that is not valid JavaScript (a bracket or a quote never closed) are errors; an empty handler and code that starts with `javascript:` are warnings. A working inline handler passes quietly. Card `T-0155` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a post or a snippet pasted by hand with `onclik="..."` or an `onclick` whose code has a missing bracket stops the build when it is published, because the browser would never run it and shows no message. Fix the attribute; the message names the page. An empty handler only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0155 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.156
- Phase 3c Part 8bd built: the build gate (`validate-html.mjs`) checks the `<style>` blocks of every built page (`style-block-lib.mjs`): a `{` never closed, a `}` with no opening one, a `{` with no selector, a comment or a quote never closed, and in each rule the same faults as a style attribute (no colon, a property typo, a number with no unit, a bad hex color, two declarations joined with no semicolon) are errors; an empty `<style>` block is a warning. Card `T-0154` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a post or a snippet pasted by hand with a `<style>` block that lacks a closing brace, or has `width:300` or `backgroud:red` in a rule, stops the build when it is published, because the browser would drop that rule, and the ones after it, with no message. Fix the block; the message names the page and the rule. An empty `<style>` block only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0154 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.155
- Phase 3c Part 8bc built: the build gate (`validate-html.mjs`) checks the style attributes of every built page (`style-attr-lib.mjs`): a declaration with no colon or no value, a property that is a typo of a real one (`backgroud`), a number with no unit in a length (`width:300`), a unit or a keyword that is a typo (`10xp`, `position:abosolute`), a hex color that is not 3, 4, 6 or 8 digits, a bracket or a quote never closed, a pasted rule and two declarations joined with no semicolon are errors; an empty style attribute, `expression(` and the same property twice with the same value are warnings. Card `T-0153` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post, or a snippet pasted by hand, with `style="width:300"`, a color such as `#12345` or a property written `backgroud` stops the build when it is published, because the browser would ignore that style with no message. Fix the style; the message names the page. An empty style attribute only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112 to T-0153 (all but the closed ones) wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.154
- Phase 3c Part 8bb built: the build gate (`validate-html.mjs`) checks the structured data blocks (`application/ld+json`) of every built page (`jsonld-check-lib.mjs`): a script type that is a typo of `application/ld+json`, a block that is not valid JSON, an `@type` that is a typo of a real schema.org type (`NewsArtcle`) or has the wrong capital letters, and a `datePublished` or `dateModified` that is not a real ISO date are errors; an empty block, a node with no `@context` or `@type`, an `@context` that is not `https://schema.org`, an HTML entity (`&amp;`) in a text and a `dateModified` before the `datePublished` are warnings. Card `T-0152` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post, or a snippet pasted by hand, with a structured data block that is broken JSON, a type written `application/ld-json` or a date such as `20 November 2026` stops the build when it is published, because search engines would ignore that data with no message. Fix the block; the message names the page. A node with no `@context` or an `&amp;` in a text only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146, T-0147, T-0148, T-0149, T-0150, T-0151 and T-0152 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.153
- Phase 3c Part 8ba built: the build gate (`validate-html.mjs`) checks the share tags of every built page (`share-check-lib.mjs`): a tag name that is a typo of a real one (`og:titel`, `twiter:card`), a `twitter:card` or `og:type` that is a typo of a real value (`summary_large_img`, `artcle`), an `og:image:width` or `og:image:height` that is not a whole number of pixels, an `og:locale` not written like `en_US`, an article time that is not a real ISO date and a `twitter:image` that is not a full address are errors; an empty content, a value no platform knows, an `og:locale` with only a language, an `http://` picture, a share tag written twice, an `og:` tag written with `name=` and a large image card with no picture are warnings. Card `T-0151` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post that carries `og:locale` as `en-US` or a card named `summary_large_img` stops the build when it is published, because the share card would break silently. Write `en_US` and `summary_large_image`; the message names the page. The same tag twice only warns.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146, T-0147, T-0148, T-0149, T-0150 and T-0151 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.152
- Phase 3c Part 8az built: the build gate (`validate-html.mjs`) checks the words of the robots meta tags of every built page (`robots-check-lib.mjs`): a word that is a typo of a real one (`noindx`), a wrong value of `max-image-preview`, `max-snippet` or `max-video-preview`, `follow` with `nofollow` and a meta name that is a typo of `robots` are errors; an empty content, an unknown word, a list with spaces and no commas and an old word such as `noodp` are warnings. Card `T-0150` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with `content="noindx"` or a robots name written `robot` stops the build when it is published, because that page would be indexed although you wanted it kept out. Write `noindex`; the message names the page. A list with spaces such as `noindex nofollow` only warns: write `noindex,nofollow`.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146, T-0147, T-0148, T-0149, T-0149 and T-0150 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.151
- Phase 3c Part 8ay built: the build gate (`validate-html.mjs`) checks the input rules of every built page (`input-rules-lib.mjs`): a `pattern` that is not a regular expression in any browser is an error; a pattern that only new browsers drop (the `v` flag), a `pattern`, `accept` or `multiple` on a field that does not read it and a `minlength` above the `maxlength` are warnings. Card `T-0149` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a broken `pattern` stops the build when it is published. Fix the pattern; the message names the page. A pattern such as `[\w-]+` only warns: write `[\w\-]+`.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146, T-0147, T-0148 and T-0149 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.150
- Phase 3c Part 8ax built: the build gate (`validate-html.mjs`) checks the language tags of links and subtitles of every built page (`langtag-check-lib.mjs`): an `hreflang` of a link that is not a language code and a `srclang` of a track that is not a language code are errors; an empty `hreflang` and a subtitles track with no `srclang` are warnings. Card `T-0148` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with `hreflang="english"` or `srclang="french"` stops the build when it is published. Write a real code such as `en` or `fr`; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146, T-0147 and T-0148 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.149
- Phase 3c Part 8aw built: the build gate (`validate-html.mjs`) checks the link targets of every built page (`target-check-lib.mjs`): a `target` or `formtarget` that starts with an underscore and is not `_blank`, `_self`, `_parent` or `_top` (`_blnk`, `_new`), and one of those words with a space around it, are errors; the plain word `blank`, `self`, `parent`, `top` or `new` with no underscore is a warning. Card `T-0147` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a link such as `target="_blnk"` or `target=" _blank"` stops the build when it is published. Write `_blank` exactly (with `rel="noopener"`); the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145, T-0146 and T-0147 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.148
- Phase 3c Part 8av built: the build gate (`validate-html.mjs`) checks the on/off attributes of every built page (`bool-check-lib.mjs`): `disabled`, `checked`, `selected`, `required`, `readonly`, `multiple`, `open`, `hidden`, `autoplay`, `async` and the other on/off attributes written as `false`, `0`, `no` or `off` are errors, because the browser still switches them on; any other value than nothing or the attribute's own name (`disabled="true"`) is a warning. Card `T-0146` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a field, a `<details>` or a script that carries an on/off attribute written as `false` stops the build when it is published. Delete the attribute (that is how you switch it off); the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144, T-0145 and T-0146 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.147
- Phase 3c Part 8au built: the build gate (`validate-html.mjs`) checks the id references of every built page (`ref-check-lib.mjs`): a name in `headers` of a cell, the `list` of an input, the `form` of a field, a name in `for` of an output and the `popovertarget` of a button that is not an id on the page are errors; a `headers` that is not a `<th>`, a `list` that is not a `<datalist>`, a `form` that is not a `<form>` and a `popovertarget` with no `popover` attribute are warnings. Card `T-0145` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a table cell whose `headers` names an id that is not in the table, or a field whose `list` or `form` names a missing id, stops the build when it is published. Add the missing id or remove the attribute; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143, T-0144 and T-0145 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.146
- Phase 3c Part 8at built: the build gate (`validate-html.mjs`) checks the image maps of every built page (`map-check-lib.mjs`): a `usemap` that is not `#` and a name or names a missing map, a `<map>` with no name, a name with a space or a repeated name, an `<area>` with an unknown shape, no `coords`, `coords` that are not numbers or of the wrong length and an `<area>` with an `href` and no `alt` are errors; a map that no picture uses, an `<area>` outside a `<map>` and an old shape name are warnings. Card `T-0144` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a clickable picture whose `usemap` names a map that is not in the post stops the build when it is published. Add the map or remove the `usemap`; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142, T-0143 and T-0144 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.145
- Phase 3c Part 8as built: the build gate (`validate-html.mjs`) checks the range values of every built page (`range-check-lib.mjs`): a `max` or `value` of a progress, a `min`, `max`, `low`, `high`, `optimum` or `value` of a meter and a `min`, `max` or `step` of a number or range field that is not a number are errors; a progress `max` of 0 or below, a value outside its range, a `min` above its `max`, a meter `low` above its `high` and a `step` of 0 or below are warnings. Card `T-0143` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a `<progress max="abc">` or a number field with `min="abc"` stops the build when it is published. Write a plain number; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141, T-0142 and T-0143 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.144
- Phase 3c Part 8ar built: the build gate (`validate-html.mjs`) checks the number attributes of every built page (`number-check-lib.mjs`): a `width` or `height` of a picture, video or canvas that is not a number, a `colspan`, `rowspan`, `span`, `rows`, `cols` or `size` that is not a whole number and an `ol` `start` or `li` `value` that is not a whole number are errors; a size written as `640px` or `100%`, a `colspan` or `span` out of range and a `rows`, `cols` or `size` of 0 are warnings. Card `T-0142` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with `width="auto"` on a picture or a table cell with a `colspan` that is not a number stops the build when it is published. Write a whole number; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140, T-0141 and T-0142 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.143
- Phase 3c Part 8aq built: the build gate (`validate-html.mjs`) checks every `<picture>` of every built page (`picture-check-lib.mjs`): a picture with no `<img>`, with more than one `<img>`, a `<source>` after the `<img>` and a `<source>` with no `srcset` are errors; a `<source>` with neither type nor media, a type that is not an image type and an empty media are warnings. Card `T-0141` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a pasted HTML block or an imported Blogger post with a broken `<picture>` stops the build when it is published. Add an `<img>` as the last child, put every `<source>` before it and give every `<source>` a `srcset`; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139, T-0140 and T-0141 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.142
- Phase 3c Part 8ap built: the build gate (`validate-html.mjs`) checks every inline `<svg>` of every built page (`svg-check-lib.mjs`): a script inside an svg, an svg `<use>` or `<image>` from `http://` and an `<svg role="img">` with no name are errors; an svg with no name that is not hidden, a hidden svg that has a name, an svg with a size and no `viewBox`, a `<foreignObject>` and a `<use>` to a missing id are warnings. Card `T-0140` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with an svg that holds a script or loads a picture from `http://` stops the build when it is published. Remove the script or use an https picture; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138, T-0139 and T-0140 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.141
- Phase 3c Part 8ao built: the build gate (`validate-html.mjs`) checks plug-in content of every built page (`object-check-lib.mjs`): Flash in an `<object>`, `<embed>` or `<param>` and an `<object>` or `<embed>` from `http://` are errors; any other `<object>` or `<embed>` is a warning. Card `T-0139` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: an old Blogger post with a Flash video or an `<embed>` stops the build when it is published. Replace the player with a video link or a YouTube iframe from the allow list; the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137, T-0138 and T-0139 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.140
- Phase 3c Part 8an built: the build gate (`validate-html.mjs`) checks the document settings of every built page (`meta-check-lib.mjs`): a character set other than UTF-8, a `<meta http-equiv="refresh">` with a delay over 0 seconds, a `<base href>` from `http://` and a second `<base>` are errors; a refresh of 0 seconds to an address, a `<base>` with no href and no target, a character set declared twice and a `<meta charset>` after the first 1024 bytes are warnings. Card `T-0138` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: do not paste a page refresh or a `<base>` into a post; for a moved page use the Redirect Manager. A refresh with a delay, a character set that is not UTF-8 or an `http://` base stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136, T-0137 and T-0138 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.139
- Phase 3c Part 8am built: the build gate (`validate-html.mjs`) checks the scripts and style sheets of every built page (`script-check-lib.mjs`): a script or a style sheet from `http://` and a `<script>` with an empty `src` are errors; a script `src` that also holds text, `async` or `defer` on an inline classic script, `nomodule` on a module, the same classic script loaded twice and `document.write(` are warnings. Card `T-0137` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you paste a script or a style sheet by hand, use an `https://` address. An `http://` address or an empty `src` stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135, T-0136 and T-0137 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.138
- Phase 3c Part 8al built: the build gate (`validate-html.mjs`) checks the forms of every built page (`form-behavior-check-lib.mjs`): a form that sends to `http://` and a password field in a form that sends with GET (the default when there is no method) are errors; a file field without `method="post"` and `enctype="multipart/form-data"`, a field with no name, a name used twice in one form, a lone radio button and a `select` with no `option` are warnings. Card `T-0136` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a form by hand, give every field a `name`, write `method="post"` when it holds a password, and use an `https://` address in `action`. A password in a GET form or an `http://` action stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134, T-0135 and T-0136 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.137
- Phase 3c Part 8ak built: the build gate (`validate-html.mjs`) checks every built page for a block tag opened inside a paragraph (`paragraph-check-lib.mjs`): a `div`, list, table, heading, figure, `pre`, `form` and the like inside a `<p>` is an error; a block tag or a `<p>` directly inside an inline tag (`span`, `b`, `em`, `strong`, `label` and the like) or a heading is a warning. Card `T-0135` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand or paste an old Blogger post, do not put a `div`, a list or a table inside a `<p>`; close the `<p>` first. A block inside a paragraph stops the build and the message names the page. A code sample that must show such a tag goes inside a `code` block, which this check leaves alone.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133, T-0134 and T-0135 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.136
- Phase 3c Part 8aj built: the build gate (`validate-html.mjs`) checks that ten tags of every built page sit inside their parent (`parent-check-lib.mjs`): an `li` outside `ul`, `ol` or `menu`, a `dt` or `dd` outside `dl`, an `option` outside `select`, `datalist` or `optgroup`, a `figcaption` outside `figure`, a `legend` outside `fieldset`, a `summary` outside `details`, a `source` outside `picture`, `video` or `audio` and a `track` outside `video` or `audio` are errors; a list with a direct child that is not an `li`, a `dl` with a stray child, a `details` with no `summary` and a `fieldset` with no `legend` are warnings. Card `T-0134` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand or paste an old Blogger post, put every `li` inside a `ul` or `ol`, every `figcaption` inside a `figure`, and every `option` inside a `select`. A loose one stops the build and the message names the page. A code sample that must show such a tag goes inside a `pre` or `code` block, which this check leaves alone.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132, T-0133 and T-0134 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.135
- Phase 3c Part 8ai built: the build gate (`validate-html.mjs`) checks the character references of every built page (`entity-check-lib.mjs`): a common reference escaped twice (`&amp;amp;`) and a numeric reference that is empty, 0, in the surrogate range or above 10FFFF are errors; a common name with no semicolon (`&nbsp`) and a reference to a control character or an old Windows code (`&#146;`) are warnings. Card `T-0133` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you paste text from an old Blogger post or write HTML by hand, write `&amp;` once (never `&amp;amp;`), end every name with a semicolon (`&nbsp;`), and use the real character (an apostrophe, a dash) instead of `&#146;` or `&#150;`. A double escape or a number that is not a character stops the build and the message names the page. A code sample that must show `&amp;` goes inside a `pre` or `code` block, which this check leaves alone.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131, T-0132 and T-0133 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.134
- Phase 3c Part 8ah built: the build gate (`validate-html.mjs`) checks that links, buttons and forms of a built page are not nested (`nest-check-lib.mjs`): a link in a link, a button in a button and a form in a form are errors; a button in a link, a link in a button and a field in a link or a button are warnings. Card `T-0132` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand in a post, never put a button or a link inside another link or button, and never start a form inside a form. A nested one stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130, T-0131 and T-0132 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.133
- Phase 3c Part 8ag built: the build gate (`validate-html.mjs`) checks the tags of every built page (`tag-check-lib.mjs`): a tag with the same attribute twice (`class="a" class="b"`) and a tag HTML has dropped (`marquee`, `blink`, `frame`, `applet`) are errors; an old tag (`center`, `font`, `big`) and an old attribute (`align`, `bgcolor`, `valign`) are warnings. Card `T-0131` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand in a post, give each tag every attribute only once, and use CSS instead of `<center>`, `<font>` and `align`. A repeated attribute or a dropped tag stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129, T-0130 and T-0131 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.132
- Phase 3c Part 8af built: the build gate (`validate-html.mjs`) checks the `srcset` and `sizes` of every picture of a built page (`srcset-check-lib.mjs`): an empty srcset, a descriptor that is not real (`400px`), a mix of `w` and `x`, the same descriptor twice, an `http://` address, an empty `sizes` and a `sizes` that does not end with a real length (`100%`) are errors; a `w` srcset with no `sizes` and a `sizes` that does nothing are warnings. Card `T-0130` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a picture by hand in a post, keep its `srcset` as `/name-400.jpg 400w, /name-800.jpg 800w` and add a `sizes` such as `100vw`; never write `sizes="100%"`. The hosted pictures get both from the site by themselves. A wrong value stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128, T-0129 and T-0130 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.131
- Phase 3c Part 8ae built: the build gate (`validate-html.mjs`) checks the input hints and the global fixed-choice attributes of every built page (`input-hints-lib.mjs`): an `autocomplete` word that is not a real field name (`firstname`, `zip`), and an `inputmode`, `enterkeyhint`, `autocapitalize`, `spellcheck`, `translate`, `contenteditable`, `draggable` or textarea `wrap` that is not a real value (`inputmode="number"`, `spellcheck="yes"`) are errors; `autocomplete="off"` on a password field is a warning. Card `T-0129` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a form field by hand in a post, use the real words: `autocomplete` is `name`, `given-name`, `email`, `tel` and so on, `inputmode` is `numeric` (not `number`), `spellcheck` is `true` or `false` (not `yes`). A wrong word stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127, T-0128 and T-0129 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.130
- Phase 3c Part 8ad built: the build gate (`validate-html.mjs`) checks the rel words and the preload hints of every built page (`rel-check-lib.mjs`): a rel word that is a typo of a real word (`noopner`, `nofolow`), a `<link>` that needs a file and has no `href`, and a `preload` with no `as` or a wrong one are errors; a font preload with no `crossorigin` and `rel="opener"` are warnings. Card `T-0128` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a link by hand in a post, use the exact words `noopener`, `noreferrer`, `nofollow`, `sponsored`. A word that is only a little wrong stops the build and the message names the page and the word it looks like.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126, T-0127 and T-0128 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.129
- Phase 3c Part 8ac built: the build gate (`validate-html.mjs`) checks the fixed-choice attributes of every built page (`attr-values-lib.mjs`): `loading`, `decoding`, `fetchpriority`, `referrerpolicy`, `crossorigin`, the `method` and `enctype` of a form and the `type` of an `ol` that hold a value that is not real (`loading="laz"`, `method="put"`) are errors; `referrerpolicy="unsafe-url"` is a warning. Card `T-0127` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a picture or a form by hand in a post, use only the real words: `loading` is `lazy` or `eager`, `fetchpriority` is `high`, `low` or `auto`, a form `method` is `get` or `post`. A wrong value stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125, T-0126 and T-0127 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.128
- Phase 3c Part 8ab built: the build gate (`validate-html.mjs`) checks the language code and the text direction of every built page (`lang-check-lib.mjs`): a `lang` or `xml:lang` that is not a language code (`english`, `en_US`) and a `dir` that is not `ltr`, `rtl` or `auto` are errors; a tag with a `lang` and an `xml:lang` that differ is a warning. Card `T-0126` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a quotation in another language by hand in a post, use the short code (`fr`, `es`, `bn`, `en-GB`), never the word (`french`) and never an underscore (`en_US`). A wrong value stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124, T-0125 and T-0126 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.127
- Phase 3c Part 8aa built: the build gate (`validate-html.mjs`) checks the type of every `<input>` and `<button>` and the length numbers of every built page (`form-controls-lib.mjs`): an input type that is not real (`emial`), a button type that is not submit, reset or button (`sumbit`) and a `maxlength` or `minlength` that is not a whole number are errors; a `<button>` inside a `<form>` with no type is a warning. Card `T-0125` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a form by hand in a post, give every button a type (`type="submit"` to send, `type="button"` for anything else) and use real input types such as `email`, `tel`, `url`, `number`. A wrong value stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123, T-0124 and T-0125 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.126
- Phase 3c Part 8z built: the build gate (`validate-html.mjs`) checks every `<time>` of every built page (`time-check-lib.mjs`): a `datetime` that is empty, not a real value or a date or time that does not exist (`2026-02-30`, `19/11/2026`) is an error; a `<time>` with no `datetime` and unreadable text is a warning. Card `T-0124` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write a date by hand in a post, use the form `2026-11-19`. Day first dates such as `19/11/2026` stop the build and the message names the page. Today's only post is a draft, so no real story page has been checked by this gate yet.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122, T-0123 and T-0124 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.125
- Phase 3c Part 8y built: the build gate (`validate-html.mjs`) checks the Tab key order of every built page (`tabindex-check-lib.mjs`): a `tabindex` that is not a whole number and a `tabindex` above 0 are errors; an `accesskey` and an `onclick` on a plain tag with no role are warnings. Card `T-0123` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand in a post, do not give a tag a `tabindex` above 0. Use 0 or -1. A wrong value stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121, T-0122 and T-0123 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.124
- Phase 3c Part 8x built: the build gate (`validate-html.mjs`) checks the ARIA words of every built page (`aria-check-lib.mjs`): a role that is not real, an `aria-` name that does not exist, a wrong value such as `aria-hidden="yes"`, `aria-hidden="true"` on `body` or `html`, and `aria-hidden="true"` on a link, button or field that the Tab key reaches are errors; an empty `aria-label`, `aria-hidden` around a link inside, `role="presentation"` on something the Tab key reaches and a role the tag already has are warnings. Card `T-0122` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: if you write HTML by hand in a post, do not put `aria-hidden="true"` on a link or button. A wrong word stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120, T-0121 and T-0122 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.123
- Phase 3c Part 8w built: the build gate (`validate-html.mjs`) checks every link address of every built page (`href-check-lib.mjs`): an empty href, a `javascript:`, `vbscript:` or `file:` address, a `mailto:` with no address and a `tel:` with no number are errors; `href="#"`, an `http://` link, a bare `www` address and a link to localhost are warnings. Card `T-0121` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: when you type a link by hand in a post, write the full `https://` address; `www.example.org` alone is read as a page of this site. A `javascript:` or empty link stops the build and the message names the page.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119, T-0120 and T-0121 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.122
- Phase 3c Part 8v built: the build gate (`validate-html.mjs`) checks every video and audio of every built page (`media-check-lib.mjs`): autoplay with sound, no controls (except a silent looping video) and an `http://` source are errors; no captions, no preload, no poster and no width and height are warnings. Card `T-0120` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: when you put a video or audio in a post, add `controls`, never `autoplay` with sound, and for a video a captions file (`track`). No public page has a video or audio today.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118, T-0119 and T-0120 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.121
- Phase 3c Part 8u built: the build gate (`validate-html.mjs`) checks every table of every built page (`table-check-lib.mjs`): a wrong `scope` and a `th` inside a layout table are errors; a table with no `th`, no caption and an empty `th` are warnings. Card `T-0119` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: when you put a table in a post, give it header cells (`th`) and a caption. A wrong `scope` stops the build; the message names the page. No public page has a table today.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117, T-0118 and T-0119 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.120
- Phase 3c Part 8t built: the build gate (`validate-html.mjs`) checks every iframe of every built page (`iframe-check-lib.mjs`): no name, an `http://` address and a `javascript:`, `data:` or `vbscript:` address are errors; a vague name, no lazy loading, no width and height, no sandbox on a frame from another website, an address with no scheme and no src or srcdoc are warnings. Card `T-0118` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: when you put an embed (video, map) in a post, the iframe now needs a `title` that says what is inside and an `https://` address, or the build stops. The message names the page and the address. No iframe is on the site today.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116, T-0117 and T-0118 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.119
- Phase 3c Part 8s built: the build gate (`validate-html.mjs`) checks the ids of every built page (`ids-lib.mjs`): an empty id, an id with a space and an id used twice are errors; an in-page link or an `aria-controls` or `aria-describedby` that points to a missing id is a warning. Card `T-0117` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: two things with the same id in one post (for example two inline SVG pictures with `id="a"`) now stop the build. The message names the page and the id.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115, T-0116 and T-0117 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.118
- Phase 3c Part 8r built: the build gate (`validate-html.mjs`) checks links that open a new tab (`new-tab-lib.mjs`): no `noopener` or `noreferrer` in `rel`, and a `base` tag with a new tab target, are errors; a link that never says "opens in a new tab" is a warning. Card `T-0116` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: when you write a post with a link that opens a new tab, the build now needs `rel="noopener"` on it. The message names the page and the address.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114, T-0115 and T-0116 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.117
- Phase 3c Part 8q built: the build gate (`validate-html.mjs`) checks that a reader can zoom (`zoom-check-lib.mjs`): `user-scalable=no`, a `maximum-scale` under 2 and a `touch-action` that stops pinch zoom on the whole page are errors; a `maximum-scale` from 2 up to 5 and `text-size-adjust: none` are warnings. Card `T-0115` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- The check reads the viewport tag and the style text. Pinch zoom the live site once on a real phone.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U); a check that links which open a new tab keep `rel="noopener"`. Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113, T-0114 and T-0115 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.116
- Phase 3c Part 8p built: the build gate (`validate-html.mjs`) checks that nothing is made wider than a 320px phone screen (`side-scroll-lib.mjs`): a fixed `width` or `min-width` over 320px with no cap is an error, in the style and in inline styles; `100vw`, an unprotected `nowrap`, pictures with no `max-width: 100%` rule and `pre` blocks that cannot scroll are warnings. One real fix came with it: the site name in the header (`.brand`) is cut with an ellipsis if it is ever very long. Card `T-0114` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- The check reads the style text, it does not draw a page. Open the site on a real phone (or a 320px window) once, in light and dark mode, and look for a sideways scroll. A long word, a wide table or a wide picture inside a real story is not proved until the first story (T-0002) is published.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key. Cards T-0112, T-0113 and T-0114 wait in `review`.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.115
- Phase 3c Part 8o built: the build gate (`validate-html.mjs`) checks where the landmarks sit (`landmarks-lib.mjs`): the h1 inside `main`, no `main` inside another landmark, and a story page with exactly one `article` inside `main` with the h1 inside it. Broken ones are errors; an unlabelled `aside` is a warning. Card `T-0112` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- The owner's new logo is in place (card `T-0113`, yellow, status `review`): the source file, every icon size, the notification badge and the default share picture. `icon-512.png` (233 KB) and `og-default.png` (315 KB) are heavy for a logo shown at 38 pixels; say if you want them made smaller. Nobody has looked at the icons on the live site yet.
- For the owner: today's site has no published story page, so the article rule of Part 8o has not run on a real story. Publish the first story (T-0002) and run the build again.
- Not started, same kind of small part: "no horizontal scroll on 320 px" is not checked yet; and the checks that need a real post with pictures (BUGS group U). Say which one you want next.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.114
- Phase 3c Part 8n built: the build gate (`validate-html.mjs`) checks the head of every built page (`head-check-lib.mjs`): a title, one full canonical, a robots tag that does not contradict itself, and the share tags (og:title, og:url, og:image). Broken ones are errors; long titles and descriptions, a canonical on http, a missing og:image, twitter:card or theme-color, and indexable pages with one shared title are warnings. Card `T-0111` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: today's site passes with no new message. If a message ever names a title or a robots value, changing it changes what Google shows, so it waits for your yes. The length limits (title 70, description 160) are warnings and follow decision 13 (still open).
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U); "no horizontal scroll on 320 px" and "article landmark on a post page" are not checked yet. Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.113
- Phase 3c Part 8m built: the menu drawer titles are `p` tags (not `h3`) and the cards on category, tag and author pages are `h2`, so every page starts with its `h1` and the 17 heading warnings are gone. Card `T-0110` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: look at the menu drawer on a phone once; the two small titles should look exactly as before.
- Not started, same kind of small part: the checks that need a real post with pictures (BUGS group U). They need one published post with a picture to be proved. Say which one you want next.
- Still to do in Part 8: those BUGS (group U) checks. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.112
- Phase 3c Part 8l built: the `.dot` colour style buttons in the menu drawer are 44px (was 38px), one line in `site/src/styles/global.css`. The tap target warning is gone from the build. Card `T-0109` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: look at the menu drawer on a phone once; the five buttons are 6px bigger each.
- Not started, same kind of small part: the two template fixes for the 17 heading warnings (they change the look, so they wait for your yes or no), and the checks that need a real post with pictures. Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.111
- Phase 3c Part 8k built: the build gate (`validate-html.mjs`) checks the contrast of text colours in the built style. The colour tokens (`--text`, `--muted`, `--acc-t` on `--bg` and `--card`, and white on `--acc`) must keep 4.5:1 in every look (light, dark, each colour style); a rule with a text colour and a solid background is an error under 3:1 and a warning under 4.5:1. Card `T-0108` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: today's site passes with no new message. A new weak colour in the style will stop the build, which is the point. If a message ever names a colour token, changing the colour changes the look, so it waits for your yes.
- Not started, same kind of small part: the `.dot` size (38px to 44px, one line in `site/src/styles/global.css`) and the two template fixes for the 17 heading warnings (they change the look, so they wait for your yes or no), and the checks that need a real post with pictures. Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.110
- Phase 3c Part 8j built: the build gate (`validate-html.mjs`) checks the size of buttons, links, menu summaries and fields in the built style. Drawn under 24px is an error; drawn under 44px is a warning. Card `T-0107` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: the build now prints one new warning: the colour style buttons in the menu drawer (`.dot`) are 38px by 38px, and the site's own rule for touch is 44px. Nothing breaks. Making them 44px is a one line change in `site/src/styles/global.css`, but it changes the look of the drawer (it must be checked on a phone), so it waits for your yes or no. The 17 heading warnings of v0.101.109 are still there (the two templates are not changed).
- Not started, same kind of small part: the contrast of text colours in the built style (today only the colour tokens are tested, in `tests/unit/contrast.test.ts`). Say if you want it next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.109
- Phase 3c Part 8i built: the build gate (`validate-html.mjs`) checks the headings of every built page. An empty heading is an error. Headings before the h1 and a skipped level after it are warnings only. Card `T-0106` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: the build now prints 17 warnings, one per page. The cause is the menu drawer: two `h3` headings ("Categories", "Colour style") come before the `h1` of every page (`site/src/components/Header.astro`). When the first real post is published, the pages of a category, a tag and an author will also warn, because the post card is an `h3` straight after the `h1` (`site/src/components/PostCard.astro`). Nothing breaks and nothing is shown to readers; it is an outline problem for screen readers. A small card can fix both templates (it changes `site/src/components/`, so the look must be checked). Say yes or no.
- Not started, same kind of small part: the contrast of text colours in the built style, and the size of tap targets on phones. Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.108
- Phase 3c Part 8h built: the build gate (`validate-html.mjs`) checks that every link, button and input button has a name (text, a picture alt, a svg title, an aria-label, or an aria-labelledby to an element of the page); text inside `aria-hidden` does not count; a link with no name or a button with no name is an error; a vague text such as "click here" or "read more" alone is a warning. Card `T-0105` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: today's site passes (382 links and 90 buttons on 17 built pages). A new icon only link or button without an `aria-label` will stop the build, which is the point.
- Not started, same kind of small part: the order of headings (no jump from h2 to h4). Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.107
- Phase 3c Part 8g built: the build gate (`validate-html.mjs`) checks that every form field has a label (a label with text that points to it or wraps it, an aria-label, or an aria-labelledby to an element of the page); a placeholder alone is an error; a label that points to a missing id is a warning. This answers the POLISH line "Forms have labels". Card `T-0104` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: the two forms of the site today (the contact form and the notification page) already pass. A new form without labels will stop the build, which is the point.
- Not started, same kind of small part: buttons and links with no name (an icon only button needs an aria-label), and the order of headings. Say which one you want next.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0009. T-0003 (time zone) is done in the files and waits in `review` for a second key.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.106
- Phase 3c Part 8f built: the build gate (`validate-html.mjs`) checks the fonts: every font face has `font-display` swap, fallback or optional; no font file or import comes from another website and no page links to a font website (errors); more than four font faces gives a warning. This answers the POLISH line "Fonts self-hosted, font-display: swap, one or two weights". Card `T-0103` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: the site uses four faces today (two families, two weights each). That is exactly the warning limit; a fifth face will print a warning, not stop the build.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.105
- Phase 3c Part 8e built: the build gate (`validate-html.mjs`) checks the final style: a print rule, a visible focus ring and a reduced motion rule when the style moves things (errors). This answers the POLISH lines about the print stylesheet, the focus ring and `prefers-reduced-motion`. Card `T-0102` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.104
- Phase 3c Part 8d built: the build gate (`validate-html.mjs`) checks the basics of every built page: `lang`, viewport, skip link to `#main`, an element with id `main`, exactly one `main`, a header and a footer (errors), and an unlabelled `nav` when there are several (warning). This answers the POLISH lines about the skip link and the landmarks. Card `T-0101` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.103
- Phase 3c Part 8c built: the build gate (`validate-html.mjs`) checks that every thumbnail (class `thumb`) says a width and height of 16:9 (error) and that the style of `.thumb` keeps `aspect-ratio: 16/9` and `object-fit: cover` (error, only when some page has a thumbnail). This answers the POLISH line "image ratio 16:9 everywhere, no stretched images". Card `T-0100` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: the checks look at the class `thumb` only (the cards and the top picture of an article). A picture you place by hand in the text of a post is not forced to 16:9, because a text picture may be any shape.
- Still to do in Part 8: the BUGS (group U) checks that need a real post with pictures (a build with real posts has no outside picture). Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet; no real post with pictures has been built with the new gate.

## Open Items After v0.101.102
- Phase 3c Part 8b built: the build gate (`validate-html.mjs`) checks the loading of the pictures of every built page: the top picture of an article must have `fetchpriority="high"` and must not be lazy (error), a picture must not be both (error), only one picture should have the high priority (warning), the other article pictures should be lazy (warning). Card `T-0099` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- For the owner: a picture you place by hand in the text of a post gets a warning on its article page until it has `loading="lazy"`. The warning does not stop the build.
- Still to do in Part 8: the 16:9 check of the cards (needs the style, not only the HTML), the hero preload line in the page head (decision: the `fetchpriority` attribute already does the job, a `link rel=preload` would only be needed for a picture set by CSS), and the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet; no real post with pictures has been built with the new gate.

## Open Items After v0.101.101
- Phase 3c Part 8a built: the build gate (`validate-html.mjs`) checks every built page for pictures with no `alt` attribute (error), `http://` pictures (error), pictures from another website (warning) and pictures with no width or height (warning). Card `T-0098` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- IMPORTANT for the owner: from now on a post whose picture has no alt attribute (the article page or a card) or an `http://` picture stops the Cloudflare build until it is fixed. Add alt text in the post or in the Files screen. An empty `alt=""` is allowed for a decoration.
- Still to do in Part 8: the rest of the POLISH checks (hero picture preload, 16:9 cards) and the BUGS (group U) checks that need a real post with pictures. Part 7 still has the R2 option and the `_headers` rule for `/media/*` (not the immutable header before decision 50). Part 6b waits for the owner's secret and the images Worker.
- Still open for the owner: decisions 15, 24 and 50, and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet; no real post with pictures has been built with the new gate.

## Open Items After v0.101.100
- Phase 3c Part 7ae built: `npm run check:content` warns when `site/public/media/` is above 900 MB (BUGS U12). Fixed value, a warning only, no setting. Card `T-0097` is in `tasks/open/` with status `review`; it is a red card (it touches `package.json`), so only the owner closes it.
- Still to do in Part 7: the R2 option (`storage`; decision 15; the warning above tells the owner when it is time) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker. Part 8: the POLISH and the rest of the BUGS (group U) checks.
- Still open for the owner: decision 24 (the picture settings Save: straight to `main` or a pull request) and the owner tasks T-0001, T-0002, T-0003, T-0009.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.99
- Phase 3c Part 7ad built: the Picture settings screen of the dashboard has a `Save picture settings` button under the form. It writes `config/images.json` in one commit through `saveImagesSettings` (Part 7ac), only when every value is right, stops when the file was changed by someone else after the page was opened, writes nothing when the file already says the same, and shows plain fixed sentences. The screen is drawn again after a save. A file that lacks some keys is completed with the shipped values when Save is pressed. Card `T-0096` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT for the owner: the form can now change `quality`, `nameOrder`, `askFirst`, `askHosts`, `blockHosts`, `allowHosts` and `enabled`, and the Save of the editor reads them (Parts 7k to 7ab), so a saved value changes how NEW pictures are handled as soon as picture hosting runs (it still needs the images Worker and `imagesUrl`). `maxWidth`, `sizeWarnKb` and `hardBlock` change only the build check. `storage` set to `r2` changes nothing yet (R2 is not built).
- Open question for the owner (decision 24, not blocking): the button writes straight to `main`, like the ads, links, redirects and robots settings. Should the picture settings go through a pull request instead? One place to change: `imagesView` in `app.js`.
- Still to do in Part 7: the R2 option (`storage`; decision 15) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker. Part 8: the POLISH and BUGS (group U) checks.
- Not verified live: no GitHub run of the validate workflow with this change yet; the button has not been tried in the real dashboard.

## Open Items After v0.101.98
- Phase 3c Part 7ac built: `site/public/admin/js/images-save.js` (`saveImagesSettings`) checks the values of the picture settings form and writes `config/images.json` in one commit (one `gh.put` with the sha just read, the way the other dashboard settings are saved). It writes nothing when the file already says the same, stops when the file changed after the form was opened (`loadedText`), stops on any wrong value, and answers every failure with a fixed plain sentence. Nothing calls it yet: no button, so the dashboard and the live site do not change. Card `T-0095` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- Open question for the owner (decision 24, not blocking this part): the new function writes straight to the branch of `admin/config.json`, like the ads, links, redirects and robots settings. Should the picture settings go through a pull request instead? Nothing is wired, so either answer is easy to follow.
- Still to do in Part 7: the button on the Picture settings screen that calls `saveImagesSettings` (with `loadedText`), the check and a refresh of the screen after the save, the R2 option (`storage`; decision 15) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the save has not been tried with the real GitHub.

## Open Items After v0.101.97
- Phase 3c Part 7ab built: the Save of the editor reads the `allowHosts` of `config/images.json` and adds those websites to our own websites, so a picture from them is not an outside picture: it is not fetched and not hosted, and the Save goes on as before. The match is the exact website name ("www." ignored); a sub name is still checked and hosted (the build check also counts sub names, so the Save is stricter). A name that is the same as, a sub name of, or a parent name of an agency website (dashboard list, starting list, `askHosts`) or a blocked website is ignored, so the list can never let an agency or blocked picture through. The shipped list is empty; a missing file, a wrong list and a broken file change nothing. Card `T-0094` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality`, `enabled`, `nameOrder`, `askHosts`, `askFirst`, `blockHosts` and `allowHosts`. No code uses `storage` yet; `sizeWarnKb`, `maxWidth` and `hardBlock` are build-check settings only. The switch `enabled` stops only the Save. When the caller gives a `quality`, the file is not read, so the shipped naming order, empty lists and `askFirst` false are used unless the caller gives them (the dashboard gives none today).
- Open question for the owner (not blocking): should the Save also count SUB names of an `allowHosts` website as ours, like the build check does? Today it does not (more careful).
- Still to do in Part 7: the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the R2 option (`storage`; decision 15) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; `allowHosts` has not been tried in the real dashboard.

## Open Items After v0.101.96
- Phase 3c Part 7aa built: the Save of the editor reads the `blockHosts` of `config/images.json` and adds those websites to the block list (the dashboard list `blockHosts`, or an empty list), so a picture from them (and from their sub names and `www.` name) is refused: it is not fetched and not hosted, and the writer sees "The owner blocked this host." with the Replace action. Nothing is removed from the dashboard list. The shipped list is empty; a missing file, a wrong list and a broken file change nothing. Card `T-0093` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality`, `enabled`, `nameOrder`, `askHosts`, `askFirst` and `blockHosts`. No code in the Save uses `allowHosts` or `storage` yet. The switch `enabled` stops only the Save. When the caller gives a `quality`, the file is not read, so the shipped naming order, an empty `askHosts`, `askFirst` false and an empty `blockHosts` are used unless the caller gives them (the dashboard gives none today).
- Still to do in Part 7: `allowHosts` in the Save (websites counted as ours; own card), the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the R2 option (`storage`) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; `blockHosts` has not been tried in the real dashboard.

## Open Items After v0.101.95
- Phase 3c Part 7z built: the Save of the editor reads `askFirst` of `config/images.json` and, when it is the real value `true`, every outside picture that is not hosted yet waits for the writer to confirm (PLAN 34.10). Pictures that are already hosted are reused, refused addresses stay refused, and a picture the writer confirmed is hosted. A picture that waits only because of ask first shows its own sentence; agency pictures still show the agency sentence. The shipped value is `false`; `false`, a wrong value, a missing file and a broken file change nothing. Card `T-0092` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality`, `enabled`, `nameOrder`, `askHosts` and `askFirst`. No code uses `storage` yet. The switch `enabled` stops only the Save. When the caller gives a `quality`, the file is not read, so the shipped naming order, an empty `askHosts` and `askFirst` false are used unless the caller gives them (the dashboard gives none today).
- Still to do in Part 7: the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the R2 option (`storage`) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; `askFirst` has not been tried in the real dashboard.

## Open Items After v0.101.94
- Phase 3c Part 7y built: the Save of the editor reads the `askHosts` of `config/images.json` and adds those websites to the agency list (PLAN 34.5), so a picture from them is not hosted until the writer confirms the rights. They are added to the dashboard list `agencyHosts` or to the starting list of `hosted-meta.js`; nothing is removed. The shipped list is empty, a missing file, a wrong list and a broken file change nothing. Card `T-0091` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality`, `enabled`, `nameOrder` and `askHosts`. No code uses `askFirst` or `storage` yet. The switch `enabled` stops only the Save. When the caller gives a `quality`, the file is not read, so the shipped naming order and an empty `askHosts` are used unless the caller gives them (the dashboard gives none today).
- Still to do in Part 7: the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the Save using `askFirst` (every picture waits for the writer), the R2 option (`storage`) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the list has not been tried in the real dashboard.

## Open Items After v0.101.93
- Phase 3c Part 7x built: the Save of the editor reads the `nameOrder` of `config/images.json` and gives it to the picture names (PLAN 34.4). A valid order that differs from the shipped one changes how NEW pictures are named (the ways are tried in the order of the file; a way that is not in the list is skipped; `handle` is always the last fallback). The shipped order, a missing file, a wrong order and a broken file give the names as before. Card `T-0090` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality`, `enabled` and `nameOrder`. No code uses `askHosts`, `askFirst` or `storage` yet. The switch `enabled` stops only the Save; it does not stop the Media screens or the build check. When the caller gives a `quality`, the file is not read, so the shipped naming order is used unless the caller gives one (the dashboard gives none today).
- Still to do in Part 7: the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the Save using `askFirst` and `askHosts`, the R2 option (`storage`) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the order has not been tried in the real dashboard.

## Open Items After v0.101.92
- Phase 3c Part 7w built: the Save of the editor reads the switch `enabled` of `config/images.json`. `"enabled": false` stops picture hosting for the Save (it goes on as before, the post keeps its outside pictures); every other value, a missing file or a broken file leaves hosting on. The shipped value is `true`, so nothing changes until the owner sets it. Card `T-0089` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads `quality` and `enabled`. No code uses `askHosts`, `nameOrder`, `askFirst` or `storage` yet. Pictures are named and hosted as before. The switch stops only the Save; it does not stop the Media screens or the build check.
- Still to do in Part 7: the save of the settings form to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the Save using `askFirst`, `askHosts` and `nameOrder`, the R2 option (`storage`) and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the switch has not been tried in the real dashboard.

## Open Items After v0.101.91
- Phase 3c Part 7v built: the Picture settings screen of the dashboard (`#/images`, admins only) now has the form of Part 7u under the read only list. The admin can type and see the sentences, the changes and the new file text. There is NO save: nothing is written to GitHub. Card `T-0088` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it. The owner should open the dashboard once after the deploy and try the form (not verified live).
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads only `quality`. No code uses `enabled`, `nameOrder`, `askHosts`, `askFirst` or `storage` yet. Pictures are named and hosted as before. To change a setting now, edit `config/images.json` by hand (the form shows the text to use).
- Still to do in Part 7: the save to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call, the check after the save and a refresh of the screen), the Save and the build using the other settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the form has not been looked at in a real browser.

## Open Items After v0.101.90
- Phase 3c Part 7u built: `site/public/admin/js/images-form-screen.js` draws the form of the picture settings with the sentences for wrong values, the list of changes and the new file text (`imagesFormScreen`). It has no save and no button, and nothing calls it yet (it is not on the Picture settings screen). Card `T-0087` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads only `quality`. No code uses `enabled`, `nameOrder`, `askHosts`, `askFirst` or `storage` yet. Pictures are named and hosted as before.
- Still to do in Part 7: put the form on the Picture settings screen (`app.js`), the save to GitHub (needs decision 24, the write mode: a pull request or straight to `main`; the save button, the `commit` call and the check after the save), the Save and the build using the other settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet; the form has not been looked at in a real browser.

## Open Items After v0.101.89
- Phase 3c Part 7t built: `site/public/admin/js/images-form.js` has the logic of the picture settings form (`imagesFromForm`, `imagesFileText`, `imagesChanges`, `imagesFormValues`), strict, with the same rules as the build check. Nothing calls it yet. Card `T-0086` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads only `quality`. No code uses `enabled`, `nameOrder`, `askHosts`, `askFirst` or `storage` yet. Pictures are named and hosted as before.
- Still to do in Part 7: the form page on the Picture settings screen (inputs, the list of changes, a save button; `app.js` and `admin.css`), the save to GitHub (needs decision 24, the write mode: a pull request or straight to `main`), the Save and the build using the other settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.88
- Phase 3c Part 7s built: the dashboard has a new menu item **Picture settings** (`#/images`, admins only) that shows the eleven settings of `config/images.json` in plain words, read only (`imagesView` in `app.js`, the screen of Part 7r). Card `T-0085` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it. The owner should open the dashboard once after the deploy and look at the screen (not verified live).
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads only `quality`. No code uses `enabled`, `nameOrder`, `askHosts`, `askFirst` or `storage` yet. The screen says this in words next to each setting. Pictures are named and hosted as before.
- Still to do in Part 7: a form to change `config/images.json` (needs decision 24, the write mode, and its own card), the Save and the build using the other settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.87
- Phase 3c Part 7r built: `site/public/admin/js/images-screen.js` draws the eleven picture settings in plain words, read only (`imagesRows`, `imagesScreen`). It is not in the dashboard menu yet. Card `T-0084` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: the build check reads `hardBlock`, `blockHosts`, `allowHosts`, `sizeWarnKb` and `maxWidth`; the Save of the editor reads only `quality`. No code uses `enabled`, `nameOrder`, `askHosts`, `askFirst` or `storage` yet. The screen says this in words next to each setting. Pictures are named and hosted as before.
- Still to do in Part 7: put the screen in the dashboard menu (`app.js`; the next small part), then a form to change `config/images.json`, the Save and the build using the other settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.

## Open Items After v0.101.86
- Phase 3c Part 7q built: `site/public/admin/js/images-setting.js` can now read every setting of `config/images.json` (`readImagesSettings`), each one checked alone with its shipped value as the fallback. Nothing calls it yet. Card `T-0083` is in `tasks/open/` with status `review`; it is a red card (it touches `public/admin/`), so only the owner closes it.
- IMPORTANT: no code uses `enabled`, `nameOrder`, `askHosts`, `askFirst`, `storage` or the host lists yet; only `quality` is used by the Save. Pictures are named and hosted as before.
- Still to do in Part 7: the settings screen (read only first, then a form to change `config/images.json`), the Save and the build using the settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.85" still stands (including the `enabled` default decision, the `handle` rule decision, the Terms law decision and the `/sitemap/` live check).

## Open Items After v0.101.85
- Phase 3c Part 7p built: `site/config/images.json` now also has `enabled` (shipped `true`) and `checkImagesConfig` checks it: `true` or `false` passes, anything else fails `npm run check:content`. All the settings of PLAN 34.10 now exist in the file (on or off, automatic or ask first, size, width, quality, storage, agency list, allow and block lists, hard block, naming order). Card `T-0082` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- DECISION FOR THE OWNER (small): the shipped value `enabled: true` is my choice. If you want hosting off until the images Worker is deployed, say so and it will be `false`. Today nothing reads it.
- IMPORTANT: nothing reads `enabled`, `nameOrder`, `askHosts` or `askFirst` yet. Pictures are named and hosted as before.
- Still to do in Part 7: the settings screen (the dashboard form for `config/images.json`), making the build and the dashboard read the new settings, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.84" still stands (including the `handle` rule decision, the Terms law decision and the `/sitemap/` live check).

## Open Items After v0.101.84
- Phase 3c Part 7o built: `site/config/images.json` now also has `nameOrder` (shipped as the six ways of PLAN 34.4 in its order) and `checkImagesConfig` checks it: only the six words, each once, ending with `handle`. A missing key is fine. Card `T-0081` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- DECISION FOR THE OWNER (small): the rule "the list must end with handle" is my choice, so a name can always be made. If you do not want it, say so and it will be removed.
- IMPORTANT: nothing reads `nameOrder`, `askHosts` or `askFirst` yet. Pictures are named and hosted as before.
- Still to do in Part 7: the on or off setting of PLAN 34.10, the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.83" still stands (including the Terms law decision and the `/sitemap/` live check).

## Open Items After v0.101.83
- Phase 3c Part 7n built: `site/config/images.json` now also has `askHosts` (shipped `[]`) and `checkImagesConfig` checks it like the other host lists; a name in both `askHosts` and `blockHosts` fails `npm run check:content`. A missing key is fine. Card `T-0080` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: nothing reads `askHosts` or `askFirst` yet. Pictures are hosted as before. Do not fill the list expecting a result.
- Still to do in Part 7: the naming order and on or off settings of PLAN 34.10, the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.82" still stands (including the Terms law decision and the `/sitemap/` live check).

## Open Items After v0.101.82
- Phase 3c Part 7m built: `site/config/images.json` now also has `askFirst` (shipped `false` = automatic) and `checkImagesConfig` checks it: `true` or `false` passes, anything else (text, a number, `null`, a list) fails `npm run check:content` with one plain sentence. A missing key is fine. Card `T-0079` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: nothing reads `askFirst` yet. Pictures are hosted as before. Do not change the value expecting a result.
- Still to do in Part 7: the other settings of PLAN 34.10 (the agency host list, the naming order, on or off), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.81" still stands (including the Terms law decision and the `/sitemap/` live check).

## Open Items After v0.101.81
- The publisher country is now India (`site/config/publisher.json`, About Us and Ownership and Funding). The audience stays the USA (the site description and share picture text say U.S. news).
- DECISION NEEDED from the owner: the "Law" sentence of `terms-and-conditions.md` still says "These terms follow the laws of US." Which country's law should the terms follow: the USA (the audience), India (the office), or another wording? This is legal text, so an AI does not choose it. Until the owner answers, the page is unchanged.
- Live check: the HTML sitemap (`/sitemap/`) showed "Nothing to list yet" on the live site on 2026-11-18 although the footer listed the twelve pages and a local build lists them. Probably an old deploy or an old cached copy; look at it again after the next deploy.
- Everything under "Open Items After v0.101.80" still stands.

## Open Items After v0.101.80
- Phase 3c Part 7l built: `site/config/images.json` now also has `storage` (shipped `"repo"`) and `checkImagesConfig` checks it: the text `"repo"` or `"r2"` passes, anything else (a number, `true`, `"s3"`, capital letters) fails `npm run check:content` with one plain sentence. A missing key is fine. Card `T-0077` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: nothing reads `storage` yet. Pictures always go to the repository. `"r2"` passes the check only so the owner can write it in the future; it does NOT switch on R2 (R2, its Worker binding and decision 15 are not built). Do not change the value expecting a result.
- Still to do in Part 7: the other settings of PLAN 34.10 (the "ask first" agency list, the naming order, on or off and automatic or ask first as settings of this file), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.79" still stands.

## Open Items After v0.101.79
- Phase 3c Part 7k built: the Save of the editor now reads `quality` from `site/config/images.json` and passes it to the picture steps. `runHostingSave` (hosting-hook.js) reads the file only when picture hosting is on (`imagesUrl` in `site/public/admin/config.json`) and no quality was given; `startHostingSave` (hosting-save.js) passes it to `hostingSetup`. A missing file, bad JSON or a bad number gives the old fixed 85. A quality given by the caller, or inside `optimizeDeps`, wins over the file. Card `T-0076` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: the number in `config/images.json` now changes the quality of NEW hosted pictures (and their smaller copies when `imageCopies` is true). Pictures that are already hosted are not changed. Picture hosting is still OFF in the shipped `admin/config.json` (no `imagesUrl`), so nothing happens on the live site until the owner switches it on.
- Known gap (safe): the file is read on every Save while hosting is on, even for a post with no outside picture (one small GitHub read); it is not cached.
- Still to do in Part 7: the other settings of PLAN 34.10 (storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow and no real browser run with this change yet.
- Everything under "Open Items After v0.101.78" still stands, except that the Save now reads the `quality` setting.

## Open Items After v0.101.78
- Phase 3c Part 7j built: the dashboard code that reads `quality` from `site/config/images.json` now exists (`site/public/admin/js/images-setting.js`), and `hostingSetup` (hosting-setup.js) accepts the number as `quality` and passes it to the picture step and the smaller-copies step. A missing file, a bad file or a bad number gives the old fixed 85, so pictures are made exactly as before. Card `T-0075` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: changing `quality` in `config/images.json` still does nothing to pictures today, because the Save of the editor does not call the reader yet. Do not change the number expecting a result. The next part makes the Save read the setting and pass it on.
- Still to do in Part 7: the Save reading the setting (the wiring in `app.js` or `hosting-hook.js`), the other settings of PLAN 34.10 (storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow and no real browser run with this change yet.
- Everything under "Open Items After v0.101.77" still stands, except that the reader of the `quality` setting now exists (not yet connected to the Save).

## Open Items After v0.101.77
- Phase 3c Part 7i built: `site/config/images.json` now also has `quality` (shipped `85`, a whole percent from 1 to 100) and `checkImagesConfig` checks it. Card `T-0074` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- IMPORTANT: changing `quality` does nothing to pictures yet, because the dashboard does not read `config/images.json`. Do not change the number expecting a result; the only effect today is that a wrong value fails `npm run check:content`. The next part makes the dashboard read the file and pass the number to the picture steps of Part 7h.
- Still to do in Part 7: the dashboard reading `config/images.json` (quality first), the other settings of PLAN 34.10 (storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.76" still stands, except that the `quality` setting now exists.

## Open Items After v0.101.76
- Phase 3c Part 7h built: the picture quality can now be given to the browser steps. `prepareImage` (image.js), `optimizePicture`, `resizeWebp` and `makeVariants` (hosting-optimize.js) accept a quality in percent (1 to 100; default 85, the old fixed 0.85). Nothing passes a quality yet, so the dashboard and the live site are unchanged. Card `T-0073` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- There is no `quality` setting in `site/config/images.json` yet. The next small part adds it (shipped `85`, with a check of the value) and a part after that makes the dashboard read it.
- Known gap (safe): this was tested with a fake browser, not a real one; the number given to the canvas is the only thing that changes.
- Still to do in Part 7: the `quality` setting and the dashboard reading `config/images.json`, the other settings of PLAN 34.10 (storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run and no real browser run with this change yet.
- Everything under "Open Items After v0.101.75" still stands.

## Open Items After v0.101.75
- Phase 3c Part 7g built: `site/config/images.json` now also has `maxWidth` (shipped `0`, off). With a number above 0 (for example `1600`), a published post whose top picture, share picture or a picture of our own site inside the text is wider than that many pixels gets a WARNING in `npm run check:content` (so in `preflight` and the validate workflow). It uses `imageSize` of Part 7f. It is never an error. Card `T-0072` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- To use it: change `0` to `1600` in `site/config/images.json` and push. The number 1600 is only a suggestion; there is no decision for the width yet (decision 47 covers only the 300 KB size). Turn it on and look at the warnings of the older posts first.
- Known gaps (safe): a picture with its own `srcset` is not measured; an SVG has no pixel size and is skipped; a picture whose size information starts after the first 256 KB of the file is skipped.
- Still to do in Part 7: the other settings of PLAN 34.10 (quality, storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.74" still stands, except that the width limit is now built.

## Open Items After v0.101.74
- Phase 3c Part 7f built: `site/scripts/image-size-lib.mjs` with `imageSize(bytes)` reads the pixel width and height of a PNG, JPEG, GIF or WebP. It is not connected to anything: no setting, no check and no screen uses it yet, so nothing changes on the site. Card `T-0071` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Why: the width limit (`maxWidth` of PLAN 34.10) needs a way to read the picture size. The reader is the first small step; the next part will add `maxWidth` to `site/config/images.json` (shipped `0`, off) and a warning in `npm run check:content`.
- Known gap (safe): an SVG has no pixel size, so it gives `null` and will be skipped by the width check.
- Still to do in Part 7: `maxWidth` (uses this reader), the other settings of PLAN 34.10 (quality, storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run with this change yet.
- Everything under "Open Items After v0.101.73" still stands.

## Open Items After v0.101.73
- Phase 3c Part 7e built: the picture size warning (`sizeWarnKb` of v0.101.71) now also measures the pictures of our own site inside the TEXT of a published post (`localPictures` in `validate-content-lib.mjs`: Markdown and img tags, code skipped). No new setting; `sizeWarnKb` is still `0` (off) as shipped. Card `T-0070` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- To use it: change `0` to `300` in `site/config/images.json` and push (decision 47 is still open: is 300 KB the right number?). Turn it on and look at the warnings of the older posts first.
- Known gaps (safe): a picture that has its own `srcset` is not measured; the pixel width is not checked (`maxWidth` needs a way to read the picture size, so it is its own later part and decision).
- Still to do in Part 7: the other settings of PLAN 34.10 (width limit, quality, storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.72" still stands, except that the gap "pictures inside the text are not measured" of v0.101.71 is closed.

## Open Items After v0.101.72
- Phase 3c Part 7d built: `site/config/images.json` now also has `allowHosts` (shipped `[]`). A picture in the text of a published or scheduled post from a listed website (or a sub-site of it) counts as our own: no outside-picture warning, and no error under `hardBlock`. If a name is in both `blockHosts` and `allowHosts` the config check fails and the block list wins. Card `T-0069` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- To use it: add website names, for example `"allowHosts": ["media.yourdomain.com"]`, and push. Use it for your own picture address (for example after the R2 option of decision 15) so those pictures are not counted as outside pictures.
- Decision 16 is still open: the "ask first" agency list is not built. The images Worker keeps its own `BLOCK_HOSTS`; the lists are not joined yet.
- Still to do in Part 7: the other settings of PLAN 34.10 (width limit, quality, storage `repo` or `r2`, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.71" still stands.

## Open Items After v0.101.71
- Phase 3c Part 7c built: `site/config/images.json` now also has `sizeWarnKb` (shipped `0`, off). With a number above 0 (for example `300`), a published post whose front matter `image` or `ogImage` file is bigger than that many KB gets a WARNING in `npm run check:content` (so in `preflight` and the validate workflow). It is never an error. Card `T-0068` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- To use it: change `0` to `300` in `site/config/images.json` and push. The number 300 is only the proposal of decision 47 (picture warning above 300 KB); decision 47 is still open.
- Known gap (safe): only the two front matter pictures are measured. Pictures inside the post text and the width of a picture are not checked; `maxWidth` is its own later part.
- Still to do in Part 7: the other settings of PLAN 34.10 (width limit, quality, storage `repo` or `r2`, the allow list, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.70" still stands.

## Open Items After v0.101.70
- Phase 3c Part 7b built: `site/config/images.json` now also has `blockHosts` (shipped `[]`). A picture in the text of a published or scheduled post from a listed website (or a sub-site of it) is always an error in `npm run check:content` (so in `preflight` and the validate workflow), even while `hardBlock` is false. Card `T-0067` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- To use it: add website names to the list in `site/config/images.json`, for example `"blockHosts": ["photos.example.com"]`, and push. A name only: no `https://`, no slash. Turn it on after the older posts have been checked, or a live post with a picture from that website will stop the check.
- Decision 16 (the agency host list that asks first) is still open: this part is a plain block list (error), not the "ask first" list. The images Worker keeps its own `BLOCK_HOSTS`; the two lists are not joined yet.
- Still to do in Part 7: the other settings of PLAN 34.10 (size and width limits, quality, storage `repo` or `r2`, the allow list, the "ask first" agency list, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled). Part 6b (the Action `hotlink.yml`) still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.69" still stands.

## Open Items After v0.101.69
- Phase 3c Part 7a built: `site/config/images.json` (`"hardBlock": false`) and the check in `validate-content-lib.mjs` / `validate-content.mjs`. With `true`, an outside picture in the text of a published or scheduled post is an error in `npm run check:content` (so in `preflight` and the validate workflow). Card `T-0066` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Decision 16 (warning or hard block): the warning stays the default. To choose the hard block, change `false` to `true` in `site/config/images.json` and push. Turn it on only after the older posts have been checked, or a live post with an outside picture will stop the check.
- Still to do in Part 7: the other settings of PLAN 34.10 (size and width limits, quality, storage `repo` or `r2`, agency host list, allow and block lists, naming order), the settings screen, the R2 option and the `_headers` rule for `/media/*` (do not add the immutable header before decision 50 is settled: a replace keeps the same address). Part 6b (the Action `hotlink.yml`) also still waits for the owner's secret and the images Worker.
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.68" still stands.

## Open Items After v0.101.68
- Phase 3c Part 6a built: the build gate is a warning. `checkPost` in `site/scripts/validate-content-lib.mjs` lists a published or scheduled post whose text shows a picture from another website (one `WARN` line with the count and the first address); `npm run check:content`, `preflight` and the validate workflow show it. Card `T-0065` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Next, code: Part 6b the safety-net Action `.github/workflows/hotlink.yml` (on push and daily; it needs the images Worker address and a secret, so it is a red card and the owner sets the secret); Part 7 `config/images.json` with the hard-block setting (decision 16) and the R2 option. Decision 16 is open (warning only is proposed and is what is built).
- Known gap (safe): only the TEXT of a post is checked by the gate; the front matter pictures had their own warnings; `SITE_URL` must be set for a full address of our own site to be skipped (on Cloudflare Pages and in the Actions it is).
- Not verified live: no GitHub run of the validate workflow with this change yet.
- Everything under "Open Items After v0.101.67" still stands.

## Open Items After v0.101.67
- Phase 3c Part 4c-6 built: `withPictureSets` in `site/src/lib/picture-set.ts` and `bodySets` in `picture.ts`. The pictures inside the article text now get `srcset` and `sizes` when they have copies. Card `T-0064` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Known gaps (safe): a picture typed as raw HTML with its own `srcset` or `sizes` is left alone on purpose; the AMP page and the feed use the plain picture; the `sizes` numbers are estimates from `global.css` and should be looked at on a real article.
- Next, code: the rest of Phase 3c (see `CODING_PLAN.md`: Part 4 is complete after this; the owner steps below come first because nothing can be seen live before them).
- Next, owner steps (unchanged, in this order): 1. deploy the images Worker (`cd workers/images` then `npx wrangler deploy`); 2. put its address in `site/public/admin/config.json` as `imagesUrl`; 3. only when you want copies, change `"imageCopies": false` to `"imageCopies": true` and push. Then host a NEW picture and look at the article on a phone and a desktop.
- Not verified live: no real hosted picture exists yet; tested with a temporary picture in a throw-away build.
- Everything under "Open Items After v0.101.66" still stands, except that the text pictures now use the copies.

## Open Items After v0.101.66
- Phase 3c Part 4c-5 built: `site/src/lib/picture-set.ts` (`pictureSet`) and `setOf` in `site/src/lib/picture.ts`. The picture at the top of an article, the lead story and the story cards now get `srcset` and `sizes` when the picture has the `variants` note and a stored `width` in `config/media.json` and each copy file exists. Card `T-0063` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Known gap (safe): pictures INSIDE the article text are not changed (the text is made by the linking step, not by a template). Next, code: give those pictures `srcset` and `sizes` too (a small part 4c-6); and the review of the `sizes` numbers on a real article (they follow `global.css`: wrap 1200, card padding, 1.3fr lead, grid of about four columns).
- Next, owner steps (unchanged, in this order): 1. deploy the images Worker (`cd workers/images` then `npx wrangler deploy`); 2. put its address in `site/public/admin/config.json` as `imagesUrl`; 3. only when you want copies, change `"imageCopies": false` to `"imageCopies": true` and push. Then host a NEW picture and look at the article in the browser.
- To check when you look at it: a picture with no `variants` note has the same `img` tag as before; a missing copy file is not named; the main file is listed with its stored width.
- Not verified live: no real hosted picture exists yet; tested with a temporary picture in a throw-away build.
- Everything under "Open Items After v0.101.65" still stands, except that the page now uses the copies.

## Open Items After v0.101.65
- Phase 3c Part 4c-4e built: `copiesEnabled` and the optional dep `makeVariants` in `site/public/admin/js/hosting-setup.js`, and the key `imageCopies` in `site/public/admin/config.json` (shipped as `false`). Copies are OFF. Card `T-0062` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Next, code: 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`). Until then, copies that are made are not used by any page.
- Next, owner steps (in this order): 1. deploy the images Worker (`cd workers/images` then `npx wrangler deploy`); 2. put its address in `site/public/admin/config.json` as `imagesUrl`; 3. only when you want copies, change `"imageCopies": false` to `"imageCopies": true` in the same file and push. To turn copies off again, set it back to `false`.
- Known gaps (safe): copies are made only for new pictures of a hosted post; a replaced picture has no copies until it is hosted again; a picture hosted before the switch has none.
- To check when you look at it: only the value true switches copies on; a preview never makes copies; a picture of 480 pixels or less gets none; `makeVariants` is named only in `hosting-setup.js`.
- Not verified live: tested with fakes and jsdom only; the canvas that draws the copies is faked in the tests; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.64" still stands, except that the switch is now written.

## Open Items After v0.101.64
- Phase 3c Part 4c-4d built: `site/public/admin/js/file-replace.js` (`planReplace`, `mapWithoutVariants`). `onReplace` in `app.js` now deletes the old smaller copies and drops the `variants` note in the SAME commit as the new bytes (message: `admin: replace file a.webp and remove 2 old smaller copies`). The Replace box of the Files screen is open for a picture with copies; no action of the Files screen is locked by copies any more. Card `T-0061` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Next, code (small parts, in this order): `hosting-setup.js` gives `makeVariants` (the switch that turns copies on; it needs a plain, owner-visible way to turn it on and off); then 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`).
- Known gap: replace REMOVES the old copies, it does not make new ones (the dashboard cannot make copies yet). After copies are switched on, a replaced picture has no copies until it is hosted again. This is safe: no page shows an old copy.
- To check when you look at it: a copy is deleted only when it is in the list of files that exist now; a copy of another picture is never touched; the `variants` note goes with the copies.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with fakes and jsdom only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.63" still stands, except that replace with copies is now written.

## Open Items After v0.101.63
- Phase 3c Part 4c-4c built: `planFileRename` in `site/public/admin/js/file-rename.js` moves the smaller copies of a picture to the new name, with a 301 for each copy and the media entry (with its `variants` note) under the new name; `onRename` in `app.js` puts all of it in ONE commit (message: `admin: rename file a.webp to b.webp and 2 smaller copies`). The Rename box of the Files screen is open for a picture with copies; the question and the answer name the copies. Card `T-0060` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Next, code (small parts, in this order): 4c-4d replace at the same address makes new copies (or removes the old ones), or the old copies would show the old picture (then the lock of Replace is removed); then `hosting-setup.js` gives `makeVariants` (the switch that turns copies on); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`).
- Known gap until 4c-4d (still safe): the screen refuses Replace for a picture with copies. Do not switch copies on before 4c-4d is built.
- To check when you look at it: a copy is moved only when it is in the list of files that exist now; a rename is refused when a copy of the new name already exists; every copy adds one redirect, so a rename of a picture with four copies needs five.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with fakes and jsdom only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.62" still stands, except that rename with copies is now written.

## Open Items After v0.101.62
- Phase 3c Part 4c-4b built: `site/public/admin/js/file-delete.js` (`planDelete`, `mapWithout`). `onDelete` in `app.js` now deletes a picture together with its smaller copies and their notes in ONE commit (message: `admin: delete file a.webp and 2 smaller copies`). The Delete box of the Files screen is open for a picture with copies; the question and the answer name the copies. 22 tests in `file-delete.test.ts`, 29 in `admin-files-copies.test.ts`. Card `T-0059` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, code (small parts, in this order): 4c-4c rename takes the copies along (`planFileRename` moves each copy, adds a 301 for each copy and keeps the `variants` note under the new name; then the lock sentence of Rename is removed); 4c-4d replace at the same address makes new copies (or removes the old ones), or the old copies would show the old picture (then the lock of Replace is removed); then `hosting-setup.js` gives `makeVariants` (the switch that turns copies on); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`).
- Known gap until 4c-4c and 4c-4d (still safe): the screen refuses rename and replace for a picture with copies, so no copy can be left behind or show the old picture. Do not switch copies on before both are built.
- To check when you look at it: a copy is deleted only when it is in the list of files that exist now; a width that has no file is never invented. A picture that a post uses is still refused before anything is deleted.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with fakes and jsdom only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.61" still stands, except that delete with copies is now written and the hidden count goes down after a delete.

## Open Items After v0.101.61
- Phase 3c Part 4c-4a built: `site/public/admin/js/files-screen.js` hides the smaller copies (a copy whose main picture is missing stays visible), counts only pictures (`, N smaller copies hidden` is added only when copies exist) and, for a picture that has copies, shows one plain sentence instead of Delete, Rename and Replace. 20 tests in `admin-files-copies.test.ts`. Card `T-0058` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, code (small parts, in this order): 4c-4b delete, rename and replace take the copies along (`app.js`: `onDelete` removes the copies and the `variants` note in ONE commit; `onRename` moves the copies and keeps the 301 for each; `onReplace` at the same address must make new copies, or the old ones would show the old picture; then the lock sentence of 4c-4a is removed); then `hosting-setup.js` gives `makeVariants` (the switch that turns copies on); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`).
- Known gap until 4c-4b (now safe): the screen refuses delete, rename and replace for a picture with copies, so no copy can be left behind. A deleted or renamed picture WITHOUT copies is as before. Do not switch copies on before 4c-4b.
- To check when you look at it: the hidden count is fixed when the screen opens; after a delete it is not lowered until the screen is opened again.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with jsdom only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.60" still stands, except that the Files screen part of 4c-4 is now written.

## Open Items After v0.101.60
- Phase 3c Part 4c-3 built: `site/public/admin/js/hosting-copies.js` (`addCopiesToRun`) puts the smaller copies of each new picture in the run, the commit (`hosting-commit.js`) saves them in the ONE commit and refuses a copy without its note or a note without its copy, and the pipeline takes the optional dep `makeVariants` (off today). The media row gets `variants: [480, 800, ...]`. 34 tests in `hosting-copies.test.ts`. Card `T-0057` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, code (small parts, in this order): 4c-4 the Files screen hides copies (`withoutVariants`) and delete, rename and replace take the copies with the picture (`variantsOnList`; a replace at the same address must make new copies, or the old ones would show the old picture); then `hosting-setup.js` gives `makeVariants` (the switch that turns copies on); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`; until then a browser assumes the full screen width).
- Known gap until 4c-4 (unchanged): if copies existed today, the Files screen would show each as its own picture and delete or rename would leave them behind. None exist today because the dashboard does not give `makeVariants`. Do not switch copies on before 4c-4.
- Known limit: a picture that was reused (the same picture met again) gets no copies in this save, because its bytes are not in the run. A picture hosted before copies existed has none either; a later part may add them.
- To check when you look at it: a failed copy does not stop the save (the picture and the post are saved, the message says "N pictures have no smaller copies"); a preview makes no copies.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with fakes and a fake canvas only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.59" still stands, except that saving the copies is now written.

## Open Items After v0.101.59
- Phase 3c Part 4c-2 built: `site/public/admin/js/hosting-optimize.js` now makes the smaller copies of a hosted picture in the browser (`makeVariants`, `makeVariantMaker`, `resizeWebp`, `isWebpBytes`). 33 tests in `hosting-variants.test.ts`. All or nothing: one failed copy fails the call and names the width. Nothing calls it yet. Card `T-0056` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, code (small parts, in this order): 4c-3 put the copies in the ONE commit and note them in `config/media.json`; 4c-4 the Files screen hides copies (`withoutVariants`) and delete, rename and replace take the copies with the picture (`variantsOnList`; a replace at the same address must make new copies, or the old ones would show the old picture); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`; until then a browser assumes the full screen width).
- Known gap until 4c-4 (unchanged): if copies existed today, the Files screen would show each as its own picture and delete or rename would leave them behind. None exist today. Do not switch copies on before 4c-4.
- To check when you look at it: copies are made from the optimized main WebP (not from the original), at WebP quality 0.85 like the main picture; a browser that cannot make WebP gets no copies and no `srcset` (the main picture still works).
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested with a fake canvas only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.58" still stands, except that making the copies is now written.

## Open Items After v0.101.58
- Phase 3c Part 4c-1 built: `site/public/admin/js/hosting-srcset.js`, the plain rules of the smaller copies (name `name.480w.webp`, which widths, planned size, the `srcset` text, copy or main in a list). 30 tests in `hosting-srcset.test.ts`. Nothing calls it yet. Card `T-0055` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, code (small parts, in this order): 4c-2 make the copies in the browser (resize in `hosting-optimize.js`); 4c-3 put the copies in the ONE commit and note them in `config/media.json`; 4c-4 the Files screen hides copies (`withoutVariants`) and delete, rename and replace take the copies with the picture (`variantsOnList`; a replace at the same address must make new copies, or the old ones would show the old picture); 4c-5 write `srcset` and a `sizes` attribute on the page (the width of the article column is needed for `sizes`; until then a browser assumes the full screen width).
- Known gap until 4c-4: if copies existed today, the Files screen would show each as its own picture and delete or rename would leave them behind. None exist today, so nothing is wrong yet. Do not switch copies on before 4c-4.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`.
- Not verified live: tested as plain functions only.
- Everything under "Open Items After v0.101.57" still stands, except that the srcset rules are now written.

## Open Items After v0.101.57
- Phase 3c Part 4b built: the review marker for automatic alt text on the Files screen (`site/public/admin/js/files-screen.js`; two rules in `admin.css`; 16 tests in `admin-files-review.test.ts`). Save details clears the mark. `app.js` did not change. Card `T-0054` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`. Until then no file gets the mark.
- Next, code: the srcset files and text on the page; the credit line; the Paste hook (preview mode) if wanted; Parts 5 to 8.
- To decide when you look at it: should Save count as "reviewed" even if the text did not change (built that way), and do you want a filter "only files to review" next to "only files without alt text" (not built).
- Not verified live: tested with fakes in jsdom only; no real browser, Worker or GitHub token.
- Everything under "Open Items After v0.101.56" still stands, except that the review marker is now built.

## Open Items After v0.101.56
- Phase 3c Part 3c-8d built: the style of the pictures list (`.hosting-result`, `.hosting-list`, `.hosting-row` and the four tones) is the last block of `site/public/admin/admin.css`; 8 new tests in `admin-hosting-style.test.ts`. Only CSS changed. Card `T-0053` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, owner steps (unchanged): deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`. Until then nothing changes for the writer.
- Next, code: the Paste hook (preview mode) if wanted; the srcset files; the review marker on the Files screens; Parts 5 to 8.
- Not verified live: tested with fakes and a text check of the CSS only; no real browser has shown the list yet.
- Everything under "Open Items After v0.101.55" still stands, except that the style is now built.

## Open Items After v0.101.55
- Phase 3c Part 3c-8c-2 built: `save()` of the post editor in `site/public/admin/js/app.js` now calls `runHostingSave`. `stop` stops Save, `saved` skips the normal write (the flow already made ONE commit with the post), `normal` goes on as before. With `imagesUrl` empty (today) the dashboard works exactly as before. Card `T-0052` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next, owner steps: deploy the images Worker (`cd workers/images` then `npx wrangler deploy`), then put its address in `site/public/admin/config.json` as `imagesUrl`. Until then nothing changes for the writer.
- Next, code: the style rules for `.hosting-row` and the list in `site/public/admin/admin.css` (the list shows without its own style now); the Paste hook (preview mode) if wanted; the srcset files; the review marker on the Files screens; Parts 5 to 8.
- Not verified live: tested in jsdom and with fakes only (no real browser, Worker or GitHub token).
- Everything under "Open Items After v0.101.54" still stands, except that the wiring is now built.

## Open Items After v0.101.54
- Phase 3c Part 3c-8c-1 built: `runHostingSave` in `site/public/admin/js/hosting-hook.js` decides what Save does around the pictures flow: `normal` (Save writes the post as before), `saved` (the flow already wrote the post, Save must not write it again) or `stop` (nothing written). Nothing calls it yet. Card `T-0051` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Next part, 3c-8c-2: the few lines in `save()` of `app.js`: call `runHostingSave` after the checks and before the write, show the list with `mount`, skip the normal write on `saved`, return on `stop`, copy `onSaved` fields into the editor, refresh `orig` with `freshOrig`. It is the only hand edit that cannot be tested without a browser, so it has its own jsdom test in `admin-app.test.ts` style. Only after that: the key `imagesUrl` (owner, after the Worker is deployed with `cd workers/images` then `npx wrangler deploy`).
- Not built: the wiring, the style rules for `.hosting-row`, the srcset files, the review marker on the Files screens, Parts 5 to 8. Not verified live: tested in jsdom and with fakes only.
- Everything under "Open Items After v0.101.53" still stands.

## Open Items After v0.101.53
- Phase 3c Part 3c-8b built: `startHostingSave` in `site/public/admin/js/hosting-save.js` decides whether Save should host pictures (reasons `off`, `setup`, `archived`, `no_pictures`, `moved`) and, when it should, gives the flow. Nothing calls it yet. Card `T-0050` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Known limit: a post that moves to a new address (changed permalink or category) is not hosted in that Save; the writer saves once more after the move.
- Next part, 3c-8c: the hook in `save()` of `app.js` (the one place that is edited by hand and cannot be tested without a browser; keep it to a few lines). Before it, the owner may add `"imagesUrl"` to `site/public/admin/config.json` only after the Worker is deployed (`cd workers/images` then `npx wrangler deploy`).
- Not built: the hook, the style rules for `.hosting-row`, the srcset files, the review marker on the Files screens, Parts 5 to 8. Not verified live: tested in jsdom and with fakes only.
- Everything under "Open Items After v0.101.52" still stands.

## Open Items After v0.101.52
- Phase 3c Part 3c-8a built: `hostingSetup` in `site/public/admin/js/hosting-setup.js` makes the `deps` of `hostingFlow` from `admin/config.json` (key `imagesUrl`) and the GitHub client. Empty `imagesUrl` means off. Nothing calls it yet. Card `T-0049` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Decision 52 (where the Worker address lives) is answered in the code with the proposed value, `imagesUrl` in `admin/config.json`. The owner may say "move it" and it is a small change. The key is NOT in `admin/config.json` yet: add `"imagesUrl": "https://<your-worker>.workers.dev"` only after the Worker is deployed.
- Next part, 3c-8b: the hook into Save and Paste of `app.js` (call `hostingSetup`, then `hostingFlow`, `onResult` into the editor). Only the owner can deploy the Worker (`cd workers/images` then `npx wrangler deploy`).
- Not built: the hook, the style rules for `.hosting-row`, the srcset files, the review marker on the Files screens, Parts 5 to 8. Not verified live: tested in jsdom and with fakes only.
- Everything under "Open Items After v0.101.51" still stands.

## Open Items After v0.101.51
- Phase 3c Part 3c-7 built: the flow, `hostingFlow` in `site/public/admin/js/hosting-flow.js` (the first Save, Retry and Confirm joined to the screen; `onResult` gives the editor the new post; preview mode; one run at a time). `hosting-screen.js` got `say`. Nothing calls it yet. Card `T-0048` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- The decision about the Worker address (where the dashboard finds it) is still open and is needed now for the next part, the hook into Save and Paste. The Worker itself is still NOT deployed (`cd workers/images` then `npx wrangler deploy`).
- Known limit: Retry on one row runs the pipeline for every picture that is still outside (the pipeline cannot name one address). It loses nothing.
- Not built: the hook into Save and Paste, the style rules for `.hosting-row` in `admin.css`, the srcset files, the review marker on the Files screens, Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site; tested in jsdom, not in a real browser.
- Everything under "Open Items After v0.101.50", "v0.101.49" and "v0.101.48" still stands.

## Open Items After v0.101.50
- Phase 3c Part 3c-6 built: the result list screen, `hostingScreen` in `site/public/admin/js/hosting-screen.js` (headline, notices, one row for each picture, Retry, Confirm, Confirm all from the host and Show in post buttons, one job at a time, text only). Nothing calls it yet. Card `T-0047` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- The decision about the Worker address (where the dashboard finds it) is still open and is needed now for the next part, the hook into Save and Paste. The Worker itself is still NOT deployed (`cd workers/images` then `npx wrangler deploy`).
- Not built: the hook into Save and Paste, the style rules for `.hosting-row` in `admin.css`, the srcset files, the review marker on the Files screens, Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site; tested in jsdom, not in a real browser.
- Everything under "Open Items After v0.101.49", "v0.101.48" and "v0.101.47" still stands.

## Open Items After v0.101.49
- Phase 3c Part 3c-5 built: the pipeline, `savePostWithHosting` in `site/public/admin/js/hosting-pipeline.js` (read `config/media.json`, `hostPost`, the result list, ONE commit; `preview`, `saved`, `nothing` and `error` as answers; the media file is read again just before the commit and only the new rows are added). No screen. Nothing calls it yet. Card `T-0046` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- The decision about the Worker address (where the dashboard finds it) is still open and is needed now for the next part, the screen. The Worker itself is still NOT deployed (`cd workers/images` then `npx wrangler deploy`).
- Not built: the screen that draws the list and its buttons, the hook into Save and Paste, the srcset files, the review marker on the Files screens, Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site; tested with the real GitHub client code behind a fake network, not in a real browser.
- Everything under "Open Items After v0.101.48", "v0.101.47" and "v0.101.46" still stands.

## Open Items After v0.101.48
- Phase 3c Part 3c-4 built: the data of the result list, `buildResultList`, `confirmFor` and `carryOver` in `site/public/admin/js/hosting-result.js` (one row for each picture with its sentence and its one action: Retry, Confirm, Replace or nothing; the addresses for Retry and Confirm; a headline; the rights notice). Pure, no screen. Nothing calls it yet. Card `T-0045` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- The decision about the Worker address (where the dashboard finds it) is still open and still needed when the screens are joined. The Worker itself is still NOT deployed (`cd workers/images` then `npx wrangler deploy`).
- Not built: the screen that draws the list and its buttons, the hook into Save and Paste (read `config/media.json` again just before the commit), the srcset files, the review marker on the Files screens, Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site; tested with the real `hostPost` and fake pictures, not in a real browser.
- Everything under "Open Items After v0.101.47", "v0.101.46" and "v0.101.45" still stands.

## Open Items After v0.101.47
- Phase 3c Part 3c-3 built: the call to the images Worker, `makeFetchPictures` / `imagesUrl` in `site/public/admin/js/hosting-client.js` (Bearer token of the signed-in user, every failure turned into a reason word and a plain sentence). `hosting-run.js` got four new reason words. Nothing calls it yet. Card `T-0044` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- New decision for you: where the dashboard finds the Worker address (for example a field `imagesEndpoint` in `site/config/`, or a setting on the Settings screen). It is needed when the screens are joined (the next part). The Worker itself is still NOT deployed (`cd workers/images` then `npx wrangler deploy`); until then every call fails with the plain sentence "The picture service is switched off or not ready."
- Not built: the result list screen with Retry and Confirm, the hook into Save and Paste (read `config/media.json` again just before the commit), the srcset files, the review marker on the Files screens, Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site; tested with the real Worker code behind a fake network, not with a real Worker or GitHub.
- Everything under "Open Items After v0.101.46", "v0.101.45" and "v0.101.44" still stands.

## Open Items After v0.101.46
- Phase 3c Part 3c-2 built: the one commit `buildHostingCommit` / `commitHosting` in `site/public/admin/js/hosting-commit.js` (pictures, post and `config/media.json` in one commit, all or nothing). It writes nothing by itself and nothing calls it yet. Card `T-0043` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Please remember: the commit writes the whole `config/media.json` it is given, so the next part must read that file again just before the commit.
- Not built: the Worker call with the token, the result list screen with Retry and Confirm, the hook into Save and Paste (Part 3c), the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still not deployed.
- Not verified live: nothing in this part runs on the live site; the commit was tested with a fake network, not against GitHub.
- Everything under "Open Items After v0.101.45" and "Open Items After v0.101.44" still stands.

## Open Items After v0.101.45
- Phase 3c Part 3c-1 built: the browser picture step `makeOptimizer` / `optimizePicture` in `site/public/admin/js/hosting-optimize.js` (it lets `prepareImage` serve as `optimize` for `hostPost`; a GIF gets its size from its header). It writes nothing and nothing calls it yet. Card `T-0042` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: the one commit, the Worker call with the token, the result list screen with Retry and Confirm, the hook into Save and Paste (Part 3c), the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still not deployed.
- Not verified live: nothing in this part runs on the live site; the browser step was tested with a fake canvas, not in a real browser.
- Everything under "Open Items After v0.101.44" still stands (the two choices to check: the hash is of the DOWNLOADED file; only WebP and GIF are hosted).

## Open Items After v0.101.44
- Phase 3c Part 3b built: the hosting run `hostPost` in `site/public/admin/js/hosting-run.js` (plan, Worker in groups of 30, reuse by address or hash, optimize, name, record, rewrite). It writes nothing and nothing calls it yet. Card `T-0041` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Please check two choices: the hash stored in the media row is the hash of the DOWNLOADED file; only WebP and GIF are hosted (a JPEG from the browser fails that picture with a plain sentence).
- Not built: the one commit, the `prepareImage` wrapper, the Worker call with the token, the result list screen with Retry and Confirm, the hook into Save and Paste (Part 3c), the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still not deployed.
- Not verified live: nothing in this part runs on the live site.
- Everything under "Open Items After v0.101.43" still stands.

## Open Items After v0.101.43
- Phase 3c Part 3a built: the plan and the post rewrite in `site/public/admin/js/hosting-plan.js`. Nothing calls it yet. Card `T-0040` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Please check one choice I took: an agency or stock picture is held for confirmation even when the same address is already hosted (the literal order of LOGICS 22). It is the careful choice and easy to relax.
- Not built: the pipeline itself (Worker call, optimize, one commit, result list with Retry, Confirm button), the srcset files, the review marker on the Files screens, Parts 5 to 8. Decisions 15 and 16 are still open; the plan defaults (repo storage, a warning and no hard block) are enough to build on.
- Not verified live: nothing in this part runs on the live site; the images Worker is still not deployed.
- Everything under "Open Items After v0.101.42" still stands.

## Open Items After v0.101.42
- Phase 3c Part 4a built: the pure rules about the hosted picture in `site/public/admin/js/hosted-meta.js` (auto alt text, width, height, lazy and priority, srcset widths, agency hosts, rights notice, the `config/media.json` row). Nothing calls it yet. Card `T-0039` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: the srcset files (several sizes of one picture) and the `srcset` text, the "auto, please review" marker on the Files screens (they do not know `autoAlt`, so editing an auto alt text there does not clear the flag yet), the credit line and the rights notice on screen, Part 3 (needs decisions 15 and 16), Parts 5 to 8.
- Not verified live: nothing in this part runs on the live site.
- Everything under "Open Items After v0.101.41" still stands (the images Worker is written but not deployed).

## Open Items After v0.101.41
- Phase 3c Part 2b built: the images Worker `workers/images/index.js` and `wrangler.toml` (`POST /fetch`, sign-in like the contact Worker, a secret header for the Action, rate limit, size limit of a call). NOT deployed and nothing calls it. Card `T-0038` is in `tasks/open/` with status `review`; it is a red card (`workers/`, `site/package.json`), so only the owner closes it.
- Open for the owner, when you want the Worker live: `cd workers/images` then `npx wrangler deploy` (from inside the full repository, because `lib.js` reads two files of `site/public/admin/js/`); the secret `IMAGES_SECRET` is needed only for the Action of Part 6. If the deploy fails with an import error, tell me the first red line.
- Not built: Part 3 (the Save pipeline in the dashboard; it needs decisions 15 and 16), Parts 4 to 8.
- Not verified live: nothing in this part runs on the live site; the bundling by wrangler is not tried.
- Everything under "Open Items After v0.101.40" still stands.

## Open Items After v0.101.40
- Phase 3c Part 2a built: the fetch rules of the images Worker in `workers/images/lib.js` (address and redirect checks, host name lookup, size and time limits, byte check, a list of 30). No `index.js`, no `wrangler.toml`, no deploy: nothing can call it. Card `T-0037` is in `tasks/open/` with status `review`; it is a red card (`workers/`, `site/package.json`), so only the owner closes it.
- Not built: Part 2b (the entry point, sign-in, rate limit, `wrangler.toml`, deploy), Parts 3 to 8. Part 2b needs the owner for the deploy and for the sign-in choice (the same login as the other Workers, plus a secret header for the Action).
- Not verified live: nothing in this part runs on the live site.
- Everything under "Open Items After v0.101.39" still stands.

## Open Items After v0.101.39
- Phase 3c Part 1 built: the pure rules of auto image hosting in `site/public/admin/js/hotlink.js` (find outside pictures, address and redirect safety, SEO name, path from the post date, duplicate lookup). Nothing calls it yet. Card `T-0036` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: Part 2 (the Worker `workers/images`; it must also resolve a host name and refuse a private answer), Part 3 (the Save pipeline), Parts 4 to 8. Decisions 15 and 16 (repo or R2, warning or hard block) are still open and are needed from Part 3 and Part 6.
- Not verified live: nothing in this part runs on the live site.
- Everything under "Open Items After v0.101.38" still stands (the owner's Cloudflare steps in `UPDATE_NOTE.md`).

## Open Items After v0.101.38
- Build fix (cause found by building the real repository): `config/contact.json` needed `/contact` at the end of the endpoint, and the ad-code check in `scripts/validate-html.mjs` tripped on the word "Adsterra" in the Ownership and Funding text. Both fixed; a new test reads the real contact settings. Card `T-0035` is in `tasks/open/` with status `review`; it is a red card (`workers/`, `site/package.json`), so only the owner closes it.
- Open for the owner: push this change to `main` and watch the Cloudflare Pages build go green; deploy the trap Worker so the ids are live (`UPDATE_NOTE.md`); decide `country` in `publisher.json` (`T-0003`): two live pages say "based in US" and "laws of US" beside a West Bengal address.
- Not verified live: the Cloudflare Pages build log, the deployed trap Worker and the live Contact page. The trap still blocks nobody on pages.dev (a route and a WAF rule need a custom domain).
- Everything under "Open Items After v0.101.37" and "v0.101.36" still stands.

## Open Items After v0.101.37
- Phase 3b Part 9 built: the **File tab** in the post editor (raw Markdown and front matter; read-only for writers and editors; admins can save it through the same checks as the form, one commit on the same file). Phase 3b is complete. Card `T-0034` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: creating a post from the File tab; changing the handle, category or date from the File tab (the form does it with its redirect question); a warning for unsaved text when you leave a screen.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test: sign in as admin, open a post, press File, change one word, Save file; look for the commit `admin: edit file: <handle>`. Then sign in as a writer and check that the File tab is read-only.
- Everything under "Open Items After v0.101.36" still stands (the owner's Cloudflare steps in `UPDATE_NOTE.md`).

## Open Items After v0.101.36
- Completion pass (config only): the publisher facts are in `site/config/publisher.json`; the public VAPID key is now in `workers/push/wrangler.toml` as well as in `site/config/push.json`; `TRAP_ENABLED` is "true" in `workers/trap/wrangler.toml`. Card `T-0033` is in `tasks/open/` with status `review`; it is a red card (`workers/`, `site/package.json`), so only the owner closes it.
- Seen live on 2026-11-17: the home page and `/sitemap/` list no pages and no stories, and the footer has no policy links. `T-0001` stays `ready` until the owner sees the twelve required pages live.
- Open for the owner: create the Cloudflare IP list and paste its id and the account id into `workers/trap/wrangler.toml` before the next trap deploy (a deploy overwrites the dashboard values); the trap route and the WAF rule need a custom domain, so on pages.dev the trap blocks nobody; confirm the secrets (see `UPDATE_NOTE.md`); redeploy `workers/push` (`T-0005`) and send one test notification; `country` in `publisher.json` is still "US" while the address is in India (`T-0003`).
- Not verified live: nothing in this part runs on the live site; the Worker secrets cannot be read from the repository.
- Everything under "Open Items After v0.101.35" still stands.

## Open Items After v0.101.35
- Phase 3b Part 8d-3 built: **rename** in the Files editor (type the new name, one question, one commit that moves the picture, updates every post, page, author and config file that names it, adds one 301 and moves the alt text, caption and credit). Only editors and admins (`media:rename`). Part 8 (rename, replace, delete, bulk alt text) is complete. Card `T-0032` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: Part 9 (File tab), a warning for unsaved text when you leave a screen. Renaming into another folder is not planned.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); tested in a simulated browser (jsdom) with a fake GitHub. Test: sign in, open Files, open a picture that a post shows, type a new name, Yes; look for the commit `admin: rename file <old> to <new>` (the picture at the new path and gone from the old, the post changed, one new entry in `config/redirects.json`, the `config/media.json` key moved). After the deploy open the old address: it must answer 301 to the new one, and the post must show the picture.
- Everything under "Open Items After v0.101.34" still stands (decisions 50 and 51 are still open).

## Open Items After v0.101.34
- Phase 3b Part 8d-2 built (rules only): `site/public/admin/js/file-rename.js` checks the new name and builds the whole rename (the move, the text files, one 301, the `config/media.json` entry). Nothing calls it yet. Card `T-0031` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Fixed on the way: a picture written at the end of a sentence now counts as used (before, it could be deleted by mistake).
- Not built: 8d-3 the Rename screen and the one commit, Part 9 (File tab), a warning for unsaved text when you leave a screen. Renaming into another folder is not planned.
- Not verified live: no dashboard change in this part. Tested with plain functions only.
- Everything under "Open Items After v0.101.33" still stands (decisions 50 and 51 are still open).

## Open Items After v0.101.33
- Phase 3b Part 8d-1 built (site side only): the pictures in `public/media/` are live addresses for the redirect builder, so a 301 from an old picture address to a new one is kept (`src/lib/media-live.ts`). Card `T-0030` is in `tasks/open/` with status `review`; it is a red card (`site/package.json`), so only the owner closes it.
- Not built: 8d-2 the rename rules, 8d-3 the Rename screen and the one commit, Part 9 (File tab), a warning for unsaved text when you leave a screen.
- Not verified live: no dashboard change in this part. Test after deploy: add a redirect `/media/<old>.webp` to a picture that exists, deploy, and open the old address; it must answer 301 to the new one.
- Everything under "Open Items After v0.101.32" still stands (decisions 50 and 51 are still open).

## Open Items After v0.101.32
- Phase 3b Part 8c built: **replace** in the Files editor (choose a new file of the same kind, one question, one commit at the same address; the alt text, caption and credit stay). Only editors and admins (`media:replace`). Card `T-0029` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- New decisions 50 (open: same address or new name; two documents disagree, PLAN 33.3 against BUGS U13 and PLAN 34; PLAN 33.3 was followed) and 51 (open: the limit for a replacement picture).
- Not built: 8d rename with a redirect and the posts updated in the same commit, Part 9 (File tab), a warning for unsaved text when you leave a screen.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); tested in a simulated browser (jsdom). Test: sign in, open Files, open a picture, choose a new file of the same type, Yes; look for the commit `admin: replace file <name>`, the same path with new content, and the live picture after the deploy. Then choose a PNG for a .webp address: it must be refused.
- Everything under "Open Items After v0.101.31" still stands.

## Open Items After v0.101.31
- Phase 3b Part 8b built: **delete** in the Files editor (refused while a post, page, author file or config file names the picture; otherwise two taps and one commit that removes the picture and its `config/media.json` entry). Only editors and admins (`media:delete`). Card `T-0028` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- New decision 49 (open): should a deleted picture get a redirect or a 410? Today none is made; the proposal is none, because a picture that nothing names has no readers.
- Not built: 8c replace (same address), 8d rename with a redirect and the posts updated in the same commit, Part 9 (File tab), a warning for unsaved text when you leave a screen.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); tested in a simulated browser (jsdom). Test: sign in, open Files, open a picture that no post uses, Delete file, Yes; look for the commit `admin: delete file <name>`, the picture gone from `site/public/media/` and its entry gone from `config/media.json`. Then open a picture a post uses: it must show the refusal and the list.
- Everything under "Open Items After v0.101.30" still stands.

## Open Items After v0.101.30
- Phase 3b Part 8a built: the **bulk alt text** screen (`#/files/alt`, linked from Files): one table of the pictures without alt text, saved to `config/media.json` in one commit. Card `T-0027` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Decisions 47 (limits) and 48 (does a stored alt text satisfy the publish gate) are still open; the screen uses the proposed limits.
- Not built: 8b delete (refused while a post uses the file), 8c replace (same address), 8d rename with a redirect and the posts updated in the same commit, Part 9 (File tab), a warning for unsaved text when you leave a screen.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); tested in a simulated browser (jsdom). Test: sign in, open Files, click the link, type alt text for two pictures, Save all, then look for the commit `admin: alt text for 2 files` and the two new entries in `config/media.json`.
- Everything under "Open Items After v0.101.29" still stands.

## Open Items After v0.101.29
- Phase 3b Part 7c built: the article page, the post cards and the home page read `config/media.json` (caption and credit under the big picture; stored alt text when the post has none). The post's own `imageAlt` and `imageCredit` still win. Card `T-0026` is in `tasks/open/` with status `review`; it is a red card (`site/package.json`, `site/package-lock.json`), so only the owner closes it.
- Owner decision needed (new, number 48): should a stored alt text satisfy the publish gate? Today it does not, so the stored alt text is mostly a spare.
- Not built: Part 8 (rename, replace, delete, bulk alt text), Part 9 (File tab), a warning for unsaved edits on the Files screen, alt text for pictures inside a post body.
- Not verified live: zip delivery. A real local build with temporary posts showed the right HTML; it was not opened on the live site. Test: save a caption on the Files screen, deploy, open the article and look under the big picture.
- Everything under "Open Items After v0.101.28" still stands.

## Open Items After v0.101.28
- Phase 3b Part 7b built: the **Files** screen in the dashboard (grid, search, only-without-alt switch, one editor with alt text, caption, credit, image checks and "Used in"), saved to `config/media.json`. Card `T-0025` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Decision 47 (limits of the file editor and the 300 KB picture warning) is still open; the screen uses the proposed values.
- Not built: Part 7c (the page head and the article read `config/media.json`; until then a saved alt text is not shown on the site), Part 8 (rename, replace, delete, bulk alt text), Part 9 (File tab), a warning for unsaved edits when another file is opened.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); the screen is tested in a simulated browser (jsdom). Test: sign in, open Files, pick a picture, type an alt text, Save details, then look for the commit `admin: file details ...` and the new entry in `config/media.json`.
- Everything under "Open Items After v0.101.27" still stands.

## Open Items After v0.101.27
- Phase 3b Part 7a built: `config/media.json` (alt text, caption, credit by file path) and the rules in `public/admin/js/media-meta.js`; the content check covers the file. Card `T-0024` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decision needed (new, number 47): the limits of the file editor and the 300 KB picture warning. They are proposals; the plan gives only the 125 characters for alt text.
- Not built: Part 7b (the Files screen), 7c (the page head and the article read `config/media.json`), Part 8 (rename, replace, delete, bulk alt text), Part 9 (File tab), and the box in a page screen and a tag screen.
- Not verified live: zip delivery; nothing here reaches the live site yet because no screen or page uses the new rules.
- Everything under "Open Items After v0.101.26" still stands.

## Open Items After v0.101.26
- Phase 3b Part 6d built: static pages can have `metaTitle` and `metaDescription` in their front matter, and tags can have them in the new `config/tags.json` (empty means the old title and description). The content check covers both. Card `T-0023` is in `tasks/open/` with status `review`; it is a red card (`site/package.json`, `site/package-lock.json`, `site/scripts/`), so only the owner closes it.
- Not built: the box in a page screen and a tag screen (the dashboard has neither yet), then Parts 7 to 9 of Phase 3b.
- Not verified live: zip delivery; the page heads were checked in a real local build with temporary values, not on the live site. Test: put `metaTitle` in a page, deploy, open the page source and look at `<title>`.
- Everything under "Open Items After v0.101.25" still stands.

## Open Items After v0.101.25
- Phase 3b Part 6c built: the **Search engine listing** box of the home page in Settings (home title `homeTitle`, site description). Empty home title = "site name - tagline", as before. Card `T-0022` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decision needed (new): the home title is the whole title as typed, with no site name added. Say if the site name should be added after it, like the automatic title of other pages.
- Not built: Part 6d (stored search fields for static pages and tags; the dashboard has no page screen yet, so the box in a page editor waits for it), Parts 7 to 9.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); the box is tested in a simulated browser. Test: Settings, type a home title, Save settings, deploy, open the home page source and look at `<title>`.
- Everything under "Open Items After v0.101.24" still stands.

## Open Items After v0.101.24
- Phase 3b Part 6b built: the **Search engine listing** box on the Categories and Authors screens (preview, search title, search description, counters, Reset to auto, save). Card `T-0021` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: Part 6c (page editor, home page settings), 6d (tags need stored data first), Parts 7 to 9. The Hide from search switch and the Advanced fold are not on these two screens.
- Not verified live: not opened on a phone or the real dashboard (zip delivery); the box is tested in a simulated browser. Test: open Categories, press Edit in a box, type a search title, press Save categories, deploy, open the category page source and look at `<title>`.
- Everything under "Open Items After v0.101.23" still stands.

## Open Items After v0.101.23
- Phase 3b Part 6a built: a category and an author can have their own search title and description (`metaTitle`, `metaDescription`); the page head uses them and the Categories and Authors saves keep them (before, those saves would have deleted them). No screen yet: today the two fields are set by editing the file. Card `T-0020` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Not built: Part 6b (the listing box on the Categories and Authors screens), 6c (page editor, home page settings), 6d (tags need stored data first), and Parts 7 to 9.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test after deploy: put a `metaTitle` in a category file, deploy, open the category page source and look at `<title>`.
- Everything under "Open Items After v0.101.22" still stands.

## Open Items After v0.101.22
- Phase 3b Part 5b built: the **Advanced** fold in the post editor (share card preview, share title, description and picture with Reset to auto and Use the featured image, canonical locked for writers, schema type). Card `T-0019` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- A bug of my own 0.101.21 code was found and fixed by the new tests (`checkCanonical` threw on a path-only own address).
- Owner decision needed (new): the share description preview shows the stored description only, as the page head does. Say if an empty description should fall back to the first paragraph in the page head too (then a published post without a description would still get `og:description`).
- Not built: Phase 3b Parts 6 to 9 (the same box in page, category, tag and author editors; Files screen; rename and delete of files; File tab); blocking Publish on the hard errors of the box.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test: open a post, press Advanced, type a share title, save, deploy, open the live page source and look for `og:title`.
- Everything under "Open Items After v0.101.21" still stands.

## Open Items After v0.101.21
- Phase 3b Part 5a built: the data and the rules of the Advanced fold (share card fields `ogTitle`, `ogDescription`, `ogImage`; canonical check; schema type check; the role `post:canonical`). The page head now writes the share card. Card `T-0018` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decision needed: the share limits are 70 (title) and 320 (description), the same as the page title and meta description limits. Say if they should differ.
- Owner decision needed: a canonical that points to another page or another website is only a warning (it does not block Publish). Say if it should block.
- Not built: Phase 3b Part 5b (the Advanced fold screen: nothing in the dashboard shows the new fields yet; they can be set in the post file), Parts 6 to 9, blocking Publish on the hard errors of the box.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test: add `ogTitle` to a live post file, deploy, open the live page source and look for `og:title`.
- Everything under "Open Items After v0.101.20" still stands.

## Open Items After v0.101.20
- Phase 3b Part 4 built: the **Hide this page from search engines** switch in the post editor (`site/public/admin/js/listing-box.js`, `roles.js`, `app.js`; 15 new tests). Card `T-0017` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decision needed: should a writer (author role) be allowed to hide a draft? Today only editors and admins may, and Save refuses a robots change from a writer.
- Known limit: switching the tick off always gives `index,follow`, so a hand-set `nofollow` in the Robots list is lost. The Robots list stays in Details until Part 5.
- Not built: Phase 3b Parts 5 to 9 (Advanced fold, other editors, Files screen, rename and delete of files, File tab); blocking Publish on the hard errors of the box.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test: open a live post, tick the switch, save, then open the live page and look for `noindex` in the source and for the page missing from `sitemap-posts.xml`.
- Everything under "Open Items After v0.101.19" still stands.

## Open Items After v0.101.19
- Phase 3b Part 3 built: the 301 question for a handle change on a live post (24 hour rule). Card `T-0016` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decisions still open (from v0.101.18): may a handle repeat in another category or on another date; the description limit (160 or 320). The validator still wins at Save.
- Known limit: for a young post the switch removes the old address for any URL change (handle, category or date); the question appears only for a handle change.
- Not built: Phase 3b Parts 4 to 9 (hide-from-search switch, Advanced fold, other editors, Files screen, rename and delete of files, File tab); blocking Publish on the hard errors of the box.
- Not verified live: not opened on a phone or the real dashboard (zip delivery). Test: open a post that is live, change the handle, look for the question, save, then open the old address on the live site and expect a 301.
- Everything under "Open Items After v0.101.18" still stands.

## Open Items After v0.101.18
- Phase 3b Part 2 built: the **Search engine listing** box in the post editor (`site/public/admin/js/listing-box.js`, 17 tests). Card `T-0015` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decisions needed before Part 3: (1) may a handle repeat in another category or on another date (LOGICS 21) or is it unique site-wide (`validate.js`)? (2) the description limit: warn 160 and stop 320 (LOGICS 21) or refuse above 160 (`validate.js`)? Today the validator wins at Save.
- The hard errors of the box are shown but do not block Publish yet.
- Not built: Phase 3b Parts 3 to 9 (301 question, noindex switch, Advanced fold, other editors, Files screen, rename and delete of files, File tab).
- Not verified live: the dashboard was not opened on a phone or on the real site (zip delivery). Open `/admin/`, make a new post and look at the box on a phone.
- Everything under "Open Items After v0.101.17" still stands.

## Open Items After v0.101.17
- Phase 3b Part 1 built: `site/public/admin/js/listing.js` (the rules of the search engine listing, no screen) with 31 tests. Card `T-0014` is in `tasks/open/` with status `review`; it is a red card (`site/public/admin/`, `site/package.json`), so only the owner closes it.
- Owner decision needed: LOGICS 21 lets a handle repeat in another category or on another date; `validate.js` says a permalink is unique site-wide. `listing.js` follows LOGICS 21; the validator is unchanged. Choose before Part 2.
- Not built: Phase 3b Parts 2 to 9 (the box in the post editor, handle change with the 301 question, the noindex switch, the Advanced fold, other editors, the Files screen, rename and delete of files, the File tab).
- Not verified live: nothing public changed in this version.
- Everything under "Open Items After v0.101.16" still stands.

## Open Items After v0.101.16
- Phase 3d Part 4 built: `.github/workflows/automerge.yml`, `site/scripts/automerge-lib.mjs`, `site/scripts/automerge.mjs` (34 tests). It is off until the owner sets the repository variable `AUTO_MERGE` to `on`. Card `T-0013` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it.
- Correction: v0.101.15 told the owner to require the check `validate` on `main`. The dashboard saves straight to `main`, so that rule can block the owner's own saves. Now optional, with a bypass step and a test step in `site/README.md`.
- Not verified live: neither workflow has run on GitHub (zip delivery). Paste the first `Validate` and `Auto-merge` run links in `T-0012` and `T-0013`.
- Not built: Phase 3d Part 5 (the real trial: publish, schedule, unpublish, redirect and delete one test post on a branch). It stays in task `T-0007`, which also waits for the second key on `T-0006`.
- Everything under "Open Items After v0.101.15" still stands.

## Open Items After v0.101.15
- Phase 3d Part 3 built: `.github/workflows/validate.yml` (content check with `--base`, task check, tests, build; reads only; 12 tests). Card `T-0012` is in `tasks/open/` with status `review`; it is a red card (`.github/`, `site/package.json`), so only the owner closes it.
- Not verified live: the workflow has not run on GitHub yet (zip delivery). The first pull request or push after it is merged is the real test; paste that Actions link in `T-0012`.
- Owner step (corrected in v0.101.16): protecting `main` is optional and can block the dashboard saves; read the warning in `site/README.md` before you do it.
- Not built: Phase 3d Part 4 (auto-merge, branch protection steps in the README) and Part 5 (real trial). They stay in task `T-0007`, which also waits for the second key on `T-0006`.
- Everything under "Open Items After v0.101.14" still stands, except that `validate.yml` is no longer missing.

## Open Items After v0.101.14
- Phase 3d Part 2 built: `npm run check:content` (27 tests). Preflight runs it now. Card `T-0011` is in `tasks/open/` with status `review`; it is a red card (`site/package.json`), so only the owner closes it.
- Not built: Phase 3d Part 3 (`validate.yml`, red) and Parts 4 and 5. They stay in task `T-0007`, which also waits for the second key on `T-0006`.
- Everything under "Open Items After v0.101.13" still stands.

## Open Items After v0.101.13
- Phase 3k Part 7 built: the read-only **Tasks** screen (Waiting for the owner, Decisions that block work, the board, Copy AI prompt). Card `T-0010` is in `tasks/open/` with status `review`; it is a red card, so only the owner closes it (`Confirmed by <name>, <date>` in its Log, from an owner login).
- Not built: Part 8 (the write screen and the Owner checklist) and Part 9 (weekly report). Both are red.
- Everything under "Open Items After v0.101.12" still stands.

## Open Items After v0.101.12
- Phase 3k Part 5: `npm run tasks:gate` built (paths gate, second-key gate). The pull request workflow is still open (red, owner approval).
- T-0006 is **not done**: it waits for a second key (status verify, in `tasks/open/`). This corrects the line "T-0006 is done" under v0.101.7.
- Next: the owner steps T-0001, T-0002, T-0003, T-0009 (they unlock the site), or the red tasks with approval (T-0007 validate.yml, the two workflows). Everything under "Open Items After v0.101.11" still stands.

## Open Items After v0.101.11
- Phase 3k Part 6 built: `npm run docs:archive` and the budget test. Not yet run on the real documents (T-0008 waits for decision 43). `INCOMPLETE.md` (about 28,700 words) and `CHANGELOG.md` (about 44,500) stay over budget until then; `npm run preflight` shows this as a warning.
- Next: Part 5 (paths check, second-key rule; a pull request workflow under `.github/`, red, needs owner approval), Part 7 (read-only Tasks screen in the dashboard; `site/public/admin/` is red, needs owner approval), or the owner steps T-0001, T-0002, T-0003, T-0009. Everything under "Open Items After v0.101.10" still stands.

## Open Items After v0.101.10
- Phase 3k Part 4: `npm run verify:live` built and tested (17 tests). It has not been run against the real site from here, because this workspace cannot reach it: run it once yourself after the first real article is live (T-0002).
- Still open in Part 4: the workflow `.github/workflows/live-check.yml` (red, needs owner approval).
- Next: Part 5 (paths check and second-key rule; the pull request side is a workflow, so also red) or Part 6 (document budget test and `archive-docs.mjs`, yellow; needs decision 43). Everything under "Open Items After v0.101.9" still stands.

## Open Items After v0.101.9
- Phase 3k Part 3 built: `npm run preflight`. Budgets are a warning only until decision 43 is answered and T-0008 is done; then switch the default to strict.
- Next: Part 4 (`verify-live` and the live-check workflow; the workflow is under `.github/`, so it is a red task needing owner approval). Everything under "Open Items After v0.101.8" still stands.

## Open Items After v0.101.8
- Phase 3k Part 2 built: `npm run tasks:check` and its 34 tests. It also found that T-0009 was marked green but edits a root document (yellow); the card is fixed.
- Next: Part 3 (`npm run preflight`: tests, build, tasks check, document budgets). Everything under "Open Items After v0.101.7" still stands.

## Open Items After v0.101.7
- T-0006 is done: the 12 stale tests read fixtures under `site/tests/fixtures/shipped/`; the suite is green (1939 tests). No code or config changed.
- Next: Phase 3k Parts 2 to 4, then T-0007 (red, needs owner approval). Owner steps still open: T-0001, T-0002, T-0003, T-0009. Everything under "Open Items After v0.101.6" still stands, except that T-0006 is finished.

## Open Items After v0.101.6
- Added a task system for people and AI: `AI_START_HERE.md` (one page), `tasks/README.md`, `tasks/TEMPLATE.md`, nine task cards in `tasks/open/` (T-0001 to T-0009), the Issue form and the pull request template under `.github/`. PLAN 43, LOGICS 31, BUGS group Q, AI_OPERATIONS 19, BETTER N48 to N55. The files are plain documents: nothing runs yet, nothing to deploy, no code changed.
- **Start here for open work: the folder `tasks/open/`.** Owner steps first: T-0001 (publisher facts and required pages), T-0002 (five real articles), T-0003 (time zone and country), T-0009 (answer decisions 23 to 46); with care: T-0004 (narrow sign-in permission), T-0005 (deploy the push Worker). AI work: T-0006 (fix 12 stale tests), T-0007 (content check and validate.yml, red, needs owner approval), T-0008 (shrink the documents, waits for decision 43).
- The documents are now about 140,000 words (`INCOMPLETE.md` 27,860 before this block, `CHANGELOG.md` 43,144). Decision 43 and task T-0008 fix that.
- `.github/` now has an Issue form and a pull request template. They change nothing in the build. The repository is public, so anyone can open an issue: only owner-opened issues count as tasks (PLAN 43.9).
- Decisions 41 to 46 are open.
- Recommended order: T-0001, T-0002 and T-0003 (the owner, today), T-0006, then Phase 3k Parts 2 to 4, then T-0007, then the earlier recommended order. Everything under "Open Items After v0.101.5" still stands.

## Open Items After v0.101.5
- New plan only: author pages that can be indexed (PLAN 41, Phase 3i) and a "Newsroom" theme with a better dark mode (PLAN 42, Phase 3j). No code changed, nothing to deploy.
- **Why the author is not indexed today:** there is no published post, so no author page is built and `sitemap-authors.xml` is empty (read from `src/pages/author/[author]/[...rest].astro` and `site-data.ts`). Publishing one real post is the quickest fix; Phase 3i adds the Show author page now switch.
- **Dark mode measured in `global.css`:** card on page 1.08 : 1, outline on page 1.16 : 1, one orange `theme-color` for both modes, a two-state switch, no `color-scheme`, dark colours written ten times. The numbers are in PLAN 42.1.
- **Seen in the screenshot:** the footer has no About, Privacy, Contact or Editorial links and the home page says "No stories yet". The required pages are not generated because `config/publisher.json` still lacks `address`, `foundedYear` and `fundingSummary`. Fill those three fields and run `npm run pages` before applying to AdSense or Google News.
- The owner must answer decisions 34 to 40; decisions 36 and 37 only after seeing the preview (Phase 3j Part 7).
- Recommended order: Phase 3j Parts 1 to 4 (dark mode fixed, same look), real articles, Phase 3i Parts 1 to 5, Phase 3j Parts 5 to 8, then Phase 3g and 3f as listed before. Everything under "Open Items After v0.101.4" still stands.

## Open Items After v0.101.4
- New plan only: automatic dashboard sign-in (PLAN 39, Phase 3g) and a professional link editor (PLAN 40, Phase 3h). No code changed, nothing to deploy.
- Read from the code while writing it: the dashboard keeps the GitHub token in `sessionStorage` (so every new tab asks to sign in again), and the auth Worker asks for the scope `repo`, which reaches every repository of the owner's account. Decision 30 (the smaller scope `public_repo` while the repo is public) is the quickest safety win and needs only a Worker variable and a new sign-in; it can be done today without code: set `GITHUB_SCOPE = "public_repo"` in `workers/auth/wrangler.toml`, deploy the auth Worker, sign out and sign in again. Check first that the repository really is public (decision 17).
- The owner must answer decisions 28 to 33 before Phase 3g Part 2 and Phase 3h Part 1.
- ChatGPT cannot reuse its own GitHub connection to sign in to the dashboard (PLAN 39.2). Use AI_OPERATIONS 15 now and Connected apps (PLAN 38) later.
- Recommended order: Phase 3d Parts 2 to 4, Phase 3g Parts 1 to 5, Phase 3f Parts 1 to 5, Phase 3h. Everything under "Open Items After v0.101.3" still stands.

## Open Items After v0.101.3
- New plan only: Connected apps, a Shopify-style token connection so ChatGPT, Claude and other tools stop using a browser robot and the dashboard login (PLAN 38, CODING_PLAN Phase 3f, LOGICS 26, BUGS group X, AI_OPERATIONS 16, BETTER N32 to N35). No code changed, nothing to deploy.
- The owner must answer decisions 23 to 27 before Parts 4, 5 and 9. Decision 27 matters most: a Free ChatGPT account cannot add a custom connector, so pick the assistant or plan first.
- Recommended order: Phase 3d Parts 2 to 4 (the check), then Phase 3f Parts 1 to 5, then the screen (Part 8).
- Everything under "Open Items After v0.101.2" still stands.

## Open Items After v0.101.2
- Docs only: new ideas N25 to N31 in `BETTER.md` (section E) and a new Section 15 in `AI_OPERATIONS.md` (fast paths without a browser robot). No code changed, nothing to deploy.
- Time zone, language and country (T-0003): the owner decided on 2026-11-18 for US readers, `America/New_York`, `en_US`, `publisherCountry` US. `config/site.json` was already right; decision 8, `AI_OPERATIONS.md` and this file were changed to match. Left as it is: `config/publisher.json` says country India and address West Bengal; that is the true place of the publisher, not a site setting. Still to fix outside the card paths: `site/README.md` line 155 still says `Asia/Kolkata`.
- Found while reading the zip: 12 tests fail only because they expect empty owner settings (publisher, contact, push, analytics, wrangler). They should read a fixed test copy of the settings, not the real files.
- Still open: deploy the push Worker again (`cd workers/push ; npx wrangler deploy`), decision 17 (public or private repo), and real posts (only one draft exists).
- Recommended next order: N27 (Phase 3d Parts 2 to 4), then real posts, then Phase 3e Part 1.

## Open Items After v0.101.1
- New plan only: Direct code writing in the editor (PLAN 37, CODING_PLAN Phase 3e, LOGICS 25, BUGS group K, POLISH, AI_OPERATIONS 14). No code changed. Next code part: Phase 3e Part 1 (the rules and the sanitizer, no screen), then Part 2 (the Code button). Everything under "Open Items After v0.101.0" still stands.

## Open Items After v0.101.0
- New: the offer "Remove this topic?" with a one-tap button on `/notifications/` (`site/src/lib/notifications-page.js`, `site/src/pages/notifications.astro`, `site/src/lib/push-client.js`, `workers/push/feedback.js`, `workers/push/index.js`; `tests/unit/notifications-offer.test.ts` with 21 tests and `tests/unit/push-less-clear.test.ts` with 11 tests).
- To do FIRST: deploy the push Worker again (`cd workers/push ; npx wrangler deploy`) and publish the site. No migration. Everything under "Open Items After v0.100.0" still stands (the migration of v0.100.0 must have been run once).
- Full `npm test`: 1924 passed, 12 failed (the same old tests that expect empty owner settings while this zip holds the real ones); `npm run build` passed. Run both on your own computer too.
- Check by hand (after the deploy): tap "Less like this" 3 times on notifications of one category you follow, open `/notifications/`: the box shows "You tapped Less like this for X 3 times. Remove X?" with a button. Press it: the category is unticked and saved, the box goes. Open the page again: no box.
- Known limits: no "Keep it" button (the offer returns on each visit until the topic is removed or 30 days pass); a reader who changes categories only through turn off and on again keeps old counted taps for up to 30 days.
- Push Phase 9 Part 8c-2 is done. Next: Part 8d (adaptive limit and pause after no opens).
- Not done yet: Parts 8d to 11 of push, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.100.0
- New: the count of "Less like this" taps (table `push_less`, `workers/push/migrate-0.100.0.sql`, `workers/push/feedback.js`, `workers/push/index.js`, `workers/push/control.js`; `tests/unit/push-less.test.ts` with 18 tests).
- To do FIRST: run the migration once (`cd workers/push ; npx wrangler d1 execute <database-name> --remote --file=migrate-0.100.0.sql`), then deploy the push Worker (`npx wrangler deploy`). Everything under "Open Items After v0.99.0" still stands.
- Full `npm test`: 1892 passed, 12 failed (old tests that expect empty owner settings while this zip holds the real ones); `npm run build` passed. Run both on your own computer too.
- Check by hand (after the migration and deploy): tap "Less like this" 3 times on notifications of one category you follow, then open `/notifications/` and read the answer in the browser network tab: `suggestRemove` is there. The page does not show text yet.
- Push Phase 9 Part 8c-1 is done. Next: Part 8c-2 (the text and the one-tap button on `/notifications/`, and clearing the counted taps when the topic is removed), then 8d (adaptive limit and pause).
- Not done yet: Parts 8c-2 to 11 of push, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.99.0
- New: the weekly fade of the learned weights (`runFade` and `FADE_SQL` in `workers/push/feedback.js`, called by `runCleanupTick` in `workers/push/control.js`; `tests/unit/push-fade.test.ts` with 16 tests). No database change.
- To deploy: the push Worker again (`cd workers/push ; npx wrangler deploy`). Everything under "Open Items After v0.98.0" still stands.
- Full `npm test`: 1874 passed, 12 failed (old tests that expect empty owner settings while this zip holds the real ones); `npm run build` passed. Run both on your own computer too.
- Check by hand (after deploy and one cron hour): read `weights` of your row in the D1 console; the numbers are a little smaller each hour.
- Push Phase 9 Part 8b is done. Next: Part 8c (the offer "Remove this topic?" after 3 "Less like this" taps), then 8d (adaptive limit and pause).
- Not done yet: Parts 8c to 11 of push, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.98.0
- New: `POST /feedback` in the push Worker (`workers/push/feedback.js`, `workers/push/index.js`; `tests/unit/push-feedback.test.ts` with 18 tests). No database change.
- To deploy: the push Worker again (`cd workers/push ; npx wrangler deploy`). Nothing else.
- Run `npm test` and `npm run build` on your own computer too. In this zip the settings files hold the owner's real values, so 12 old tests that expect empty settings fail here (publisher, contact, push, analytics, wrangler placeholders); they are not about this change.
- Check by hand (after deploy): tap a real notification, then read `weights` of your row in the D1 console.
- Push Phase 9 Part 8a is done. Next: Part 8b (the weekly fade of the weights by 5 percent, in the hourly clean-up), then 8c (the offer "Remove this topic?" after 3 "Less like this" taps), then 8d (adaptive limit and pause).
- Not done yet: Parts 8b to 11 of push, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.97.0
- New: the source "Push notification" (`workers/analytics/lib.js`, `workers/analytics/index.js`, `site/src/lib/beacon-client.js`; `tests/unit/analytics-push-source.test.ts` with 14 tests and 4 new ones in `beacon.test.ts`). No database change.
- To deploy: the analytics Worker again (`wrangler deploy` in `workers/analytics`) and the next site build. Deploy the Worker FIRST: the old Worker refuses a message with the new field `pn` as a wrong shape, so no push visit would be counted until it is updated.
- The full `npm test` (100 files) and `npm run build` were run and passed in this session. Run both once on your own computer too.
- Check by hand: open a post address with `?pn=1` at the end, read for 6 seconds, scroll a little, then look at "Traffic sources" in the Analytics screen after a minute.
- Push Phase 9 Part 7 is complete. Next: Part 8 (feedback endpoint and learning).
- Not done yet: Parts 8 to 11 of push, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.96.0
- New: `site/public/admin/js/push-fields.js`, the Notifications box in the post editor (`app.js`), `tests/unit/push-editor.test.ts` (17 tests). Nothing to deploy for the Workers; the dashboard updates with the next site build.
- The full `npm test` (99 files, 1834 tests) and `npm run build` were run and passed in this session. Two old faults of v0.95.0 were fixed: the build gate stopped on a comment in `src/lib/own-browser.js`, and one `admin-security.test.ts` test counted the Worker calls twice (see the CHANGELOG). Run both once on your own computer anyway before deploying.
- Open the editor once on a phone: pick Off, Auto and Force, write a title and a text, save, and look at the post file on GitHub. `auto` and empty texts must not appear in the file.
- Next: 7e-3, the analytics source "Push notification" (the `?pn=1` mark that the notification link already carries).
- Not done yet: 7e-3, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.95.0
- New: the fields `push`, `pushTitle`, `pushBody` in `src/content.config.ts`, `public/admin/js/validate.js` and `public/admin/js/frontmatter.js`; `tests/unit/push-fields.test.ts` (11 tests). The announce job reads quoted values better (`scripts/push-announce-lib.mjs`). Nothing to deploy for the Workers.
- FIRST: run `npm test` and `npm run build`. The new schema lines were only syntax checked. Everything under "Open Items After v0.94.0" and older still stands.
- The fields can be written by hand in a post file today. The editor has no controls for them yet: that is 7e-2 (a choice "Notify readers: auto, off, force" and two boxes with character counters). Then 7e-3: the analytics source "Push notification".
- Not done yet: 7e-2, 7e-3, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.94.0
- New: `.github/workflows/push.yml`, `site/scripts/push-announce.mjs`, `site/scripts/push-announce-lib.mjs`, `tests/unit/push-announce-script.test.ts` (23 tests). No Worker change, nothing to deploy for the Workers.
- FIRST: run `npm test` and `npm run build`. In the session that wrote this only the 23 new tests were run, with a stand-in test tool (no network, no `node_modules`). Everything under "Open Items After v0.93.0" still stands, including the 8 jsdom tests that were never run.
- To switch the job on: add the GitHub secrets `SITE_URL`, `PUSH_ENDPOINT` (address of the push Worker) and `PUSH_ANNOUNCE_SECRET`, and set the same text (32 characters or more) as `ANNOUNCE_SECRET` on the push Worker. Test first by hand: `node scripts/push-announce.mjs --dry` in `site/` shows what would be sent.
- Until the editor fields exist (7e) every post is `auto`. Next: 7e (the `push` fields in the post model and the editor, and the analytics source "Push notification").
- Not done yet: 7e, 7c and 7d of bot protection, 6b-3b, 6b-3c, and the owner's Part 1.

## Open Items After v0.93.0
- New: the Security screen in the dashboard (`public/admin/js/app.js`: menu entry, route `#/security`, function `securityView`) and `tests/unit/admin-security.test.ts` (8 jsdom tests). The dashboard is deployed with the next site build; no Worker changes.
- FIRST: run `npm test` and `npm run build`. The 8 new jsdom tests were written but NOT run (the session that wrote them had no browser tool and no `node_modules`). Then sign in to the dashboard and open Security once. If something fails, the change is only the function `securityView` and one menu line.
- The screen needs the analytics Worker (address in `config/analytics.json`). Without it the screen says so and still shows the two lists.
- Cloudflare challenges, blocks and kill switches cannot be read by the dashboard on purpose (no Cloudflare token in the browser); the screen links to the Cloudflare start page.
- The "last done" times are kept in this browser only. The limits (50 views, 30 and 60 percent) are a first proposal: change them in `security.js` after a week of real numbers.
- Not done yet: 7c, 7d, 6b-3b, 6b-3c, and the owner's Part 1. Everything under "Open Items After v0.92.0" and older still stands.

## Open Items After v0.92.0
- New in `site/public/admin/js/security.js`: `renderSecurity` (the drawing) and the last done helpers; `tests/unit/security-rules.test.ts` now has 21 tests; 3 colour lines in `public/admin/admin.css`. Nothing imports the file yet, so the dashboard is unchanged.
- Before deploying anything: run `npm test` and `npm run build` once (in this session only the 21 + 18 + 24 tests were run, with a stand-in test tool that has no browser; the full suite and the jsdom tests were not).
- Decision taken for the "last done" times: browser only (`localStorage`). Tell me if you want a repo file instead.
- Next: 8b-2, the wiring in `app.js` (route `#/security`, menu entry, two analytics calls, save to `localStorage`). It must be tested in a real run with jsdom before it is trusted.
- Not done yet: 8b-2, 7c, 7d, 6b-3b, 6b-3c, and the owner's Part 1. Everything under "Open Items After v0.91.0" and older still stands.

## Open Items After v0.91.0
- New: `site/public/admin/js/security.js` (the rules of the Security screen as plain functions) and `tests/unit/security-rules.test.ts` (10 tests). Nothing imports it, so the dashboard is unchanged and there is nothing to deploy for it.
- Before deploying anything: run `npm test` and `npm run build` once (in this session only the 10 + 18 + 24 new and trap tests were run, with a stand-in test tool; the full suite was not).
- The limits (under 50 views is too few, 30 percent unverified is watch, 60 percent is high) are a first proposal. Change them after a week of real numbers.
- Owner decision for 8b: where the "last done" times of the daily and weekly lists are kept (in the browser only, or in a repo file).
- Not done yet: 8b (the screen), 7c, 7d, 6b-3b, 6b-3c, and the owner's Part 1. Everything under "Open Items After v0.90.0" and older still stands.

## Open Items After v0.90.0
- New: `workers/trap/index.js` (the Worker), `workers/trap/wrangler.toml` and `tests/unit/trap-worker.test.ts` (24 tests); `workers/trap/lib.js` got `listRequest` and `parseListPage`. Nothing is deployed and nothing is connected: `TRAP_ENABLED` is `"false"`, there is no route, no secret and no link.
- Before deploying anything: run `npm test` and `npm run build` once (in this session only the 18 + 24 trap tests were run, with a stand-in test tool; the full suite was not).
- To switch the trap on, the owner needs, in this order: decision 6 (yes); an IP list and the WAF rule that blocks it (BOT_PROTECTION Section 3); an API token with only "Account Filter Lists: Edit"; the two ids and `OWN_IPS` in `wrangler.toml`; `npx wrangler secret put CF_API_TOKEN`; `npx wrangler deploy`; the route for `/trap/`; then `TRAP_ENABLED = "true"`. Put the owner's own address in `OWN_IPS` first.
- Check once before first use: the Cloudflare list read call and its answer shape were written from memory, not from Cloudflare's pages and not tried on the account (see CHANGELOG 0.90.0).
- Not done yet: 7c (the link; the Google risk of a hidden link stands), 7d, 6b-3b, 6b-3c, Part 8, and the owner's Part 1. Everything under "Open Items After v0.89.0" and older still stands.

## Open Items After v0.89.0
- New: `workers/trap/lib.js` (the rules of the trap link as plain functions) and `tests/unit/trap-lib.test.ts` (18 tests). It changes no page, no header, no Worker and no setting, so there is nothing to deploy for it.
- Before deploying anything else: run `npm test` and `npm run build` once (in this session only the 18 new tests and the 32 header tests were run, with a stand-in test tool; the full suite was not).
- Owner decision still open: trap link yes or later (BOT_PROTECTION Section 16, item 6). Without a yes, 7b to 7d are not built.
- Risk, said plainly: a hidden link on a news site can count as a bad practice for Google; see 7c in BOT_PROTECTION Section 17 before any link is added.
- Cloudflare facts used (from Cloudflare's API pages, read in this session, not tried on the owner's account): `POST` appends list items `{ ip, comment }`, `DELETE` removes items by id, both ids are 32 characters, one pending bulk operation per account, and list items have no timer of their own (so the clean-up must delete them).
- Not done yet: 7b (the Worker, needs an API token and an IP list), 7c, 7d, 6b-3b, 6b-3c, Part 8, and the owner's Part 1. Everything under "Open Items After v0.88.0" and older still stands.

## Open Items After v0.88.0
- New: `public/_headers` has a report-only policy for article pages (`/:year/:month/:day/blogs/:category/:slug/`): the all-paths policy plus the ad script hosts (`afders.org`, `bicea.org`, `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`) and the frame hosts `googleads.g.doubleclick.net` and `tpc.googlesyndication.com`. Nothing is blocked. The site must be built and deployed again for it to appear. Ads are still OFF (`geoUrl` is empty, compliance mode is on), so for now the policy has nothing to report.
- Before deploying: run `npm test` and `npm run build` once (in this session only the 32 header tests were run, with a stand-in test tool; the full suite was not).
- After the deploy, the owner checks once: `curl -I` on one article address shows exactly ONE `content-security-policy-report-only` and it holds `bicea.org`; the home page shows one that does not.
- Honest limits: the host list is a first list. Adsterra and AdSense load more hosts after their first script; nobody knows which ones until ads run. Part 6b-3b reads the console report of a real article with ads on. The AdSense hosts come from Google's public help text, not from a live test. The `smartlink` host (`arwf.org`) is left out on purpose: a new tab opens it, no script loads from it. A new script host entered in the Ad loader screen makes `npm test` fail until it is added to the block.
- Not done yet: 6b-3b, 6b-3c (enforcing), Part 7, Part 8, and the owner's Part 1. Everything under "Open Items After v0.87.1" and older still stands.

## Open Items After v0.87.1
- New: `public/_headers` has a report-only policy for the dashboard (`/admin/*`): scripts from itself only, `blob:` pictures for the previews, the rest as the all-paths policy; and a block for `/admin/blog-xml-tool.html` (inline script) that gives it the all-paths policy. Nothing is blocked. The site must be built and deployed again for it to appear.
- Before deploying: run `npm test` and `npm run build` once (in this session only the 23 header tests were run, with a stand-in test tool; the full suite was not).
- After the deploy, the owner checks once: `curl -I https://shivam-das-news.pages.dev/admin/` shows exactly ONE `content-security-policy-report-only`, and its `script-src` is only `'self'`. Then open the dashboard with DevTools, Console, sign in, open a post, the media library, the Analytics screen and the Import screen, and note every report line. If a line names a host or a script of the dashboard itself, tell the assistant before 6b-3. The Blogger XML tool needs a separate look (open it once).
- Honest limits: nothing is collected (no report address); `style-src` still has `unsafe-inline` because the dashboard sets `style` attributes; `connect-src` has `https:` because the Workers and the remote image import go to hosts that are not known in advance; the `!` line and the second block were not tried on a live site.
- Not done yet: 6b-3 (article pages with ads, then enforce, one page type at a time), Part 7, Part 8, and the owner's Part 1. Everything under "Open Items After v0.87.0" and older still stands (ads are still off: `geoUrl` is empty).

## Open Items After v0.87.0
- New: `public/_headers` has a block for the Contact Us page (`/:year/:month/:day/pages/contact-us/`): the all-paths report-only policy plus `https://challenges.cloudflare.com` for scripts and frames, only there. It blocks nothing. The site must be built and deployed again for it to appear.
- Before deploying: run `npm test` and `npm run build` once (in this session only the 16 header tests were run, with a stand-in test tool; the full suite was not).
- After the deploy, the owner checks once: `curl -I` on the Contact Us address shows exactly ONE `content-security-policy-report-only` and it holds `challenges.cloudflare.com`; `curl -I https://shivam-das-news.pages.dev/` shows one that does NOT. If the Contact Us page shows two, the `!` line did not take the first one off: tell the assistant, nothing breaks (it is report-only).
- The form only exists when `config/contact.json` has the Worker address and the Turnstile site key (both are still empty), so until then the Contact Us page has the policy but no form.
- Not done yet: 6b-2b (the dashboard's own policy), 6b-3 (article pages with ads, then enforce), Part 7, Part 8, and the owner's Part 1. Everything under "Open Items After v0.86.0" and older still stands (ads are still off: `geoUrl` is empty).

## Open Items After v0.86.0
- New: `public/_headers` has `Content-Security-Policy-Report-Only` for all paths (the dashboard is excluded with a `!` line). It blocks nothing; it only prints what it WOULD block in the browser console. The site must be built and deployed again for it to appear.
- Before deploying: run `npm test` and `npm run build` once (in this session only the header tests and the own-browser tests were run, with a stand-in test tool).
- After the deploy, the owner checks once: `curl -I https://shivam-das-news.pages.dev/` shows `content-security-policy-report-only`, and `curl -I https://shivam-das-news.pages.dev/admin/` does NOT. Then open an article and the Contact page with DevTools, Console, and note what is reported (ads and the Turnstile box are expected there).
- Honest limits: no report address exists, so nothing is collected automatically; `unsafe-inline` is still needed.
- Not done yet: 6b-2, 6b-3 (then enforce), Part 7, Part 8, and the owner's Part 1. Everything under "Open Items After v0.85.2" and older still stands (ads are still off: `geoUrl` is empty).

## Open Items After v0.85.2
- Owner decision, written 2026-11-16: the site stays on the free address `https://shivam-das-news.pages.dev` and the owner will NOT buy a custom domain. `SITE_ORIGIN` in `workers/geo/wrangler.toml` is now set to it (the geo Worker is ready to deploy: `cd workers/geo` then `npx wrangler deploy`). The other three Workers (`contact`, `push`, `analytics`) still hold the placeholder `https://YOUR-DOMAIN`; their tests pin the placeholder, so set `https://shivam-das-news.pages.dev` in each file when that Worker is deployed (and change its test line in the same commit).
- Owner to do in Cloudflare Pages settings: set the build variable `SITE_URL` to `https://shivam-das-news.pages.dev` (without it canonicals, sitemaps and `robots.txt` use `http://localhost:4321`; `validate-html.mjs` warns about it).
- HSTS: the owner decision about `includeSubDomains` (see "Open Items After v0.85.0") is closed for now: with no custom domain the header only covers `shivam-das-news.pages.dev` itself. Look at it again if a custom domain is ever added.
- Search Console: the two verification codes work only for the property made on this exact address.
- RISK, said plainly: AdSense and Google News are likely NOT to accept a free `pages.dev` address. Web reports about similar free hosts (for example `vercel.app`) say Google wants the applicant to own the domain; one guide lists a custom domain as a requirement. Not checked with Google for `pages.dev`. Adsterra is approved, so the Adsterra plan is not blocked by this. Decide before spending effort on AdSense.
- Everything under "Open Items After v0.85.1" and older still stands: `geoUrl` is still empty, `complianceMode` is still `true`, ads are still off.

## Open Items After v0.85.1
- Owner news, written 2026-11-16: **Adsterra has approved the site's account** and the owner wants the ads to start running. The owner has said in writing that compliance mode may be turned off (the rule of `AI_OPERATIONS.md` 13.3).
- Why ads are still not running: this is a documentation-only change (version 0.85.1); `config/ad-loader.json` was NOT changed. Compliance mode is still `true` and `geoUrl` is empty. With an empty `geoUrl` and `complianceMode: false` the build stops on purpose (ads never load without the country check), so the order matters.
- To start the ads, in this order: (1) the owner deploys the geo Worker: `cd workers/geo`, set `SITE_ORIGIN` in `wrangler.toml` to the real site address, then `npx wrangler deploy`; (2) the owner gives the Worker address (it ends with `/geo`); (3) put it in `geoUrl` and set `complianceMode` to `false` in ONE commit (a branch and a pull request, `AI_OPERATIONS.md` section 2); (4) build, deploy, then open one article page and check that the geo answer is `ads: true` and the ad scripts load (`?own-browser=on` must be OFF in that browser, or the loader stays silent).
- Owner decision still open: `BLOCKED_COUNTRIES` in `workers/geo/wrangler.toml` is `"IN"`, so readers in India see NO ads (PLAN 29.1). If most readers are in India, the earnings will be very small. Change the list only if the owner decides so; the plan's rule was written for the AdSense and Google News approval.
- Owner decision still open: Adsterra popunder and social bar with a pending AdSense and Google News application is a policy risk (BUGS A6, BETTER.md item 3). Turning compliance mode off switches off the clean state for ALL formats at once.
- Not changed: `config/ads.json` (`extraLines` is empty). If Adsterra gives an `ads.txt` line for the account, the owner sends it and it is added there; never invent it.
- Everything under "Open Items After v0.85.0" and older still stands.

## Open Items After v0.85.0
- New: `public/_headers` has a block for all paths with `X-Content-Type-Options: nosniff`, `Permissions-Policy` (camera, microphone, location and payment off) and `Strict-Transport-Security` (one year, with sub-domains, no preload). Every public page has a referrer meta tag. The site must be built and deployed again for it to work.
- Before deploying: run `npm test` and `npm run build` once (in this session only the 8 new tests and the 13 older new ones were run, with a stand-in test tool). After the deploy, look at the real headers once (browser network tab or `curl -I https://your-site/`) and check that each header appears once.
- Owner decision before the real domain goes live: `includeSubDomains` in HSTS affects every sub-domain of that domain for a year. If a sub-domain is still on plain http, take `includeSubDomains` out of `_headers` first.
- Not done yet: 6b (the Content-Security-Policy, report-only first, article pages last), Part 7 and Part 8, and the owner's Part 1 (Cloudflare settings). Everything under "Open Items After v0.84.0" and older still stands.

## Open Items After v0.84.0
- New: the "my own browser" switch (BOT_PROTECTION 5c). The owner opens any public address of the site once with `?own-browser=on` at the end, in every browser the owner uses (computer, phone). That browser then loads no ad and counts no visit. `?own-browser=off` switches it back. No settings change, no migration, no deploy of a Worker. The page layout changed, so the site must be built and deployed again for it to work.
- Before deploying: run `npm test` and `npm run build` once. In this session only the 13 new tests were run (with a stand-in test tool); the whole suite was not.
- Honest limits: the mark is per browser; a private window or cleared browser data loses it; the Analytics numbers already counted are not changed.
- Not done yet: Part 6 (security headers), Part 7 (trap link, IP list, hotlink rule), Part 8 (the Security screen), and the owner's Part 1 (Cloudflare settings). Everything under "Open Items After v0.83.1" and older still stands.

## Open Items After v0.83.1
- New: `config/site.json` holds two Google verification codes (owner's two Search Console properties). The page head writes one tag for each. Deploy the site, then press Verify in Google Search Console for each property. A property must be reached on the address it was made for, and that address must serve the home page with the tag.
- Several codes are now allowed for Google, Bing and Yandex (a text, a text with commas, or a list). Do not delete the tags after verifying: Google checks them again from time to time.
- Not done yet: everything listed under "Open Items After v0.83.0".

## Open Items After v0.83.0
- New: `workers/push/cleanup.js` (Phase 9 part 7c). Once an hour (UTC minute 7) the existing every-minute cron also deletes old push rows by PLAN 31.3: readers unseen 90 days with no delivery (a reader marked gone at once) with all their rows, `push_sent` and `push_audit` older than 30 days, `push_posts` older than 3 days, expired `push_held`, finished `push_queue` rows older than 1 day, and search words of a reader who is gone. It needs only the D1 database, so it runs even while sending is paused. No database change: no migration. No new variable or secret.
- To use it the owner must deploy the push Worker again (`cd workers/push` and `npx wrangler deploy`). Push is still off on the live site, so no live page changed.
- Honest limits: at most 50 readers a hour (1200 a day), 2000 rows a hour for each simple table; a missed tick skips that hour; nothing is deployed from this project and it has not run on a real Cloudflare D1.
- Not done yet: 7d (`push.yml`, the workflow that announces new posts after a deploy), 7e (the `push` fields in the post model and the editor, the analytics source "Push notification"), then parts 8 to 11.

## Open Items After v0.82.0
- New: the geo Worker answers `ads: false`, `consent: false`, reason `datacenter` to a visitor on a cloud or hosting network (BOT_PROTECTION 5b). The ad loader already loads nothing for `ads: false`, so the browser file did not change. The datacenter list moved to `workers/shared/datacenter.js`; the analytics Worker re-exports it, so there is one copy. New setting `BLOCK_DATACENTERS` in `workers/geo/wrangler.toml` ("true" by default). No database change: no migration. Ads are still off on the live site (compliance mode), so no live page changed.
- To use it the owner must deploy the geo Worker again (`cd workers/geo` and `npx wrangler deploy`). The analytics Worker behaves as before; deploy it again only to keep both Workers on the same files. Nothing is deployed from this project.
- Honest limits: the list is short and by hand (it needs a review now and then); a real person on a company VPN inside a cloud network sees no ads; Cloudflare WARP and Apple Private Relay readers are not on the list; the geo Worker keeps no count of refusals (the analytics `dc` counter shows datacenter visits); a datacenter visitor from a blocked country now gets the reason `datacenter` instead of `blocked`.
- Not done yet: Part 5c (the "my own browser" switch), then Parts 6 to 8, and the owner's Part 1 (Cloudflare settings).

## Open Items After v0.81.0
- New: the ad loader starts only after one real event (press, key, touch or scroll); the 4 second idle time is gone, and a made-up event (`isTrusted` false) is ignored (BOT_PROTECTION 5a). No settings change, no migration. Ads are still off on the live site (compliance mode), so no live page changed.
- Behaviour change for the money: a reader who only looks at the page and does nothing sees no ad, so ad views will be a little lower than with the old timer. That is the plan.
- Honest limits: the browser's scroll restore after a reload counts as a scroll; a bot that really drives a browser and really scrolls still passes this step; `idleMs` is still in the plan object and in the tests but nothing reads it (a later clean-up).
- The "Ad choices" note of v0.26.0 (the button is not added when the reader scrolls to the end first) now reads: before the first real event.
- Not done yet: Part 5b (no ads for the datacenter list, in the geo Worker) and Part 5c (the "my own browser" switch), then Parts 6 to 8.

## Open Items After v0.80.0
- New: the red note per page, per country and per source (BOT_PROTECTION 4b-4). An item gets a note when its unverified views are at least 10 and at least 3 times its own count in the period just before. The Worker's `GET /stats` gives `itemUnverified` for 5 min, 1 hour and 24 hours. No database change: no migration. The beacon is still off on live pages, so no live page changed.
- Honest limits: no item note for 7 days and lifetime (null); a new page, country or source has a normal level of 1, so it needs 10 unverified views to be noted; only the top 10 items by unverified views now are checked; the chart, visitors and average read time still use all views.
- Not done yet: Parts 5 to 8 of BOT_PROTECTION, and the owner's Part 1 (Cloudflare settings).

## Open Items After v0.79.0
- New: the Analytics screen (BOT_PROTECTION 4b-3). The main page views are verified human views, a card shows unverified views and their share, and a red note shows when the newest chart step has at least 3 times the normal level of unverified views. The Worker's `GET /stats` also gives `unverifiedTimeline`. No database change: no migration. The beacon is still off on live pages, so no live page changed. The dashboard is only for admins.
- Honest limits: days saved before v0.77.0 have no verified count, so in the Lifetime view they show as all unverified; the 5 min range has too few steps for the red note; visitors and average read time still use all views; the chart still draws all views.
- Not done yet: Part 4b-4 (the 3 times note per page, per country and per source, which needs a normal level per item), then Parts 5 to 8.

## Open Items After v0.78.0
- New: the page script sends its first message after 5 counted reader seconds (nothing for a shorter visit); the Worker stores one page view per session per address per 30 minutes (BOT_PROTECTION 4b-2). No database change: no migration. The beacon is still off on live pages, so no live page changed.
- Behaviour change for the numbers: views will be lower than with the old rules (no reloads, no bounces under 5 seconds). That is the plan. Compare numbers only within the same rules.
- Honest limits: the reader is the tab's random session id (a new tab counts again); a real person who leaves in under 5 seconds is not counted.
- Not done yet: Part 4b-3 (the two lines in the Analytics screen with the red note above 3 times the normal level; main numbers on verified human), then Parts 5 to 8.

## Open Items After v0.77.0
- New: the analytics Worker stores `dc` (1 for a datacenter network, from `request.cf.asn`) and counts verified human views (`acted` 1, `webdriver` 0, `dc` 0) in the hourly and daily totals and in `GET /stats` (`verifiedViews`, `unverifiedViews`). `views` and the dashboard screen are unchanged. The beacon is still off on live pages, so no live page changed.
- **If the analytics D1 database was made before v0.77.0, the owner must run `workers/analytics/migrate-0.77.0.sql` once** before the new Worker is deployed (after `migrate-0.76.0.sql` if that one was not run either). Without it every save fails (500). A database made new from `workers/analytics/schema.sql` already has the columns: do not run the migration there. Nothing is deployed from this project yet.
- Honest limits: the datacenter list is short and by hand (it needs a review now and then); a real person on a company VPN in a cloud network counts as unverified; days counted before this version show as unverified in the lifetime number (their `verified_views` is 0).
- Not done yet: Part 4b-2 (one visit per reader per page per 30 minutes; the 5-second rule) and Part 4b-3 (the two lines in the Analytics screen with the red note above 3 times the normal level; main numbers on verified human).

## Open Items After v0.76.0
- New: the beacon message has `acted` and `webdriver` (numbers 0 or 1) and the analytics Worker stores them on the page view row (BOT_PROTECTION 4a). The beacon is still off on live pages, so no live page changed.
- **If the analytics D1 database already exists (made before v0.76.0), the owner must run `workers/analytics/migrate-0.76.0.sql` once** before the new Worker is deployed. Without it every save fails (500) because the new columns are missing. A database made new from `workers/analytics/schema.sql` already has them: do not run the migration there. Nothing is deployed from this project yet, so this matters only if the owner created the database by hand earlier.
- Not counted yet: the flags are stored and not used. The dashboard numbers are the same as before. Part 4b makes the two counters (verified human and unverified), the datacenter list, the rule "one visit per reader per page per 30 minutes", the two dashboard lines and the 5-second rule.
- Left out on purpose: a `headless` flag (the Worker already drops every agent that says Headless, so it would never arrive).
- Honest limit: `acted` stops scripts that fake events and plain bots. A real browser driven by a tool that sends real input events looks like a person to this signal. No real phone test has been done.

## Open Items After v0.75.0
- New: `npm run pages` adds the section "Checks that you are a person" to the Privacy Policy when the contact form, the analytics beacon or push is switched on (BOT_PROTECTION 3d). Nothing else changed: no Worker, no live page.
- Order for the owner: fill `config/contact.json`, `config/analytics.json` and `config/push.json` first, then run `npm run pages`. If the pages were made earlier, `npm run pages` leaves them alone (it never rewrites a page), so add the section to the Privacy page by hand in the dashboard; the exact text is in `scripts/required-pages-lib.mjs`, function `personCheckSection`.
- Honest limit: the text names Cloudflare Turnstile and says it runs a check in the browser. Cloudflare's own privacy policy governs what Cloudflare does with that; the owner should read it and, if a lawyer reviews the legal pages, ask about this line too.
- Not done yet: the guard for the chat (no chat Worker exists), Parts 1 and 4 to 8 of the bot protection plan.

## Open Items After v0.74.0
- New: the analytics Worker uses `workers/shared/guard.js` on `POST /collect` and has `GET /stamp`. The beacon script (`beacon-client.js`) asks for the stamp when the page opens and sends it with every message. The beacon is still off (`config/analytics.json` is empty), so no live page changed.
- **Before the beacon is switched on the owner must set the new secret** `STAMP_SECRET` in `workers/analytics` (a long random text). Without it `/collect` and `GET /stamp` answer 503 and nothing is counted. `COLLECT_OFF` in `wrangler.toml` is the kill switch; it does not touch `/stats` or `/trending`.
- Behaviour change: `/collect` now refuses an extra field (400), a number sent as text (400) and any type other than `text/plain` or `application/json` (415). The beacon script already sends only the known fields as numbers and text. A message without a good stamp is not counted (400).
- Cost: one more Worker call for every article page view (`GET /stamp`). The free plan allows 100,000 calls a day; with the beacon on, a page view is about 3 to 4 calls (stamp, first message, a message every 30 seconds, leave). Check this against real traffic before launch.
- The shared guard got two more small options: a `number` field and `allowPlain` (also accept `text/plain`). Contact and push are unchanged.
- Not done yet: the guard for the chat (no chat Worker exists), the Privacy page line (3d), a hashed rate counter in D1 for analytics (the optional limiter binding by session id is as before).
- The stamp stops only scripts that never ask for one (BUGS W13). A real phone test with the real Worker has not been done.

## Open Items After v0.73.0
- New: the push Worker uses `workers/shared/guard.js` on `/subscribe`, `/preferences`, `/unsubscribe` and `/test`, and has `GET /stamp`. `/subscribe` needs a stamp; the page script (`push-client.js`) asks for it before every subscribe call. Notifications are still off on live pages (`config/push.json` is empty), so no live page changed.
- **Before notifications are switched on the owner must set the new secret** `STAMP_SECRET` in `workers/push` (a long random text). Without it `/subscribe` and `GET /stamp` answer 503. `PUSH_SUBSCRIBE_OFF` in `wrangler.toml` is the kill switch for new subscriptions only; `/unsubscribe`, `/preferences` and `/test` are never switched off.
- Behaviour change: the four browser routes now refuse a request with an extra field (400) and a request that is not `application/json` (415). The page script already sends JSON with only the known fields. `POST /test` used to ignore extra fields.
- The shared guard got two small options: a text field can be `optional` (left out when missing) and a field can be an `object` (handed on unchanged); a Worker can set `stampMinMs` and `stampMaxMs`. Contact is unchanged.
- Not done yet: the same guard for analytics `/collect` and chat (3c), the Privacy page line (3d), a hashed rate counter in D1 for push (the Worker still limits new readers in total, 200 an hour, and by the optional limiter binding).
- The stamp stops only scripts that never ask for one (BUGS W13). A real phone test with the real Worker has not been done.

## Open Items After v0.72.0
- New: the contact Worker uses `workers/shared/guard.js` and has `GET /stamp`. The contact page script fetches the stamp and sends the message as JSON. The form is still off (`config/contact.json` is empty), so no live page changed.
- **Before the form is switched on the owner must set two secrets** in `workers/contact`: `TURNSTILE_SECRET` (already needed) and the new `STAMP_SECRET` (a long random text). Without either the form answers 503. `CONTACT_OFF` in `wrangler.toml` is the kill switch.
- Messages from the browser are now `application/json`, so the browser asks the Worker first (preflight). The Worker already answers it.
- Not done yet: the same guard for push subscribe (3b), analytics `/collect` and chat (3c), the Privacy page line (3d), a duplicate-message key and a hashed rate counter in D1 (the contact Worker still limits by email and in total).
- The stamp stops only instant scripts (BUGS W13). A real browser test on a phone with the real Worker and Turnstile has not been done.

## Open Items After v0.71.0
- New: `workers/shared/guard.js` (bot protection Part 2). Pure rules for every Worker: kill switch, method, exact origin, JSON only, size, exact fields, hidden trap field, signed fill-time stamp, hashed rate and duplicate keys, link check. 38 tests. Nothing calls it yet, so no behaviour changed.
- Next small part (Part 3): Turnstile with the guard in the contact Worker first, a `GET /stamp` route, a stamp secret (`STAMP_SECRET`), and the page script that fetches the stamp and sends it back. The contact Worker already has its own Turnstile check and trap field; Part 3 joins the two without a second form.
- The rate counter (D1 table or the Workers rate limit binding) is chosen when the first Worker is connected.
- The owner still has to do Part 1 (Cloudflare settings and rules) by hand.

## Open Items After v0.70.4
- Documents only. `BOT_PROTECTION.md` is the plan for real readers only: nine layers, five Cloudflare rules, Turnstile, Worker checks, a human score for analytics and ad safety. Nothing is built or switched on yet.
- The owner can do Part 1 (Cloudflare settings and rules) alone with the click list; it needs no code. Run the test table in Section 15 after each rule, especially Search Console, Publisher Center and the AdSense site check.
- Seven owner decisions are in Section 16 of that file (Cloudflare plan, Access for `/admin`, AI crawler block, datacenter networks, RSS summary or full text, trap link, alert contact).
- `npm test` and `npm run build` were rerun after this change and passed.

## Open Items After v0.70.3
- AdSense id is set in `config/ads.json`; `ads.txt` now has the AdSense line. No ad shows yet: `adsense.slot` in `config/ad-loader.json` is empty and compliance mode is ON.
- To show a unit: create an in-article ad unit in AdSense, copy the digits from `data-ad-slot`, put them in `adsense.slot`, and switch compliance mode off only after AdSense approval.
- If AdSense asks for its code snippet in the page head to verify the site, that needs a new small part (a head tag that follows the consent rule). Not built.

## Open Items After v0.70.1
- Documents only. `BETTER.md` has a new section "New Ideas Added in v0.70.1" with 24 ideas (N1 to N24), each with value, effort and a status box. None is built. Decision 17 (public or private repository) now has an option that keeps the code public: N1, a private drafts repository.
- No code, no test and no behaviour changed. `npm test` and `npm run build` were not rerun for the ideas themselves.

## Open Items After v0.70.0
- New: auto language and location schema (PLAN 36). `inLanguage` follows the site locale on every block. Every post gets `contentLocation` and `locationCreated` when a place is found from the front matter `location`, the dateline, the title, the tags or the first 300 words.
- `config/locations.json` ships empty. The owner should add the cities and states the site covers (for example Kolkata and West Bengal with country `IN`); until then only countries, datelines and the `location` field give places.
- Not built: the dashboard field for `location` in the post editor, a preview of the detected place in the editor, and a build report listing posts with no place. The field is kept on save and an AI can write it.
- The scan reads only English text and can guess wrong (a country named in a title that is not the story's place). Use `location` to fix it or `["none"]` to switch it off. Check a few real posts in the Rich Results Test after the first deploy.
- `Intl.DisplayNames` is used for the country list. Cloudflare Pages and GitHub Actions run Node with full ICU, but this was not checked on a real build there (BUGS L8).
- No page text shows the place. If a visible dateline or place label is wanted, it is a new part.

## Open Items After v0.69.0
- New: `workers/push/control.js` (part 7b). The `scheduled` handler of the push Worker sends one batch every minute (`[triggers]` in `wrangler.toml`), and `POST /announce` plans the accepted posts. Both do nothing until the D1 database, `VAPID_PUBLIC_KEY` and the two secrets exist. Nothing was deployed, so no reader is notified.
- Kill switch: the variable `PUSH_PAUSED` ("true", "1", "yes" or "on"). While it is on, nothing is planned and nothing is sent; messages already in the queue wait until their time to live ends or the switch is off. The admin Push screen (part 10) will get a button for it.
- `/announce` answers with `planning` (counts only) when sending is ready. The deploy job `push.yml` (part 7d) must not treat `planning.errors` above 0 as a failed deploy: the posts are recorded.
- At most 5 posts are planned in one call (the import guard keeps 2). Free plan limits for a cron tick and for one `/announce` call with a live check plus planning were not checked on a real Cloudflare account.
- Still not built: 7c (clean-up cron for old rows), 7d (`push.yml`), 7e (post model fields and the analytics source "Push notification"), parts 8 to 11, and the release of held stories and the digest.
- Not tried on a real D1 database or a real Cloudflare cron. Tested on real SQLite (29 tests).

## Open Items After v0.68.1
- Documents only: `AI_OPERATIONS.md` Section 13 gives an AI with GitHub access a recipe for every dashboard menu. The rules come from the real code, but they were not tried with a real AI connector yet (Phase 3d part 5 is still the first trial, on a branch).
- Still not possible through GitHub alone: the private analytics numbers, the Export XML, pictures through a text-only connector, and all Cloudflare, key and account work.
- `validate-content.mjs` and `validate.yml` (Phase 3d parts 2 and 3) are still not built, so the check before a merge is still the Cloudflare Pages preview build.
- The repository is still public (decision 17).
- `npm test` and `npm run build` were not run for this version (no code changed and no `node_modules` in the working folder).

## Open Items After v0.68.0
- New: `workers/push/sender.js` (part 7a). `runSender(db, opts, now)` is one batch of at most 36 messages: it takes back messages that were claimed and never finished (claim time 5 minutes), drops messages older than their time to live, claims the next ones (breaking first, then the higher score, then the older), reads the reader and the post, sends with `sendPush`, and writes the results in one database batch (`push_queue`, `push_sent`, the counters `sent_today`, `sent_day`, `last_sent` and `failures` of the reader).
- Nothing calls `runSender` yet. There is no cron, no kill switch in the Worker and `POST /announce` does not call `runPlan`, so `push_queue` stays empty on a real site and no reader is notified. Part 7b connects all three together, so no message can wait without a sender.
- Database change: `push_queue` has a new column `next_try`. A database made from `schema.sql` before v0.68.0 needs the `ALTER TABLE` line written in the file. Nothing was deployed yet, so nothing needs to be changed now.
- Answers of the push service: 404, 410 or unusable keys delete the reader and everything of the reader at once. 429 stops the batch and waits for Retry-After (one minute if none), counting nothing. 401 and 403 are a problem of ours: the batch stops, the messages wait 10 minutes, nothing is counted against any reader. Other errors are retried twice (after 1 and 5 minutes), then the message fails and the reader gets one failure; 5 in a row and the audience search skips the reader (a new subscribe resets it). A message that fails because its post is missing or its text cannot be used does not count against the reader.
- A story update (same thread sent in the last 12 hours) uses no daily slot and does not change `last_sent`.
- If the Worker stops after the push service accepted a message but before the result is written, the message is sent again after the claim time. The tag of the notification makes the phone show one. This cannot be removed without a second write before the send.
- `runSender` returns counts only: no push address, key or text, and it calls no `console` function.
- `push_audit.sent` still holds the number queued (written by `runPlan`), not the number delivered. The admin Push screen (part 10) must count delivered messages from `push_sent`.
- Held stories are still not released when quiet hours end, and the digest is still not built (parts 7b, 9).
- The figures for the free plan (about 50 outgoing calls, 6 open connections, the size of one database batch) are the figures of the plan text, not checked on a real Cloudflare account. `SEND_BATCH`, `SEND_CONCURRENCY` and `RESULT_CHUNK` are constants at the top of `sender.js`. Check the current limits before the first real send.
- Not tried on a real D1 database. Tested on real SQLite (54 tests).

## Open Items After v0.67.0
- New: `workers/push/plan.js` (part 6d). `runPlan(db, postKey, now)` reads the post from `push_posts`, finds the candidates (part 6c), reads their choices (`push_terms`), what was sent to them in the last 12 hours (`push_sent`, with the category from `push_posts`) and what waits in `push_queue`, runs `scoreSubscriber` and `deliveryDecision` of `lib.js`, and writes `push_queue` (queued), `push_held` (quiet, gap, digest) and one `push_audit` row. It changes no counter of a reader (`sent_today`, `last_sent`): only the sender does that (part 7).
- Nothing calls `runPlan` yet. `POST /announce` still only records posts, so `push_queue`, `push_held` and `push_audit` stay empty on a real site and no reader is notified. Part 7 connects it after the post is recorded, together with the sender, so no message can wait in the queue without a sender.
- Waiting messages (state queued or sending) count against the daily limit like a send, so a slow sender cannot let one reader get more than the limit. They are not used for the minimum gap yet.
- The queue row has no "update" flag. The sender (part 7) must work it out again (the same thread sent in the last 12 hours) so an update does not use a daily slot.
- The first 300 words of the text (match strength 0.35) are not used: `/announce` does not send the text and `push_posts` does not keep it. The other strengths work.
- The thread key uses the alphabetical fallback for tags (no site-wide tag counts yet), the same on every call, so the same story always gets the same key.
- A held story (quiet hours, gap) is only stored. Releasing it when the quiet hours end, and the digest, are part 7 and part 9. `push_held` rows expire by time (6 hours, 12 for the digest) and are limited to 5 for each reader inside one SQL statement.
- Reading is done in chunks of 80 readers (D1 allows 100 values in one query) and writing in batches of 40. A database error while reading or writing goes up and stops the step: nothing is half-written for the reading part, and the audit row is written last.
- Not tried on a real D1 database. Tested on real SQLite (36 tests).

## Open Items After v0.66.0
- New: `workers/push/audience.js` (part 6c). For one post it finds the candidate readers through the indexes of `push_terms` (door "cat", door "kw" through the keyword index `kwtok`, door "author") and, for breaking news only, through `push_subs_breaking` (door "breaking"). It keeps only readers who are active, have fewer than 5 failures in a row and are not paused. A reader found through two doors is one candidate with both doors listed.
- It only FINDS. A keyword word that matches is a hint: the real strength (`keywordHit`), the mute rule, the gate, the score, the daily limit, the gap, quiet hours and threads are part 6d. Nothing calls the module yet: `POST /announce` still only checks and records posts, so `push_audit` stays empty and no reader is notified.
- The loaded rows (`loadCandidates`) have no push address, no keys and no token, only what scoring needs. The address and keys are read at send time (part 7).
- Limits: at most 240 words of a post are used for the keyword search (title, focus keyword and tags come first), each query holds at most 60 words (D1 allows 100 values), and a list longer than 5000 candidates is cut and marked `truncated`. A database error stops the search: no half list is used (PLAN 31.10).
- Not tried on a real D1 database. The tests use real SQLite, and one test checks with `EXPLAIN QUERY PLAN` that the queries use the indexes and do not scan every reader.
- The scoring part will also need the reader's choices (categories, keywords, muted words, authors) for the candidates: they are in `push_terms`, kinds `cat`, `kw`, `mute`, `author`. Part 6d must read them for the candidate ids only, in chunks.

## Open Items After v0.65.3
- New: `AI_OPERATIONS.md` (the recipes for an AI assistant with GitHub access), PLAN 35, LOGICS 23, BUGS group V, CODING_PLAN Phase 3d. The guide is written from the real code (`content.config.ts`, `posts.ts`, `redirects.ts`, `gone.ts`, `rebuild.yml`); the check script and `validate.yml` are not built yet.
- The repository `shivam-das-news` is public. Decision 17 above.
- Not possible through GitHub alone: Cloudflare settings and secrets, search and ad accounts, and (unless the connector writes binary files) pictures.
- Scheduling is `status: published` with a future date; `status: scheduled` is not read by the build. The dashboard shows both as "scheduled".
- Not tried with a real AI connector. A first trial on a branch is Phase 3d part 5.

## Open Items After v0.65.2
- New plan only (PLAN 34, LOGICS 22, BUGS group U, CODING_PLAN Phase 3c): hotlinked pictures are downloaded, renamed for SEO, hosted on our own CDN and the post is rewritten. No code is written. Decisions 15 and 16 above need an answer before part 1.
- Rights: hosting a picture does not give the right to publish it. The plan keeps the source, asks first for agency hosts and shows a notice; the owner stays responsible.
- It builds on the image re-hosting of the XML import (v0.13.0) and on the media metadata file of PLAN 33 (`config/media.json`).

## Open Items After v0.65.1
- New plan only (PLAN 33, LOGICS 21, BUGS group S, CODING_PLAN Phase 3b): the Shopify-style "Search engine listing" box in every editor and the Files editor with alt text. No code is written. Decisions 13 and 14 above need an answer before part 1.
- The live SEO score and previews of v0.3.0 stay; the new box reuses them.

## Open Items After v0.65.0
- The live check is built (`workers/push/livecheck.js`) and used by `POST /announce`: before a post is recorded the Worker opens its address (GET, no redirects followed, 5 seconds, at most 5 pages at a time, only the head of the page is read). It needs status 200, an HTML page and no `noindex` or `none` in the `X-Robots-Tag` header or in a robots or googlebot meta tag.
- Still no reader is found, scored or notified (6c was built in v0.66.0 as a module only; 6d, 7 are open). `config/push.json` stays empty for readers.
- A post that fails the live check (`not_live`, `noindex`, `check_failed`) is NOT written to `push_posts`. The deploy job of part 7 must ask again a few minutes later while the post is younger than 120 minutes, because a new page may take a minute to spread after a deploy.
- The redirect history rule (a changed slug keeps its old key, PLAN 31.5) is not part of 6b; the live check only looks at the address it is given.
- A page that answers 200 but is really an error page (a soft 404) passes the check. The check does not read the text of the page, only the head.
- Tested with fake pages and a fake database on real SQLite (48 new tests, 42 old ones updated to give the Worker a fake live page). Not tried against a real deployed site.

## Open Items After v0.64.0
- `POST /announce` only checks and records posts. No reader is found, scored or notified yet (6b to 7), so filling `config/push.json` still gives readers nothing but the test message.
- The secret `ANNOUNCE_SECRET` (32 characters or more) is set with `npx wrangler secret put ANNOUNCE_SECRET` in `workers/push`; the same value goes into a GitHub repository secret for the job of part 7. Without it the route answers 503.
- The live check of PLAN 31.5 (the Worker opens the URL and needs status 200 and `index`) is NOT built. It is 6b. Until then a post is trusted as far as the deploy job's data and the checks in `announce.js` go.
- The post editor does not have the fields `push`, `pushTitle` and `pushBody` yet (part 7); the deploy job sends the defaults until then.
- `push_posts` rows are not cleaned yet (part 7, "kept 3 days").
- Tested with the real Worker on SQLite and a fake database for the failure cases (42 tests). Not deployed, not tried against a real deploy job.

## Open Items After v0.63.0
- Still do NOT fill `config/push.json` for readers: parts 6 and 7 (announce, queue, sender) are not built, so the only message a reader can get is the test. The bell button, the header bell and the soft prompt stay hidden while the file is empty.
- The bell button needs the story to have a `focusKeyword` to fill the keyword; without one it fills the category only. A keyword with letters outside English (Bengali, Hindi) is left out because the Worker accepts English keywords only.
- Tested in jsdom with a fake push client (28 new tests) and by a temporary build of one sample post. Not tried on a real phone or with the deployed Worker.
- Next small part: part 6, the first piece (`POST /announce` checks), written as its own small step with its own tests.

## Open Items After v0.62.0
- `config/push.json` may be filled for a first real-phone test only after the Worker is deployed with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Real stories still cannot be sent (parts 6 and 7), so the only message a reader can get is the test.
- A database made before v0.62.0 needs `ALTER TABLE push_subs ADD COLUMN last_test INTEGER;` once (the Worker is not deployed yet, so today nothing needs it).
- (Done in v0.63.0.) The article bell button was not built in v0.62.0. It was part 5c-6.
- The test uses the same send code as the real sender will (`sendPush`), so a good test on a real phone also proves the VAPID keys and the encryption. Not tried on a real phone yet.
- Tested with the real Worker on SQLite and a fake push service (24 tests) and in jsdom for the page and the client (26 tests).

## Open Items After v0.61.0
- Still do NOT fill `config/push.json`: nothing can send yet (parts 6 and 7). The page stays hidden while the file is empty.
- The Authors block is built but invisible today: the site has one author (`shivam-das`). It appears by itself after a second author has a published story. A temporary build with two authors showed it.
- An author alone is not a choice: the Worker needs a category, a keyword or Breaking news as well (the page says so under the block).
- If the Authors block disappears later (fewer than two authors), the authors a reader saved stay in the Worker but cannot be seen or changed on the page until the block returns.
- (Done in v0.62.0.) "Send me a test notification" was not built in v0.61.0. It needs a new Worker endpoint (rate limited, sends one fixed message to the caller's own subscription) and a `test` function in `push-client.js`, then the button. Planned as 5c-5.
- Tested in jsdom with a fake push client (12 new tests, one compares the author id rule with the Worker). Not tried on a real phone or with the deployed Worker.

## Open Items After v0.60.0
- Still do NOT fill `config/push.json`: nothing can send yet (parts 6 and 7). The page stays hidden while the file is empty.
- The digest choice is only stored. Nothing builds or sends a digest until part 9 (digest and held stories), so a reader who picks a digest today would get no summary. Keep the feature off (empty `push.json`) until part 9 is built, or hide the Digest block for the first launch.
- The pause is stored by the Worker (`status` and `paused_until`). The sender (parts 6 and 7) must skip paused readers and clear a finished timed pause; until then a pause has no effect.
- The pause list is shown only to a reader who already has notifications on. A running timed pause is shown as "Paused until <date and time>" (24 hour clock, in the reader's browser zone) and is kept by Save; pick "Not paused" and Save to end it.
- The page lists the digest modes, the hours and the pause words from its own copy; a test compares them with the Worker, so a change in `workers/push/prefs.js` fails `npm test` until the page is changed too.
- Tested in jsdom with a fake push client (19 new tests). Not tried on a real phone or with the deployed Worker.
- Still to do in 5c: authors, the test notification.

## Open Items After v0.59.0
- Still do NOT fill `config/push.json`: nothing can send yet (parts 6 and 7). The page stays hidden while the file is empty.
- Quiet hours use the time zone of the reader's browser, sent when notifications are turned on. A reader who travels keeps the zone from the day they subscribed until the Worker is told a new one (a later part).
- The defaults on the page (on, 22:00 to 07:00, breaking news not allowed) equal the Worker defaults; a test compares them.
- What happens to a story that arrives in quiet hours (held up to 6 hours, at most 5 items, then released or dropped) belongs to the sender parts 6, 7 and 9; the page only stores the choice.
- Tested in jsdom with a fake push client (17 new tests). Not tried on a real phone or with the deployed Worker. Some phone browsers show their own time picker; check it on Android Chrome and Safari.
- Still to do in 5c: digest, pause, authors, the test notification. Until then the Worker's defaults apply (no digest).

## Open Items After v0.58.0
- Still do NOT fill `config/push.json`: nothing can send yet (parts 6 and 7). The page stays hidden while the file is empty.
- The keyword boxes are tested in jsdom with a fake push client (18 new tests) and with the real Worker rules for the limit (the page limit must equal `MAX_TERMS`). Not tried on a real phone or with the deployed Worker.
- The page checks only the count and a word in both boxes. The words themselves (English letters, digits, spaces, hyphens and apostrophes; up to 4 words and 40 characters; not too common) are checked by the Worker, and its sentence is shown.
- The reader sees the keywords exactly as written (the Worker stores the written form and a cleaned form for matching).
- Still to do in 5c: quiet hours, digest, pause, authors, the test notification. Until then the Worker's defaults apply (quiet hours 22:00 to 07:00, no digest).

## Open Items After v0.57.0
- Still do NOT fill `config/push.json`: nothing can send yet (parts 6 and 7), so readers who turn notifications on would collect nothing and the Worker is not deployed. The page and the bell stay hidden while the file is empty.
- The page is tested with a fake push client in jsdom and with two temporary builds (file empty, file filled with a made-up key); it has not been used with the real Worker or on a real phone.
- The page has the core choices only. Keywords, mute, authors, quiet hours, digest, pause and the test notification are part 5c; until then the Worker's defaults apply (quiet hours 22:00 to 07:00, no digest).
- The article bell button ("Get alerts for this topic", PLAN 31.1) is not built yet.
- Categories on the page come from the published posts at build time; a new category appears after the next build.

## Open Items After v0.56.0
- The soft prompt button opens `/notifications/` (built in v0.57.0). With the file empty (as shipped) nothing is added to any page.
- The soft prompt is tested with a fake window and one temporary build; it has not been seen on a real phone. After 5b, test on Android Chrome first.
- The prompt keeps up to 20 article addresses and a dismiss count in the browser (`localStorage`, key `pushPrompt`). Nothing is sent to any server.
- The "never on the first visit" rule means the first article a browser opens never shows the card; the 45 second rule works from the second visit on. Change `existed` in `push-prompt-client.js` if you want it differently.

## Open Items After v0.55.0
- The Adsterra addresses are in `config/ad-loader.json`, but ads stay off: compliance mode is ON and `geoUrl` is empty. Deploy `workers/geo`, fill `geoUrl`, then turn compliance mode off.
- The smartlink opens only from a click on an article picture, one time per session. Not tried on a real phone yet. Adsterra and AdSense policy risk (BETTER.md item 3) still applies.

## Open Items After v0.2.0 (Phase 2)
- Fill the new fields in `site/config/site.json`: `sameAs`, `publisherEmail`, `publisherCountry`, `description`, `tagline`, `verification` codes.
- Logo and icons are done (v0.2.1). To change the logo, replace `site/brand/source-icon.png` and run `npm run icons`.
- Host settings needed: `SITE_URL`, `INDEXNOW_KEY` (build), GitHub secrets `SITE_URL`, `INDEXNOW_KEY`, `CF_DEPLOY_HOOK` (workflows).
- Image width check (BUGS S9, 1200 px): a build warning since v0.2.3; the Phase 3 media library will block it in the editor.
- Article schema carries one image; the 16:9, 4:3 and 1:1 variants need the Phase 3 image pipeline.
- Robots AI-crawler settings live in `config/robots.json` for now; the admin screen comes in Phase 3.
- Redirects (`_redirects`, trailing slash, case rules) start in Phase 4.
- Do not change the live structure during a Google core update rollout (see SEARCH_ENGINE_UPDATES.md).


## Open Items After v0.2.2
- The publisher time zone is `America/New_York` (decided 2026-11-18). URLs contain the date and are permanent, so do not change it after the first real post.
- Still not built: the 16:9 / 4:3 / 1:1 schema images (needs the Phase 3 image pipeline).
- Real browser and phone visual testing has not been done yet.
- Docs still describe `/src` and `/content` at the repo root; the real code is inside `site/`.
- Ad strategy risk: Adsterra popunder / social bar with AdSense and Google News approval (see BETTER.md item 3). Decide the order before Phase 5.

## Open Items After v0.2.3
- IndexNow git mode and the hourly ping were tested on a local git repo with `--dry`; the real GitHub Actions run and the real IndexNow server reply have not been tested yet (needs your repo, `SITE_URL`, `INDEXNOW_KEY`).
- IndexNow does not yet report deleted posts (needs the Phase 4 redirect and 410 logic).
- Next: Phase 3 (admin).

## Open Items After v0.3.0 (Phase 3 part 1)
- The dashboard is tested only against a fake GitHub. Not yet tried: a real GitHub OAuth app, the deployed Worker, a real save to your repo, a real phone. Do this first (steps in `site/README.md`, "Phase 3 setup").
- Set `repo`, `authUrl` and `roles` in `site/public/admin/config.json`. Deploy `workers/auth/` with the GitHub OAuth secrets.
- Roles hide screens in the dashboard. The real lock is GitHub: only people with write access to the repo can save, and `ALLOWED_USERS` in the Worker limits who can sign in.
- The dashboard saves straight to the configured branch (default `main`), so each save starts a deploy. A separate `content` branch (BUGS B1) is not built.
- Archiving or moving a live post does not yet give a 410 or a redirect for its old URL (Phase 4). Moving a post only keeps `redirects` in its front matter.
- The post list reads every post file when you open it (cached for the tab). Fine for hundreds of posts; a built index is needed for thousands.
- Image check: a featured image under 1200 px is blocked. If the width cannot be read (remote image), the editor only warns.
- The `scheduled` value in the post schema is not used by the build. The dashboard schedules with `status: published` and a future date (as in README).
- Images are converted in the browser; very large photos from old phones may be slow.

## Open Items After v0.4.0 (Phase 4 part 1)
- `_redirects` is tested with a temporary post on a local build. It has not run on a real Cloudflare Pages deploy yet. After the first real move of a live post, open the old URL and check for a 301.
- Redirects need a host that reads `_redirects` (Cloudflare Pages). On pure GitHub Pages they do nothing (stub pages are not built).
- Archived posts now answer 410 (v0.6.0). A post file that is deleted on GitHub leaves no trace, so its address still gives 404. Archive instead of deleting.
- Renaming a category slug is built (v0.16.0, Categories screen).
- Cloudflare Pages allows 2000 static redirects. The build stops above that.
- A failed move is undone by the dashboard. If both the removal and the undo fail, the editor must delete one file on GitHub by hand (the message names both paths).
- Astro keeps a content cache in `node_modules/.astro`. If a deleted post still appears in a local build, delete that folder.

## Open Items After v0.5.0 (Phase 4 part 2)
- The Redirects screen is tested only against a fake GitHub (like the rest of the dashboard). Try it once on the real repo.
- The CSV import is not tested in a browser file picker (only the parser is tested). Try a small file first.
- A hand-made redirect may only point to a live page of this site (post, page, category, home). A target that is missing at build time is dropped and printed as `[redirects]` in the build log. Read the log after importing a big CSV.
- A hand-made redirect whose old address is a live page is dropped (loop guard). Remove it from the list or the build log will keep reporting it.
- The dashboard checks only live posts when it tests an old address. The build checks every live page.

## Open Items After v0.6.0 (Phase 4 part 3)
- The 410 Function is tested in code and the build files are checked, but it has not run on a real Cloudflare Pages deploy. After the first archive, open the old address and check for status 410 (browser developer tools, Network tab).
- Cloudflare Pages must use **Root directory = `site`**, so it finds `site/functions/`. Without it the Function is not deployed and archived posts give 404 (nothing else breaks).
- Functions are metered on the free plan. `_routes.json` keeps the Function off normal pages. Do not replace `dist/_routes.json` with `include: ["/*"]`.
- At most 100 gone addresses. An archived post uses one address plus one for each old address it had. More than 100: the extra ones give 404 and the build log says how many.
- An archived post that was never published also gets a 410 at the address it would have had. This is harmless.
- If a live post later takes the permalink, category and date of an archived one, the live page wins and the 410 is dropped.

## Open Items After v0.7.0 (Phase 4 part 4)
- Related stories are chosen at build time. The first posts will have few or none (the block stays hidden until there is something related). Real tags and a focus keyword on each post make the list better.
- The score has no popularity part yet (needs Phase 6 analytics).
- Related stories are not tuned on real content. Look at 5 real articles after the first 20 posts and adjust the weights in `src/lib/related.ts` if the list feels off.
- Still missing from the plan's linking section: links inside the text, "Read next", "Trending", orphan report.

## Open Items After v0.8.0 (Phase 4 part 5)
- Auto links are chosen at build time and tested on 4 temporary posts, not on real content. After the first 20 posts, read 5 real articles and check that the links make sense. Weights are in `src/lib/autolink.ts` (`W`).
- A post is linked by a phrase of two or more words (its focus keyword or title). Give each post a clear focus keyword, or it will rarely be linked to.
- Tag pages are linked only when the tag has at least `thinTagMinPosts` posts (the same rule that keeps thin tags out of search results).
- The hand-made list is the file `site/config/links.json`. The Links screen edits it since v0.15.0.
- The linker reads the rendered article text that Astro stores (`rendered.html`). If a future Astro version changes this, the page falls back to the plain text without auto links (nothing breaks).
- Still missing from the plan's linking section: "Trending" (the numbers endpoint exists since v0.39.0; the block on the site is still to do).

## Open Items After v0.9.0 (Phase 4 part 6)
- "Read next" is chronological (older story of the same category). It is tested on 5 temporary posts only. Look at it on real content after the first 20 posts.
- The `[orphan]` warning appears in the build log (Cloudflare Pages build log or `npm run build`). It does not stop the build. Fix it with tags, a focus keyword, or a hand-made link in another article.
- A brand new article is an orphan until an older article is related to it or a newer one links to it. Early in a site's life the warning is normal.
- There is no orphan screen in the dashboard yet.

## Open Items After v0.10.0 (Phase 4 part 7)
- The Import screen only previews. It has not been tried with a real Blogger or WordPress backup yet. Try it with your own export first; large files (many MB) read in the browser and may be slow on a phone.
- The preview uses the posts already in your repository to find duplicates. If posts are added in another tab after the screen opened, reload the dashboard.
- Pages are previewed with their new address, but duplicates among existing pages are not checked (the dashboard has no pages list yet).
- A post without a usable category is planned as a draft. A label with no Latin letters (for example Bengali) cannot be a category address; the next step must let you pick a category.
- Not read yet: comments, images (they will be downloaded and re-hosted in the saving step, BUGS I2), HTML cleaning (BUGS I5).

## Open Items After v0.11.0 (Phase 4 part 8)
- The converter is tested on small samples, not on a real Blogger or WordPress backup. Import preview of your own export, then read a few converted texts (the preview shows the line, the Markdown itself is saved in the next step) before trusting it for hundreds of posts.
- Images still point to the old host. The next step downloads them, converts them to WebP, saves them under `public/media/` and rewrites the addresses (BUGS I2). A featured image under 1200 px wide is blocked by the editor rules, so some imported posts may stay drafts.
- Imported posts get a plain description cut from the start of the text. Review them: the first sentence is not always a good description.
- Embeds (YouTube, X, Instagram) become plain links until the embed blocks exist (Phase 3, still to do).
- Tables are converted to simple GFM tables. Complex layouts (merged cells) lose their layout but keep the text.
- Comments are not imported.

## Open Items After v0.12.0 (Phase 4 part 9)
- Saving is tested against a fake GitHub and with a real local build of generated files. It has not been tried on your real repository. Import a small file (3 to 5 items) first and look at the commit on GitHub.
- Images were not downloaded in v0.12.0; v0.13.0 does it (see below).
- Every imported post gets the default author from Settings. The author names in the file are not matched to authors on the site.
- Imported pages are not checked for duplicates by title (only the permalink is kept unique). Re-importing the same file skips posts by old address and by title and day; a page can be saved twice under `about-2`.
- A draft post keeps its old address in `redirects`. If the post is never published, that old address stays a 404.
- The redirect limit (2000) counts the redirects already on the site plus the new ones. Old addresses beyond it get no redirect and the card shows how many.
- The Git commit uses the Git Data API with the branch you set in `admin/config.json`. If the branch is protected and needs pull requests, the save fails with a GitHub message.
- A very large import (thousands of items) runs in the browser tab. Keep the tab open until the card says "Saved".

## Open Items After v0.54.0 (Phase 9 part 4, the service worker and the client script)
- Tested with a made-up browser and the real push Worker on SQLite. **Not tried** in a real browser, with a real push service, or on a phone (Chrome, Firefox, Safari). On an iPhone, web push works only when the site is added to the Home Screen; the page (part 5) must say so and not promise it.
- Nothing loads `push-sw.js` or `push-client.js` yet and `config/push.json` is empty. Part 5 builds the soft prompt (the rules of PLAN 31.2) and the `/notifications/` page; part 5 must also add the push paragraph to the Privacy and Cookie pages before the feature is switched on (PLAN 31.3).
- `POST /feedback` (open, close, less) does not exist in the Worker yet (part 8). Until then every tap sends one request that gets a 404 and is ignored. Do not switch push on before part 8, or the learning of PLAN 31.8 has nothing to learn from.
- The button "Send me a test notification" (PLAN 31.1) needs a route in the Worker that sends one message to the caller's own subscription. It is not built (part 7 or later).
- A browser can replace its own push subscription without telling the page (the `pushsubscriptionchange` event). The worker does not handle that event on purpose (BUGS P16: only push and clicks). The page can notice it with `status()` (`subscribed` false but `hasState` true) and call `enable()` again, which needs no new permission box. Part 5 should do that on the preference page.
- When a token is fixed quietly the pause of a reader is not restored (the row is written again as active); the choices are. A reader who paused for a week and lost the token is active again.
- `badge-96.png` is made from the logo by a simple colour comparison. It looks right for the current logo (a plain "N"). If the logo changes to something with a gradient or a photo, put your own one-colour 96 by 96 PNG in `public/` and do not run `npm run icons` again, or look at the new badge first.
- The service worker shows English text only (PLAN 3.1), and it has no setting for sound or vibration; the phone's own settings decide.

## Open Items After v0.53.0 (Phase 9 part 3, encryption, VAPID and the send function)
- Tested against the RFC 8291 example and against Node's crypto, with a fake push service. **Not tried** on a real push service (Google, Mozilla, Apple), a real browser or a real Cloudflare Worker. The first real test is Part 4 and 5 on a phone.
- Make the key pair once with `cd site ; npm run vapid`. Put the public key in `workers/push/wrangler.toml` (`VAPID_PUBLIC_KEY`) and later in `config/push.json`; put the private key and the contact address in Cloudflare only (`wrangler secret put VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Keep the first pair: a new pair makes every saved subscription useless.
- Apple (Safari, iPhone) wants a `mailto:` or `https:` subject that is a real address; use one you read.
- The `Topic` header is allowed by `sendPush` but the caller (Part 7) must give it: a short hash of the thread key, 32 URL-safe characters at most (LOGICS 19).
- `sendPush` only reports. Deleting a reader after `gone` or `bad_sub`, waiting after `retry`, counting failures (`MAX_FAILURES`) and raising an alarm after `auth` belong to the sender (Part 7).
- Size rule fixed in `lib.js` (BUGS P25): the plain JSON plus 103 bytes must stay under 4,000.
- `site/public/admin/blog-xml-tool.html` (Site to Blogger Sync and Internal Link Fixer) was in the 0.52.1 zip without a changelog entry or a test. Its arrows and a check mark emoji were removed in v0.53.0 so `npm test` passes. It is not linked from the dashboard and has no unit test; decide whether it becomes a dashboard screen.

## Open Items After v0.52.0 (Phase 9 part 2, subscribe, preferences and unsubscribe)
- The Worker is tested against SQLite (the engine under D1), not against a real D1 database or a deployed Worker. After deploy: create the database (`npx wrangler d1 create news-push`), put its id and `SITE_ORIGIN` in `workers/push/wrangler.toml`, run `schema.sql`, deploy, then call `/subscribe` once from the site origin and look at the row. A call from any other origin must give 403.
- The database tests need Node 22.5 or newer (`node:sqlite`). On Node 20 they are skipped without a message, so run `npm test` on Node 22 before a zip. Only the rule tests run on Node 20.
- Nothing in the site calls these endpoints yet. The service worker and the client script are part 4, the soft prompt and the `/notifications/` page are part 5. `config/push.json` is not created yet either.
- A browser that lost its manage token (site data cleared, but the push subscription still exists) gets a new token by subscribing again, because only that browser knows the secret endpoint. The old token then stops working. A second open tab with the old token gets 403 and must subscribe again; the page (part 5) must do that quietly.
- Category and author names are checked for form only (lower-case letters, digits, hyphens, 60 characters). The Worker does not know the real list, so a reader can follow a name that does not exist. They simply never match. Part 6 or the page can check against the real list.
- Limits I chose, not written in the plan: 60 categories, 60 authors, digest hour 4 to 11 for the morning and 16 to 23 for the evening. Change them in `prefs.js` (constants at the top) with a test.
- The plan says the reader must pick a category, a keyword or "Breaking news". An author alone is therefore refused. Say if you want that changed.
- Rate limits: new subscribers are limited to 200 an hour in total (counted from `push_subs.created`). Limits per visitor need the `RATE_LIMITER` binding (a commented block is in `wrangler.toml`; check the current Cloudflare syntax first). Without it, preference and unsubscribe calls have no limit of their own.
- A subscribe call does one read of the reader, possibly one count, and one batch. A preference save does two reads and one batch. Check the free plan limit on database queries per call before launch (PLAN 31.11).
- A fake subscription (a well formed address and keys that belong to no browser) is accepted, because only the form can be checked. It fails at the first send (part 3) and is removed then. The 200 an hour limit keeps the number small.
- `status = 'gone'` is read as "not found", but nothing sets it yet. The clean-up (90 days with no visit, 410 from the push service) comes with part 7.
- The keyword text is stored in readable form (`kwtext`, `mutetext`) so the page can show it. The Privacy Policy paragraph for push (part 11) must say that the words a reader follows are stored.
- `learn` starts on outside `CONSENT_COUNTRIES` and off inside it or when the country is unknown. Keep the list equal to the geo Worker's list; a test compares the two files.
- Pause "until I turn it on" is `status = 'paused'`; a timed pause is `paused_until` in the future. `isEligible` in `lib.js` already reads both. A new Subscribe call from the same browser ends any pause.

## Open Items After v0.51.0 (Phase 4 part 14, same-title match)
- The script has **not** read the real Blogger feed (the build machine cannot reach `blogspot.com`). It was run on files shaped like the feed. First open `https://shivam-das-news-usa.blogspot.com/feeds/posts/default?alt=json&max-results=5` in a browser, then run `node scripts/title-match.mjs --dry` from `site/` and read the lists before a real run.
- Blogger cannot send a 301. The theme script (`blogger/redirect-snippet.html`, made by the script) was run only in a fake page, not in a real Blogger theme. Paste it as the first thing inside `<head>`, then open one old address and check that the address bar changes.
- Blogger Custom redirects to a target on another domain: not verified. Try one row.
- Paste the snippet again every time the daily Action changes it. If Blogger refuses to save a very large theme, split the list by year (not built).
- The Blogger redirect lasts only while the Blogger blog exists. Do not delete the blog or its posts.
- The bare `shivam-das.online` to `www.shivam-das.online` rule is a Cloudflare Redirect Rule in the dashboard, not code. Set `SITE_URL` to the `www` address (Cloudflare Pages and the GitHub secret `SITE_URL`).
- Old Blogger-style paths on the new domain only help if that domain served the Blogger blog before; otherwise they are harmless extra lines. Count against the 2000 line limit.
- Near matches, ambiguous titles and posts on one side only are listed and never redirected: a person decides. Hand-made redirects go in `config/redirects.json` (Redirects screen).
- The daily Action commits to the branch, so each change starts a deploy. It needs the secret `SITE_URL`.

## Open Items After v0.50.0 (Phase 9 part 1, push rules and database)
- Pure rules and a database file only. No Worker, no endpoint, no page and no service worker exist yet, so nothing can be subscribed to or sent. `workers/push/schema.sql` was run on a real SQLite (twice) in the tests, but not yet on a real Cloudflare D1.
- Two places where the text of the plan and the pseudocode disagreed. The code follows this decision; change it in `workers/push/lib.js` if you want it the other way (VERSIONING applies):
  1. **Breaking news from any category.** By the score formula alone, a reader with Balanced or Important who has no matching category could never receive a breaking story from another category (its score is at most about 50, the lines are 48 and 65 and the realistic score is about 32). The code therefore lets a breaking story pass the level line when the reader chose "Breaking news from any category" (the default is on). Mute, quiet hours, the daily limit and the gap still apply. LOGICS 19 step 3d now says so.
  2. **Fatigue.** PLAN 31.6 says "down to minus 20"; the LOGICS pseudocode adds 10 more for the same category in the last hour, so it can reach 30. The code follows the pseudocode.
- Choices made where the plan was silent: the default daily limit for "Breaking only" is 2; a keyword may contain a number next to a word ("iPhone 17") but not a number alone; a hyphenated word such as "covid-19" counts as one word of the four; the "too common" list is in `workers/push/lib.js` (`COMMON`) and is a first guess; with no focus keyword the story key uses two tags (the two most used tags when the site gives counts, otherwise the first two in alphabetical order); the notification image is sent only when its width is known and at least 1200 px.
- The light stemmer is English only and rough on purpose (it also drops a final e, so "house" and "houses" meet). The stored form of a keyword is the stemmed one ("iPhone" is stored as "iphon"); the preference page must show the reader's own words, so Part 5 has to keep the original text next to it.
- Quiet hours are stored as minutes since local midnight (22:00 is 1320). The reader's zone is a name such as `Asia/Kolkata`; an offset is refused. Zone names depend on the time zone data of the runtime (Cloudflare Workers have it).
- Times in the push database are milliseconds (the contact database uses seconds).
- Still to do in Phase 9: Parts 2 to 11 (see CODING_PLAN.md). The numbers to check before Part 2 are the same as listed under v0.49.1.

## Open Items After v0.49.1 (Push notification plan, documents only)
- Only plan files changed. No code, no test and no live page changed.
- Numbers to check against the real Cloudflare and Apple pages before Part 1: the free Worker limit of outgoing requests per call (the plan assumes about 50), the free D1 write limit per day, the cron frequency on the free plan, and the current Safari rules for push on iPhone (Home Screen app, iOS 16.4 or newer).
- The weights and thresholds in LOGICS Section 19 are a first guess. After real readers exist, look at the opened rate per level and adjust them in `workers/push/lib.js` (VERSIONING applies).
- The Privacy Policy and Cookie Policy generator text must get a push paragraph before the feature is switched on (Phase 9 Part 11). Ask a lawyer about consent wording for your readers' countries; this plan is not legal advice.
- The plan keeps no reading history on the server. If you later want server-side history, that is a new privacy decision.
- Smart timing (best hour per reader) is described but left for a later part.
- An existing rule still holds: no emoji in notification text or icons (PLAN 29.3).

## Open Items After v0.49.0 (Phase 7 part 7)
- **Nothing visible changed.** The dashboard has no inbox screen yet (next part). The new endpoints only answer when called with a GitHub token.
- **Before you use it:** set `ALLOWED_USERS` in `workers/contact/wrangler.toml` to your GitHub login (comma list for more people) and run `cd workers/contact ; npx wrangler deploy` again. With the list empty every call answers 503 and nothing is read. The table `contact_messages` already has the `status` column, so `schema.sql` needs no change.
- Tested with a fake database and a fake GitHub only. **Not tried:** a real Worker, a real token, a real D1 table. After the inbox screen exists, send one message from the form and open it in the dashboard.
- The dashboard sends the same GitHub token it already holds. The Worker asks GitHub who the token belongs to and remembers the answer for 60 seconds; if GitHub cannot be reached the answer is 401 (the safe side).
- A message cannot be deleted from the dashboard on purpose (only new, read, done). Delete a row in the D1 console if you must.
- Message text is returned as plain text. The inbox screen must show it as text (never as HTML) when it is built.
- The first page holds 50 messages; the older ones come with `before=<next>`. There is no search inside messages yet.
- Nobody is told when a message arrives (no email notice yet).

## Open Items After v0.48.0 (Phase 7 part 6)
- **The form is off.** `config/contact.json` ships empty on purpose, so the live pages are unchanged. To switch it on: deploy the Worker (README, "Contact Worker"), make a Turnstile widget for your domain, put the Worker address (ending in `/contact`) and the **Site Key** (the public one) in `config/contact.json`. The secret key goes only into the Worker (`wrangler secret put TURNSTILE_SECRET`).
- Tested with a real (jsdom) page against the real browser script, and the message the script sends was checked by the Worker's own rules. A build with the form on and off was made in a throw-away copy: the form is only on the Contact page. **Not tried:** a real browser or phone, a real Turnstile widget, a real Worker. After you switch it on, send one message from a phone and read the row in D1. Check the form at 320 px in light and dark mode.
- **When you switch the form on, edit three pages by hand** (the generator still writes the old text and a test stops it from mentioning a form): Contact Us (add the form to the way of reaching you), Privacy Policy (a message you send through the form is stored with your name and email) and Cookie Policy / Privacy Policy (the Contact page loads a check script from Cloudflare). What Turnstile stores in the browser is Cloudflare's to say; read its documentation and write only what is true.
- The site sends no Content-Security-Policy today. If you add one, allow `challenges.cloudflare.com` for scripts and frames on the Contact page.
- Without JavaScript, or with the Turnstile script blocked (an ad blocker, an old browser), nobody can send a message. The page text still shows the email address, and the form says so when the check is missing. A fallback without Turnstile is not built on purpose (it would let spam in).
- Nobody is told when a message arrives (no email, no inbox screen). Read the table in the D1 console until the inbox part exists.
- The form is hidden when printing. The Contact page text is indexed by search; the form is not (`data-pagefind-ignore`).
- `npm test` and `npm run build` were run and passed (see the counts in the CHANGELOG entry).

## Open Items After v0.47.0 (Phase 7 part 5)
- **The contact Worker is not deployed and no page calls it.** It is code and tests only. Visitors still reach you by the email on the Contact page. Steps to deploy are in `site/README.md` ("Contact Worker").
- Tested with a fake database and a fake Turnstile. **Not tried:** a real Cloudflare Worker, a real D1 database, a real Turnstile widget, a real browser. After you deploy, send one message with `curl` and read the row with `npx wrangler d1 execute news-contact --remote --command "SELECT * FROM contact_messages"`.
- `SITE_ORIGIN` in `workers/contact/wrangler.toml` is a placeholder (`https://YOUR-DOMAIN`). Until you set it, every call gets 403.
- Messages are kept for ever. There is no cleanup yet. The Privacy Policy says messages are kept to answer you and to keep a record of corrections; decide how long you keep them and delete old rows by hand or add a cleanup part.
- **Nobody is told when a message arrives.** There is no email notice and no inbox screen in the dashboard yet. Until they exist, read the table in the D1 console.
- The rate limit by email address can be dodged with many addresses; the total limit (40 per hour) and Turnstile stop a flood. Turnstile can fail for a real person (a blocker, an old browser): the form (next part) must show the email address as a fallback.
- When the form goes live, update the Contact Us and Privacy Policy pages (they say there is no form today) and the Cookie Policy if Turnstile stores anything in the browser. The test that stops the pages from mentioning a form must be changed in the same step.
- `npm test` and `npm run build` were run and passed (see the counts in the CHANGELOG entry).

## Open Items After v0.46.0 (Phase 7 part 4)
- `npm run pages` now makes **twelve** pages (the ten of v0.44.0 plus Advertise With Us and Affiliate Disclosure). The notes for v0.43.0 and v0.44.0 apply to all twelve. If you already ran the script, run it again: the ten existing pages are left alone and only the two new ones are written (as drafts).
- **Advertise With Us** gives the email, says ads appear in article pages only, that an advertiser cannot see, choose or change an article, and that sponsored articles are marked Sponsored. It gives **no price, no visitor number and no offer**, because the site has no real numbers yet. When you have a real offer (formats, rates, a media kit), add it by hand.
- **Affiliate Disclosure** is written as a rule, not as a fact: it says an article will say so near an affiliate link. It does not claim the site has affiliate links. The site has no affiliate link manager (not built). If you add affiliate links, mark each one near the link as the page promises, and keep the page true.
- Both pages say nothing about a contact form or a chat (a test fails if any page does, until those exist).
- The pages of PLAN 16 that the generator still does not make: Ethics and Fact-Checking Policy and Team/Authors (the Authors pages exist as `/author/...`).
- `npm test` and `npm run build` were run and passed (see the counts in the CHANGELOG entry). Not tried: a real owner file, a real browser or phone.

## Open Items After v0.45.0 (Phase 7 part 3)
- `npm test` and `npm run build` were run and passed (55 test files, 563 tests). The page was also built in a throw-away copy with temporary posts. Not tried: a real browser or phone. Open `/sitemap/` on a 320 px screen in light and dark mode: the lists must wrap, nothing may scroll sideways.
- **The address is `/sitemap/`, not the dated address of other pages** (PLAN 3.2 gives `/YYYY/MM/DD/pages/...` for pages written by hand). This page is made from live data at every build, like `/search/`, so a fixed address is right. The footer links to it on every page.
- It is `noindex,follow` on purpose: it is for readers and for crawl depth, and it is not listed in the XML sitemaps (BUGS S6). Change `robots` in `src/pages/sitemap.astro` only if you want it indexed; then also add it to `src/lib/site-data.ts`.
- **Only active sections are listed** (the same list as the menu, PLAN 29.2). A section with no post in the last 7 days is hidden here too, as everywhere else in the theme. Its posts are still listed under their month, and the section page and its sitemap entry stay live.
- Topics with fewer than `thinTagMinPosts` posts are not listed (BUGS S7). A story marked `noindex` is not listed.
- At most 500 stories are listed (`MAX_STORIES` in `src/lib/html-sitemap.ts`). When there are more, the page says so and the older ones are reached through the sections and topics. A page with thousands of links would be slow and thin.
- The month of a story follows the site time zone (`America/New_York`), like the date in its address.
- The page has no search box and no ads. It is not counted by the analytics beacon (article pages only).
- Still not made from the generator: Advertise With Us (needs your real contact and offer) and Affiliate Disclosure (the affiliate link manager is not built).

## Open Items After v0.44.0 (Phase 7 part 2)
- `npm run pages` now makes **ten** pages (the seven of v0.43.0 plus Cookie Policy, Disclaimer, DMCA). Read the notes for v0.43.0 below: they apply to all ten. If you already ran the script with v0.43.0, run it again: the seven existing pages are left alone and only the three new ones are written.
- The cookie page lists what the code stores today. If a later part adds storage (chat, newsletter, push, share buttons, comments), update the page. The test only watches `document.cookie` in four site scripts, not new features.
- The DMCA page is a plain notice and response guide, not a registered DMCA agent. In the United States a registered agent gives extra protection; whether you need one is for you or a lawyer to decide. This is not legal advice.
- Not made yet: Advertise With Us (needs your real contact and offer), Affiliate Disclosure (the affiliate link manager is not built). The HTML sitemap page was built in v0.45.0.
- `npm test` and `npm run build` were run and passed (54 test files, 551 tests). Not tried: a real owner file, a real browser or phone.

## Open Items After v0.43.0 (Phase 7 part 1)
- **The pages are not made yet.** `site/config/publisher.json` is empty on purpose. Fill the seven fields with the owner's real details, run `npm run pages` (from `site/`), read the ten drafts in `content/pages/`, then set `status: published` in each (or delete them and run `npm run pages -- --publish`). Until then the site has no About, Contact or policy pages.
- **Read every page before it goes live.** The text is plain and says only what the code really does (for example the privacy page names the analytics data, ads on article pages only, the consent bar). It is not legal advice. Whether it is enough for your law, for AdSense or for Google News is for you or a lawyer to decide. The editorial and corrections pages are promises the owner must be ready to keep.
- The page date is the day `npm run pages` runs, in UTC, and the date is part of each address and never changes (PLAN 3.2). Run it when you are ready, not before. A page that already exists is never overwritten.
- The privacy page says the ad choice "is asked again after some time" and does not give the number of days (the number is a setting, v0.28.0). If you want the number in the text, edit the page after it is made.
- There is no contact form and no chat yet, so the Contact page gives the email and the postal address only. When the form exists, update the page.
- The pages are not made from the dashboard yet (no screen). The dashboard has no Pages list or Pages editor (Phase 3 leftover), so edit them in the repository.
- Pages from `npm run pages` are in English only, with a single owner. A team or a company with several owners needs a hand edit of the Ownership page.
- `npm test` and `npm run build` were run and passed (54 test files, 548 tests). Not tried: a real owner file, a real browser or phone.

## Open Items After v0.42.0 (Footer links)
- `npm test` and `npm run build` were run and passed (53 test files, 522 tests). Not tried: a real phone or browser. Check the footer on a 320 px screen in light and dark mode: the two project links wrap, the marks keep their colours, the X icon follows the text colour.
- **The X address was added in v0.43.1** (`https://x.com/shivamdas_191a` in `sameAs`), so the "Follow us" row shows. Other accounts (Facebook, Instagram, YouTube, Telegram) can go in the same list; they show as the host name until their own icon is drawn in `svg-icons.ts`.
- The project marks were traced from the owner's two PNG files. Small edges differ slightly from the originals. If the original vector files exist, replace the drawings in `svg-icons.ts` (`mark-h`, `mark-s`).
- The two project sites open in a new tab. The first project address was given with and without `index.html`; the root address (`https://www.shivam-das-2.online/`) is used.
- Footer rows are on every page (home, articles, categories, pages, 404). No ads or analytics code is in the footer (a test checks it).

## Open Items After v0.41.0 (Phase 6 part 9)
- `npm test` and `npm run build` were run and passed (52 test files, 513 tests). The block was also built in a throw-away copy with one temporary post (it appears on the home page and the article page only; with an empty endpoint nothing is built). Not tried: a real Worker with real visits, a real browser or phone.
- **To turn it on:** set `endpoint` in `site/config/analytics.json` (this also switches the beacon on), set `SITE_ORIGIN` in `workers/analytics/wrangler.toml` to the real site address (the Worker answers `/trending` only to that origin), redeploy the Worker. Until then nothing is shown.
- The block stays hidden until an article has at least 3 views in 24 hours (`TRENDING_MIN_VIEWS`). A new site shows no block at first; this is intended (no demo text).
- The home page and the article page each call `/trending` once per view. The Worker lets the browser keep the answer for 60 seconds; check the free-plan D1 reads after launch.
- The block is placed below the first screen to avoid layout shift when it appears. Check it on a real phone: if the list pushes content that the reader is looking at, give the block a fixed height.
- The title list (`/trending-titles.json`) holds the newest 2000 articles (`TITLES_MAX` in `src/lib/trending.ts`). A trending article older than that gets no link in the block (it is skipped). It is rebuilt on every deploy, so a trending title can be missing for a new article until the next build.
- Trending does not use the `trending: true` flag in a post (that flag is for the editor's own pick). The two are separate.
- Search pages, categories, tags, authors, pages and 404 have no block on purpose.

## Open Items After v0.40.0 (No emojis, SVG only)
- `npm test` and `npm run build` were run and passed (51 test files, 496 tests). Look at the header on a real phone in light and dark mode: the three icons must be centred, 44 px tap targets, and change colour on hover and in dark mode.
- The Pager icons were not seen in a built page (the site has no second page yet). Check them when the first category has more than one page.
- The rule covers every future part: the Trending block, share buttons, chat bubble, consent bar, cookie button, admin screens and the pages generator must use `Icon` (or the dashboard `icon()`), never a symbol character. Add new drawings to `site/src/lib/svg-icons.ts` and to the list in `CSS.md`.
- Posts: the build stops on an emoji in a published page. Imported Blogger or WordPress text can contain emojis; the Import screen does not remove them (the post is saved as it is). The build then names the page and the character. Remove it in the editor before publishing. An automatic removal in the import step is not built.
- The editor has no live warning for emojis yet (the build is the only gate). A warning in the post editor next to the other pre-publish checks is still to do.
- Social share buttons and the logo are not built yet; they must be SVG.

## Open Items After v0.39.0 (Phase 6 part 8)
- `npm test` and `npm run build` were run and passed (50 test files, 486 tests). The endpoint was tested on Node's built-in SQLite, not on Cloudflare D1.
- The block on the site (home and article pages) was built in v0.41.0.
- Only article addresses (`/YYYY/MM/DD/blogs/...`) can be trending. The age is made from the date in the address (the start of that day in UTC), so it can be off by up to a few hours; the site time zone is `America/New_York` (-5:00 in winter, -4:00 in summer). This only matters for ranking.
- An article needs at least 3 views in the last 24 hours (`TRENDING_MIN_VIEWS` in `lib.js`). A new site will show an empty list at first. The block must hide itself when the list is empty (no demo text).
- The answer is public (addresses and scores only, no view counts). A browser may keep it for 60 seconds. One call per page view is cheap for D1 only with that cache; check against the free-plan limits after launch.
- The score has no popularity weight from older days; only the last 24 hours and the last hour count (LOGICS 6).

## Open Items After v0.38.0 (Phase 6 part 7)
- `npm test` and `npm run build` were run and passed. The names were tested with sample hosts, not with real visits. After deploy, open one article from Google, Facebook and a WhatsApp link, then check that Traffic sources shows Google, Facebook and (often) Direct.
- **Google Discover is not a separate source.** The Discover app sends no web address as the referrer, so those visits are counted as Direct. A tagged link or Search Console is the way to see Discover; it is not built.
- WhatsApp, Telegram, Instagram and many apps also send no referrer, so their visits are also Direct. A high Direct number is normal for a news site.
- The same host rules are in one place only (`workers/analytics/lib.js`, `SOURCES`). Add a new site there and in `tests/unit/analytics-sources.test.ts`.
- Names are made when the dashboard asks, not when the visit is stored, so old visits show the new names too. The stored `referrer_host` is unchanged.
- The top 10 is taken after grouping, from the 200 biggest hosts of the range. A very long tail of tiny hosts can leave a few views out of the list (never out of the totals).

## Open Items After v0.37.0 (Phase 6 part 6)
- `npm test` and `npm run build` were run and passed. The screen was tested in jsdom with a fake Worker. Try it once on the real dashboard after the Worker is deployed: open **Analytics**, visit one article in another tab, press Refresh in Live: one view must appear.
- The screen reads `config/analytics.json` from GitHub. After you save the endpoint, wait for the file to be in the repository (it is, once committed) and reload the screen.
- The screen is admin only (the numbers are private). An editor does not see it, and the Worker also checks `ALLOWED_USERS`.
- The chart draws plain bars with no axis numbers; hover (or long press) a bar to see its time and count. Up to 400 bars.
- The time zone selector only changes labels. The Worker's buckets are in UTC; for 24 hours and 7 days in a zone that is not a whole hour from UTC (for example India, +5:30) a bar can be labelled with the half hour.
- The dashboard has no "Top searched terms", revenue widget, live map or per-post numbers yet (PLAN 15, 18).
- Refreshing: Live every 15 seconds and others every 60 seconds while the tab is open and visible. This uses free-plan D1 reads; close the tab when not needed.

## Open Items After v0.36.0 (Phase 6 part 5)
- `npm test` and `npm run build` were run and passed. The SQL was tested on Node's built-in SQLite, not on Cloudflare D1. The GitHub token check was tested with a fake GitHub only.
- **Set `ALLOWED_USERS`** in `workers/analytics/wrangler.toml` (your GitHub login, for example `shivam-das`) and redeploy. Empty means nobody can read the numbers.
- The token used is the dashboard's GitHub token (scope `repo`). Anyone whose login is in the list can read the numbers; the list is separate from the auth Worker's list.
- Lifetime visitors are not given (null). The dashboard must show views and read time only for lifetime, or label any sum of daily visitors as "visitor-days".
- Device and browser are not kept in the daily totals, so lifetime shows no device or browser lists (only the last day's raw events).
- "Sources" are referrer hosts. Direct visits (empty host) are not listed as a source. Google Discover still looks like Google Search.
- The chart series is in UTC seconds; the time zone selector is part of the dashboard screen (not built).
- Free-plan limits (D1 rows read per day) are not checked: one dashboard refresh runs 7 queries over raw events of the chosen range. Do not refresh the 7-day view every few seconds.

## Open Items After v0.35.0 (Phase 6 part 4)
- `npm test` and `npm run build` were run and passed. The SQL was tested on Node's built-in SQLite, not on Cloudflare D1, and the cron was not run on Cloudflare.
- **Redeploy the Worker** (`cd workers/analytics ; npx wrangler deploy`) so the cron is registered. Without it nothing is rolled up and `events` grows.
- A run recomputes only the last 48 finished hours and 3 finished UTC days. If the cron is down for more than 2 days, the hours in between are never rolled up (the raw events are still kept 7 days; a one-time manual run of the two SQL statements in `lib.js` with a wider window fixes it).
- The running hour and day are in raw events only. The dashboard must add raw events for the running hour to the totals.
- Daily visitors are counted from raw events (one session counts once per day). The weekly or lifetime sum of daily visitors counts a returning session once per day, so it is "visitor-days", not unique people. Name it that way in the dashboard.
- The 7-day and 48-hour numbers are constants in `lib.js` (`RAW_DAYS`, `HOURS_BACK`, `DAYS_BACK`), not settings.
- Free-plan limits (D1 rows read and written per day) are still not checked against expected traffic; the hourly job reads the last 48 hours of raw events each time.

## Open Items After v0.34.0 (Phase 6 part 3)
- `npm ci`, `npm test` and `npm run build` were run for this step and passed. The beacon was tested with a fake window only: not in a real browser, not on a real phone, not against the deployed Worker.
- Fill `site/config/analytics.json` only after the Worker is deployed (steps in the v0.33.0 note below). A wrong `SITE_ORIGIN` in the Worker means every visit gets 403 (silent in the browser). Check in the browser Network tab: the call to `/collect` must answer 204.
- The beacon runs on article pages only. Home, category, tag, author, search and static pages are not counted yet, so "top pages" will show articles only. Decide if you want the other pages counted (the Worker already accepts any path).
- The beacon sends the referrer text; the Worker keeps only its host. Google Discover still looks like Google Search.
- Whether analytics needs consent for readers in the EU, EEA, UK and Switzerland is still not decided (no cookie and no IP address are used). A lawyer should say; this is not legal advice.
- A reader who leaves in under one active second is not counted at all (the first message goes after the first read second).
- `sessionStorage` is per tab: the same person in a new tab is a new session. Fine for page counts; "unique visitors" will count sessions, not people.
- The ad loader's "guard test" (`ads-client.test.ts`) requires that only `AdLoader.astro` imports ad files; `beacon.ts` therefore has its own small address check instead of reusing the ad one.

## Open Items After v0.33.0 (Phase 6 part 2)
- **Run `npm test` and `npm run build` first.** This step was written without a way to install packages. The new tests were run only through a stand-in in plain Node.
- The Worker is not deployed. Steps (once): `cd workers/analytics`, `npx wrangler d1 create news-analytics`, put the printed `database_id` in `wrangler.toml`, set `SITE_ORIGIN` to your site (same `https://` and host, no slash at the end), `npx wrangler d1 execute news-analytics --remote --file=schema.sql`, `npx wrangler deploy`. Note the `workers.dev` address: the beacon script will need it.
- A wrong `SITE_ORIGIN` means every visit gets 403 (the safe side). Test with one real visit after the beacon script exists: the row must appear in D1.
- The rate limit binding is a comment in `wrangler.toml` because its syntax was not checked against the current Cloudflare docs. Check them before you switch it on. Without it the endpoint has no limit of its own; it is only protected by the origin check and the size limit, and the origin header can be faked outside a browser.
- The country comes from the edge (`request.cf.country`, or the `CF-IPCountry` header). Free-plan limits (Workers requests per day, D1 reads and writes) are not checked against expected traffic yet.
- A visit is stored only if it has a valid session id and page view id. A second send of the same page view only raises read time and scroll depth.
- Nothing reads the data yet: there is no rollup, no deletion of old raw events (BUGS N5) and no dashboard. The `events` table grows until the next parts exist.

## Open Items After v0.32.0 (Phase 6 part 1)
- **Run `npm test` and `npm run build` first.** This step was written without a way to install packages. The new tests were run only through a stand-in in plain Node.
- `schema.sql` is not applied anywhere. Create a D1 database in Cloudflare and run `npx wrangler d1 execute <name> --remote --file=workers/analytics/schema.sql` once, when the Worker part arrives.
- Nothing sends data yet: no Worker, no beacon script. The Analytics screen and the "Trending" block still wait.
- `events` has the extra column `pv_id` (needed so a page view sent twice stays one row). CODING_PLAN section 4 lists the table without it.
- A visitor from the EU, EEA, UK or Switzerland: whether analytics needs the consent bar too is not decided. The plan says no cookies and no IP; a lawyer should say if that is enough. This is not legal advice.
- The bot list is a short list of well-known words. A new crawler that does not use them is counted as a visitor until a word is added in `workers/analytics/lib.js` (`BOT`).
- The source name (Google, Discover, Facebook, X, direct) is not decided yet. Only the referrer host is kept. Google Discover cannot be told apart from Google Search by the referrer alone.
- A referrer is dropped when it is the site itself (so a click inside the site is not a source). A visit with no referrer is stored as an empty host (direct).

## Open Items After v0.31.0 (Phase 5 part 14)
- **Run `npm test` and `npm run build` first.** This step was written without a way to install packages, so the new tests were never run.
- The words are tested with a test browser (jsdom) only. Try them once by hand: in the dashboard open **Ad loader**, fill the three boxes, save, and after the deploy open an article through a VPN in Germany: the bar and the "Ad choices" button must show your words.
- If you write the bar text and the button words in another language, write all four. The `aria-label` of the bar ("Advertising choice") stays English.
- The words are plain text, 2 to 24 characters. Keep them short: the buttons are at least 44 px high and share a row with the text.
- An older `config/ad-loader.json` without the three words still works (read as empty). A file saved from the screen carries a word only when one is set.
- The screen and the build keep two copies of the same rule (browser JS and TypeScript); `tests/unit/ad-loader-config.test.ts` fails if they differ. Change both together.

## Open Items After v0.30.0 (Phase 5 part 13)
- **Run `npm test` and `npm run build` first.** This step was written without a way to install packages, so the new tests were never run.
- The bar text is tested with a test browser (jsdom) only. Try it once by hand: in the dashboard open **Ad loader**, write a sentence in "Bar text", save, and after the deploy open an article through a VPN in Germany: the bar must show your sentence.
- The text is one language only (the one you write). The buttons stay "Accept", "No thanks" and "Ad choices" in English (`src/lib/ads-client.js`).
- The text is shown as plain text. Links and formatting are not possible on purpose.
- Say in the text what the readers agree to (ads from partners, cookies or similar technology). Whether your wording is enough for your legal needs is for you or a lawyer to decide; this is not legal advice.
- The screen and the build keep two copies of the same rule (browser JS and TypeScript); `tests/unit/ad-loader-config.test.ts` fails if they differ. Change both together.
- An older `config/ad-loader.json` without `consentText` still works (read as empty). A file saved from the screen carries `consentText` only when a text is set.

## Open Items After v0.29.0 (Phase 4 leftover)
- `backup.yml` has not run on GitHub yet. After you push it, open the Actions tab, run **Weekly backup** by hand once, check that a tag `backup-<date>` exists and that the zip artifact opens.
- The job needs repository permission "Read and write" for workflows (it pushes a tag). If the push is refused, change it in the repository Settings, Actions, General.
- The zip has content, settings, images and the logo, not the built site and not the XML export. Artifacts are kept 90 days only; download one now and then.
- The zip lives in the same repository. A copy in a separate private repo (PLAN 28.5) and the restore steps are not written.
- Running twice on one day does not make a second tag (the zip is still made).

## Open Items After v0.28.0 (Phase 5 part 12)
- The days box is tested against a fake GitHub (like the rest of the dashboard) and on a real built article page in jsdom. Try it once on the real repo: open **Ad loader**, the box must show 180, save with nothing changed (the file only gains `"consentDays": 180`).
- The allowed range is 30 to 365. Shorter or longer is refused. Whether the number you choose is enough for your legal needs is for you or a lawyer to decide; this is not legal advice.
- A change applies to the next deploy. Answers already saved in readers' browsers are judged by the new number the next time they open an article (a shorter number can make an old answer expire at once).
- The screen and the build keep two copies of the same rule (browser JS and TypeScript); `tests/unit/ad-loader-config.test.ts` fails if they differ. Change both together.
- A file saved from the screen now always carries `consentDays`. An older `config/ad-loader.json` without it still works (read as 180).

## Open Items After v0.27.0 (Phase 5 part 11)
- The expiry is tested in jsdom (a test browser) and on a real built article page, with fake times. It has **not** run in a real browser. To try it by hand: in the browser developer tools (Application, Local Storage) change `adConsent` to `yes|1700000000000` (an old time) and reload: the bar must come back.
- The limit is a setting since v0.28.0 (`consentDays` in `config/ad-loader.json`, dashboard screen Ad loader); 180 by default.
- Readers who gave an answer with v0.25.0 or v0.26.0 (a plain `yes` or `no`) are asked once more. Nothing is live yet, so this is harmless.
- The time comes from the reader's own device clock. A device with a wrong clock can keep an answer too long or ask too early. A time in the future is refused.
- A "No thanks" no longer lasts for good: the bar comes back after 180 days.

## Open Items After v0.26.0 (Phase 5 part 10)
- The "Ad choices" button is tested in jsdom (a test browser) with a faked Worker, also on a real built article page. It has **not** run in a real browser or on a real phone. After deploy, through a VPN in Germany: click Accept, scroll to the end of the text, find "Ad choices", click it, choose No thanks: the page must reload and the ad scripts must be gone (Network tab).
- The button is added only when the end of the text is still below the screen. A reader who scrolls to the end within the first seconds (before the first touch or the 4 second idle time ends) does not get it on that visit; it appears on the next article.
- A change of answer reloads the page. A reader who changes the answer in the middle of a long article goes back to the top of the page.
- With a browser that blocks `localStorage`, a reload asks the question again (nothing is remembered).
- The button is only on article pages (part of the ad loader, PLAN 29.1). There is no button in the footer of other pages, because they never have ads.
- The button text and the bar text are fixed English in `src/lib/ads-client.js`.

## Open Items After v0.25.0 (Phase 5 part 9)
- The consent bar is tested in jsdom (a test browser) with a faked Worker, also on a real built article page. It has **not** run in a real browser, on a real phone, or with the deployed Worker. After deploy open one article through a VPN in Germany: the bar must show, the Network tab must show **no** ad script before you click Accept. Through a VPN in the USA: no bar. Through India: no bar, no ad.
- **Redeploy the geo Worker** (`cd workers/geo ; npx wrangler deploy`) so the answer carries `consent`. An old Worker without it is safe: the page treats a missing field as "consent needed".
- **This bar is not Google's certified consent tool.** For AdSense in the EU and UK Google needs its own certified one (for example Funding Choices). So the AdSense unit is never added for readers who had to consent. Adsterra formats are added after Accept. Whether that is enough for your legal needs is for you or a lawyer to decide; this is not legal advice.
- The reader can change the choice with the "Ad choices" button (v0.26.0). Clearing the browser data asks again. Both answers expire after 180 days (v0.27.0).
- A browser that blocks `localStorage` is asked again on every article (nothing is remembered).
- The bar text is fixed English and fixed in `src/lib/ads-client.js`. The dashboard has no screen for it.
- `CONSENT_COUNTRIES` in `workers/geo/wrangler.toml` is the list that asks. An unknown country also asks (when `ADS_ON_UNKNOWN` is true). Review the list with your own advice before launch.
- Pages without an ad never show the bar (it is part of the ad loader, which exists on article pages only, PLAN 29.1).

## Open Items After v0.24.0 (Phase 5 part 8)
- The AdSense unit is tested with a fake window and with the real built article page run in jsdom (screen size and Worker answer faked). It has **not** run in a real browser with a real AdSense account. After you turn it on, open one long article with the browser developer tools: the Worker call, then a box with the label "Advertisement" after the paragraph you chose, then the script from `pagead2.googlesyndication.com` (Network tab). Do the same through a VPN in India: no box and no script.
- **Consent (updated in v0.25.0):** a consent bar now exists, but it is not Google's certified tool. The AdSense unit is therefore never added for readers from the EU, EEA, UK and Switzerland.
- **India is off for AdSense too.** The plan's hard rule (PLAN 29.1) sends every ad format through the same country check, and the check blocks India. If you want AdSense to show in India while Adsterra stays off there, the loader needs a per-format country rule. That is not built.
- The AdSense id is read from `config/ads.json` (Ads screen). A slot without an id stops the build with a plain message, also in compliance mode. The dashboard reads the id when the Ad loader screen opens; after changing the id on the Ads screen, open the Ad loader screen again.
- The screen checks only the form of the slot (digits, 6 to 20). It cannot know that the slot belongs to your account or that the site is approved. Copy it from `data-ad-slot` in your AdSense ad unit code.
- One in-article unit only. Display and multiplex units and auto ads are not built.
- The box has a fixed minimum height of 280 px. If AdSense serves a taller or shorter ad, the box does not resize itself.
- The box is added only when the article has more paragraphs than the number you set and the place is still below the visible screen. A fast reader or a short article gets no unit (on purpose, BUGS A2).
- The native banner and the AdSense unit may not use the same paragraph number. The build and the screen refuse it.
- Compliance mode stays the default. AdSense, Google News and popunders or smartlinks do not mix well: keep compliance mode ON while you apply (BETTER.md item 3, BUGS A6).
- An older `config/ad-loader.json` without `adsense` still works (read as empty). Saving it from the screen adds the `adsense` block.
- AdSense display and multiplex units, auto ads, the consent banner and AMP are still not built.

## Open Items After v0.23.0 (Phase 5 part 7)
- The smartlink is tested with a fake window and with the real built article page run in jsdom (screen size and Worker answer faked). It has **not** run in a real browser with a real Adsterra Smartlink. After you turn it on, open a long article: scroll a little (the end of the text must still be below the screen), and check that a line "Sponsored link" shows under the text and goes to your Smartlink only when clicked. Through a VPN in India: no line.
- Copy the Smartlink address exactly from your Adsterra account. The screen checks only that it is a clean `https://` address.
- The link text is fixed: "Sponsored link". It cannot be changed in the screen yet.
- It is one line only under the article text. No smartlink inside buttons, the Related area or other pages. A reader who has already scrolled to the end of the text before the country check finishes gets no smartlink (nothing may move under the reader, BUGS A2).
- The link is marked `rel="sponsored nofollow"` so search engines do not count it as an editorial link. A paid or tracking link on a news page can still hurt Google News or AdSense approval. Keep compliance mode ON until both are approved (BETTER.md item 3, BUGS A6).
- An older `config/ad-loader.json` without `smartlink` still works (read as empty). Saving it from the screen adds the `smartlink` line.
- AdSense units, the consent banner and AMP are still not built.

## Open Items After v0.22.0 (Phase 5 part 6)
- The native banner is tested with a fake window and with the real built article page run in a test browser (jsdom) that had its screen size and the Worker answer faked. It has **not** run in a real browser with a real Adsterra script. After you turn it on, open one long article with the browser developer tools: the Worker call, then a box with the label "Advertisement" after the paragraph you chose, then the Adsterra script (Network tab). Do the same through a VPN in India: no box and no script.
- Copy the **script address** and the **container id** exactly from the Adsterra native banner code (`src=...` and `id="container-..."`). The screen only checks the form (clean `https://` address, safe id); it cannot know that they belong together or to your account.
- The box is added only when the article has more paragraphs than the number you set, and only when that place is still below the visible screen. A reader who scrolls fast, or a short article, gets no native banner. This is on purpose (nothing may jump under the reader, BUGS A2), but it also means fewer views of this format.
- The box looks for plain paragraphs that are direct children of the article text. A paragraph inside a list, a quote or an embed is not counted.
- The reserved height is a fixed 250 px. If Adsterra serves a taller or shorter banner, the box does not resize itself.
- One native banner per article. A second slot (for example in the Related area) is not built.
- Compliance mode stays the default. Keep it on while you apply to AdSense and Google News (BETTER.md item 3, BUGS A6).
- The screen and the build still keep two copies of the same rules (browser JS and TypeScript); `tests/unit/ad-loader-config.test.ts` now also compares the container id and paragraph number rules.
- An older `config/ad-loader.json` without `nativeBanner` still works (read as empty). Saving it from the screen adds the `nativeBanner` block.
- Smartlink (a plain link), AdSense units, the consent banner and AMP are still not built.

## Open Items After v0.21.0 (Phase 5 part 5)
- The Ad loader screen is tested only against a fake GitHub (like the rest of the dashboard). Try it once on the real repo: open the screen (it must show compliance mode ticked), save with nothing changed, then fill the real values only when you are ready.
- The screen and the build keep two copies of the same rules (browser JS and TypeScript). `tests/unit/ad-loader-config.test.ts` fails if they differ. Change both together.
- Saving rewrites `config/ad-loader.json` in the dashboard's format (cleaned addresses, same four settings). Only admins see the screen; editors cannot change ad settings.
- The confirm box appears only when the saved file had no ad scripts ON and the new one has. It is a browser box, so a browser that blocks boxes cannot switch scripts ON (the safe side).
- The screen does not check that a script address belongs to Adsterra or that the Worker address answers. Open an article after deploy and check the Network tab (see v0.20.0 items).

## Open Items After v0.20.0 (Phase 5 part 4)
- The loader is tested with a fake window and a fake page build. It has **not** run in a real browser with a real Adsterra script. After you turn it on, open one article with the browser developer tools (Network tab) and check: first the call to the geo Worker, then the ad script. Do the same through a VPN in India: the Worker call must happen and **no** ad script may follow.
- It is **off** until you edit `site/config/ad-loader.json`: set `complianceMode` to `false`, put the deployed Worker address in `geoUrl` and the exact script address(es) from your Adsterra account in `adsterra`. Since v0.21.0 the dashboard screen **Ad loader** edits this file.
- The script addresses are not checked against Adsterra (only that they are clean `https://` addresses). Copy them exactly from your account.
- Keep `complianceMode: true` while you apply to AdSense and Google News (BETTER.md item 3, BUGS A6).
- The popunder and the social bar are the only formats. Native Banner needs a slot inside the article text and comes later. Smartlink is a plain link, not a script.
- AdSense units are not added yet. Nothing loads from Google on any page.
- Views are counted per browser session (session storage), so a second tab can count as a second view. A browser that blocks storage never gets a popunder.
- The geo Worker must be deployed first (see v0.19.0). If `SITE_ORIGIN` in `workers/geo/wrangler.toml` does not equal your site address exactly (same `https://` and host, no slash at the end), the browser blocks the answer and no ad shows (the safe side).
- A visitor behind a VPN or proxy can get the wrong country. That is a limit of any country check.

## Open Items After v0.19.0 (Phase 5 part 3)
- The geo Worker is tested in code only (decision rules and HTTP answers). It has **not** been deployed. After deploy, test with a VPN: India must give `ads: false`, another country `ads: true`. The "country when behind a VPN or proxy" can be wrong; that is a limit of any country check.
- `SITE_ORIGIN` in `workers/geo/wrangler.toml` still says `YOUR-DOMAIN`. Set it before deploy, or the browser will block the answer (which means no ads, the safe side).
- The Worker address must later go into the ad loader's config (next part). No site page calls the Worker yet, so no ad can show.
- Cloudflare Workers free plan: 100,000 requests per day. One call per article view is the plan; check against real traffic (INCOMPLETE risk list).
- The loader must treat any failure (timeout, bad answer, blocked by CORS) as "no ads". Built in the next part.

## Open Items After v0.18.0 (Phase 5 part 2)
- The Ads screen is tested only against a fake GitHub. Try it once on the real repo: save an empty form (file stays the same), then a real id after AdSense approval.
- The screen and the build keep two copies of the same rules (browser JS and TypeScript). `tests/unit/ads-config.test.ts` fails if they differ. Change both together.
- Saving rewrites `config/ads.json` in the dashboard's format: `ca-pub-...` form for the id, lines cleaned (lower-case domain, upper-case DIRECT or RESELLER).
- Only admins see the screen. Editors cannot change ad settings.

## Open Items After v0.17.0 (Phase 5 part 1)
- `config/ads.json` is empty on purpose. Add your real AdSense id after approval, and the exact Adsterra line from your Adsterra account (not checked against Adsterra here).
- The Ads screen (v0.18.0) edits `ads.json`. It holds only the ads.txt values for now; format switches, page-type rules and the India rule come with the loader.
- The check is the format only. It cannot know if an id really belongs to you; a wrong but well-formed id is written as is.
- The file stays empty until configured. An empty `ads.txt` answers 200, which is valid.
- After the first real deploy open `/ads.txt` and compare it with what AdSense shows in its account.

## Open Items After v0.16.0 (Phase 4 part 13)
- Category rename is tested with a fake GitHub only. Try it once on a scratch category of the real repo, then open one old post address and the old `/category/<old>/` address: both must answer 301.
- Old pages of the category list (`/category/<old>/page/2/`) and old tag or feed addresses (`/feed/<old>.xml`) get no redirect. Only the first category page does.
- No merge: renaming into an existing category is refused.
- Posts whose body or `canonical` text contains the old address keep it. The old address redirects, so readers are fine, but fix `canonical` by hand if you set one.
- The rename is one commit of up to 1000 posts. A very large category is refused, not split, on purpose (a split rename could leave posts in two categories).
- Redirects count against the 2000 Cloudflare limit; a big rename on a big site can be refused for that reason.

## Open Items After v0.15.0 (Phase 4 part 12)
- The Links screen is tested only against a fake GitHub. Try it once on the real repo: add one keyword, wait for the deploy, open an article that contains it.
- The screen does not check that the target page exists. A wrong address becomes a dead link. Open the page after adding.
- Keywords are plain English (letters, numbers, spaces, `'`, `-`), the same rule the build uses. Non-Latin keywords are ignored by the build, so the screen refuses them.
- One keyword can have one address. Edit by removing and adding again.

## Open Items After v0.14.0 (Phase 4 part 11)
- Export is tested with a fake GitHub and with a round trip through the Import parser. It has **not** been tried on a real repository or a real Blogger import. Download one backup, open it in a text editor, then import it into a scratch site to check.
- The file holds text and image **links**, not the image files. The repository (`public/media/`) is the backup of the images. The weekly automatic backup (`backup.yml`) is built since v0.29.0.
- Export reads every post and page in the browser. Fine for hundreds; thousands may take minutes (the tab must stay open).
- WordPress WXR export is not offered (only the Blogger format, which Import also reads).
- Comments, settings, categories descriptions and redirects are not in the file. `config/` is in the repository.
- Re-importing a backup into the **same** site shows every item as "Already on the site" (duplicate check), so nothing is overwritten.

## Open Items After v0.13.0 (Phase 4 part 10)
- Image download is tested with a fake downloader and with a real local build of files made by the new code. It has **not** been tried against a real Blogger or WordPress host. Try a file with 3 to 5 posts first.
- Browsers only download an image when the old host allows it (CORS). Blogger (googleusercontent) often does; some WordPress hosts do not. A blocked image keeps its old address and is counted on the result card. A server-side fetch (Cloudflare Worker) would fix this; it is not built.
- Downloads time out after 20 seconds each. A very large import (thousands of images) needs the tab open and may take many minutes.
- The conversion to WebP uses the browser canvas, so an animated gif is kept as a gif and an svg as an svg (no width check).
- Image alt text is copied from the old post. Posts with no alt text use the title (a warning is shown in the preview).
- Images are saved in `public/media/imported/` only. They are not sorted by date.
- If the images are saved but the posts commit fails, the images stay in the repository unused. Saving again downloads them again under a new name (`-2`); delete the unused ones in the Media screen.

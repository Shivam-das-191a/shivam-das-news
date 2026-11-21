# BUGS.md: Known Risks and Bug Prevention

Every item: what can go wrong, why, the fix built into the plan, and how to test it.

## A. URL and Redirect Bugs
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| U1 | Wrong date in URL (off by one day) | Publish time in one time zone, build in UTC | Store dates in UTC, build URL date from one configured site time zone | Publish at 11:55 PM local; URL date must match site time zone |
| U2 | Two posts, same permalink | Slug unique only inside a category | Permalink unique **site-wide** (editor blocks duplicates) | Create duplicate slug in another category; must be rejected |
| U3 | Redirect chain A to B to C | Permalink changed several times | Collapse chains at build; always point old URL to the latest | Change slug 3 times; each old URL must be a single hop |
| U4 | Redirect loop | Slug changed back to an older value | Remove the redirect whose source equals a live URL | Rename A to B, then B to A; no loop |
| U5 | Category rename breaks every post URL | Category is part of the URL | Bulk redirect all posts in that category, update sitemap | Rename a category with 50 posts; all old URLs redirect |
| U6 | Trailing slash duplicates | `/x` and `/x/` both load | One canonical form; the other redirects | Request both forms |
| U7 | Uppercase URLs indexed | Case-insensitive server | Redirect uppercase to lowercase | Request uppercase URL |
| U8 | Date change creates 404 | Date is in URL | Treat date change like permalink change (auto redirect) | Edit publish date; old URL redirects |
| U9 | Deleted post leaves dead link | Internal links still point to it | Link checker in CI; redirect or 410 | Delete a linked post; CI must fail or warn |

## B. SEO and Indexing Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| S1 | Two H1 tags | Theme and content both emit H1 | Editor forbids H1 in body; build linter checks one H1 |
| S2 | AMP canonical wrong | AMP points to itself | AMP canonical always points to normal page |
| S3 | Sitemap lists redirected URLs | Old URLs not removed | Sitemap built only from live URLs |
| S4 | `lastmod` changes on every build | Using build time | Use real content-modified time only |
| S5 | News sitemap has old articles | No 2-day filter | Filter on publish time at build; rebuild hourly via cron |
| S6 | Search result pages indexed | Missing noindex | `/search/` is noindex, not in sitemap |
| S7 | Tag/category thin pages indexed | Pages with 1 post | noindex tags with fewer than N posts (configurable) |
| S8 | Schema errors | Missing image/author/date | Pre-publish gate; schema validation in CI |
| S9 | Discover image too small | Featured image under 1200 px | Editor rejects or warns under 1200 px width |
| S10 | Mixed canonical (http/www/non-www) | No host rule | One canonical host enforced by redirect |

## C. Ads and Geo Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| A1 | Ads show in India | Geo call failed or cached | Default to **off** on failure; never cache geo result across visitors |
| A2 | Layout jumps when ads load | No reserved space | Fixed-height slots |
| A3 | Popunder on first view hurts UX | No frequency cap | Session cap and skip first view |
| A4 | Ads on policy/contact pages | Global ads on | Page-type exclusions |
| A5 | AMP shows Adsterra script | Script not allowed in AMP | AMP uses iframe-only formats |
| A6 | AdSense and popunder conflict | Policy risk | "Compliance mode" switch; clean mode while applying |
| A7 | `ads.txt` missing or wrong | Manual error | Generated from Ads Manager and validated in CI |

## D. Analytics and Chat Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| N1 | Double counting visits | Beacon fires twice (SPA/AMP) | Session and page-view IDs; dedupe on server |
| N2 | Bots inflate numbers | Crawlers run JS | Bot user-agent filter and rate limit |
| N3 | Wrong time zone in charts | Server vs browser mismatch | Store UTC, render in selected zone |
| N4 | Read time inflated | Tab left open | Count only visible and active time (Page Visibility + activity) |
| N5 | Free-tier limit exceeded | Raw event growth | Hourly/daily rollups, delete raw events after N days |
| N6 | Chat spam | Open endpoint | Turnstile, rate limit, size limit |
| N7 | Chat messages lost | Connection drop | Retry queue and message IDs |

## E. Build and Deployment Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| B1 | Commit conflicts from admin and CI | Two writers on one branch | Admin commits to `content`, CI builds, concurrency lock in workflow |
| B2 | Build gets slow with thousands of posts | Full rebuild | Incremental builds and cached image processing |
| B3 | Repo too big | Images in Git | Compress images; use image storage or Git LFS for large media |
| B4 | Scheduled post not published | Cron skipped | Cron every 5 to 10 min and a catch-up check on every build |
| B5 | Bad build goes live | No gate | Build must pass link, schema, AMP and Lighthouse checks first |
| B6 | Decap/OAuth login fails | Wrong callback URL | Setup wizard tests login before finishing |

## F. Content Import Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| I1 | Broken characters after import | Wrong encoding | Force UTF-8, test with non-Latin text |
| I2 | Images not imported | Remote images unreachable | Download and re-host; report failures |
| I3 | Blogger labels become wrong categories | Many labels per post | Map first label to category, rest to tags (preview step) |
| I4 | Duplicate posts after re-import | No uniqueness key | Match by original URL and title+date |
| I5 | Broken HTML from Blogger | Inline styles | Sanitize and normalize on import |

## G. Browser and Device Bugs
- Safari iOS 100vh height issue: use `dvh` with fallback.
- Older Android WebView: avoid unsupported CSS; use fallbacks.
- Samsung Internet dark-mode auto-inversion: set `color-scheme` meta.
- Service worker serving stale pages: versioned cache, update prompt.
- Input zoom on iOS: font size 16 px minimum in inputs.

## H. Hard Rule Bugs
| ID | Bug | Cause | Fix |
|---|---|---|---|
| H1 | Ad appears on home/category/page | Ad script in shared layout | Ad scripts only in article template; build check fails on any ad code outside articles |
| H2 | Popunder fires on non-article page | Global script tag | Load popunder from article template only |
| H3 | Category stays in menu after 7 days | Build not re-run | Scheduled rebuild every 6 hours |
| H4 | Hidden category returns 404 | Page removed with the menu item | Hide from menus only; keep page, URL and sitemap entry |
| H5 | Hidden category missing from search | Search index built from menu list | Search index uses all categories and posts |
| H6 | Menu empty when no active categories | No fallback | Show "Latest" only |
| H7 | An emoji or a symbol used as an icon appears on a page | A template, a pasted article or an import contains it (a symbol character can also show up as a colour emoji on some phones) | Icons are inline SVG only (PLAN 29.3); `npm run build` fails on any emoji in a built page, also as an entity; `no-emoji.test.ts` fails on emoji or icon symbols in templates, scripts, dashboard, design preview, config and plan files |
| H8 | `Icon` used with a name that does not exist | Typo | The `Icon` component stops the build with the name; a test checks every used name |

## P. Push Notification Bugs
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| P1 | The whole audience is notified after an import | 500 old posts look "new" | Age limit of 2 hours; import guard keeps at most 2 posts per announce unless `force` | Announce 50 posts: at most 2 are sent; an old post is refused |
| P2 | The same story is sent twice | Rebuild every 6 hours, retry of the Action | The permalink (and every key in its redirect history) is a unique announce key | Announce the same post twice; one send |
| P3 | A notification opens a 404 or a draft | Post not live yet, or slug changed | Live check (status 200, index) before announcing; redirects keep old keys working | Announce a URL that gives 404: refused (built in v0.65.0: `not_live`, `noindex`, `check_failed`) |
| P4 | Old news arrives a day later | The phone was off | TTL of 2 hours for breaking, 6 hours for normal, 12 hours for digests | Check the TTL header on each kind |
| P5 | Dead subscribers pile up and slow sending | No clean-up | 404 and 410 delete at once; 5 failures pause; 90 days of no visit delete | Fake push service answers 410: the row is gone |
| P6 | Quiet hours wrong, or wrong after a clock change | Offset stored instead of the zone name | Store the IANA zone name; compute the local time at send time | Quiet hours across midnight and across a daylight saving change |
| P7 | The permission box appears too early or too often | Prompt on first visit | Soft prompt rules (31.2); "denied" is final; 3 dismissals mean never | Simulate 1st visit, 2nd article, dismissals, denied |
| P8 | Keyword abuse (very long text, script, hundreds of terms) | Free text field | Strict characters, 40 characters, 4 words, 10 terms; the notification text comes only from the post, never from a keyword | Send script text as a keyword: refused |
| P9 | An emoji or symbol in a notification | Pasted into a headline | Announce refuses emoji text (PLAN 29.3); the editor warns; the Action stops | Announce a title with an emoji: refused |
| P10 | iPhone readers cannot subscribe | Safari needs the Home Screen app | Detect it; show the "Add to Home Screen" steps; never show a broken button | Run the prompt with an iPhone user agent in a browser tab |
| P11 | The free limit is hit in the middle of a send | One request per push | Batches of about 40 each minute; queue table; Retry-After respected; dashboard warning | Queue 200 sends: they finish across several runs |
| P12 | `?pn=1` creates duplicate pages in search | Query string indexed | Canonical stays clean; the page ignores the parameter; the beacon reads it | Check the canonical of a page opened with `?pn=1` |
| P13 | Push endpoint addresses leak | Logged or shown | Endpoint is a secret: never logged, shown only as a short hash | Search the code and a log sample for endpoint text |
| P14 | An editor notifies everyone by mistake | One click, no preview | Dry run with the audience size, confirmation for `force`, site daily cap, kill switch | `force` without confirmation sends nothing |
| P15 | Wrong kinds of posts are pushed | No filter | Sponsored, noindex, archived, draft posts are never pushed | Announce each kind: refused |
| P16 | The service worker is stale or breaks the site | Cached old worker | Versioned worker file, `skipWaiting` on update, the worker only handles push and clicks | Update the worker file and check that the page still loads |
| P17 | A reader is spammed by the same story | Several posts on one event | Story thread merge: same tag replaces; no extra slot | Two posts on one event give one visible notification |
| P18 | Two subscriptions for one browser | Subscribe pressed twice | The endpoint is unique (insert or update) | Subscribe twice: one row |
| P19 | A reader cannot stop the alerts | No clear exit | Unsubscribe and delete data on the preference page; deleting removes the terms and the sent rows too | Delete, then check every table |
| P20 | Keyword reports expose a person | Tiny groups | Only keywords with at least 5 followers appear in reports | Report with 4 followers hides the keyword |
| P21 | Learned weights remove a choice the reader made | Automatic clean-up | Weights only change scores; choices change only by the reader | Tap "Less like this" 5 times: the category stays in the list |
| P22 | Push shown while ads policy forbids it near ads | Confusion with ads | Push is not an ad; the prompt card is never inside an ad slot and never loads ad code | Build check: no ad code in the prompt component |
| P23 | A reader who cleared the site data can never change or remove the alerts | The manage token was lost with the data | The secret endpoint proves ownership: subscribing again gives a new token and the old one stops working | Subscribe without a token: a new token comes and the old one gives 403 |
| P24 | The preference page shows unreadable keywords | Matching uses stemmed words such as iphon | The words as written are stored beside the matching form (`kwtext`, `mutetext`) and are what the page reads back | Save "iPhone launches", read it back: the same text |
| P25 | An encrypted message is too big for the push service | The size rule counted the plain JSON only, and encryption adds 103 bytes | `buildPayload` counts `ENCRYPT_OVERHEAD` (103); `encryptPayload` refuses more than 3,993 plain bytes | A JSON that fits 4,000 alone must not pass; 3,993 bytes encrypt to 4,096, 3,994 are refused |
| P26 | Every send is refused with 401 or 403 | The private key does not belong to the public key, or the contact address is wrong | `loadVapid` signs a test message and checks it with the public key; `cleanSubject` allows only `mailto:` and `https:`; 401 and 403 come back as `auth: true` so the sender can stop and raise an alarm instead of deleting readers | Load a private key with another public key: `key_mismatch` |
| P27 | A signed request is sent to the wrong host | A push service answers with a redirect | `redirect: manual`; a 3xx is `rejected`; the token `aud` is the origin of the endpoint only | A fake service answering 301 and 307 gets one request and no follow-up |
| P28 | A notification opens a page on another site | A wrong or forged `url` in the message | The worker opens only an address on its own site; anything else opens the home page | Message with `https://evil.test/`: the home page opens |
| P29 | A push with unreadable content shows nothing, and the browser shows its own message or takes the permission back | Message not made by our Worker, or cut | One plain notice (site name and "Open the site for the latest news.") is always shown | Push with broken JSON: one notice, no error |
| P30 | The Android status bar shows a white square instead of the mark | A badge with a coloured background | The badge is white with the mark in the transparency only; it is made from the logo's own background colour | Badge file: every visible pixel is white, corners clear |
| P32 | The soft prompt moves the text the reader is reading | The card appears above or inside the screen | It is shown only while its place is still below the visible screen; hidden otherwise | Test: card top above the screen height stays hidden |
| P33 | The soft prompt shows to someone who cannot use it | iPhone Safari tab, a "denied" answer, already subscribed, blocked storage | Four checks in `push-prompt-client.js`; any error means no card | Tests for each case |
| P34 | The notifications page shows a turn-on button that cannot work | Blocked permission, a browser without push, an iPhone tab | The page reads the real status first: blocked and unsupported browsers get a message and no button; an iPhone tab gets the Home Screen steps | jsdom tests for each state |
| P35 | A reader presses Unsubscribe by mistake | One tap deletes the data | The button needs a second press within 6 seconds | Test: one press does not call the client |
| P36 | A reader follows and mutes the same word, or lists too many | Two free-text boxes with no check | The page checks both before sending (limit 10 each, same word in both in any letter case) and the Worker checks again; a refusal shows the Worker's sentence and keeps what the reader typed | jsdom tests in `notifications-keywords.test.ts`: nothing is sent on a clash or too many words |
| P37 | A keyword box that is missing from an old page wipes saved keywords | The form sends an empty list | `readForm` sends `keywords` and `muted` only when the boxes exist, so the Worker keeps what it has | Test: no boxes, no keyword fields in the data |
| P38 | Quiet hours with the same start and end, or an empty time, are sent and refused late | `type="time"` can be empty; the Worker refuses equal times | The page checks both before sending (message, nothing sent, buttons stay usable); the Worker checks again and its sentence is shown, the times stay as typed | jsdom tests in `notifications-quiet.test.ts` |
| P39 | Switching quiet hours off by mistake keeps a stale pair, or an old page wipes the saved quiet hours | Off must be `null`, and a missing box must not send anything | Off sends `quiet: null`; a page without the boxes sends no quiet field; the saved value fills the boxes again | Tests: off sends null, no boxes sends nothing, saved null greys the times |
| P40 | The pause is sent again on every Save and keeps extending a one day pause | The list still says "1 day" after saving | After a save the list shows "Paused until ..." (value `keep`) and `keep` sends no `pause`; a new pause is sent only when the reader picks one | Test: second Save sends no `pause` |
| P41 | A reader pauses before the browser has a subscription, or the pause list shows when it cannot work | No subscriber row to pause | The pause list is shown only in the subscribed state; turn on never sends a pause | Tests: hidden for a new reader, turn on has no `pause` |
| P42 | The page and the Worker disagree on digest hours, modes or pause words | Two copies of the same lists | A test compares the page lists with `workers/push/prefs.js` | `notifications-digest-pause.test.ts`, first test |
| P43 | An author tick never matches or the whole save is refused | The Worker lower-cases an author id and refuses odd ones, so a page id like `Ana` is stored as `ana` | The page lists only ids that the Worker stores exactly as written (`isAuthorSlug`) | Test compares the page rule with the Worker for 12 sample ids |
| P44 | A one-author site asks readers to follow its only author, or saved authors vanish when the block is hidden | The block adds nothing with one author | The block shows from `MIN_AUTHORS` (2) authors with published stories; without the block the page sends no `authors` field, so the Worker keeps what it has | Tests: no block means no `authors` field; template check |
| P45 | The test button is used to flood a reader or a push service | Anyone with a manage token can call `POST /test` again and again | One test a minute for each reader, taken with one SQL statement (`CLAIM_TEST_SQL`); the message is fixed text and goes only to the caller's own browser | Tests: second call inside a minute is 429 and sends nothing; two taps at the same moment send one message; each reader has their own minute |
| P46 | A test uses up a real reader's daily limit or breaks the real send rules | The test shares counters with real sends | The test writes only `last_test`; `sent_today`, `last_sent`, `failures` and `push_sent` are not touched | Test compares the row before and after |
| P47 | A Worker without keys burns the reader's minute, or leaks why it failed | The slot is taken before the keys are checked, or the push service answer is passed on | Keys are checked first (503, no slot used); a push service refusal of our key shows one general sentence, never the status, key or address | Tests: no keys, wrong contact address, mismatched key, 401, 403, 400, 413 |
| P48 | A dead browser keeps a reader row after a test | 404 or 410 from the push service is ignored | The reader is removed and the page goes back to "Turn on notifications" (answer 410, reason `gone`) | Tests: 410, 404 and unusable keys remove the reader and the terms |
| P49 | A post is sent to every reader because the audience search scans the whole table | Search reads all subscribers | The search reads only the indexes (category, keyword word, author, breaking list) | `EXPLAIN QUERY PLAN` of each query uses an index and has no table scan |
| P50 | A paused, failed or deleted reader is found as a candidate | The status rules are applied after the search | The same rules are inside every search query (active, fewer than 5 failures, pause over) | Readers with each bad state are not found, a reader whose pause is over is found |
| P51 | A long post breaks the search (too many values for one query) | One query with every word | Words are cut at 240 and split in chunks of 60 values per query | A post with 400 words finds its reader and no query has 100 values or more |
| P52 | The push address or the keys leak into a later step | The whole row is loaded | The candidate rows have only the columns scoring needs | Loaded rows have no endpoint, key or token column |
| P53 | A reader gets more than the daily limit because the sender is slow | Only sent messages are counted, and the queue is not | Messages that wait in the queue count against the limit like a send | Two waiting messages and a limit of 2: the next story is skipped with the reason limit |
| P54 | Two calls for the same post queue it twice or fill the held list | Check and write are two steps | The queue has a unique key (reader, post) and the held limit of 5 is checked inside the same SQL statement | Run the step twice: one queue row; 5 held stories: the sixth is refused; an expired one frees a slot |
| P55 | A story is sent again to a reader who already has it | Only the queue is checked | The step reads push_sent first and skips a reader who got this post | A reader with a push_sent row for the post is skipped with already_sent |
| P56 | A database error leaves a half plan | Reading and writing mixed | All reading happens first and any error goes up before the first write; the audit row is last | A failing database: queue, held and audit stay empty |
| P57 | The same message is sent twice because two sender runs overlap | Read and mark are two steps | A message is claimed with one statement that changes the row only while it is still queued; a run that changes no row does not send it | Two runs at the same time over 20 messages: 20 sends, each reader once |
| P58 | A phone wakes up to old news | The queue is read without looking at age | Messages older than their time to live are dropped before sending, and the push service gets only the time that is left | A message 7 hours old is expired and not sent; one with 60 seconds left is sent with TTL 60 |
| P59 | A key problem of ours (401, 403, missing key) deletes or fails readers | Every refusal is counted against the reader | A refusal with auth is not counted: the batch stops, the message stays queued and waits 10 minutes | 401 and 403: no failure counted, no message failed, the queue is kept |
| P60 | One "too many requests" answer is followed by more sends | The batch goes on | The batch stops at the first 429, the other messages go back unchanged and wait for Retry-After (one minute if none) | 10 messages and 429: at most 6 requests, all 10 queued again with the wait time |
| P61 | A Worker that stops in the middle leaves messages stuck as "sending" for ever | The state is set and never taken back | A claimed message has a claim time of 5 minutes; after it the message is taken back and the try is counted; after 3 tries it fails | A message left "sending": sent in the next run after the claim time, or failed after 3 tries |
| P62 | One batch is too big for the free plan (about 50 outgoing calls) | Many database calls for each message | 36 sends and about 10 database calls for the whole batch: results are written in one database batch | 36 messages: 36 sends and at most 12 database calls, 48 in all |
| P63 | A message waits in the queue and nothing ever sends it | Planning is switched on but the sender is not (no keys, a pause, no cron) | Planning and sending use one rule (`sendingState`: database, sender keys, no pause): if it is not ready, nothing is planned, so the queue stays empty | No keys, a pause or no database: `/announce` queues nothing |
| P64 | The kill switch does not stop a queue that already exists | Pause only stops new plans | The cron tick checks the same switch first and sends nothing while it is on; the queue is kept and goes on when the switch is off | Plan, switch on, tick: no send; switch off, tick: sent |
| P65 | A planning error makes the deploy job fail or announce twice | The error goes up through `/announce` | Every plan is wrapped: an error is counted in the answer, the post stays recorded and the answer is still 200 | A failing database during planning: 200, `errors: 1`, post recorded |
| P66 | A cron tick that fails stops all later ticks | The error goes up out of `scheduled` | `runCron` never throws and `scheduled` ignores the result; the next minute tries again | A broken database: `scheduled` resolves, the next tick works |
| P67 | Old readers and their data stay for ever | Nothing deletes rows | `cleanup.js` deletes by the retention rules of PLAN 31.3 every hour | A reader unseen 91 days with no delivery is removed with all their rows; 89 days stays |
| P68 | A reader is half deleted (the reader gone, the search words left) | Separate deletes, one fails | The reader and all their rows go in one batch, all or nothing | A failing last delete leaves every row |
| P69 | Clean-up stops while sending is paused, so data lives too long | It was tied to the kill switch | `runCleanupTick` needs only the database | Paused and no keys: the clean-up still runs at minute 7 |
| P70 | A clean-up deletes a message that is still waiting | Delete by age only | Only finished queue rows (sent, failed, expired) older than 1 day are deleted; queued and sending rows are never touched | Old queued and sending rows stay |
| P71 | A test or manual call to `scheduled` deletes real rows with a wrong clock | It used the current time | The clean-up runs only when the event has its own `scheduledTime`, and uses that time | A call with no event time deletes nothing |
| P31 | A browser subscription stays that the Worker does not know | The Worker refused or was unreachable after the browser had subscribed | A subscription made in that call is removed again; an older one is left alone | Refused choice: no browser subscription, no saved state |
| P72 | The same post is announced twice by two jobs at the same time (after a push and at the hourly run) | Two runs overlap | One job at a time (`concurrency`), and the Worker records the key once (`INSERT OR IGNORE`); the answer says `already_announced` | Announce the same key twice: one `accepted`, one `already_announced` |
| P73 | The job asks before the page is live and the post is lost | Cloudflare Pages needs a moment after a push | The job waits 120 seconds after a push, then asks again (4 tries, 90 seconds apart) only for `not_live` and `check_failed`; the Worker records nothing for those, and the hourly run tries again while the post is under 2 hours old | First answer `not_live`, second `accepted`: asked twice; `too_old` is never asked again |
| P74 | A wrong secret or a Worker that is off turns the workflow red every hour | Every run fails the same way | A missing setting or a 503 ends well with one plain line; a 401, 413 or 500 ends with an error and is not retried; a network failure is retried and then ends with an error | Run with no settings: exit 0; fake 401: exit 1 after one call |
| P75 | The secret or a post text appears in the public GitHub log | Printing the whole answer or the request | The log holds only keys, statuses and reason words; a test fails if the runner prints `cfg.secret` | Source check; a full run prints no title |
| P76 | An old post that was saved again, or an import, is announced | The job sees every file | Only posts dated within 120 minutes are sent, at most 25 in one call; the Worker applies the import guard again; a test checks the same numbers as the Worker | A post 121 minutes old is left out; 28 fresh posts: 25 sent, 3 reported |
| P77 | A notification text that is too long or holds an emoji fails late, at the announce, and the post is not notified | The limits are only known to the Worker | The same limits (70 and 120) and the same emoji rule stop the build (schema) and the save in the dashboard, for drafts too | A title of 71 characters and an emoji are refused; 70 and 120 pass |
| P78 | A plain sign such as the copyright sign is refused in the notification text | A rule stricter than the Worker | The pattern skips the copyright, registered and trade mark signs, like the site rule and the Worker; a test compares it with the site finder on 10 samples | The text with a copyright sign, a rupee sign and Bengali passes |
| P79 | A title with a quote or a backslash reaches the notification with stray backslashes | The dashboard writes JSON-style strings and the job read them as plain text | The job reads a double quoted value as JSON (and single quoted YAML) | Write with the dashboard, read with the job: the same text comes back |
| P80 | A typo in `push` (for example `Off`) is taken as `auto` and the post is notified | An unknown value falls back to the default | The schema accepts only `auto`, `off`, `force` and stops the build; the dashboard shows an error; the job ignores an unknown value and the Worker refuses it | `push: maybe` is an error in both |
| P81 | Every post file gets `push: "auto"` after a save in the dashboard and old files change for no reason | The select writes its default value | `cleanPush` leaves out `auto` and empty texts before the file is written | Choose Auto and clear both texts, save: the file has no `push` line |
| P82 | The preview shows a text that the Worker then cuts differently | Two different cut rules | `cutWords` is the same rule as `cutText`; a test compares them on 28 cases | Test in `push-editor.test.ts` |
| P83 | An editor presses Force on a draft or a noindex page and thinks a notification will go | Force has no visible limit | A note under the choice says when it has no use | Notes for draft, noindex, Off |
| P84 | `npm run build` stops with "placeholder text found" because of a code comment | A comment with a sample address is sent inside the page script | The comment does not contain the sample address; the build gate stays strict | `npm run build` ends with "Validation passed" |
| P85 | Visits that come from a push notification are counted as "Direct", so the push value cannot be seen | A notification click has no referrer | The link mark `?pn=1` is read by the beacon (`pn: 1`) and the Worker stores the reserved source `(push)` | A visit with `?pn=1` shows as Push notification; one without it is unchanged |
| P86 | A real website is shown as Push notification, or the raw `(push)` text appears in the list | A made-up referrer could equal the reserved value | `referrerHost` keeps only real host names (a dot, from the address parser), so `(push)` cannot come from a referrer; `sourceName` shows the readable name | Referrers `https://(push)/`, `(push)`, `push` are not the reserved value |
| P87 | `?pn=10`, `?xpn=1`, `?PN=1` or `pn` as text count as push | A loose pattern or a loose number check | The pattern needs `pn=1` as a whole parameter; the Worker needs the number 1 | 9 look-alikes in the Worker tests and 9 in the beacon tests |
| P88 | After this change a page with an old script, or an old Worker, loses visits | A new required field | `pn` is optional and only sent when needed; the deploy note says to update the Worker first | A message without `pn` is accepted and stored as before |
| P89 | A tap of one reader moves the weight of another reader | The tag is the same for all readers | The category is looked up only in `push_sent` rows of this reader (`sub_id`) | Send a story to reader A; reader B taps with that tag; nothing changes for B or A |
| P90 | A made-up tag or event breaks the learning or fills the database | The route is public for anyone with a token | Only `open`, `close`, `less`; unknown tag, empty tag and `test` change nothing; the weight is clamped to -1..1 and at most 40 categories are kept | Send `__proto__`, a 5000 character tag, `shown`; the weights stay clean |
| P91 | The service worker shows an error or retries because the Worker answered with an error | A strict answer to a harmless tap | A known reader always gets 200 `{ ok, applied }`; only a wrong token, wrong reader or wrong origin gets an error | Tap with an old tag; answer 200 and `applied: false` |
| P92 | The answer shows what the reader likes | The answer holds the category or the weight | The answer holds only `ok` and `applied` | Check the answer text for the category and the word weight |
| P93 | Learned weights never fade, so a reader who stopped liking a topic is shown it for ever | Taps only add | Every hour all weights are multiplied by the factor for 5 percent a week (`FADE_SQL`) | 168 runs turn 0.4 into 0.38 |
| P94 | The fade is rounded away (0.1 stays 0.1), or a tiny weight stays for ever | The weights text is kept with 4 digits | The fade keeps 6 digits and removes a weight smaller than 0.005 | One run changes 0.1; a weight of 0.005001 becomes `{}` |
| P95 | The fade breaks a reader row (broken text, gone reader) or stops the clean-up | One bad row stops one big statement | Only valid JSON of a reader that is not gone is changed; `runFade` never throws and the clean-up runs before it | A row with `not json` and a gone reader keep their text |
| P96 | The offer "Remove this topic?" appears for a topic the reader does not follow, or for taps long ago | The count has no window and no check of the list | The count uses the last 30 days and the offer only lists categories that are in the own list of the reader | Tap 5 times for a topic that is not followed: no offer; tap 5 times 31 days ago: no offer |
| P97 | A flood of taps fills the database | One row for each tap | At most 20 rows for one reader and one category in 30 days; rows older than 30 days are deleted every hour | Send 25 taps: 20 rows stay |
| P98 | The change breaks readers whose database has no `push_less` table yet | A new table needs a migration | Every use of the table is guarded; the weight, the read answer and the removal of a reader work without it | Drop the table in a test: the tap, the read and the removal still answer 200 |
| P99 | "Delete my data" leaves the counted taps behind | A new table is forgotten in the removal | The removal deletes the taps of the reader first; the hourly clean-up also deletes taps of readers that no longer exist | Unsubscribe; no push_less row is left |
| P100 | The offer comes back for a topic the reader already removed | The counted taps stay after the category is removed | Saving choices without a category deletes its counted taps (`CLEAR_LESS_SQL`, own error guard) | Tap 3 times, remove the category: no `push_less` row, no `suggestRemove` |
| P101 | Two fast taps on "Remove" save twice | The offer buttons were not in the busy list of the page | The offer handler ignores a tap while one save is running | Click twice: one save call |
| P102 | The one tap saves, or throws away, other edits that the reader typed but did not save | The button used the whole form | It sends only the saved categories without this one; the rest of the form stays as it is, unsaved | Tick another box, press Remove: only `{ categories }` is sent, the box is still ticked |
| P103 | The reader removes the last choice and then gets no notifications | No check before the save | The page refuses when no category, keyword or Breaking news would be left, and says why | One category only, press Remove: message, no save |
| P104 | A category name with markup runs as HTML in the offer line | Text put into the page as HTML | Lines are made with `createElement` and `textContent` | Name `<img onerror=...>`: no img element in the box |
| P105 | A new box name that starts with an older name breaks code and tests that look for the older one by its first letters | `data-n-offer` starts with `data-n-off` | The box is named `data-n-suggest`; names are checked for a shared start before they are added | The old order test (Save, test button, Unsubscribe) passes |

## T. Title Match and Old Blogger Redirect Bugs
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| T1 | A wrong post gets the redirect | Fuzzy or partial title match | Strict key only; one old and one new post per title; near matches are only reported | "Big News" against "big news" gives no pair |
| T2 | Two posts share a title | A headline reused | Ambiguous: skipped and listed; a person adds a hand-made redirect | Two old and one new: no pair |
| T3 | An entity, a non-breaking space or the Unicode form hides a real match | Blogger stores entities | Decode once, NFC, clean spaces | "A &amp; B" equals "A & B" |
| T4 | Double decoding makes a false match | Decoding twice | One pass only | "&amp;#39;" stays "&#39;" |
| T5 | A good redirect disappears later | Old post deleted or title edited | Append-only list | Run with no pairs: list unchanged |
| T6 | The redirect points to a 404 after a slug change | Stored target is stale | The entry moves when the old target is in the post's `redirects` list | Move case |
| T7 | A redirect is silently pointed at another post | A title reused later | The entry is kept and a conflict is printed | Conflict case |
| T8 | `?m=1` and country hosts (`blogspot.in`, `.co.uk`) are missed | Blogger variants | The host check accepts country forms; the query is dropped | `oldPathOf` cases |
| T9 | A lookalike host is accepted | Loose host check | Exact blog name and `.blogspot.` only | `...blogspot.com.evil.site` refused |
| T10 | Half a feed decides the result | Paging or network error | Whole feed or stop; the count is compared with the feed total | The script stops |
| T11 | Open redirect to another site | Bad data in the list | Targets must be paths on this site; the Blogger script adds the fixed origin itself | Full address and `//host` refused |
| T12 | Script injection through the Blogger snippet | Text put into a script | Only paths go in; `<` is escaped | Closing script tag case |
| T13 | A dead target breaks the build or loops | Target not live | The existing builder drops it and reports it; the entry stays | Build check in CHANGELOG 0.51.0 |
| T14 | Too many redirects | A large old blog | The build stops above 2000 static lines | Existing limit |


## S. Search Listing and File Editor Bugs (PLAN 33)
| # | Bug | Cause | Prevention | Test |
|---|---|---|---|---|
| S1 | Title or description cut in the middle of a word in Google | No limit shown to the writer | Counters, warn at 60 and 160, cut at a word end | 60, 61, 160, 161 characters |
| S2 | A handle change breaks old links | No redirect | Redirect asked on every handle change, required after 24 hours | Change a live post handle: old address answers 301 |
| S3 | Many pages with the same description | Field left empty | Automatic fallback from the summary; duplicate warning | Two posts, same description: warning |
| S4 | A page stays hidden by mistake | The noindex switch left on | Red note on breaking and featured posts; the publish list shows it | Breaking post with noindex: warning |
| S5 | Two posts with the same handle | No check | Hard error before save | Same handle twice: refused |
| S6 | Images with no alt text | Forgotten | Image SEO check and the bulk alt screen | File without alt: listed |
| S7 | Renaming a file breaks the posts that use it | References not updated | Rename rewrites references and keeps a redirect in one commit | Rename a used file: posts still show it |
| S8 | The preview does not match the real page | Two copies of the rule | The preview calls `src/lib/seo.ts` functions | Same input, same output in both |
| S9 | An emoji in a title or description | Pasted text | Hard error (PLAN 29.3) | Emoji in a field: refused |
| S10 | A writer changes the handle or noindex of a live post | Only the screen was checked | Roles checked again at save | Writer role changes handle: refused |


## U. Auto Image Hosting Bugs (PLAN 34)
| # | Bug | Cause | Prevention | Test |
|---|---|---|---|---|
| U1 | The Worker is used to reach an internal address (SSRF) | A fetch of any address the user types | https only, public hosts only, every redirect checked, no credentials | `http://localhost`, a private IP and a redirect to one: refused |
| U2 | A huge or endless download | No limits | 10 MB, idle and total time limits, streamed | An 11 MB file and a slow server: stopped |
| U3 | A harmful file saved as an image | Only the header was trusted | Check the first bytes; SVG refused; always re-encode | A text file named `.jpg`: refused |
| U4 | The same picture saved many times | No duplicate check | SHA-256 and source address lookup | Same picture twice: one file |
| U5 | A bad file name (`IMG_1234`, a hash) | Old name copied | Name from alt text, caption, heading, keyword | Camera names are rejected |
| U6 | Two different pictures with one name | A name was reused | A taken name gets -2, -3 | Two pictures, same alt: two names |
| U7 | A picture lost when the download fails | The reference was replaced first | Replace only after a successful write; the failed one stays and is listed | 404: post unchanged, picture flagged |
| U8 | A half saved post (files written, post not changed) | Several commits | One commit for files, post and `media.json`; stop on any error | Fail the last write: nothing committed |
| U9 | The path changes when the date changes | The download day was used | Use the post's publish date; a name is final | Same post saved in two months: same path |
| U10 | A copyrighted agency picture hosted by mistake | Fully automatic | Agency host list asks first; the rights notice is always shown; the source is kept | Getty address: needs confirm |
| U11 | Private data in the picture (location) | EXIF kept | EXIF removed on re-encode | A photo with GPS: none after hosting |
| U12 | The repo grows too large | Thousands of pictures | WebP, 2400 px cap, an R2 option, a size warning near 1 GB | Size warning test |
| U13 | A cached picture shows an old image under the same name | A file replaced in place | Names are final; a replacement gets a new name; immutable cache is safe | Replace a picture: the address changes |
| U14 | The Worker is abused by strangers | No sign-in | Dashboard login or the Action secret, a rate limit | No token: 401 |


## V. AI Operator Bugs (PLAN 35, AI_OPERATIONS.md)
| # | Bug | Cause | Prevention | Test |
|---|---|---|---|---|
| V1 | A scheduled post never goes live | `status: "scheduled"` used; the build only reads `published` | Schedule = published plus a future date | A post with `scheduled` is reported by the content check |
| V2 | The build stops after an AI commit | Bad front matter, missing image, skipped heading level | Branch, pull request, green check before merge | A bad post fails `validate.yml` |
| V3 | A live post loses its address | `date`, `category` or `permalink` changed without a redirect | Add the old address to `redirects` in the same commit | Change a live permalink: the check asks for the redirect |
| V4 | A post points to a picture that is not in the repo | A binary file could not be written | Ask for the upload; keep the post as a draft | Missing image: build stops, check reports it |
| V5 | A secret is committed to a public repo | Careless paste | Never commit keys; a secret scan in `validate.yml` | A key-like text is reported |
| V6 | An edit breaks a config file | Invalid JSON or a removed key | Keep every key, valid JSON only, check on the pull request | Broken JSON fails the check |
| V7 | A draft or scheduled story leaks | Public repository | Private repository for unpublished work | Owner decision |
| V8 | The AI says "published" before the deploy finished | No status check | Report only after the deploy is green and the address opens | Manual |
| V9 | Hand-edited title redirect list | Append-only file edited | Never edit `config/title-redirects.json` | The check refuses a removed line |
| V10 | Two writers change the same file at once | AI and a person or an Action | One writer at a time (`concurrency: content-writer`), pull request merges | Manual |

## L. Auto Language and Location Schema Bugs (PLAN 36)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| L1 | A wrong place is written | A country named in the title is not the story's place | The `location` field wins; `["none"]` switches the place off | Manual and none cases in `geo-schema.test.ts` |
| L2 | A person is read as a country (Jordan, Georgia, Chad) | The name is also a common word | These names count only as a tag or in `location` | Ambiguous case |
| L3 | A part of a word matches (Indiana gives India) | Plain text search | Whole-word match with letter and digit boundaries | Whole words case |
| L4 | A shouted headline becomes a dateline | A capital-letter start | Only a long dash after the city counts; Breaking, Update and similar words are skipped | Dateline cases |
| L5 | Empty place fields appear in the schema | Fake or blank values | `clean()` drops empty values; nothing is written when nothing is found | Nothing found case |
| L6 | A bad owner list stops the build | A wrong entry in `config/locations.json` | Entries without a text name are ignored, never thrown | Broken entries case |
| L7 | Language differs between pages | A hard-coded `en` in some generators | One `SITE_LANG` used by all generators | Language test for WebSite, CollectionPage, simplePage |
| L8 | No country list on an old runtime | `Intl.DisplayNames` missing | The country list is empty and only the owner list, the dateline and `location` work; the build still passes | Manual: check on the build machine |

## K. Direct Code Writing Bugs (PLAN 37)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| K1 | A script in an HTML block steals the GitHub token of the dashboard | The preview runs the code on the dashboard page | Preview only in a sandboxed iframe without same origin; the dashboard never renders custom code in its own page | Put a script that reads `localStorage` in an HTML block: preview shows nothing and no token is read |
| K2 | An author or editor adds a script | The role check is only in the dashboard | The build checks the role of the last committer for Page JavaScript and fails the build if it is not an admin | Commit a script as an editor: the build fails with a clear message |
| K3 | An `on...` handler or a `javascript:` address survives the sanitizer | The allow list is written as a block list | Allow list only; unknown tags, attributes and address types are removed; the same function runs in the dashboard and in the build | A table of 40 bad inputs, all removed |
| K4 | Page CSS restyles the header, the menu or the ad slot | Rules are not scoped | Every rule is wrapped in the post scope; `@import` and outside urls are blocked | Write `header{display:none}`: the header is still there |
| K5 | A fixed full screen box (an interstitial) hurts Google News and Discover | Custom CSS is free | Fixed and sticky overlays that cover the screen are blocked at save | Save `position:fixed;inset:0`: refused with a reason |
| K6 | Two H1 tags, or a skipped heading level, because of an HTML block | The linter reads only Markdown | The linter reads the HTML blocks too | An HTML block with an H1: Publish shows the warning |
| K7 | Custom code adds an ad or an ad network address to the page | Section 29.1 is checked only in the layout | The build fails if an HTML block or script holds an ad network address or an ad slot | Paste an Adsterra address in a script: the build fails |
| K8 | Emoji inside code breaks the no emoji rule | Code blocks are skipped by the scan | The scan also reads code blocks, HTML blocks, Page CSS and Page JavaScript | A code block with an emoji: the build names the page |
| K9 | The script stops working after the content security policy becomes enforcing | An inline script has no hash | The build writes the sha256 of each Page JavaScript to `_headers` for that page | Switch the policy to enforcing in a test: the script still runs |
| K10 | Code blocks are auto linked, counted as words or used as the meta description | Code is treated as text | Code blocks and HTML blocks are skipped by auto links, word count, read time and meta description | A post that is only code has 0 auto links and an empty auto description |
| K11 | Colours in light mode are unreadable in dark mode (or the reverse) | One colour theme | Two themes, both checked at contrast 4.5 to 1 | `contrast.test.ts` reads both themes |
| K12 | Long code makes the page scroll sideways on a phone | The box has no scroll of its own | The block scrolls inside itself | 320 px page: the body does not scroll sideways |
| K13 | The HTML tab loses the layout of an imported Blogger post | Two way conversion drops what Markdown cannot hold | What cannot be written as Markdown is kept as an HTML block and the editor says so | Import a post with a styled table: the table is unchanged after save |
| K14 | A bad script breaks the whole article | The script throws at load | The script runs inside a guard so the text, the ads and the rest still load | A script with a thrown error: the article text and ad slot are still there |
| K15 | Feeds and the news sitemap carry scripts | Feeds use the page HTML | Feeds strip scripts and layout only HTML blocks | RSS of a post with a script: no script in the feed |
| K16 | The AMP page fails validation because of custom code | AMP does not allow it | The AMP version drops scripts and anything over the AMP CSS limit | AMP validator passes for a post with custom code |
| K17 | A code sample holding lorem ipsum or example.com is published as real text | Section 25 is not checked inside code | The editor warns, and the pre-launch sweep greps code too | A code block with example.com: warning in the editor |
| K18 | A lost edit: the reader or editor saves a wrong script and cannot go back | No copy of the last good version | Autosave and "Undo my last code change" keep the last good version | Save, change, press Undo: the old code is back |

## W. Bot Protection Bugs (BOT_PROTECTION.md)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| W1 | Any website can call a Worker from a browser | CORS `*` or a partial origin match | `originOk` is an exact match; an empty, `*` or non-http(s) site origin never matches | Origin cases in `guard.test.ts` |
| W2 | A bot learns which check caught it | Different answers for trap, timing and stamp | The trap and the too-fast form are dropped with an "ok" answer; the trap is checked before the stamp | Order case |
| W3 | A real person is dropped after a long coffee break | An old form was dropped silently | An old form (over 2 hours) gets a plain "reload the page" message and nothing is lost | Too old case |
| W4 | A stamp from one form works on another | The signature covers only the time | The route is part of the signed text | Wrong route case |
| W5 | A forged or changed stamp passes | Plain text compare, no signature | HMAC SHA-256 with a Worker secret and a compare that does not stop early | Changed time, wrong secret, junk cases |
| W6 | A missing secret lets everything pass | Check skipped when no secret | No secret gives 503, never a pass | Missing secret case |
| W7 | The address or the message is kept for rate limits and duplicates | Raw values used as keys | `hashKey` makes a salted hash; the raw value is never stored | Hash case |
| W8 | A huge body is read before it is refused | Only the real text was checked | The declared length is checked first, then the real text | Size cases |
| W9 | A guard is added to a Worker by mistake and breaks a live form | The file is new and unused | A test checks that no Worker uses it until its own part connects it | File case |
| W10 | A message in Bengali or another script is refused as too large | The header length (bytes) was compared with a limit in characters | The header may be up to 4 times the character limit; the real text is checked in characters | Bengali case in `guard.test.ts` and `contact-worker.test.ts` |
| W11 | A real person who waits too long loses the message | An old stamp ended in a refusal with no way to go on | The Worker answers `reload: true`; the page asks for a new stamp and keeps the text | Too old and reload cases |
| W12 | A quick second try after a refusal is dropped as "too fast" | A new stamp was asked for after every refusal | A new stamp is asked for only after a sent message or a `reload` answer | Ordinary refusal case in `contact-form.test.ts` |
| W13 | The stamp does not stop a patient bot | A bot can ask `GET /stamp`, wait 3 seconds and send | Known and accepted: the stamp only stops instant scripts. Turnstile, the rate limits and the trap field are the main walls | Documented in README and `BOT_PROTECTION.md` |
| W20 | The page close message is lost because the stamp is asked for at that moment | `sendBeacon` cannot wait for an answer | The stamp is asked for when the page opens and kept for the page view; nothing is sent until it has arrived, then the newest numbers go out | Stamp before and after cases in `beacon.test.ts` |
| W21 | The beacon needs a preflight and the leave message is dropped | A JSON content type is not a "simple" request | `/collect` keeps `text/plain` JSON; the guard has `allowPlain` | Content type cases in `analytics-worker.test.ts` and `guard.test.ts` |
| W22 | A long referrer makes the message too large once the stamp is added | The stamp adds about 80 characters to a message that was limited to 1 KB | The page cuts `ref` to 300 characters, the Worker allows MAX_BODY plus 128 | Longest message and cut referrer cases |
| W23 | The first message is an empty one (0 seconds) when the stamp arrives early | The stamp callback sent at once | It sends only when a reader second has passed | "Empty first message" case in `beacon.test.ts` |
| W24 | A stamp call that always fails keeps asking on every tick | No limit on the retries | At most 3 tries in all, then the page stays quiet | "3 times in all" case |
| W25 | The Privacy page says Turnstile or a stamp is used while that feature is off (or says nothing while it is on) | The text was written by hand and not tied to the config | The section is built from the config files: contact needs endpoint and site key, analytics and push need an endpoint | "nothing while off", `featuresFrom` and "all three on" cases in `required-pages.test.ts` |
| W26 | An older Privacy page is silently rewritten when `npm run pages` is run again | The generator writes pages again | A page that exists is never touched (its date is in its address); the README tells the owner to add the section by hand | "never touches a page that already exists" case in `required-pages.test.ts` |
| W27 | A script claims to be a person by sending `acted` itself | Any program can write a number in a message | Only the number 1 counts; the page counts only real events (`isTrusted`); the flags are a signal for Part 4b, not a proof. The stamp, the origin check and the bot list stay in front | `acted` cases in `analytics-lib.test.ts`, `analytics-worker.test.ts` and `beacon.test.ts` |
| W28 | A made-up click from a script (dispatchEvent) sets `acted` | The page reacted to every event | The beacon ignores events with `isTrusted` false (read time still counts them, as before). Limit: a real browser driven by a tool that sends real input events cannot be told apart this way | "made-up event" case in `beacon.test.ts` |
| W29 | An old database has no new columns and every save fails | `CREATE TABLE IF NOT EXISTS` does not add columns | `migrate-0.76.0.sql` (run once); the README and INCOMPLETE say so; the test builds an old database and runs the migration | The migration case in `analytics-human.test.ts` |
| W30 | The second message of a page view lowers a flag | A late or older message overwrote the row | The upsert uses `MAX`, so a flag only goes up | "only raises the flags" cases in `analytics-lib.test.ts` and `analytics-human.test.ts` |
| W31 | A cloud server visit is counted as a reader | The edge's network number was not used | `dc` column from `request.cf.asn` and a datacenter list; such a visit is unverified | "datacenter" cases in `analytics-verified.test.ts` |
| W32 | A page makes its own visit look like a home network | The browser could send `dc` | `dc` comes only from the edge; a field named `dc` in the message is refused (400) by the exact-field check and ignored by `cleanBeacon` | "dc from the edge" cases in `analytics-verified.test.ts` |
| W33 | Verified and unverified counts follow different rules in different places | The test was written twice | One rule `VERIFIED_SQL`; `VERIFIED_COUNT` is built from it and used by the rollups and `/stats`; a test checks every query contains it | "one rule only" case in `analytics-verified.test.ts` |
| W34 | An old database has no `dc` or `verified_views` and every save fails | `CREATE TABLE IF NOT EXISTS` does not add columns | `migrate-0.77.0.sql` (run once, after `migrate-0.76.0.sql` where needed); the README and INCOMPLETE say so; old rollup days count as unverified in the lifetime number | The migration case in `analytics-verified.test.ts` |
| W35 | A reload or a quick return is counted as a new visit | Every page view had its own row | The session id plus the address: another page view inside 30 minutes is skipped by the one insert statement | `analytics-visit.test.ts` |
| W36 | The leave message of a long read is lost because of the 30-minute rule | The rule looked only at the time | A page view that already has its row is always updated (the `EXISTS` branch) | "old page view is still updated" case in `analytics-visit.test.ts` |
| W37 | A background tab or a bounce under 5 seconds is counted | The first message went out after 1 second | The page sends nothing until 5 counted reader seconds, also on leaving | The 5-second block in `beacon.test.ts` |
| W38 | A late stamp sends an empty message | The stamp arrived before there was anything to say | The stamp answer sends only when read time is 5 or more | "late stamp" and "early stamp" cases in `beacon.test.ts` |
| W39 | The red note fires on one visit on a quiet site | Normal was 0, so 1 visit was infinite times higher | Normal is at least 1, and a note needs at least 10 unverified views in the step |
| W40 | One old spike makes the note never fire again | The normal level was an average | The normal level is the median of the earlier steps, so one spike does not move it |
| W41 | The screen breaks or shows wrong numbers with an older Worker answer | The new fields were assumed to be there | The screen checks for `verifiedViews` and `unverifiedTimeline`; without them it draws the old card and no note |
| W42 | The same limits are written twice (Worker and dashboard) and drift apart | The note rule was copied | The Worker only sends the two counts per item; the rule (3 times, 10 views) is in the dashboard only (`itemAlert`) |
| W43 | An item note is shown for 7 days or lifetime with a wrong comparison | The period before is not in the raw events any more | `itemUnverified` is null there and the screen draws no item note |
| W44 | A page address with HTML in it runs as code in the note | The address was put in as HTML | The note is built with text nodes only; a test puts an `<img onerror>` address and checks it stays text |
| W45 | A bot that only opens the page still loads ad scripts after 4 seconds | The idle timer started the loader | No timer: only a real event starts it (`onAction` in `ads-client.js`) |
| W46 | A script makes up a scroll or key event and starts the ads | Any event was accepted | An event with `isTrusted` false is ignored |
| W47 | The loader never starts for a real reader because the listeners were removed with another function | `stop()` removed `run`, the listeners were added as `onAction` | The same function is added and removed; a test checks the listeners are gone after the first real event |
| W48 | A datacenter bot is shown ads | Only the analytics Worker knew the datacenter list | The geo Worker answers `ads: false`, reason `datacenter`, for a network on the shared list; the ad loader loads nothing for `ads: false` |
| W49 | The two Workers disagree about what a datacenter is | The list was copied into each Worker | One file, `workers/shared/datacenter.js`; the analytics file only re-exports it; a test checks it is the same object and that no second list of numbers exists |
| W50 | The datacenter rule is switched off by a typing mistake in the setting | The setting was read loosely | Only `false`, `0`, `no` or `off` turn it off; a missing, empty or unknown text keeps it ON; tested |
| W51 | The network number leaks to the browser, or one visitor's answer is cached for another | The answer carried the number or lost its no-store header | The answer holds only the word `datacenter`; `Cache-Control: no-store, private` and `Vary: Origin` are unchanged; a test checks the number is not in the answer text |
| W52 | The owner's own visits are counted as readers and inflate the numbers | The owner reads their own site in a normal browser | `?own-browser=on` marks that browser; the beacon returns at once there (no stamp, no timer, no message); tested |
| W53 | The owner's own browser shows or loads ads (risk of invalid clicks on the owner's own ads) | The ad loader starts on any real event | The marked browser gets the empty runner: no geo request, no listener, no ad script; tested |
| W54 | The switch is read loosely (`xown-browser=on`, `own-browser=onn`, `own-browser=`) | A loose pattern on the address | Only the exact word with the value `on` or `off` counts; every other form does nothing; tested |
| W55 | A blocked storage breaks the page or the clients | `localStorage` throws in some private modes | Every read and write is in try/catch; a failure means "not the owner's browser" and the page works as before; tested |
| W56 | A browser guesses the file type and runs an upload or a text file as a script | No `nosniff` on most paths | `X-Content-Type-Options: nosniff` for all paths in one block; tested |
| W57 | A header is sent twice with two values and the weaker one wins (for example `Referrer-Policy` on the dashboard) | Two matching blocks in `_headers` set the same name | The all-paths block holds only names no other block sets; the dashboard keeps its own `no-referrer`; a test fails if any block repeats a name |
| W58 | HSTS locks a sub-domain that has no https, or is locked for good by `preload` | `includeSubDomains` and `preload` are hard to undo | One year, no `preload`, the owner decision is written in `INCOMPLETE.md`; tested that `preload` is absent |
| W59 | A permissions rule breaks push notifications or the Turnstile box | Too wide a policy | Only camera, microphone, location and payment are switched off; a test fails if notifications, push, clipboard or fullscreen appear in it |
| W60 | A strict content policy is switched on at once and blocks the site's own scripts, ads or contact box | No trial run | Report-only first: it blocks nothing; enforcing is a later step per page type (6b-3); a test fails if an enforcing `Content-Security-Policy` header appears |
| W61 | The report-only policy is applied to the dashboard and floods the console, or the dashboard gets a policy it cannot run under | The all-paths block reaches `/admin/*` | A `! Content-Security-Policy-Report-Only` line in the dashboard block; a test checks it; the live check is in `INCOMPLETE.md` |
| W62 | The policy is weakened by a typing mistake (eval, a foreign host, a wildcard) | Hand-edited header line | Tests fail on `unsafe-eval`, on any wildcard or `https:` in `script-src` and `default-src`, on an ad or Turnstile host (those come in 6b-3), and on a missing `object-src`, `base-uri`, `form-action` or `frame-ancestors` |
| W63 | The Turnstile host is added to every page, or the Contact Us box breaks when the policy is enforced later | One policy for all pages | The Turnstile host is only in the Contact Us block, only in `script-src` and `frame-src`; tests compare it with the all-paths policy and fail on any other difference, and read the component to check its script host |
| W64 | The Contact Us page gets two policies at once (the all-paths one and its own) | Headers of two matching blocks add up | A `! Content-Security-Policy-Report-Only` line in its block; a test checks the block has the detach line and its own policy; the live `curl -I` check is in `INCOMPLETE.md` |
| W65 | The block never matches: the date in the address changes, or the slug is renamed | The address has the publish date | Placeholders for year, month and day; tests check that the path matches any date and only the slug `contact-us`, and that the page file and the required-pages list use the same slug |
| W66 | The dashboard policy lets in an inline or foreign script, and a stolen script could read the GitHub token | The dashboard first had no policy of its own | `script-src 'self'` only; tests fail on `unsafe-inline`, any host, a wildcard, `eval`, and read `index.html` (one module script, no inline script, no inline handler) and every dashboard script (no `eval`, `new Function`, script building, `import()`) |
| W67 | The policy would break the dashboard when enforced (previews, GitHub, the Workers, remote image import) | Needs that the policy did not list | Report-only first; `blob:` added for previews, `connect-src` stays `'self' https:` (GitHub, the Workers and any old image host are all https); the console report after the deploy is the check, in `INCOMPLETE.md` |
| W68 | The old Blogger XML tool is broken by the strict dashboard policy (its page has an inline script) | The tool sits in the same folder | Its own block with the all-paths policy; a test checks the tool still has the inline script and the policy is the same as the all-paths one |
| W69 | The article policy misses an ad host and the ads break once the policy is enforced | Adsterra and AdSense load more hosts than the config shows | Report-only first; a test makes every host in `config/ad-loader.json` and the AdSense script host part of the block; the console report with ads on (6b-3b) finds the rest before anything is enforced |
| W70 | An ad host is added to the policy of every page, and a stolen script could be loaded from it | One policy for all pages | The ad hosts are only in the article block (the template that holds the ad loader); a test checks the ad loader is used by that one template and that the all-paths and form policies have no ad host |
| W71 | The policy is weakened by a wildcard or a broad source when someone adds an ad host | Hand-edited header line | Tests fail on `*`, `unsafe-eval`, and any script source that is not `'self'`, `'unsafe-inline'` or one exact `https://host`; the block may differ from the all-paths policy only in `script-src` and `frame-src` |
| W72 | A real reader, a good bot or the owner is blocked by the trap | The trap blocks by address and by name | Reserved and private addresses and the owner's own list are never blocked; a client that names itself Googlebot, Bingbot and others is only recorded; the link comes only after decision 6, and Disallow in `robots.txt` keeps good bots away |
| W73 | The 24-hour clean-up deletes the owner's own entries from the Cloudflare list | Both sit in the same list | Our items carry the comment `sdn-trap until=...`; the clean-up returns only items with that exact start and a readable time; tests check owner entries, empty and broken comments and items without an id |
| W74 | A wrong account or list id, or a made-up address, sends an API call to the wrong place | Ids come from settings | Both ids must be exactly 32 letters or numbers (a to f, 0 to 9); the URL is built only from them; tests refuse `../`, capitals and wrong lengths |
| W75 | A flood of trap hits fills the account's list or hits the one-bulk-operation limit | Cloudflare allows one pending bulk operation per account | Our own limits: 1000 of our items, 100 per call; the later Worker sends calls one after the other (written in README and INCOMPLETE) |
| W76 | The trap switches on by accident, or stays on when the owner wants it off | A kill switch that reads many spellings | ON only for exactly `true` (any case); anything else, an empty text or a missing value is OFF; it ships OFF | Switch cases and the file check in `trap-worker.test.ts` |
| W77 | The client or an attacker learns whether the trap is on, or that an address was blocked | Different answers for different outcomes | The same plain 404 with `noindex` and no-store for every request, switch on or off; the work runs in the background | Same-answer tests |
| W78 | The API token or a visitor's address ends up in a log | Logging an error or the request | Logs hold only a short reason word; a test fails a network error that carries the token text and checks every `console` line in the file | Token and log-line tests |
| W79 | A clean-up that stops with the switch leaves addresses blocked for ever, or a failed call is repeated in a loop | Clean-up tied to the switch; no limit on pages and calls | The hourly clean-up runs even when the switch is off, deletes only our own expired items, reads at most 5 pages, sends at most 5 delete calls of 100, and stops at the first failure | Clean-up tests |
| W80 | The screen cries wolf: a red level after a handful of visits | 3 views, all unverified, is 100 percent | Under 50 views the level is `few` ("too few to judge"), never `watch` or `high` | `few` cases in `security-rules.test.ts` |
| W81 | The screen shows a made-up or wrong share when the Worker sends no verified count | A missing number read as zero | A missing or odd verified count gives level `unknown` and no share; no views gives `none`; verified above views counts as 0 percent | `unknown`, `none` and odd-number cases |
| W82 | A review list never comes back after a wrong clock or a first visit | "Last done" is empty or in the future | `isDue` counts never done, a non-number and a future time as due; a bad time or days value throws | `isDue` cases |
| W83 | The Mark done button marks a wrong item, or a broken saved text breaks the screen | Ids and times come from storage the owner (or a browser extension) can edit | Only the known ids and times above zero are read; `markDone` ignores an unknown id or a bad time and never changes the old map; broken text gives an empty map | `readLastDone` and `markDone` cases |
| W84 | The screen leaks the owner to another site, or the link takes over the dashboard tab | An outside link with `target="_blank"` and no `rel` | One outside link only (the Cloudflare start page), `rel="noopener noreferrer"`; a test fails on any other link | Link test |
| W85 | The screen shows numbers that were never measured when the Worker fails | Old or empty numbers drawn as zeros | Without numbers it draws only the plain notice (for example the text of `statsError`) and no level card | Notice test |
| W86 | A person who is not an admin opens the Security screen | A new address that someone forgot to protect | The route and the menu entry use the same `analytics` permission as Analytics; the screen is hidden from editors and authors | Role cases in `admin-security.test.ts` |
| W87 | The screen keeps asking the Worker and uses up the free plan, or shows old numbers after a failure | A timer, or the old summary kept after an error | No timer: two calls only when the owner opens the screen or presses Refresh; a failure clears the numbers and shows the plain reason | Two-call and failure cases |
| W88 | A full or blocked browser storage breaks the screen or loses the click | Saving without a try/catch | Every read and write of `localStorage` is inside try/catch; the time stays on screen when saving fails; broken saved text reads as empty | Storage cases |
| W14 | A form stops working after deploy because the new secret is missing | `STAMP_SECRET` is new (contact since v0.72.0, push since v0.73.0, analytics since v0.74.0) | The Worker answers 503 (never accepts what it cannot check) and the page shows the plain "write to us by email" message; the README and `wrangler.toml` say how to set it | Missing secret cases (contact, push and analytics) |
| W15 | A reader cannot remove their own data while new subscriptions are switched off | One kill switch for every push route | `PUSH_SUBSCRIBE_OFF` stops only `/subscribe` and `GET /stamp`; `/unsubscribe`, `/preferences` and `/test` never read it (PLAN 31.3) | Switch case on a real SQLite database in `push-endpoints.test.ts` |
| W16 | A real reader is dropped as "too fast" because the push stamp was just made | The stamp is asked for right before the call, with no waiting time | The push Worker sets `stampMinMs` to 0; the client never waits | Zero minimum case in `guard.test.ts`, stamp cases in `push-client.test.ts` |
| W17 | A missing push field becomes an empty text and changes what the Worker does | `checkSchema` turned every missing field into `''`, and `pause` is checked with `!== undefined` | Fields can be `optional` (left out when missing); `prefs` and `subscription` are `object` fields handed on unchanged | Optional and object cases in `guard.test.ts` |
| W18 | A reader who must subscribe again (lost token) is refused because the quiet fix sent no stamp | The fix calls `/subscribe` without the page | `reauthorize` uses the same stamp step as `enable` | Quiet fix case in `push-client.test.ts` |
| W19 | A failed stamp leaves half a state in the browser | The browser subscription was made before the stamp failed | A failed call removes a browser subscription that was made just now, as for any other failure | No stamp case in `push-client.test.ts` |

## X. Connected Apps Bugs (PLAN 38, LOGICS 26)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| X1 | Token leaks into a log, a commit or the repo | Error text or a debug line prints the header | Never log headers; the commit and activity writers take only the last 4 characters; a secret scan in `validate.yml` | Send a bad request with a token; no log, activity line or error answer contains it |
| X2 | A revoked or expired token still works | Cache of the check | No cache longer than 60 seconds; revoke clears it at once | Revoke, then call: 401 within 1 second |
| X3 | A token does more than was ticked | Scope check missing on one route | Route table lists the scope for every route; a test walks the table; unknown route denies | Call every route with a token that has no scopes |
| X4 | Path trick writes outside content | Permalink with `../` or `%2e` | The Worker builds the path from checked parts; final tree check | Permalinks `../x`, `a/b`, `a%2fb`, `A`, empty, 200 characters |
| X5 | Lost update (two writers, one file) | No version check | `If-Match` with 412 and the fresh text | Change the file between read and write: 412, nothing committed |
| X6 | Double publish after a timeout and retry | Client repeats the request | `Idempotency-Key` | Same key twice: one commit |
| X7 | A prompt injected into a post makes the assistant delete things | Assistant treats content as orders | The API acts only on scope and confirm words; delete forever is off by default and needs the confirm word | Post text says "delete everything"; a token without the scope cannot |
| X8 | The build breaks after an API write | API and build rules differ | One shared rules file; the API refuses before the commit | Every build rule has a test that runs through the API |
| X9 | Hard delete of a ranked post | Delete used instead of archive | Archive is the normal way; delete needs its own scope, the confirm word and a warning with the links | Delete without the confirm word: refused |
| X10 | GitHub App key mistakes | GitHub gives a PKCS#1 key, the Worker needs PKCS#8 | README step with the conversion command; a startup check with a clear message | Start with the wrong key format: a plain error, no crash loop |
| X11 | Runaway loop of an assistant | A bug repeats writes | Rate limits per minute and per day; a daily budget message in the answer | 21 writes in a minute: the 21st is 429 |
| X12 | Activity log holds reader or secret data | Body text stored | Store only action, target, result, codes | Inspect a stored line |
| X13 | One compromised token controls everything | Wide scopes, no expiry | Default off, 90 day expiry, Pause all, one app per assistant | Expired token: 401 |
| X14 | Browser pages call the API with a stolen session | CORS allowed | No CORS headers; Bearer only, no cookies | A browser request from another origin fails |
| X15 | Wrong assumption that the assistant plan allows the connector | Plan rules change | PLAN 38.2 says to check on the day; the path of AI_OPERATIONS 15 stays as the fallback | Read the assistant's own help page before Part 9 |
| X16 | Picture upload fills the repo | No size or type limit | WebP only, 2 MB, file name rules of PLAN 34, daily media budget | Upload a 5 MB PNG: refused |

## Y. Automatic Sign-in Bugs (PLAN 39, LOGICS 27)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| Y1 | Token stolen from storage | Token kept in `localStorage` for "stay signed in" | Token only in memory; the cookie is HttpOnly and encrypted | After sign-in, storage holds no token; the cookie is not readable by script |
| Y2 | Another site reads the session | `/session` answers any caller | Same-origin check; `SameSite=Strict`; no CORS headers | Call from another origin: 401 |
| Y3 | Redirect loop after a failed sign-in | Auto redirect on every load | One try per tab, then the button | Make GitHub fail twice: the button shows, no third redirect |
| Y4 | Open redirect through the return value | Return address taken from the URL | Only `#/` plus safe characters | Return values `https://evil.example`, `//evil`, `#/..`, a script: all become `#/` |
| Y5 | A removed person stays in | Session trusted without a check | Allow list and roles checked at every session read | Remove a login; its next load is 401 |
| Y6 | Sign out leaves a live token | Only the tab forgot it | Worker revokes the token at GitHub and clears the cookie | After Sign out the old token gets 401 from GitHub |
| Y7 | Lost devices stay signed in | No all-devices switch | Key version number | Raise it: every old cookie is refused |
| Y8 | Cookie not sent on the dashboard call | Worker on another site (`workers.dev`) | Serve the sign-in from the site's own address | Test on the real site, not only on the Worker address |
| Y9 | Token reaches a private repository | Scope `repo` | Scope `public_repo` while the repo is public; red note if private | Setup screen with a private repo and the small scope shows the note |
| Y10 | Session secret leaks or is reused | Key in a file or the repo | Worker secret only; secret scan in `validate.yml`; rotate with the key version | Search the repo for the key name with a value |
| Y11 | Clock or idle limit wrong | Cookie lifetime only in the browser | Limits inside the encrypted value, checked by the Worker | Change the clock by 8 days: no session |
| Y12 | An AI believes its GitHub connection logs it in | Two keys confused | PLAN 39.2 and AI_OPERATIONS 17 say it plainly | Read the files; no recipe uses the dashboard login for an AI |

## Z. Link Editor Bugs (PLAN 40, LOGICS 28)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| Z1 | A line is dropped silently | The old box filters bad lines | Rows with reasons; save blocked | A row with no address cannot be saved and says why |
| Z2 | Dangerous address saved | `javascript:` or `data:` passes `z.string().url()` | Only `https://` after the rule 28.1 | `javascript:alert(1)`, `data:text/html,x`, `ftp://x.y`: refused |
| Z3 | Same profile twice | No duplicate rule | Duplicate key (28.1 step 9) | `x.com/a`, `https://www.x.com/a/`: refused |
| Z4 | Tracking junk in a saved address | Address pasted from a share button | Strip `utm_*`, `fbclid`, `gclid`; tell the owner | Paste an address with all three |
| Z5 | A bad link breaks the build | Schema rejects an old address | The dashboard uses the same rules; the build gives a plain message with the author file | Build with a broken author link: the message names the file |
| Z6 | Wrong type or icon | Host table too small or too greedy | Parent-domain match, `whatsapp.com/channel` rule, hand override | 30 real addresses and 10 look-alikes (`notx.com`) |
| Z7 | Link opens with no `rel` | Template forgets it | One link component; `rel` by type | Render each type; read the `rel` |
| Z8 | Emoji in a label | Pasted from a social page | The no-emoji rule in the label check | Paste a label with an emoji: refused |
| Z9 | Dashboard and build disagree | Two copies of the rules | Same functions, a shared cases test | 60 cases through both files: equal answers |
| Z10 | Phone layout breaks | Four fields in a row | Rows stack under 600 px; buttons 44 px | 320 px screen: no sideways scroll |
| Z11 | Dead links stay for years | No check | Weekly report-only Action | A saved 404 address appears in the report |
| Z12 | Order lost on save | Rows sorted by type | Order is the row order | Move a row to the top, save, reload: same order |

## M. Author Page Bugs (PLAN 41, LOGICS 29)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| M1 | No author page, so nothing to index | Page only exists after the first published post | Show author page now switch (profile must be complete) | Author with no post and the switch on: page is built |
| M2 | A thin author page is indexed | One-line bio, no links | `noindex,follow` and no sitemap line until index-ready | Bio of 40 characters: `noindex`, not in `sitemap-authors.xml` |
| M3 | Title repeats the name | "Name | Name News" | Title pattern `{Name}, Author at {Site}` | Read the title of the built page |
| M4 | Article and profile are not tied together | Author data has no `@id` | Same Person `@id` in article and profile | Compare the two `@id` values in one build |
| M5 | Author box has no link or photo | Box shows only an initial | Linked name, photo, role, bio | Render the article; the box has a link to the author page |
| M6 | Bio holds a web address or promotion | Pasted from a profile | Warn in the dashboard and in the build; index-ready needs no address | Bio with `https://x.example`: not index-ready |
| M7 | `/authors/` with one author | Always built | Built only with two or more live authors | One author: no `/authors/`, no link |
| M8 | Sitemap lists a `noindex` page | Sitemap built from all authors | Sitemap uses the same live and index-ready test as the page | A `noindex` author is not in the sitemap |
| M9 | `lastmod` changes on every build | Build time used | `updated` and newest post only | Build twice: same `lastmod` |
| M10 | Photo is huge or missing alt | No limit | WebP, at least 400 px square, at most 300 KB, alt is the name | Upload a 2 MB photo: refused |
| M11 | Invented person or credentials | Fake author to look bigger | Plan rule: real people only; warning for "AI-generated" language and unlinked awards | Bio with an award and no link: warning |
| M12 | IndexNow is expected to reach Google | Misunderstanding | PLAN 41.9 says it does not; Search Console and the sitemap do | Read the text in the Authors screen |
| M13 | Two authors with the same slug or name | No uniqueness check | Slug is the file name (unique); same name shows a warning | Two files with the same name: warning |
| M14 | Page 2 of an author competes with page 1 | Pagination | Self canonical and `noindex,follow` from page 2 as for other lists (BUGS S group) | Build page 2; read the tags |

## R. Theme and Dark Mode Bugs (PLAN 42, LOGICS 30)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| R1 | Weak contrast after a new accent | Colour picked by eye | The Theme screen and the build test block it and name the ratio | Pick `#ffb347` as fill: refused with 1.9 : 1 |
| R2 | Flash of the wrong theme | Mode applied after paint | Inline head script before paint plus `color-scheme` | jsdom: the attribute is set before the body script runs |
| R3 | Browser bar stays orange in dark | One `theme-color` | Two tags with `media` and a script update | Read both tags; force dark and read the tag |
| R4 | Scroll bars and pickers stay light in forced dark | No `color-scheme` | `style.colorScheme` set with the mode | Force dark: `colorScheme` is `dark` |
| R5 | System choice lost after one tap | Two-state switch | Three states, System is the default | Tap three times: back to System |
| R6 | Dark colours drift apart | Ten copies in the CSS | Generated from one file; stale check | Edit one token only in the CSS: the build fails |
| R7 | Cards vanish in dark | Card 1.08 : 1 on page | Three surfaces and soft borders at 1.4 : 1 | Contrast test on surface, surface-2 and border |
| R8 | Input border cannot be seen | Border same as card | `border-strong` at 3 : 1 | Contrast test on `border-strong` |
| R9 | Photos glare, logos disappear | No dimming or plate | Brightness .92; `data-plate` | Render a transparent PNG logo in dark |
| R10 | Ads break the theme | Ad colours not framed | Framed neutral slot with a label | An ad with a white background sits inside the frame |
| R11 | Code, table or quote unreadable in dark | Light-only colours | Dual-theme colours (PLAN 37) | Article with each: ratios 4.5 : 1 or more |
| R12 | Playful look changes by accident | Shared tokens edited | Token-set snapshot test for Playful | Change one Playful token: the test fails |
| R13 | Layout shift from the category bar or fonts | No reserved space | Fixed heights, `size-adjust` fallbacks | Lighthouse CLS 0 on home and article |
| R14 | Printed page is dark | Dark applied to print | Print uses light tokens | Print media rule exists and is tested |
| R15 | Windows high contrast loses borders | Colours only | `forced-colors` rules | Rule exists; focus ring uses `Highlight` |
| R16 | Dashboard and site disagree | Two colour sets | Dashboard uses the same tokens | `admin.css` has no raw hex outside tokens |
| R17 | Hard-coded colours creep back | A component sets its own hex | Grep test for raw hex in `global.css` outside the generated file | Add a hex in a component: the test fails |

## Q. Task System Bugs (PLAN 43, LOGICS 31)
| ID | Bug | Cause | Fix | Test |
|---|---|---|---|---|
| Q1 | "Done" with no proof | Nothing asks for evidence | Evidence rule and validators | A card with Evidence "done" fails the check |
| Q2 | Two actors change the same files | No claims | `claimed-by`, one in-progress card per claimer, no shared paths | Two cards with the same path both in progress: refused |
| Q3 | The card no longer matches reality | Work moved on, card not updated | Stale claim after 24 hours; weekly sweep | A claim with a 2 day old Log is listed as stale |
| Q4 | An AI reads the wrong or an old document | Too much text, no order | `AI_START_HERE.md` context packs; archive; budgets | Word-count test on every root file |
| Q5 | Documents grow without end | No limit | Budgets and the archive script | A file over its budget fails the test |
| Q6 | An AI changes a red thing alone | Risk not checked | Red needs `approved-by`; paths check; red closed only by the owner | A red card without `approved-by` cannot be in progress |
| Q7 | An owner step is assumed done | Nobody checks | Owner tasks have Check it buttons and evidence; status `verify` | An owner card with empty Evidence cannot close |
| Q8 | The doer confirms their own work | One key | Second key rule | Confirmer equal to claimer: refused |
| Q9 | A secret ends up in a card, issue or pull request | Pasted by mistake | Secret scan in the task check and in `validate.yml` | A card with a `ghp_` token fails |
| Q10 | A stranger's issue or comment steers the AI | Public repository, text read as an order | Act only on cards and on owner-opened issues; other text is data | A comment saying "delete all posts" is ignored by the rules (read the text of AI_START_HERE 2.1) |
| Q11 | The live check passes while the new page is broken | Only the home page is checked | The card lists the new address; `verify-live` checks it | A card for a post without its address in "Done when" fails the check |
| Q12 | Nobody knows how to undo | No rollback line | "If it goes wrong" is required; Cloudflare Pages rollback is documented | Ready rule refuses a card without it |
| Q13 | Two people edit the same card at once | Last write wins | The dashboard writes with a version check (as PLAN 38.6 rule 3) | Stale version: 412, nothing written |
| Q14 | The AI goes beyond the task | Scope creep | `paths` and the paths check | A pull request with one extra file fails |
| Q15 | Cards pile up and nobody looks | No sweep | Weekly report; Waiting for the owner filter | The report lists a card older than 30 days |
| Q16 | A card states a lower risk than the files need | Optimistic label | Risk is computed from `paths`, the card may not be lower | Red path with `risk: green`: refused |
| Q17 | Decision unanswered blocks tasks silently | No owner or date | `needs: decision-N` and the Tasks screen shows the chain | A card needing an undecided decision shows blocked |
| Q18 | The handoff is missing and the next session repeats work | Notes only in chat | Log line required to move to `review` | `review` with no Log line today: refused |

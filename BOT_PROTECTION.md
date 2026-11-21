# BOT_PROTECTION.md: Only Real Readers, Good Bots Welcome

Plan for keeping fake traffic, scrapers, spam and attackers out, while real readers and the good crawlers (Google, Bing and others) always get in. Written in v0.70.4. Part 2 (the shared Worker guard) was built in v0.71.0 and Part 3a (the contact Worker uses it) in v0.72.0 and Part 3b (the push Worker uses it) in v0.73.0 and Part 3c (the analytics Worker uses it) in v0.74.0 and Part 3d (the Privacy page text) in v0.75.0 and Part 4a (the beacon flags) in v0.76.0 and Part 4b-1 (the datacenter flag and the verified counters in the Worker) in v0.77.0 and Part 4b-2 (one visit per 30 minutes and the 5-second rule) in v0.78.0 and Part 4b-3 (the dashboard lines) in v0.79.0 and Part 4b-4 (the red note per page, country and source) in v0.80.0 and Part 5a (the ad loader waits for one real event) in v0.81.0 and Part 5b (no ads for the datacenter list, in the geo Worker) in v0.82.0; the rest is plan and checklist.

## 0. Read This First: Honest Rules

1. **No tool gives 100 percent.** A determined bot that uses real phones, real browsers and real home internet lines cannot be told apart from a person at the door. The goal is many layers, so that fake traffic is expensive, small and visible.
2. **Never block the good bots.** Blocking Googlebot, Googlebot-News, Bingbot, the AdSense crawler or the social preview bots kills ranking, Google News, Discover, ads and link previews. Every rule in this file must say who is exempt.
3. **Challenge first, block second.** A real person on a VPN or a shared office line can look like a bot. Use a Managed Challenge (a person passes in one second) for doubtful traffic. Block only what is sure to be bad.
4. **Protect the doors that cost money or trust.** Forms, push subscribe, analytics beacon, chat, admin login and ads matter more than a static article page.
5. **Test after every rule** (Section 15). A rule that breaks Search Console is worse than no rule.
6. **No secret in the repo.** Keys and secrets live in Cloudflare (Worker secrets) only. The secret scan of the build already checks this.

## 1. The Layers (From the Edge to the Page)

| Layer | What it does | Cost | Stops |
|---|---|---|---|
| 1. Cloudflare front door | Proxy, TLS, Bot Fight Mode, known bad bots | Free | Most junk and simple scripts |
| 2. WAF custom rules | Challenge or block by path, agent, network | Free (a few rules) | Probes, scrapers, scripts |
| 3. Rate limiting | Slow down one address that asks too much | Free (limited) | Scrapers, floods |
| 4. Turnstile | Proves a person on every form | Free | Spam bots on forms |
| 5. Worker checks | Origin, size, schema, honeypot, timing, limits | Free | Direct calls to our endpoints |
| 6. Human signals in analytics | Counts only readers who act like people | Free | Fake numbers |
| 7. Ad safety | Ads load only for people, never for datacenter bots | Free | Invalid traffic, ad account ban |
| 8. Admin and secrets | Access control, roles, rotation | Free | Takeover |
| 9. Watching | Security Events, alerts, weekly review | Free | What got through |

## 2. Layer 1: The Cloudflare Front Door

Do these once, in this order. Menu names change; look for the same words in the dashboard.

1. **DNS: proxied (orange cloud)** for the site and every Worker hostname. A grey cloud bypasses all rules.
2. **SSL/TLS mode: Full (strict).** Turn on **Always Use HTTPS** and **Automatic HTTPS Rewrites**. Set **Minimum TLS version 1.2**.
3. **Security, Bots: turn on Bot Fight Mode.** It challenges known automated traffic and lets verified bots pass. On the free plan it cannot be skipped by a custom rule, so run the tests in Section 15 right after switching it on. If a good bot is hurt, switch it off and use Section 3 rules instead.
4. **AI crawlers:** if the dashboard shows a switch to block AI scrapers and crawlers, decide it on purpose. On blocks AI training bots; it may also reduce how often AI search tools show the site. Owner decision (Section 16, item 3).
5. **Security Level: Medium.** Not High: High challenges too many real people.
6. **Challenge Passage: 30 minutes.** A person who passed once is not asked again soon.
7. **Browser Integrity Check: on.** It stops requests with broken or missing headers.
8. **Scrape Shield: Hotlink Protection on** (stops other sites from showing our pictures from our server). Email Obfuscation on.
9. **Always Online: off** for a news site (old copies are wrong news).
10. **Turn on Security Events notifications** and Cloudflare account two-step login.

## 3. Layer 2: WAF Custom Rules

The free plan allows only a few custom rules (about five). The five below give the most protection. Write them in this order. `cf.client.bot` is true for the verified good bots, so every rule that must spare them says `not cf.client.bot`.

**Rule 1: Block probes for software this site does not have.** The site is static; nobody real asks for these.

```
(http.request.uri.path contains "/wp-login")
or (http.request.uri.path contains "/wp-admin")
or (http.request.uri.path contains "/xmlrpc.php")
or (http.request.uri.path contains "/phpmyadmin")
or (http.request.uri.path contains "/.env")
or (http.request.uri.path contains "/.git")
or (http.request.uri.path contains "/cgi-bin")
or (http.request.uri.path contains "/vendor/phpunit")
```
Action: Block. (If the owner ever moves from Blogger links that contain `wp-`, check the redirect list first.)

**Rule 2: Challenge scripts and empty agents on article pages.**

```
(not cf.client.bot)
and (http.request.uri.path ne "/robots.txt")
and (http.request.uri.path ne "/ads.txt")
and (not http.request.uri.path contains "sitemap")
and (not http.request.uri.path contains "feed")
and (http.user_agent eq ""
  or lower(http.user_agent) contains "python-requests"
  or lower(http.user_agent) contains "scrapy"
  or lower(http.user_agent) contains "curl/"
  or lower(http.user_agent) contains "wget"
  or lower(http.user_agent) contains "go-http-client"
  or lower(http.user_agent) contains "java/"
  or lower(http.user_agent) contains "libwww"
  or lower(http.user_agent) contains "aiohttp"
  or lower(http.user_agent) contains "httpclient"
  or lower(http.user_agent) contains "headlesschrome")
```
Action: Managed Challenge. The sitemap, feed, `robots.txt` and `ads.txt` stay open because crawlers and feed readers need them. The GitHub Actions of this project (IndexNow, title match, backup) call endpoints with a secret header, so Rule 5 handles them, not this rule. Test them (Section 15).

**Rule 3: Challenge datacenter networks that are not verified bots.** Real readers use home and phone lines. Scripts run in cloud servers.

```
(not cf.client.bot)
and (ip.geoip.asnum in {16509 14618 14061 16276 24940 63949 20473 396982 8075 45102 37963})
and (not http.request.uri.path contains "sitemap")
and (http.request.uri.path ne "/robots.txt")
and (http.request.uri.path ne "/ads.txt")
```
The numbers are large cloud hosts (Amazon, DigitalOcean, OVH, Hetzner, Linode, Vultr, Google Cloud, Microsoft, Alibaba). Action: Managed Challenge, never Block (some real people use a VPN on these hosts). Review the list every quarter.

**Rule 4: Guard the admin and the sign-in Worker.**

```
(http.request.uri.path starts_with "/admin") or (http.host eq "<auth worker hostname>")
```
Action: Managed Challenge. Better: put **Cloudflare Access** (free for up to 50 people) in front of `/admin/*`, allowed only for the owner emails. Access plus GitHub sign-in is two doors. Keep the roles check of the dashboard as well.

**Rule 5: Protect our own endpoints from direct calls.** The endpoints are the contact Worker, the push Worker, the analytics `POST /collect`, the geo Worker and the chat. Each of them must be called from a page of this site or by our own robots with a secret.

```
(http.host in {"<contact host>" "<push host>" "<analytics host>" "<chat host>"})
and (not http.request.method in {"POST" "OPTIONS"})
and (http.request.uri.path ne "/trending")
```
Action: Block. This stops browsing and probing of Worker hosts. The private `GET /stats` and the inbox endpoints already need a secret; this rule is a second wall. (Adjust the allowed methods to the real routes when this part is built.)

## 4. Layer 3: Rate Limiting

Two places: Cloudflare (before the Worker) and inside each Worker (after it). The Cloudflare free plan has very few rate rules, so spend them on the two risky groups.

| Where | Limit (proposed) | Action |
|---|---|---|
| Whole site, one address | 100 requests in 10 seconds | Managed Challenge, 10 minutes |
| Worker hosts (`POST`), one address | 20 requests in 10 seconds | Block, 10 minutes |
| Contact form, one address | 3 messages per hour, 10 per day | Refuse with a plain message |
| Push subscribe, one address | 5 per hour | Refuse |
| Chat messages, one address | 20 per minute, 200 per day | Slow down, then refuse |
| Analytics `/collect`, one address | 60 per minute | Drop silently |
| Admin sign-in | 10 per 10 minutes | Block, 30 minutes |

Inside a Worker the counter lives in D1 or in the Workers Rate Limiting binding. The key is the address plus the route. Answer with HTTP 429 and a `Retry-After` header. A refused request never writes to the database.

## 5. Layer 4: Turnstile on Every Form

Cloudflare Turnstile is free, has no picture puzzles for most people, and respects privacy.

**Where it goes:** the contact form, the push subscribe button, the chat start, the newsletter box, and the admin sign-in page. Not on article pages.

**How it works (3 steps):**
1. The page shows the Turnstile widget (mode Managed, theme auto). It gives the form a one-time `token`.
2. The form sends the token with the message to our Worker.
3. The Worker checks the token on the server before it does anything else.

```
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
  secret   = TURNSTILE_SECRET   (Worker secret, never in the page or the repo)
  response = token from the form
  remoteip = visitor address (optional)

Accept only when ALL are true:
  success === true
  hostname   is our own site host
  action     is the name this form uses (contact, subscribe, chat, login)
  token is used once (Turnstile refuses a second check of the same token)
```

**Rules:**
- The check is always on the server. A widget alone protects nothing.
- Tokens last about 5 minutes. An old or used token gives a plain message: "Please try again."
- If the Turnstile service cannot be reached, the Worker **refuses** (fail closed) for contact, chat and login; it may **allow** an already signed-in admin.
- Add `https://challenges.cloudflare.com` to the script and frame lines of the page security headers only on the pages that have a form, so article pages stay clean.
- The site key is public and goes in a config file; the secret key is a Worker secret.
- Consent: Turnstile sets no ad cookies. Say in the Privacy page that Cloudflare Turnstile checks that a visitor is a person.

## 6. Layer 5: Worker Checks (Every Endpoint)

Every Worker runs these checks in this order and stops at the first failure. No check writes data, and no message shows internal details.

1. **Method and route:** only the routes written in the code; everything else is 404.
2. **Origin and Referer:** for browser calls, `Origin` must equal the site address exactly (no `*` in CORS). Calls from our robots use the secret header instead.
3. **Content type and size:** JSON only; body at most 4 KB for forms and beacons (push subscribe may be larger, set its own cap). A larger body is refused before parsing.
4. **Schema check:** exact fields, exact types and lengths. Extra fields are refused. The text is cut, trimmed and stripped of control characters.
5. **Honeypot field:** a hidden form field (named like a normal one, hidden by CSS and `aria-hidden`, `tabindex=-1`). If it has any text, the Worker answers "ok" and silently drops the message. Never tell the bot it was caught.
6. **Fill-time check** (a speed bump for instant scripts; a patient bot can ask for a stamp and wait, so Turnstile stays the main wall): the page gets a signed time stamp from a small `GET` route of the Worker and sends it back with the form. The stamp is tied to one form. A form sent in under 3 seconds is dropped silently. A form older than 2 hours gets a plain "please reload the page" message, so a real person loses nothing.
7. **Turnstile check** (Section 5).
8. **Rate limit** (Section 4).
9. **Content check for the contact form and chat:** no more than 2 links, no known spam words list, no repeated message from one address, no message that is only links.
10. **Idempotency:** the same message twice in a minute is stored once.
11. **Log only counts** (no message text, no address in plain text; a salted hash if needed). This follows the privacy rules of the plan.
12. **Kill switch for every Worker:** like `PUSH_PAUSED`, each Worker has a variable that turns it off in one move during an attack. The page then shows a short "temporarily unavailable" message.

## 7. Layer 6: Analytics That Cannot Be Fooled Easily (BUGS N2)

Real numbers matter for decisions and for ad partners. The beacon and the `/collect` Worker add a **human score**.

**In the page (beacon):**
- Send the visit only after the page was visible for at least 5 seconds (no background tab hits).
- Add a flag `acted` when one real event happened: touch, pointer move after a click, scroll of at least 20 percent, or key press.
- Add `webdriver` when `navigator.webdriver` is true, and `headless` when the agent says Headless.
- Send nothing when the page is a preview or the dashboard.

**In the Worker:**
- Drop requests with a bot agent list (the existing filter in `lib.js`) and any request without a valid `Origin`.
- Drop requests from the datacenter network list of Rule 3 (`request.cf.asn`).
- Count one visit per reader per page per 30 minutes (a short-lived random id, not a fingerprint).
- Keep two counters: **verified human** (`acted` true, not a datacenter, not webdriver) and **unverified** (the rest). Raw events older than 7 days are deleted as before.

**In the dashboard:** the main numbers use verified human only. A small line shows the unverified share. A sudden rise of unverified traffic on one page, one country or one source (more than 3 times the normal level) shows a red note.

## 8. Layer 7: Ads and Invalid Traffic

Fake clicks and fake views on ads can end the AdSense account, and Adsterra may stop paying. This is the most expensive risk.

1. **Ads load only for people.** The ad loader waits for consent where it is needed. No ad loads until one real event (press, key, touch or scroll) has happened; the idle time no longer starts it (built in v0.81.0, Part 5a). Also none for the datacenter list: the geo Worker answers `ads: false`, reason `datacenter` (built in v0.82.0, Part 5b; the list is `workers/shared/datacenter.js`, one copy shared with the analytics Worker; the switch is `BLOCK_DATACENTERS`, on by default). Every ad box is created only by the loader (PLAN 29.1).
2. **Never click or load your own ads.** Use a different browser profile without ads, or the AdSense preview. Add your own network to a "no ads" list in the dashboard when that part is built.
3. **No bought traffic, no traffic exchanges, no "click here" words,** no push to articles from sites that pay for visits.
4. **Watch the AdSense Policy center and the Adsterra statistics** every week. A very high click rate (CTR) on one page, many clicks from one country with no time on page, or a sudden jump in earnings are signs of bot clicks. Remove ads from that page first, then investigate.
5. **Keep the "India off" geo rule and the fail-safe** as designed; an unknown country means no ads.
6. **Popunder and smartlink formats** attract the most low quality traffic. Keep them on selected pages only (BETTER 3).
7. **`ads.txt` stays exact** (only lines the owner has contracts for), so no one can sell fake inventory in the site name.

## 9. Scraping and Copying of the News

News sites are copied all the time. Aim to make the copy slow and to prove the original.

- **Rate limit by path** (Section 4) so a script cannot read the whole archive in minutes.
- **RSS feed:** keep the summary version public. A full-text feed is easy to steal; give it only if the owner wants it.
- **Picture hotlinks:** Hotlink Protection on (Section 2) and a rule for `/media/*` that challenges a request with a `Referer` from another host, except search engines and the social bots.
- **Trap link:** a hidden link to `/trap/` (listed in `robots.txt` as Disallow; no real reader and no good bot follows it). Any client that opens it is a scraper. A small Worker records the address and adds it to a Cloudflare IP list that a WAF rule blocks for 24 hours. Optional, advanced.
- **Proof of the original:** correct `datePublished` and `dateModified`, a self canonical, IndexNow at publish, and the news sitemap give Google the first seen date. If a copy ranks above the original, use the Google copyright removal form and send the proof.
- **Never** hide text with scripts, disable right click or block selection. It hurts real readers and search engines and does not stop a scraper.

## 10. Real Browser Tests and Fingerprint Limits

Do not collect canvas, audio or font fingerprints to catch bots. It is against the privacy rules of this plan (consent countries) and it can be fooled. Use only these signals: Turnstile, the verified bot flag, the network type, the request headers, rate, and the `acted` flag.

## 11. Admin, Sign-in and Secrets

- Cloudflare Access in front of `/admin/*` (Rule 4), two-step login on GitHub for every owner and editor account.
- The sign-in Worker allows only the listed GitHub users and checks the `state` value and the redirect address exactly.
- Sessions expire; a cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
- GitHub token for AI helpers: only the repository and only the scopes needed; pull request flow with a green check (open decision 18).
- Secrets: `TURNSTILE_SECRET`, push secrets, contact inbox secret, analytics stats secret. Rotate each every 6 months and at once after any leak. Never print a secret in a log or an answer.
- The repository question (open decision 17): a public repo shows drafts and scheduled posts to scrapers. Keep drafts in a private repository (BETTER N1) or keep the repo private.

## 12. Security Headers (Add to `public/_headers`)

Today only some paths have headers. Add these for all pages, in small steps, with the report-only mode first for the content policy.

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy-Report-Only: <written when this part is built>
```
Because ads and AdSense need many hosts, the content policy for article pages is written last and tested with ads on and off. The admin keeps its own stricter headers.

## 13. Watching and Alerts (Layer 9)

**Every day (2 minutes):** Cloudflare Security Events: top paths, top countries, top agents blocked or challenged. Look for a rule that fires on real readers (many challenges from India phone networks, for example).

**Every week (10 minutes):**
- Analytics: verified human against unverified.
- AdSense and Adsterra: click rate and earnings by page.
- Search Console: crawl errors, "blocked by robots", and the crawl stats.
- Contact inbox: spam share.

**Alerts to switch on:** Cloudflare notifications for a traffic spike (DDoS and rate), a Worker error spike, and a rise in challenges. Send them to email and Telegram (open item: monitoring contact).

## 14. If an Attack Happens (Playbook)

1. **Look first:** Security Events. Which path, which agent, which network?
2. **Small step:** add a Managed Challenge rule for that exact path or agent. Wait 5 minutes.
3. **Bigger step:** raise Security Level to High for the site, and tighten the rate rule.
4. **Last step:** turn on **Under Attack Mode** (every visitor sees a short check). Tell the editors; turn it off when it is calm, because it also slows real readers and can hurt crawling.
5. **Forms:** turn on the Worker kill switch of the form that is flooded.
6. **Ads:** if the attack is fake clicks, switch the ad loader off in the dashboard (compliance mode on) before anything else.
7. **After:** write what happened and what rule fixed it in the changelog notes; remove temporary rules.

## 15. Safe Rollout and the Tests

Do one part at a time. After each part run the whole list. All must pass.

| Test | How | Must be |
|---|---|---|
| Real Googlebot | Search Console, URL Inspection, Live Test | Fetch is OK |
| Google News and Discover | Publisher Center fetch; Rich Results Test | OK |
| AdSense crawler | AdSense site check; ads.txt status | Found |
| Fake Googlebot | `curl -A "Googlebot" https://site/` from your own computer | Challenged or blocked |
| Plain script | `curl https://site/` and a Python request | Challenged |
| Sitemaps, feed, robots, ads.txt | Open in a browser and with `curl` | Open (200) |
| Link preview bots | Facebook Sharing Debugger, Telegram and WhatsApp preview, X card check | Preview shows |
| Normal phone | A real phone on mobile data (India) and on Wi-Fi | Page opens, no challenge or one quick check |
| VPN user | A browser on a common VPN | One quick challenge at most |
| Our robots | IndexNow, backup, title-match Actions run | Green |
| Forms | Contact, subscribe, chat with Turnstile on a phone | Works; a bot call without a token is refused |
| Admin | Sign in with GitHub; a signed-out user | Works; a stranger is stopped |
| Lighthouse | Lighthouse CI (90 plus) | Not lower than before |

## 16. Decisions Needed From the Owner

| # | Item | Options |
|---|---|---|
| 1 | Cloudflare plan | Free (proposed) with the rules above; or Pro for Super Bot Fight Mode and more rules, when money comes |
| 2 | Cloudflare Access for `/admin` | On (proposed, free up to 50 people) or the dashboard login only |
| 3 | Block AI scrapers and crawlers | On (less copying) or off (more AI search reach) |
| 4 | Datacenter networks | Challenge (proposed) or only watch |
| 5 | RSS | Summary only (proposed) or full text |
| 6 | Trap link and automatic block list | Yes (advanced) or later |
| 7 | Alert contact | Email, Telegram, or both |

## 17. Build Plan (Small Parts, Nothing Built Yet)

Each part has its own tests and is added to `BUGS.md` as a group (proposed group W).

- [ ] Part 1: the Cloudflare front door settings (Section 2) and Rules 1 to 5 (Section 3), done by the owner with a click list, and the test table (Section 15).
- [x] Part 2 (v0.71.0): `workers/shared/guard.js`: the common Worker checks (kill switch, method, origin, content type, size, exact fields, honeypot, signed fill-time stamp, hashed rate and duplicate keys, link check), 38 unit tests. No Worker uses it yet; the `GET` stamp route and the rate counter come with each Worker part.
- [ ] Part 3: Turnstile and the guard on every form, one Worker at a time.
  - [x] 3a (v0.72.0): the contact Worker uses the shared guard (kill switch `CONTACT_OFF`, JSON only, exact fields, trap, signed stamp from `GET /stamp`, secret `STAMP_SECRET`); the contact page script fetches and sends the stamp. Turnstile was already there. 8 new Worker tests and 8 new page tests.
  - [x] 3b (v0.73.0): the same for push subscribe (`workers/push`): the four browser routes use the guard (JSON only, exact fields, trap), `POST /subscribe` needs a stamp from `GET /stamp` (secret `STAMP_SECRET`, no minimum age because the page asks right before the call), kill switch `PUSH_SUBSCRIBE_OFF` for new subscriptions only (`/unsubscribe`, `/preferences` and `/test` are never switched off). The page script asks for the stamp and repeats once on `reload`. Turnstile is not used for push (no form to show it in; a permission box comes first). 10 new Worker tests, 8 new page tests and 5 new guard tests.
  - [x] 3c (v0.74.0): the analytics `/collect`: kill switch `COLLECT_OFF`, exact fields, signed stamp from `GET /stamp` (secret `STAMP_SECRET`, no minimum age, 12 hours), body stays `text/plain` JSON for `sendBeacon`; the beacon script asks for the stamp when the page opens. 11 new Worker tests, 7 new page tests and 4 new guard tests. **The chat part is not done: there is no chat Worker yet; it gets the same guard when it is built.**
  - [x] 3d (v0.75.0): the Privacy Policy gets the section "Checks that you are a person" from `npm run pages`, only for the features that are really switched on (contact form with Turnstile, analytics beacon, push sign-up). A page that already exists is never changed (its date is part of its address): for a Privacy page made earlier, the owner adds the section by hand in the dashboard (text in `scripts/required-pages-lib.mjs`, function `personCheckSection`). 11 new tests.
- [ ] Part 4: the human score in the beacon and in `/collect` (verified human and unverified counters), and the two lines in the Analytics screen. Split in two:
  - [x] 4a (v0.76.0): the beacon sends `acted` and `webdriver`; the Worker accepts them as optional numbers and stores them per page view (they only go up); `migrate-0.76.0.sql` for an older database. Nothing counts them yet. Left out on purpose: the `headless` flag (the Worker already drops every agent that says Headless, so a flag would never arrive), and the "send only after 5 visible seconds" rule (it changes when the first message goes out; it goes to 4b with its own tests).
  - [ ] 4b, split in three:
    - [x] 4b-1 (v0.77.0): the datacenter list (`request.cf.asn`, Rule 3) and the `dc` column (a datacenter visit is kept and counts as unverified, not dropped), the two counters (verified human = `acted` 1, `webdriver` 0, `dc` 0; unverified = the rest) in the hourly and daily totals and in `GET /stats` (`verifiedViews`, `unverifiedViews`); `migrate-0.77.0.sql`. `views` is unchanged.
    - [x] 4b-2 (v0.78.0): the rule "one visit per reader per page per 30 minutes" (the reader is the random session id of the tab; one insert statement skips a repeat of the same address inside 30 minutes) and the 5-second rule (the page sends its first message after 5 counted reader seconds, and nothing at all for a shorter visit). Limit: a new tab or a cleared session is a new reader, so a repeat from another tab is counted again.
    - [x] 4b-3 (v0.79.0): the Analytics screen: the main page views are the verified human ones (with the all-views total beside them), a card shows the unverified count and share, and a red note (role alert) shows when the newest chart step has at least 3 times the normal level of unverified views (normal = median of the earlier steps, at least 1; needs 6 steps and 10 views). The Worker adds `unverifiedTimeline` to `GET /stats`. 
    - [x] 4b-4 (v0.80.0): the same 3 times rule for one page, one country or one source. Normal for an item is its own unverified count in the period just before (same length). The Worker adds `itemUnverified` to `GET /stats` for 5 min, 1 hour and 24 hours (the earlier period must still be raw events, kept 7 days); 7 days and lifetime give null and no item note. The rule (3 times, at least 10 views, normal at least 1) is in the dashboard only, so there is one copy. A red note lists the items. Left for later: a verified chart, and an item note for 7 days and lifetime (it needs the daily totals per item).
- [ ] Part 5: the ad loader, split in three:
  - [x] 5a (v0.81.0): no ad loads until one real event (press, key, touch or scroll); the idle timer is removed; an event made up by a script (`isTrusted` false) is ignored. A bot that never acts makes no request to the geo Worker and loads no ad script. Honest limit: the browser's scroll restore counts as a scroll.
  - [x] 5b (v0.82.0): no ads for the datacenter list. The geo Worker reads `request.cf.asn` and answers `ads: false`, `consent: false`, reason `datacenter`; the list moved to `workers/shared/datacenter.js` and the analytics Worker re-exports it, so there is one copy. The switch `BLOCK_DATACENTERS` in `workers/geo/wrangler.toml` is ON unless it is exactly false, 0, no or off. The network number is never sent back. 20 new tests. Honest limits: a short list; a real person on a company VPN in a cloud network sees no ads; Cloudflare WARP and Apple Private Relay readers are not on the list; the geo Worker keeps no count of how many it refused (the analytics `dc` counter shows datacenter visits).
  - [x] 5c (v0.84.0): the "my own browser" switch. Open any public address once with `?own-browser=on` (off: `?own-browser=off`); that browser keeps the mark `ownBrowser` in its localStorage, the ad loader loads nothing and the beacon counts no visit there. File `site/src/lib/own-browser.js`, 13 tests. Honest limit: the mark is per browser and is lost when the browser data is cleared or a private window is closed.
- [ ] Part 6: security headers for all pages (report-only first, then enforce) and the admin headers. Split in two:
  - [x] 6a (v0.85.0): `X-Content-Type-Options`, `Permissions-Policy` and `Strict-Transport-Security` for all paths in `public/_headers`; `Referrer-Policy: strict-origin-when-cross-origin` as a meta tag in every public page (the dashboard keeps `no-referrer`); no header is sent twice. 8 tests. Honest limit: HSTS with `includeSubDomains` is hard to undo; the live headers must be checked once after the deploy.
  - [ ] 6b, split in six:
    - [x] 6b-1 (v0.86.0): `Content-Security-Policy-Report-Only` for all paths (self only, `unsafe-inline` for the inline scripts, no ad host, no Turnstile host), the dashboard taken out with a `!` line; 2 more tests (10 in all). Reports only in the browser console.
    - [x] 6b-2a (v0.87.0): the Contact Us page (the only page with the form) has its own report-only policy: the all-paths one plus `https://challenges.cloudflare.com` for script and frame, only there. Path with placeholders (`/:year/:month/:day/pages/contact-us/`) and a `!` line; 6 more tests (16 in all).
    - [x] 6b-2b (v0.87.1): the dashboard has its own report-only policy from what it really loads: scripts from itself only (no inline), `blob:` pictures for the previews, no other change; the old Blogger XML tool (inline script) gets the all-paths policy back. 7 more tests (23 in all).
    - [x] 6b-3a (v0.88.0): article pages have their own report-only policy: the all-paths one plus the ad script hosts (from `config/ad-loader.json` and the AdSense script) and two AdSense frame hosts; a test fails when the config names a script host that is not in the block. 9 more tests (32 in all).
    - [ ] 6b-3b: switch ads on (Part 1 and the owner's decision), open an article, read the console report, add the hosts it names, one small change at a time.
    - [ ] 6b-3c: change report-only to enforcing, one page type at a time (contact page first, then the dashboard, then the other pages, article pages last).
- [ ] Part 7: trap link, IP list Worker and the hotlink rule for `/media/*` (optional; decision 6 of Section 16 is still open). Split in four:
  - [x] 7a (v0.89.0): the rules as plain functions in `workers/trap/lib.js` (what is a trap request, which hits are blocked, ignored or only recorded, the list item with its end time, the clean-up that touches only our own items, the text of the two Cloudflare calls), 18 tests. Nothing is connected: no Worker, no route, no link, no secret.
  - [x] 7b (v0.90.0): the Worker `workers/trap/index.js` and `wrangler.toml`: the `/trap/` route, the Cloudflare list calls with the secret `CF_API_TOKEN`, an hourly clean-up of our own expired items, and the kill switch `TRAP_ENABLED` (OFF by default). 24 tests with a fake Cloudflare. NOT connected and not deployed. Before it can work the owner still needs decision 6, an API token with only the Account Filter Lists Edit permission, the IP list, the WAF rule that blocks it (Section 3 click list), the ids in `wrangler.toml` and the route.
  - [ ] 7c: the hidden link and the `Disallow: /trap/` line in `robots.txt`. Risk, said plainly: Google's rules treat a link that readers cannot see as a bad practice, and a news site that wants Google News should not risk it. Safer first step: only the `Disallow` line and a real, visible but unattractive link in the footer, or no link at all and only watch who opens `/trap/`. Decide before building.
  - [ ] 7d: the hotlink rule for `/media/*` (Section 9): a click list for the owner in Cloudflare (no code), written into Section 3 as Rule 6.
- [ ] Part 8: the Security screen in the dashboard (last 24 hours: challenges, blocks, unverified share, kill switches), and the weekly review checklist. Split in two:
  - [x] 8a (v0.91.0): the rules as plain functions in `site/public/admin/js/security.js` (a level from the verified against unverified views: few under 50 views, watch from 30 percent, high from 60 percent; the daily and weekly lists of Section 13; when a list is due), 10 tests. Not connected to the dashboard.
  - [x] 8b-1 (v0.92.0): `renderSecurity` (the drawing, with the dashboard helper `h`) and the "last done" times (`readLastDone`, `markDone`, `writeLastDone`, `reviewLists`) in `security.js`; 11 more tests (21 in all). Not connected: no route, no menu entry. Decided: the "last done" times are kept in the browser only (`localStorage`), one key.
  - [x] 8b-2 (v0.93.0): the wiring in `app.js`: `#/security` (admin only, the `analytics` permission), the menu entry "Security", the two analytics calls (24h and 7d, same address and token as Analytics, no timer), `renderSecurity`, and Mark done saved to `localStorage` in a try/catch. 8 jsdom tests in `admin-security.test.ts`, WRITTEN BUT NOT RUN yet (no browser tool in the session that wrote them): the owner runs `npm test` and opens the screen once.
- Done when: every row of the Section 15 table passes, a script cannot send a message to any Worker without a token, and the unverified share of analytics is visible and small.

## 18. What This Cannot Stop (Say It Plainly)

- Bots that run real browsers on real home or phone lines (residential proxies) and click like people.
- People paid to visit or to solve Turnstile and CAPTCHA by hand.
- A very large attack on the network (Cloudflare absorbs most, but not all).
- A reader who copies a story by hand.

For these, the answer is watching (Section 13), clean ad practice (Section 8), and strong original content. Do not promise "zero bots" to anyone; promise "real readers first".

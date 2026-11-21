# Shivam Das News: Phases 1 to 4 part 13 and Phase 5 part 12 (Site, SEO Engine, Dashboard, Redirects, Links, Import, save, images and XML export, link list, category rename, ads.txt, Ads screen, geo Worker, ad loader, Ad loader screen, native banner, smartlink, AdSense unit, required pages, HTML sitemap)  v0.89.0

Astro + TypeScript static site. Plain CSS tokens from the approved theme (`/theme/theme-preview.html`), fonts self-hosted through `@fontsource`.

## Run
```
npm install
npm run dev        # local site
npm test           # unit tests
npm run build      # build + Pagefind index + HTML validation
```
Set `SITE_URL` (for example in Cloudflare Pages) once the real domain is decided.

## Add content
Posts: `content/blogs/<category>/<slug>.md`. Pages: `content/pages/<slug>.md`. Authors: `content/authors/<slug>.json`.
Front matter fields are defined in `src/content.config.ts`. A post must have `status: published`, `image` and `imageAlt` to go live.
No demo content is shipped; the site shows real empty states until you add a post.

## Done in Phase 1
- Content schema (Zod) for posts, pages, authors; pre-publish gate for image and alt text
- URL builder `/YYYY/MM/DD/blogs/{category}/{permalink}/` using one site time zone; site-wide unique permalinks
- Layouts: home, article, category, tag, author, page, search, 404
- Pagination `/category/x/page/2/`; category pages list lifetime posts
- Active categories (7 days) in the menu; "Latest" fallback; hidden categories stay reachable
- Pagefind search; thin tag pages set to noindex
- Responsive (mobile, tablet, desktop), light/dark, 4 colour styles
- Build gate: one H1 per page, no placeholder text, no ad code outside articles

## Done in Phase 2 (v0.2.0)
- JSON-LD on every page type, full head tags, canonical, Open Graph and Twitter cards
- Sitemap index, posts, pages, categories, tags, authors, images and news sitemap (48 h)
- `robots.txt`, RSS (`/feed.xml`, `/feed/{category}.xml`), `site.webmanifest`
- `npm run icons` (all icon sizes from your real logo), IndexNow script and workflow, hourly rebuild workflow
- Heading linter and pre-publish warnings; stronger build validator

## Done in v0.2.2 (fixes)
- Missing local image stops the build; future-dated published posts are scheduled (go live at the next hourly rebuild); public-friendly empty states; no empty author pages; sitemap index never empty; accent colours pass 4.5:1; time zone `Asia/Kolkata`; missing `SITE_URL` fails the build on Cloudflare Pages and GitHub Actions.

## Done in v0.2.3 (fixes)
- Featured image under 1200 px wide gives a build warning (`[gate]`).
- IndexNow pings the pages of content files changed in git, and posts that a scheduled date just made live. Test without sending: `node scripts/indexnow.mjs --git <commit> 1 --dry` (needs `SITE_URL` and `INDEXNOW_KEY` set).

## Required pages (v0.46.0)
Twelve trust pages are made from your real details: About Us, Contact Us, Editorial Policy, Corrections Policy, Ownership and Funding, Privacy Policy, Terms and Conditions, Cookie Policy, Disclaimer, DMCA and Copyright Notices, Advertise With Us and Affiliate Disclosure.
1. Fill all seven fields in `config/publisher.json` (publisher name, owner name, email, postal address, country, founded year, one sentence on how the site is funded). Empty fields stop the script and it tells you which ones.
2. `npm run pages` writes the pages as **drafts** into `content/pages/`. Add `-- --dry` to see the plan first, or `-- --publish` to write them as published at once.
3. Read each page. Change what is not true for you (the cookie page lists what the site stores today; update it if you add a feature that stores more). Set `status: published` when it is right.
A page that already exists is never changed. The page date (part of its address) is the day you run the script. Run it again later and only the missing pages are written.

## Contact Worker (v0.47.0, Phase 7 part 5)
`workers/contact/` is the back end of the contact form: `POST /contact` takes one message and stores it in the D1 table `contact_messages`. The form on the Contact page is the next part, so no visitor can send a message yet. Spam protection (BUGS N6): only the site in `SITE_ORIGIN` may send; a Cloudflare Turnstile check; a hidden field that people never see; a size limit; at most 2 links per message; at most 3 messages per email address and 40 in total per hour; an optional per-visitor limiter. No IP address is stored. Without the secret or the database the endpoint answers 503 and stores nothing.
Set up once: `cd workers/contact`; `npx wrangler d1 create news-contact`; copy the printed `database_id` into `wrangler.toml`; set `SITE_ORIGIN`; `npx wrangler d1 execute news-contact --remote --file=schema.sql`; make a Turnstile widget in the Cloudflare dashboard for your domain; `npx wrangler secret put TURNSTILE_SECRET`; `npx wrangler deploy`.

## Contact Worker: shared guard and fill-time stamp (v0.72.0, bot protection Part 3a)
The contact Worker now runs the shared checks of `workers/shared/guard.js` before anything else: a kill switch (`CONTACT_OFF`), JSON only, exact fields, the hidden trap field and a signed fill-time stamp. The page asks `GET /stamp` of the Worker when it opens and sends the stamp back with the message. A form sent in under 3 seconds is dropped (the answer looks like a success); a stamp older than 2 hours or a wrong one gets a plain "please reload the page" message. The message is sent as `application/json` (the browser asks the Worker first, which the Worker answers). Set the new secret once: `cd workers/contact ; npx wrangler secret put STAMP_SECRET` (a long random text), then `npx wrangler deploy`. Without `STAMP_SECRET` the form and `GET /stamp` answer 503. A stamp keeps bots out that send at once; the Turnstile check stays the main wall.

## Analytics: the "acted" and "webdriver" flags (v0.76.0, bot protection Part 4a)
The beacon message has two more numbers. `acted` becomes 1 after a real press, key or touch, or after a scroll of at least 20 percent of the way down (a script cannot fake it with a made-up event: those have `isTrusted` false). `webdriver` is 1 when the browser says a program drives it. The Worker stores both on the page view row and they only go up. Nothing counts them yet (Part 4b). **If your analytics database was made before v0.76.0, run `workers/analytics/migrate-0.76.0.sql` once** (`npx wrangler d1 execute <database-name> --remote --file=workers/analytics/migrate-0.76.0.sql`). A new database made from `schema.sql` already has the columns: do not run the migration on it. An older page script that sends no flags still works (stored as 0).

## Site verification codes (v0.83.1)

Search engines give you a code to prove the site is yours. Put it in `config/site.json`, under `verification`:

```
"verification": { "google": ["code-one", "code-two"], "bing": "", "yandex": "" }
```

Each value can be one code, several codes in one text separated by commas, or a list. If you paste a whole `<meta ...>` tag, the code inside it is taken. Every public page then carries one `<meta>` tag for each code; the dashboard pages carry none. A code with odd characters is ignored. Keep the tags after verifying, because Google checks again from time to time. The dashboard Settings screen can also edit these boxes (several codes separated by commas).

## Push: clean-up of old rows (v0.83.0, Phase 9 part 7c)

The push Worker now removes old data by itself, as PLAN 31.3 promises. The cron that sends (every minute, `workers/push/wrangler.toml`) also runs `workers/push/cleanup.js` once an hour, at minute 7 (UTC).

What it deletes:
- a reader with no delivery and no visit for 90 days, and a reader marked `gone` at once, with every row of theirs (search words, queue, held stories, delivery rows) in one batch;
- delivery rows (`push_sent`) and audit rows (`push_audit`) older than 30 days;
- post summaries (`push_posts`) older than 3 days;
- held stories that have expired;
- finished queue rows (sent, failed, expired) older than 1 day. A message that is still `queued` or `sending` is never touched.

What you do: nothing new to set. Deploy the push Worker again (`cd workers/push` then `npx wrangler deploy`). There is no new variable, secret or migration. It needs only the D1 database, so it also runs while sending is paused with `PUSH_PAUSED`.

Limits: 50 readers and 2000 rows of each other table per hour; if a run fails the next hour tries again. It has not run on a real Cloudflare D1 yet.

## Ads: no ads for datacenter networks (v0.82.0, bot protection Part 5b)
The geo Worker now also looks at the network of the visitor (`request.cf.asn`). A network on the datacenter list (Amazon, Google Cloud, Azure, DigitalOcean, OVH, Hetzner, Linode, Vultr, Alibaba, Tencent, Oracle, Contabo) gets `{ "ads": false, "consent": false, "reason": "datacenter" }`, so the ad loader loads nothing. Real readers use home and phone lines; scripts run in cloud servers.
- **One list for two Workers:** `workers/shared/datacenter.js`. The analytics Worker re-exports it (it still counts such a visit as unverified, v0.77.0). To add a company, add its network number there once.
- **Switch:** `BLOCK_DATACENTERS` in `workers/geo/wrangler.toml`, "true" by default. Only false, 0, no or off turn it off (use that only to test from your own cloud server). Any other text keeps it ON.
- The network number is never sent back, only the word `datacenter`. The answer is still never cached.
- Deploy again: `cd workers/geo` and `npx wrangler deploy`. No secrets, no migration.
- Honest limits: a short list; a real person on a company VPN in a cloud network sees no ads; WARP and Private Relay readers are not on the list; no count of refusals is kept.

## Ads: one real event first (v0.81.0, bot protection Part 5a)
The ad loader no longer starts on a timer. It waits for one real event of the reader (a press, a key, a touch or a scroll) and ignores an event made up by a script (`isTrusted` false). A page opened by a bot that never acts loads no ad script and makes no request to the geo Worker. Everything else is as before: article pages only, the geo and consent answers, the limits for popunder and smartlink. The setting `idleMs` is still in the settings plan, but nothing reads it any more. Honest limit: the browser's own scroll restore after a reload is a real scroll event and counts; a script that drives a real browser and really scrolls is not stopped here (that is what the verified counters and the datacenter rule are for).

## Analytics screen: the red note per page, country and source (v0.80.0, bot protection Part 4b-4)
Besides the whole-site note, the Analytics screen now lists the pages, countries and sources whose unverified views jumped. An item is listed when it has at least 10 unverified views now and at least 3 times its own count in the period just before (same length; an item that was not there before counts as 1). The Worker's `GET /stats` has one new part, `itemUnverified`. It is there for the 5 minute, 1 hour and 24 hour views only, because the period before must still be saved as raw events (kept 7 days); the 7 day and lifetime views show no item note. No database change and no migration.

## Analytics screen: verified views, unverified share and the red note (v0.79.0, bot protection Part 4b-3)
The Analytics screen now counts a page view as a real reader only when it is verified human (a real action, no webdriver, not a datacenter network). The first card is **Page views (verified human)** with the all-views total beside it, the next card is **Unverified views** with its share in percent. When the newest chart step has at least 3 times the normal level of unverified views (normal is the middle value of the earlier steps, at least 1; at least 6 steps and at least 10 views are needed), a red note appears at the top. The Worker's `GET /stats` has one new list, `unverifiedTimeline`. No database change and no migration. Honest limits: days saved before v0.77.0 count as unverified in the Lifetime view, the 5 minute range has too few steps for the note, and the chart, visitors and average read time still use all views.

## Analytics: one visit per 30 minutes and the 5-second rule (v0.78.0, bot protection Part 4b-2)
The page script now sends its first message only after the reader has been on the page for 5 counted seconds (a visible tab and a reader who did something); a visit that is shorter sends nothing, also when the page is left. The Worker counts one visit per reader per page per 30 minutes: if the same browser tab session opens the same address again inside 30 minutes (a reload, a quick return), the second page view is not stored. No database change, no migration. Limits: the reader is the random id of the tab session, so a new tab or a cleared session counts again, and a visit under 5 seconds is not counted at all (this is on purpose; real bounces are lost from the numbers too).

## Analytics: datacenter flag and verified counters (v0.77.0, bot protection Part 4b-1)
The Worker now reads the network number of the visit from the edge (`request.cf.asn`). A visit from a big cloud or hosting network (AWS, Google Cloud, Azure, DigitalOcean, OVH, Hetzner and a few more, list in `workers/analytics/lib.js`) is stored with `dc` = 1. It is kept, not dropped. A page view is "verified human" when `acted` is 1, `webdriver` is 0 and `dc` is 0; the rest are "unverified". The hourly and daily totals have a new column `verified_views`, and `GET /stats` gives `verifiedViews` and `unverifiedViews` next to `views` (which is unchanged: the dashboard lines come in Part 4b-3). **If your analytics database was made before v0.77.0, run `workers/analytics/migrate-0.77.0.sql` once** (after `migrate-0.76.0.sql` if that was not run either): `npx wrangler d1 execute <database-name> --remote --file=workers/analytics/migrate-0.77.0.sql`. A new database made from `schema.sql` already has the columns: do not run it there. Days counted before this version show as unverified in the lifetime number. Honest limit: the list is short, and a real person on a company VPN in a cloud network is counted as unverified.

## Privacy page: Turnstile and stamp text (v0.75.0, bot protection Part 3d)
`npm run pages` now reads `config/contact.json`, `config/analytics.json` and `config/push.json`. When the contact form (endpoint and Turnstile site key), the analytics beacon or push is switched on, the Privacy Policy gets the section "Checks that you are a person": it names Cloudflare Turnstile (contact form only) and says that the signed time stamp holds only a time and a signature and is not stored. With all three off, the page is the same as before. Run `npm run pages` after you fill those files and before you publish the pages. A page that already exists is never changed, so for an older Privacy page add the section by hand (the text is in `scripts/required-pages-lib.mjs`).

## Analytics Worker: shared guard and stamp (v0.74.0, bot protection Part 3c)
`POST /collect` now runs the shared checks of `workers/shared/guard.js`: a kill switch (`COLLECT_OFF`), exact fields (an extra field or a number sent as text is refused with 400) and a signed stamp. The beacon script asks `GET /stamp` once when the article page opens (the same address as `/collect` with `/stamp` at the end) and sends the stamp with every message; until the stamp has arrived nothing is sent, then the newest numbers go out. The body stays `text/plain` JSON on purpose (`sendBeacon` on page close needs a simple request), so the guard is told to accept it. The stamp has no minimum age and lives 12 hours; a message without a good stamp is not counted. The page sends a referrer cut to 300 characters (the Worker keeps only its host). Set the secret once: `cd workers/analytics ; npx wrangler secret put STAMP_SECRET` (a long random text), then `npx wrangler deploy`. Without it `/collect` and `GET /stamp` answer 503 and nothing is counted. A stamp only stops scripts that never ask for one (BUGS W13). The beacon is still off on live pages (`config/analytics.json` is empty). Every counted page view now costs one more small Worker call (`GET /stamp`); check the free plan limits (100,000 calls a day) against your traffic before you switch it on. There is no chat Worker yet, so the chat part of Part 3c comes with the chat.

## Push Worker: shared guard and subscribe stamp (v0.73.0, bot protection Part 3b)
The push Worker now runs the shared checks of `workers/shared/guard.js` on its four browser routes (`/subscribe`, `/preferences`, `/unsubscribe`, `/test`): JSON only, exact fields (an extra field is refused with 400) and the hidden trap field. `POST /subscribe` also needs a signed stamp from `GET /stamp`. The page script asks for a new stamp right before every subscribe call (also the quiet fix of a lost token) and repeats the call once if the Worker says `reload`. The stamp of the push Worker has no minimum age (the stamp is asked for right before the call) and lives 2 hours. A stamp only stops scripts that never ask for one (BUGS W13); the origin check, the limit of new subscribers per hour and the token rules stay the other walls. Set the secret once: `cd workers/push ; npx wrangler secret put STAMP_SECRET` (a long random text), then `npx wrangler deploy`. Without it `/subscribe` and `GET /stamp` answer 503. The kill switch `PUSH_SUBSCRIBE_OFF` in `wrangler.toml` stops new subscriptions and the stamp route only; a reader can always read, change and remove their own data. Notifications are still off on live pages (`config/push.json` is empty).

## Contact inbox endpoints (v0.49.0, Phase 7 part 7)
The contact Worker also has two private endpoints for the dashboard inbox: `GET /messages` (the newest messages first, with counts of new, read and done) and `POST /messages/status` (mark one message new, read or done). They answer only a GitHub user listed in `ALLOWED_USERS` in `workers/contact/wrangler.toml` (your GitHub login; several logins separated by commas). With the list empty every call answers 503. After setting it run `cd workers/contact ; npx wrangler deploy`. The inbox screen in the dashboard is the next part; until then read the table in the D1 console. Messages cannot be deleted through these endpoints.

## Contact form (v0.48.0, Phase 7 part 6)
The Contact page shows a form (name, email, subject, message, Turnstile check) when `config/contact.json` is filled. With the shipped file (both values empty) **no form is added and no page changes**. To switch it on: deploy `workers/contact/` first (see "Contact Worker"), then set `endpoint` (the Worker address ending in `/contact`) and `turnstileSiteKey` (the public **Site Key** of the Turnstile widget, never the secret) in `config/contact.json`. A half-filled or wrong value stops the build with a plain message. The form appears on the Contact page only; it loads the Turnstile script from Cloudflare there and nowhere else. Without JavaScript the form stays hidden and the page text (the email address) is what the reader sees. The form uses no cookie and keeps nothing in the browser. When you switch it on, edit the Contact Us, Privacy Policy and Cookie Policy pages by hand: they were written for a site with no form.

## HTML sitemap (v0.45.0)
`/sitemap/` lists the pages, the active sections, the authors, the topics with enough posts and the newest 500 stories by month. It is built at every build from your real content, needs no setup, and is linked from the footer. It is `noindex,follow` and has no ads. An empty site shows "Nothing to list yet".

## Branch protection and auto-merge (v0.101.16, Phase 3d Part 4)
Both are optional. The dashboard saves straight to `main`, so read the warning before you protect `main`.

**Auto-merge (off by default).** The workflow `.github/workflows/automerge.yml` merges a pull request by itself only when all of this is true: the Validate run is green; the branch is named `ai/T-0000` or `human/T-0000` and comes from this repository; every changed file is content only (posts, pages, authors, plain pictures, redirects, category names, the card's own file); nothing is deleted or renamed; at most 50 files; no label `no-automerge` or `needs-review`; the pull request did not change after the check. It never runs code from the pull request. To switch it on:
1. GitHub, your repository, Settings, Secrets and variables, Actions, tab **Variables**, **New repository variable**.
2. Name `AUTO_MERGE`, value `on`. To switch it off, delete the variable or change the value.
3. Settings, Actions, General, Workflow permissions: leave it on "Read repository contents" or "Read and write"; the workflow asks for its own write rights.
4. Open one small test pull request with a content change, wait for green, and look at the **Auto-merge** run in the Actions tab. The line `AUTOMERGE OK` means it merged; `AUTOMERGE SKIP: ...` says why not. A skip is normal, not an error.
A merge made this way does not start `push.yml` (GitHub does not let one workflow start another with its own token). Cloudflare Pages still deploys, and the hourly run of `push.yml` announces the new posts.

**Branch protection (optional, stricter).** Auto-merge already waits for a green Validate run, so you can skip this. WARNING: the dashboard writes commits directly to `main`. A rule that requires a pull request or a status check on `main` can refuse those saves, for you too. If you still want it:
1. Do it only after one green Validate run (the check name `validate` is only offered after it ran once).
2. Settings, Rules, Rulesets, **New branch ruleset**, target the branch `main`.
3. Add the bypass list entry **Repository admin** (this is you, and the dashboard saves as you). Tick **Require status checks to pass** and choose `validate`. Do NOT tick "Require a pull request" and do not allow force pushes or deletions.
4. Test at once: in the dashboard change one harmless setting and save. If GitHub refuses, delete the ruleset (nothing else is affected) and tell the AI helper.

## Hosting note
The Astro project lives in the `site/` folder, so on Cloudflare Pages set **Root directory = `site`**, build command `npm run build`, output directory `dist`.

## Scheduling a post
Set `status: published` and a future `date`. The post appears at the first hourly rebuild after that time (`.github/workflows/rebuild.yml`).

## Setup for Phase 2
1. Set `SITE_URL` and `INDEXNOW_KEY` on your host. Add the GitHub secrets `SITE_URL`, `INDEXNOW_KEY`, `CF_DEPLOY_HOOK`.
2. Fill `config/site.json` (social links, verification codes).
3. Logo and icons are already made from `brand/source-icon.png`. To change the logo, replace that file and run `npm run icons`.
4. Submit `/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools.

## Decisions still open (see ../INCOMPLETE.md)
Domain, hosting, date format in URL. Publisher time zone is `Asia/Kolkata` in `config/site.json`; change it before the first post if needed.

## Phase 3: dashboard at `/admin/` (v0.3.0)
Write and publish from any browser, including a phone. Screens: Posts, New post, Media, Authors, Categories, Settings (admins), Setup.

### Phase 3 setup (do once)
1. **Config.** Edit `public/admin/config.json`: `repo` (`owner/name`), `branch` (default `main`), `contentRoot` (`site`, the folder with this project), `roles` (for example `{ "shivam-das": "admin" }`; a repo admin is admin even without an entry; roles are `admin`, `editor`, `author`).
2. **Quick start with a token (no Worker).** Create a fine-grained personal access token on GitHub for this repo with *Contents: Read and write*. Open `/admin/`, open "Use a personal access token instead", paste it. It is kept only in that tab.
3. **Sign in with GitHub (recommended).**
   - GitHub, Settings, Developer settings, OAuth Apps, New. Callback URL: `https://<your-worker>.workers.dev/callback`.
   - `cd ../workers/auth`, edit `wrangler.toml` (`ADMIN_ORIGIN` = your site, for example `https://yourdomain.com`; optional `ALLOWED_USERS`), then `npx wrangler secret put GITHUB_CLIENT_ID`, `npx wrangler secret put GITHUB_CLIENT_SECRET`, `npx wrangler deploy`.
   - Put the Worker address in `public/admin/config.json` as `authUrl`.
4. Open `/admin/`, go to **Setup**, and fix every item on the checklist. Confirm the time zone in Settings before the first post (URLs contain the date and never change).

### How saving works
Every save is one commit to `branch` (the post file, plus a delete when its category or permalink changes). The host then rebuilds, about 2 minutes. Scheduling = Publish with a future date; the post appears at the first hourly rebuild after that time. Unsaved text is kept on your device and offered back if you reopen the post.

### Rules the editor enforces (same as the build)
Title 5+ characters, unique lowercase permalink, category and author, description 50 to 160 to publish, featured image and alt text to publish, featured image at least 1200 px wide, no H1 and no heading jumps in the body. When the URL of a live post changes, the old URL is saved in `redirects`.

### Safety notes
- The dashboard is never indexed (`robots.txt`, `X-Robots-Tag` in `public/_headers`, meta tag).
- Roles only change what the dashboard shows. Real access is GitHub write access, and `ALLOWED_USERS` in the Worker.
- The OAuth Worker sends the token only to `ADMIN_ORIGIN`.
- Change the logo: upload `site/brand/source-icon.png` to the repo; `.github/workflows/icons.yml` rebuilds and commits all icons. (A logo screen in the dashboard is still to come.)

## Redirects (v0.4.0)
When a live post changes its permalink, category or date, the dashboard keeps the old URL in the post's `redirects` list. At build, `src/lib/redirects.ts` turns every list into one map (chains collapsed, loops dropped) and `scripts/build-redirects.mjs` writes `dist/_redirects` with real 301s. Problems (a loop, a dead end, two posts claiming one old URL) print as `[redirects]` lines in the build log. Needs Cloudflare Pages. Limit: 2000 redirects.

### Redirect Manager (v0.5.0)
`/admin/` then **Redirects**: add an old address and a new one (for example an old Blogger link), remove one, export all as CSV, import a CSV (`from,to`, one pair per line). Hand-made redirects are saved in `config/redirects.json` and merged with the post redirects at build. A target must be a live page of this site.

If you move a post and the old file cannot be removed, the dashboard undoes the new file, so two posts never share one permalink.

### 410 Gone for archived posts (v0.6.0)
Archive a post in the dashboard and its address (and the old addresses it had) answers **410 Gone** instead of 404. Cloudflare `_redirects` cannot send 410, so a small Function (`functions/_middleware.js`) does it, and only for the listed addresses (`dist/_routes.json`), so normal page views never run it. Needs Cloudflare Pages with **Root directory = `site`**. Up to 100 addresses. A redirect or a live page at the same address wins.

### Related stories (v0.7.0)
Under each article, up to 4 related stories are shown (shared tags, same category, shared keywords, newer first). Nothing is shown when nothing is related. Add tags and a focus keyword to posts to get better matches.

## Next
Rest of Phase 3 (pages editor, menus, logo screen, WYSIWYG, embeds) and the rest of Phase 4 (Trending waits for analytics).

## Auto internal links (v0.8.0)
The build links the first mention of a known phrase inside each article to the best internal page: other posts (by focus keyword or title, two or more words), tag pages, category pages and your own list in `config/links.json`.
- Limit: about one link per 250 words, at most 5. Only in paragraphs and list items, never in headings, links or code.
- Turn it off for one post with the "Auto internal links" switch in the editor (`autoLinks: false`).
- Your own list: the **Links** screen in the dashboard (admin and editor), or the file `config/links.json`, for example `[{ "keyword": "solar power", "url": "/category/energy/" }]`. The address must be a path of this site.
- A story that the text already links to is not repeated in "Related stories".

## Read next and orphan report (v0.9.0)
- **Read next:** one box under each article with the nearest older story of the same category (or the nearest newer one if nothing is older). It skips a story the text already links to. Hidden when there is nothing to show.
- **Orphan report:** `npm run build` prints `[orphan] <address> ...` for an article that no other article links to (text, Related stories or Read next). It is a warning only. Fix it with tags, a focus keyword or a hand-made link.

## Import preview (v0.10.0)
`/admin/` then **Import**: choose a Blogger backup (Atom `.xml`) or a WordPress export (WXR `.xml`). The dashboard shows how many posts and pages it found, which ones are already on the site, the new address of each, the redirects it would add and any warning. The first label becomes the category and the others become tags. The preview alone writes nothing (saving is described below).

### Import: clean Markdown (v0.11.0)
The preview already converts each text to Markdown: scripts, styles, forms and inline styles are removed, unsafe links are dropped, headings start at H2, embeds become plain links. A post is planned as a **draft** when it has no image, a text too short for a 50 character description, no category or no date, and the reason is shown on its line. Items with a title under 5 characters are skipped (the site schema needs 5; pages need 2).

### Import: save (v0.12.0)
After you choose the file, the **Save to the site** card shows a button. One press writes every item that is not skipped, **in one commit** (so the site rebuilds once). A very big file is split into commits of 200 files.
- **Posts** go to `content/blogs/<category>/<permalink>.md`, **pages** to `content/pages/<permalink>.md`. A file that already exists is never overwritten.
- **Posts without a category:** type a category in the card and they are saved as drafts in it. Leave it empty and they are skipped (the card says so).
- **Redirects:** a live post keeps its old address in its `redirects` field; a live page gets a line in `config/redirects.json`. A draft post also keeps its old address, so the redirect appears when you publish it. The build stops above 2000 redirects, so the dashboard writes no more than that and tells you how many old addresses got none.
- **Author:** every imported post gets the default author from Settings.
- **Images:** see the next section (v0.13.0).
- If one commit of a big import fails, open Import again with the same file: saved items show as "Already on the site".

### Ad loader (v0.20.0, Phase 5 part 4)
`config/ad-loader.json` controls whether any ad script may enter an article. **It is off by default**: nothing is added to any page until you change the file.
```
{ "complianceMode": true, "geoUrl": "", "adsterra": { "popunder": "", "socialBar": "", "smartlink": "", "nativeBanner": { "script": "", "containerId": "", "afterParagraph": 3 } } }
```
- `consentText` (v0.30.0): the sentence in the consent bar for readers from the EU, EEA, UK and Switzerland. Empty = the built-in English sentence. Otherwise one line of 20 to 300 characters without `<` or `>`. Dashboard: **Ad loader**, card "Consent answer", box "Bar text".
- `consentAccept`, `consentDecline`, `consentChoices` (v0.31.0): the words on the buttons "Accept", "No thanks" and "Ad choices". Empty = the built-in English word. Otherwise 2 to 24 characters on one line without `<` or `>`. Dashboard: **Ad loader**, card "Consent answer".
- `complianceMode`: stays `true` (no ad script anywhere) until the file says `false`. Keep it `true` while you apply to AdSense and Google News.
- `geoUrl`: the address of your deployed geo Worker, for example `https://news-geo.yourname.workers.dev/geo`. An ad script without it is refused at build.
- `adsterra.popunder` and `adsterra.socialBar`: the script addresses from your Adsterra account (clean `https://` only). Empty means that format is off.
- `adsterra.nativeBanner` (v0.22.0): `script` is the address in the Adsterra native banner code (`src=...`), `containerId` is the id of the box in that code (for example `container-1a2b3c`), `afterParagraph` is a whole number from 1 to 20 (empty means 3). Script and container id must be filled together or both left empty. Empty means off.
- `adsterra.smartlink` (v0.23.0): the Smartlink address from your Adsterra account (clean `https://` only). Empty means off.
- `adsense` (v0.24.0): `slot` is the number in `data-ad-slot` of your AdSense in-article ad unit (digits only, 6 to 20), `afterParagraph` is a whole number from 1 to 20 (empty means 5). The AdSense id is **not** stored here: the build takes it from `config/ads.json` (`adsensePublisherId`, the Ads screen), so it exists in one place only. A slot without an AdSense id stops the build with a plain message. Empty slot means off.
- **Smartlink:** a plain link, not a script and never an automatic redirect. One line "Sponsored link" right under the article text (`rel="sponsored nofollow noopener noreferrer"`, opens in a new tab only when the reader clicks). It is added only while the end of the text is still below the visible screen, and never when the post has "Hide all ads".
- **AdSense unit (v0.24.0):** one Google AdSense in-article box inside the article text, after paragraph N (default 5). Same safety rules as the native banner: added only when the article has more paragraphs than N and that place is still below the visible screen; fixed minimum height (280 px) and an "Advertisement" label; never when the post has "Hide all ads". Google's script address is fixed in the code (`pagead2.googlesyndication.com`), only the AdSense id and the slot number come from the settings. It goes through the same country check as every other format, so **India is off for AdSense too** (PLAN 29.1). The native banner and the AdSense unit may not use the same paragraph number (the build refuses it).
- **Native banner:** one box inside the article text, after paragraph N. It is added only when the article has more paragraphs than N (never at the very end) and only when that place is still below the visible screen, so nothing jumps under the reader. The box has a fixed minimum height (250 px) and a small "Advertisement" label. The script is added after the box. Never when the post has "Hide all ads".
- **Where:** only the article template uses the loader (`src/components/AdLoader.astro`). Home, category, tag, author, search, static pages and 404 never get it; the build fails if ad code shows up there, and a test fails if another file imports the loader.
- **When:** only after one real event of the reader: a press, a key, a touch or a scroll (v0.81.0: the 4 second idle time no longer starts the loader, and an event made up by a script does not count). A reader who does nothing gets no ad. The browser asks the geo Worker (no cookies, no cache, 3 second limit). Only `ads: true` allows ads. India, an unknown country, an error, a timeout or a blocked answer means **no ads**.
- **Popunder:** from the 2nd article view of a session, once per session. Never when the post has "Hide popunder" or "Hide all ads", or when the browser blocks session storage.
- A bad value in the file stops the build with a plain message.
- Test after deploy: open an article with the browser developer tools (Network tab). With a VPN in India the call to the Worker happens and no ad script follows.
- **Dashboard:** screen **Ad loader** (admins only, v0.21.0) edits this file: compliance mode tick box, geo Worker address, the script addresses (social bar, popunder, since v0.22.0 the native banner with its container id and paragraph number, since v0.23.0 the smartlink, since v0.24.0 the AdSense slot and paragraph number), and one sentence that says what the file would do. A bad value is refused and nothing is saved. Turning scripts from OFF to ON asks first. You can still edit the file in GitHub.

### Geo Worker (v0.19.0, Phase 5 part 3)
`workers/geo/` is a small Cloudflare Worker. `GET /geo` answers `{ "ads": true|false, "country": "US"|null, "reason": "allowed|blocked|unknown|datacenter" }` from the country Cloudflare already knows for the visitor. No IP address is read or stored.
- **India (IN) is blocked by default**, so ads are off there. More codes: `BLOCKED_COUNTRIES = "IN,PK"` in `wrangler.toml`.
- **Unknown country means no ads** (BUGS A1). Only `ADS_ON_UNKNOWN = "true"` changes that.
- **Datacenter networks get no ads** (v0.82.0, `BLOCK_DATACENTERS`, on by default).
- The answer is never cached (`Cache-Control: no-store, private`, `Vary: Origin`), so one visitor's country is never given to another.
- Only `SITE_ORIGIN` may read it (CORS). Other websites get no CORS header.
- Deploy: edit `SITE_ORIGIN` in `workers/geo/wrangler.toml`, then `cd workers/geo` and `npx wrangler deploy`. No secrets.
- Since v0.20.0 the ad loader calls it from article pages (see "Ad loader"), and shows no ad unless the answer is `ads: true`.

### Ads screen (v0.18.0, Phase 5 part 2)
Dashboard screen **Ads** (admins only): the AdSense publisher id and the lines of other ad networks, with a live preview of `/ads.txt`. Save writes `config/ads.json` in one commit. A bad value is refused with a plain message and nothing is saved. The rules are the same as the build's (`src/lib/ads-txt.ts`); a test runs both on the same inputs so they cannot drift apart. No ad is shown to readers yet.

### ads.txt (v0.17.0, Phase 5 part 1)
`/ads.txt` is built from `config/ads.json`: `adsensePublisherId` (for example `ca-pub-1234567890123456`) and `extraLines` (lines an ad network gives you, such as `adnetwork.com, 12345, RESELLER`). The AdSense line gets Google's fixed certification id automatically. Nothing is invented: with an empty config the file is empty (PLAN 25).
- A value that is not valid **stops the build** with a plain message (BUGS A7), so a typo never goes live. Lower-case domain, upper-case DIRECT or RESELLER, repeated lines written once.
- Adsterra: paste the exact ads.txt line from your Adsterra account into `extraLines`. The line is not guessed here.
- No ad is shown yet. Ads Manager, geo rule and ad loader are the next Phase 5 parts.

### Rename a category (v0.16.0)
Dashboard, **Categories**, button **Rename** under a category (admin and editor). Type the new slug (lowercase letters, numbers, hyphens), confirm, and ONE commit does everything (BUGS U5, H4):
- every post of the category moves to `content/blogs/<new>/` and gets `category: <new>`;
- every post that was live or archived keeps its old address in `redirects` (301 for live, 410 for archived); drafts get none;
- `config/redirects.json` gets `/category/<old>/` to `/category/<new>/` when at least one post is live;
- the display name and description in `config/categories.json` move to the new slug.
Refused with a plain message: a name that already exists (no merging), an unknown category, a taken file path, more than 1000 posts, or more than the 2000 redirects Cloudflare Pages allows. Nothing is changed in those cases. Do not rename during a Google core update (SEARCH_ENGINE_UPDATES.md).

### Links screen (v0.15.0)
Dashboard screen **Links**: add and remove keywords for the automatic internal links, without editing a file. Same rules as the build: keyword of 4 or more characters (letters, numbers, spaces, `'`, `-`), address is a path of this site (a full web address is cut down to its path), a keyword is not added twice (any letter case), at most 500 entries. Each Add or Remove is one save to `config/links.json`.

### Export: XML backup (v0.14.0)
Dashboard screen **Export** (admin and editor). One button downloads every post and page as a single Blogger-style Atom `.xml` file (`<site>-backup-YYYY-MM-DD.xml`). The Import screen reads the same file, so a backup can be restored (a round trip is tested).
- **Contents:** title, text (Markdown turned into HTML), featured image first, category and tags as labels, author name, dates, the live address, and the description as summary.
- **Drafts and archived posts** are written as drafts, so a restore never makes them public by accident.
- **Images** stay as absolute links to this site (`Site address` field); the files themselves are not inside the XML. Keep a copy of `public/media/` (the repository itself is the full backup of images).
- **Site address:** must be `https://domain` with no path. It is used for image links and old addresses.
- Nothing is written to the repository by Export.

### Import: images (v0.13.0)
Before the posts are saved, the dashboard downloads every image of the items that will be saved (each address once, 4 at a time), converts it like an upload (WebP, 2400 px cap) and saves it to `public/media/imported/<name>.webp` in commits of 100 images. Then the Markdown and the featured image of each post point to `/media/imported/...`.
- **A download can fail.** Many old hosts do not allow downloads from another site (CORS). That image keeps its old address, the item is still saved, and the result card says how many failed and why.
- **Featured image under 1200 px:** a post that would be published is saved as a **draft** instead (same rule as the editor, BUGS S9). A gif or svg has no checked width; it only gets a note.
- **Same name:** `-2`, `-3` is added; an existing file is never overwritten. The same address in several posts is downloaded once.
- **If something stops half way:** images already saved stay in the media library. Press Save again on the same screen (do not reload): saved images are not downloaded twice. If you reload and choose the file again, the images are downloaded again under new names (`-2`); delete the unused ones in the Media screen.

## Consent bar (v0.25.0)
For readers from the EU, the EEA, the UK and Switzerland (and when the country is unknown) no ad loads until the reader clicks **Accept** on a small bar at the bottom of the article. **No thanks** loads nothing. The choice is kept in the browser (`localStorage`, key `adConsent`).
- The geo Worker decides who is asked: `CONSENT_COUNTRIES` in `workers/geo/wrangler.toml`. Redeploy the Worker after you change it.
- The AdSense unit is never added for readers who had to consent. Google needs its own certified consent tool for that (not built).
- Test after deploy: VPN in Germany shows the bar and no ad script before Accept; VPN in the USA shows no bar; India shows nothing.

### Ad choices button (v0.26.0)
Readers who were asked for consent get a small **Ad choices** button under the article text. A click opens the bar again. When the answer changes, the page reloads so the new answer is used at once. Test after deploy: VPN in Germany, Accept, scroll to the end, click "Ad choices", choose No thanks: the page reloads and no ad script is left.

### The answer expires (v0.27.0, days setting since v0.28.0)
Accept and No thanks are each kept for **180 days by default**; change the number (30 to 365) in the dashboard, **Ad loader**, card "Consent answer", or as `consentDays` in `config/ad-loader.json` (saved as `yes|<time>` or `no|<time>` under `adConsent` in the browser). After that, or if the saved value is old, broken or from the future, the bar asks again. To try it: open the browser developer tools, Application, Local Storage, set `adConsent` to `yes|1700000000000` and reload the article.

## Analytics, part 1 (v0.32.0, Phase 6)
`workers/analytics/schema.sql` is the D1 database layout (events, hourly and daily totals). `workers/analytics/lib.js` holds the pure rules that check one visit message: bot filter, ids, path without query, country, time zone, referrer host, read time and scroll depth capped, and the SQL that stores a page view once even when it is sent twice. No IP address and no user agent text is kept. There is no Worker and no beacon script yet, so nothing is collected. Apply the schema once when the Worker part arrives: `npx wrangler d1 execute <database-name> --remote --file=workers/analytics/schema.sql`.

## Analytics, part 2 (v0.33.0, Phase 6)
`workers/analytics/index.js` is the Worker with `POST /collect`. Only the site named in `SITE_ORIGIN` may send; the message is checked by `lib.js` and stored once per page view in the D1 table `events`. Deploy (once): `cd workers/analytics`, `npx wrangler d1 create news-analytics`, copy the printed `database_id` into `wrangler.toml`, set `SITE_ORIGIN`, `npx wrangler d1 execute news-analytics --remote --file=schema.sql`, `npx wrangler deploy`. The optional rate limit is described in `wrangler.toml`. No page sends a visit yet (the beacon script comes next).

## Analytics, part 3 (v0.34.0, Phase 6)
The beacon script now exists. It is added to **article pages only** and only when `config/analytics.json` has an `endpoint` (empty by default, so nothing changes until you set it). Put the address of the deployed analytics Worker there, for example `{ "endpoint": "https://news-analytics.yourname.workers.dev/collect" }` (https, ends with `/collect`; a wrong value stops the build with a plain message). The script counts read time only while the tab is visible and the reader did something in the last 30 seconds (max 3600), remembers the deepest scroll point, and sends one small text message after the first second, then every 30 read seconds and when the reader leaves. The same page view is one row in D1. It sets no cookie. Test after deploy: open one article, wait 5 seconds, then read the `events` table in D1: one row with your country and a read time. `SITE_ORIGIN` in the Worker must be your exact site address, or every visit gets 403.

## Analytics, part 4 (v0.35.0, Phase 6)
The analytics Worker now also has a **Cron Trigger** (`[triggers]` in `workers/analytics/wrangler.toml`, every hour at minute 5). Each run writes the hourly totals (last 48 finished hours) and the daily totals (last 3 finished UTC days) into `rollup_hourly` and `rollup_daily`, then deletes raw events older than 7 days. Visitors are different session ids; running twice gives the same numbers. The running hour and day are not in the totals yet (the dashboard will read them from raw events). If a total step fails, nothing is deleted. After you redeploy (`cd workers/analytics ; npx wrangler deploy`) check the Worker's Triggers tab in Cloudflare for the cron, and after the first full hour read `SELECT * FROM rollup_hourly` in D1.

## Analytics, part 5 (v0.36.0, Phase 6)
The analytics Worker now answers `GET /stats?range=5m|1h|24h|7d|life` for the dashboard (the screen itself comes next). It is **private**: the request needs a GitHub token (the same sign-in as the dashboard) and the GitHub login must be in `ALLOWED_USERS` in `workers/analytics/wrangler.toml`. **An empty `ALLOWED_USERS` means nobody can read the numbers** (answer 503). Only the site named in `SITE_ORIGIN` gets a CORS header. The answer holds views, visitors, average read time, the top 10 pages, countries, sources (referrer hosts), devices and browsers, and a chart series in UTC seconds (the dashboard turns it into the chosen time zone). 5 minutes to 7 days are exact (read from raw events, kept 7 days). Lifetime = finished days from the daily totals + today from raw events; its visitors number is left out (null) because a returning reader would count once per day. After you set `ALLOWED_USERS` and redeploy, try it: `curl -H "Authorization: Bearer <your GitHub token>" -H "Origin: https://yourdomain.com" "https://news-analytics.yourname.workers.dev/stats?range=24h"`.

## Analytics, part 6 (v0.37.0, Phase 6): the Analytics screen
The dashboard has a new **Analytics** screen (admins only). It reads the address from `config/analytics.json` (the same `endpoint` the beacon uses; the screen turns `/collect` into `/stats`) and asks the Worker with your sign-in token. Buttons: Live (5 min, refreshes every 15 seconds), 1 hour, 24 hours, 7 days, Lifetime (the last four refresh every 60 seconds). It shows page views, visitors, average read time, a bar chart, and the top pages, countries, traffic sources, devices and browsers. The **time zone** selector (starts with the site time zone) only changes the labels; it does not ask the Worker again. With no endpoint the screen says Analytics is not switched on and shows nothing. Zero visits show a plain empty message. Failures are explained in words (not signed in, not in `ALLOWED_USERS`, Worker not ready, no connection). Lifetime shows visitors as "not counted".


## Analytics, part 7 (v0.38.0, Phase 6): source names
**Traffic sources** in the Analytics screen now shows names: Google, Google News, Facebook, Instagram, X, WhatsApp, Telegram, YouTube, Reddit, LinkedIn, Pinterest, Bing, DuckDuckGo, Yahoo, Yandex, Baidu, Ecosia, and **Direct** for visits with no referrer. Any other site is shown by its host name (for example `example.org`). The Worker makes the names when the dashboard asks (`workers/analytics/lib.js`: `sourceName`, `groupSources`), so no new deploy step is needed beyond `cd workers/analytics ; npx wrangler deploy`, and old visits get the names too. Google Discover cannot be told apart from the web address alone (the app sends no referrer), so those visits are inside Direct. To add a site, add one line to `SOURCES` in `lib.js` and one check in `tests/unit/analytics-sources.test.ts`.

## Analytics, part 8 (v0.39.0, Phase 6): Trending numbers
The analytics Worker now answers `GET /trending?limit=5` (1 to 10). It lists the best article addresses of the last 24 hours with a score: `(views in 24 h + 3 x views in the last hour) x (0.5 + read time factor) / (1 + age in hours / 24)`; the read time factor is the average read seconds divided by 60, at most 1. Only articles with at least 3 views in 24 hours are listed, so a new site starts with an empty list. The age comes from the date in the address. The answer is public but holds only addresses and scores, and the browser may keep it for 60 seconds. Redeploy to use it: `cd workers/analytics ; npx wrangler deploy`. Test after deploy: open the endpoint address with `/trending` instead of `/collect` in a browser; you should see `{"items":[]}` or a list. **No page shows Trending yet**; the block on the site is the next part.

## Push rules and database (v0.50.0, Phase 9 part 1)
`workers/push/lib.js` holds every rule of the smart push notifications (PLAN 31, LOGICS 19): keyword cleaning and light stemming, keyword match strength, scoring, alert levels, daily caps, quiet hours by zone name, story thread key and the notification text with its emoji and size checks. `workers/push/schema.sql` is the database file for Cloudflare D1. Both are pure and have no network access. **Nothing is switched on**: there is no Worker, no endpoint and no page yet (Parts 2 to 11), so readers see no change. Tests: `tests/unit/push-lib.test.ts`. Run `npm test`.

## Push endpoints (v0.52.0, Phase 9 part 2)
`workers/push/index.js` is the Worker a reader's browser will call: `POST /subscribe` (the push subscription and the choices; one row for one browser), `POST /preferences` (read the choices, or change them and the pause), `POST /unsubscribe` (removes the reader and everything that belongs to the reader). The rules and SQL are in `workers/push/prefs.js`. Only the site in `SITE_ORIGIN` may call it. The endpoint address, the keys and the token hash are never returned or logged. **Nothing is switched on**: no page calls it yet (parts 4 and 5) and nothing is sent (parts 3 to 7). Tests: `tests/unit/push-endpoints.test.ts` (the database tests use `node:sqlite`, so run `npm test` on Node 22 or newer). Set up once: `cd workers/push`; `npx wrangler d1 create news-push`; copy the printed `database_id` and your `SITE_ORIGIN` into `wrangler.toml`; `npx wrangler d1 execute news-push --remote --file=schema.sql`; `npx wrangler deploy`.

## Announce route (v0.64.0, Phase 9 part 6a)
`POST /announce` in `workers/push/index.js` (rules in `workers/push/announce.js`) takes the posts that went live in one deploy: `{ "posts": [ { key, url, title, description, category, tags, focus, author, breaking, featured, trending, push, pushTitle, pushBody, image, imageWidth, wordCount, publishedAt, robots, status, sponsored } ] }`, 1 to 25 posts. Only `key` (the permalink), `url`, `title` and `publishedAt` are needed. It checks each post (PLAN 31.5: push off, sponsored, not published, noindex, not yet live, older than 120 minutes, address not on this site, emoji, already announced, import guard) and records the good ones in `push_posts`. The answer lists every post with `accepted` or `skipped` and one reason word. It sends nothing and finds no readers yet (6b and later).

Set it up (nothing is deployed yet):
1. Make a secret of at least 32 characters: `openssl rand -hex 32`.
2. `cd workers/push ; npx wrangler secret put ANNOUNCE_SECRET`, paste it. Without it the route answers 503.
3. Later (part 7) the same value goes into the GitHub repository secret that the `push.yml` job uses. Never put it in a file.

Test by hand (replace the address and the secret): `curl -X POST https://YOUR-PUSH-WORKER/announce -H "X-Announce-Secret: YOUR-SECRET" -d '{"posts":[{"key":"my-story","url":"https://YOUR-DOMAIN/2026/11/16/blogs/tech/my-story/","title":"My story","publishedAt":"2026-11-16T10:00:00Z"}]}'`. A post older than 2 hours is answered `too_old`; that is on purpose.

## Live check (v0.65.0, Phase 9 part 6b)
Before `POST /announce` records a post, the push Worker opens the post's address (`workers/push/livecheck.js`). The post must answer status 200 with an HTML page and no `noindex` or `none` in the `X-Robots-Tag` header or in a `robots` or `googlebot` meta tag of the head. A redirect is not followed and counts as not live. The answer for a post that fails is `not_live`, `noindex` or `check_failed` (a timeout of 5 seconds or a network error: when unsure, do not send). Such a post is not recorded, so the same post can be announced again later while it is younger than 120 minutes. Only posts that passed every other check are opened, at most 5 at a time, and the live check runs before the import guard, so a page that is not live cannot take the place of a live one. Nothing to set up: no new secret or variable. The visit has the agent name `ShivamDasNewsPushCheck/1.0`.

## Page security headers (v0.85.0, bot protection Part 6a)
`public/_headers` has a block for all paths: `X-Content-Type-Options: nosniff`, `Permissions-Policy` (camera, microphone, location and payment off) and `Strict-Transport-Security` (one year, with sub-domains, no preload). The dashboard (`/admin/*`) keeps its own stricter headers, including `Referrer-Policy: no-referrer`; public pages get `strict-origin-when-cross-origin` from a meta tag in `src/layouts/Base.astro`. No header may appear in two blocks (a test checks it). After a deploy, check the real headers once with `curl -I https://your-site/`. Before the real domain goes live, make sure every sub-domain serves https, or take `includeSubDomains` out. Since v0.86.0 (Part 6b-1) the same block also has a `Content-Security-Policy-Report-Only`: it only REPORTS what it would block, in the browser console (DevTools), and never blocks anything; the dashboard is taken out with a `! Content-Security-Policy-Report-Only` line. It holds no ad host and no Turnstile host yet, so ads and the contact box show up in the console on purpose. Since v0.87.0 (Part 6b-2a) the Contact Us page (the only page with the form) has its own report-only policy: the all-paths one plus `https://challenges.cloudflare.com` for scripts and frames (Turnstile), only there. Its block in `_headers` has the path `/:year/:month/:day/pages/contact-us/` (placeholders, because the date in the address changes) and a `!` line that takes the all-paths policy off that page. After a deploy, check once: `curl -I` on the Contact Us address shows ONE `content-security-policy-report-only` with the Turnstile host, and `curl -I https://your-site/` shows one without it. Since v0.87.1 (Part 6b-2b) the dashboard (`/admin/*`) has its own report-only policy too: scripts from itself only (no `unsafe-inline`), and `blob:` pictures for the previews; the old Blogger XML tool (`/admin/blog-xml-tool.html`, it has an inline script) gets the all-paths policy back. Each of these blocks has a `!` line. After a deploy, check once: `curl -I https://your-site/admin/` shows ONE `content-security-policy-report-only` with `script-src 'self';` and `blob:`. Then open the dashboard with DevTools, Console, and sign in, open a post, the media library and the Analytics screen: any report line is a thing the policy would block later. Since v0.88.0 (Part 6b-3a) the article pages (the only pages with the ad loader) have their own report-only policy: the all-paths one plus the ad script hosts (Adsterra `afders.org` and `bicea.org`, AdSense `pagead2.googlesyndication.com` and `googleads.g.doubleclick.net`) and the two AdSense frame hosts. The path is `/:year/:month/:day/blogs/:category/:slug/` and the block has a `!` line. The list is a first guess: when ads are switched on, open an article with DevTools, Console, and every report line shows what is still missing (Part 6b-3b). If you put a new Adsterra script address with a new host in the dashboard, `npm test` fails until that host is added to this block. Enforcing comes in 6b-3c.

## My own browser switch (v0.84.0, bot protection Part 5c)
The owner opens any public address of the site once with `?own-browser=on` at the end (for example `https://your-site.example/?own-browser=on`). That browser keeps the mark `ownBrowser` in its localStorage; the word is cut from the address bar. From then on the ad loader (`src/lib/ads-client.js`) loads no ad and asks no Worker, and the analytics beacon (`src/lib/beacon-client.js`) counts no visit, in that browser. `?own-browser=off` removes the mark. The switch itself is `src/lib/own-browser.js`, put into every public page by `src/layouts/Base.astro`. Do it once in each browser and on each phone; a private window or cleared browser data loses the mark. No cookie, nothing is sent anywhere, no setting and no Worker change.

## Article bell button (v0.63.0, Phase 9 part 5c-6)
Every article ends with a button "Get alerts for this topic" (`src/components/AlertsLink.astro`). It is a plain link to `/notifications/?cat=<category>&kw=<focus keyword>`. On `/notifications/` the page ticks that category and adds the keyword to "Keywords to follow", but saves nothing: a new reader still has to press "Turn on notifications", a reader who is on still has to press "Save". The button shows only while `config/push.json` is filled. A story without a focus keyword fills the category only; a keyword the Worker would refuse (other than English letters, digits, spaces, hyphens, apostrophes; over 40 characters or 4 words) is left out of the link. Files: `AlertsLink.astro`, `topicHref`, `readTopic` and `applyTopic` in `src/lib/notifications-page.js`, `tests/unit/notifications-topic.test.ts`.

## Test notification (v0.62.0, Phase 9 part 5c-5)
`POST /test` in `workers/push/index.js` sends one fixed message to the caller's own browser; the button "Send me a test notification" on `/notifications/` calls it through `sendTest` in `push-client.js`. One test a minute for each reader; it never uses the daily limit. It works only when the sender keys are set (`VAPID_PUBLIC_KEY` in `wrangler.toml`, and the secrets `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, see the next section); without them the Worker answers 503 and the page shows "Sending is not switched on yet." The table `push_subs` has a new column `last_test`: a database made before v0.62.0 needs `npx wrangler d1 execute news-push --remote --command "ALTER TABLE push_subs ADD COLUMN last_test INTEGER;"` once. Not tried on a real phone yet.

## Push encryption, VAPID and the send function (v0.53.0, Phase 9 part 3)
`workers/push/webpush.js` seals one message for one browser (`encryptPayload`: RFC 8291, `aes128gcm`, one record, a new one-time key and salt every time) and posts it to the push service (`sendPush`). `workers/push/vapid.js` holds the sender's key pair and signs each request (RFC 8292). The result of `sendPush` is `sent`, `gone` (404, 410: delete the reader), `retry` (429, 5xx, network, time out), `rejected` (400, 401, 403, 413, redirect) or `bad_sub`; it never holds the endpoint, a key or the text, and nothing is printed to the console. The encryption is checked in `tests/unit/push-send.test.ts` against the RFC 8291 example (the exact message bytes) and by a browser written with Node's own crypto. **Nothing is switched on**: nothing calls the send function yet (Part 7) and the Worker is not deployed.

Make the key pair once: `cd site ; npm run vapid` (prints two keys, writes no file). Public key: `VAPID_PUBLIC_KEY` in `workers/push/wrangler.toml` and `vapidPublicKey` in `config/push.json`. Private key and contact address (a `mailto:` or `https:` address): `cd workers/push ; npx wrangler secret put VAPID_PRIVATE_KEY` and `npx wrangler secret put VAPID_SUBJECT`. Never commit the private key, and keep the first pair for good.

## Push service worker and client script (v0.54.0, Phase 9 part 4)
`public/push-sw.js` is the service worker. It shows a pushed notification (title, body, icon, badge, image, the two buttons "Read now" and "Less like this"), opens the story on a tap and reports open, close and "Less like this" to the push Worker. It has no fetch handler and no cache, so it cannot change how the site loads, and it only opens addresses on this site. `src/lib/push-client.js` is what the page calls: `enable` (opens the browser's permission box, only from the reader's tap), `getPrefs`, `savePrefs`, `disable` (unsubscribe and delete), `status`. `config/push.json` ships empty (`{ "endpoint": "", "vapidPublicKey": "" }`), which keeps the feature off; later you put the Worker address and the public key there. `public/badge-96.png` is the one-colour badge Android shows in its status bar, made from `brand/source-icon.png` (`npm run icons` writes it too). **Nothing is switched on**: no page loads these files yet (part 5), and the Worker route that receives the taps is part 8. After a change to `push-sw.js`, change `SW_VERSION` in it.

## No emojis, SVG icons only (v0.40.0)
The site never shows an emoji, and every icon is an inline SVG (hard rule, `NEWS_WEBSITE_PLAN.md` section 29.3). Icons live in `src/lib/svg-icons.ts` and are used as `<Icon name="search" />` in templates; the dashboard uses `icon('alert')` from `public/admin/js/ui.js`. Letters, symbols and HTML entities used as pictures (arrows, check marks, half circles, dots) are not allowed either. `npm run build` stops if a built page has an emoji, and `npm test` stops if a template, script, dashboard file, design preview, config file or plan file has one. If the build names a post: open that post and remove the emoji. To add an icon: add the drawing to `svg-icons.ts` and to the list in `CSS.md`.

## Trending block (v0.41.0, Phase 6 part 9)
"Trending now" shows the best articles of the last 24 hours on the home page and on article pages. Nothing is shown (and nothing is built) while `config/analytics.json` has an empty endpoint.
1. Turn analytics on: set `endpoint` in `site/config/analytics.json` (the Worker's `/collect` address). Set `SITE_ORIGIN` in `workers/analytics/wrangler.toml` to your real site address and redeploy the Worker.
2. The page asks the Worker for `/trending?limit=5`, then reads `/trending-titles.json` (made at build time) to get the titles.
3. The block appears only when at least one article has 3 or more views in 24 hours. The article being read is left out of its own list. Up to 5 links.
4. Files: `src/lib/trending.ts`, `src/lib/trending-client.js`, `src/components/Trending.astro`, `src/pages/trending-titles.json.ts`.

## Footer links (v0.42.0)
The footer has "Our other projects" and "Follow us" rows, all icons are inline SVG.
- Projects: edit `site/config/footer.json` (`name`, https `url`, `icon`: `mark-h` or `mark-s`, or any name in `src/lib/svg-icons.ts`). At most 8.
- Social accounts: add the full address to `sameAs` in `site/config/site.json`, for example `"https://x.com/yourname"`. X gets the X logo; another site shows its host name. The same list feeds the `sameAs` in the schema.
- A bad address or an unknown icon name stops `npm run build` with a message that names the file.

## Title match and lifetime redirects (v0.51.0, Phase 4 part 14)
Finds posts that have the exact same title on the old Blogger blog and on this site, and keeps the pairs for life (PLAN 32). Nothing is on until you run it: `config/title-redirects.json` starts as `[]`.
```
cd site
node scripts/title-match.mjs --dry     # read the lists, write nothing
node scripts/title-match.mjs           # write config/title-redirects.json and blogger/redirect-snippet.html
```
Set `SITE_URL` to `https://www.shivam-das.online` (and `OLD_BLOG` only if the blog name changes). Offline: `--old old.json --new new.json`. The entries become real 301s in `_redirects` on the next build. Paste `blogger/redirect-snippet.html` as the first thing inside `<head>` of the Blogger theme (Blogger cannot send a 301). The workflow `title-match.yml` repeats this every day and commits a change. Read the lists: near matches, ambiguous titles and one-sided posts are never redirected.

## Auto language and location schema (v0.70.0)
Every post gets `inLanguage` and, when a place is found, `contentLocation` and `locationCreated` in its JSON-LD. Nothing to type.
- **Language:** from `locale` in `config/site.json` (`en_US` gives `en-US`).
- **Place, automatic:** from a dateline at the start of the text (`KOLKATA — ...`), then the title, the tags and the first 300 words. All countries are known. Add cities and states in `config/locations.json`, for example `{ "name": "Kolkata", "type": "City", "country": "IN", "aliases": ["Calcutta"] }` (it ships empty).
- **Place, by hand:** in a post's front matter, `location: ["Kolkata", "India"]` (up to 3 names) overrides the automatic result. `location: ["none"]` writes no place.
- Rules and limits: PLAN Section 36 and LOGICS Section 24. Code: `src/lib/geo-schema.ts`. Tests: `tests/unit/geo-schema.test.ts`.

## Trap link rules (v0.89.0, bot protection Part 7a)
`workers/trap/lib.js` holds the rules of the trap link (BOT_PROTECTION section 9) as plain functions. It is NOT connected to anything yet: no Worker, no route, no link on any page, no `robots.txt` line, no secret. Tests: `tests/unit/trap-lib.test.ts` (18).

- `isTrapRequest`: only GET or HEAD to exactly `/trap/`.
- `decideTrapHit`: `block` for an ordinary client; `ignore` for a bad address, a reserved address (private, loopback, link-local, shared, documentation, multicast) and the owner's own addresses; `record` (never block) for a client whose name says it is Googlebot, Bingbot or another well known bot, because a name can be faked and a real bot may follow a link once.
- `blockItem`: the Cloudflare list item, with the comment `sdn-trap until=<time> seen=<time>` (24 hours by default). `expiredItemIds` returns only items with that mark whose time is over, so the owner's own list entries and broken comments are never deleted. Cloudflare list items have no timer of their own: a later clean-up job must delete them with these ids.
- `addRequest` and `deleteRequest`: only the text of the two Cloudflare calls (`POST` appends items, `DELETE` removes items by id) for `/accounts/{account}/rules/lists/{list}/items`. Both ids must be 32 letters or numbers. Nothing is sent. Cloudflare allows one pending bulk operation per account, so a later Worker must send these calls one after the other.
- Our own limits: 1000 items of ours in the list and 100 items per call.
- Decision 6 of BOT_PROTECTION (trap link: yes or later) is still open. A hidden link is a risk for Google News; read the note in BOT_PROTECTION 17 (7c) before it is added to any page.

## Trap Worker (v0.90.0, bot protection Part 7b)
`workers/trap/index.js` is the Worker for the trap link rules above. It is NOT connected: `TRAP_ENABLED` is `"false"` in `workers/trap/wrangler.toml`, there is no route, no secret and no link on any page. Tests: `tests/unit/trap-worker.test.ts` (24, with a fake Cloudflare).

- It answers only `/trap/`, and always with the same plain 404 and `noindex`, whatever happened inside.
- Kill switch: the trap works only when `TRAP_ENABLED` is exactly `true`. Change it in the Cloudflare dashboard, no deploy needed.
- A hit from an ordinary client: read the list, skip an address already in it, keep our limit of 1000 items, add one item for `BLOCK_HOURS` (24 by default). The calls go one after the other; one add call every 5 seconds and the same address once in 10 minutes per Worker instance.
- Never blocked: own addresses (`OWN_IPS`), reserved addresses, and clients that name themselves Googlebot, Bingbot and the other well known bots (only recorded).
- Clean-up: an hourly job deletes only our own expired items (up to 500 a run), also when the switch is off. The owner's own list entries are never touched.
- Needs from the owner: an IP list and the WAF rule that blocks it, an API token with only "Account Filter Lists: Edit" (`npx wrangler secret put CF_API_TOKEN`), `CF_ACCOUNT_ID` and `CF_LIST_ID` in `wrangler.toml`, and the route. Put your own address in `OWN_IPS` first.
- Logs hold a short reason word only: no address, no user agent, no token.
- Honest limit: the Cloudflare read call was written from memory and not tried on an account. Check it once before the first real use.

## Security screen rules (v0.91.0, bot protection Part 8a)
`site/public/admin/js/security.js` holds the rules and the drawing of the future Security screen. It is NOT connected: nothing in `app.js` imports it, so the dashboard is unchanged. Tests: `tests/unit/security-rules.test.ts` (21).

- `shareLevel(views, verified)`: a level and one plain sentence with the real numbers. `none` (no views), `unknown` (no verified count from the Worker), `few` (under 50 views: too few to judge), `ok` (under 30 percent unverified), `watch` (30 percent or more), `high` (60 percent or more). The limits are a first proposal; change them after a week of real numbers.
- `securitySummary(h24, d7)` and `worstLevel`: the last 24 hours and the last 7 days together; the more serious level wins.
- `DAILY_CHECKS` and `WEEKLY_CHECKS`: the review lists of BOT_PROTECTION Section 13 as plain text. `isDue(lastDoneMs, nowMs, days)`: when a list is due again.
- It cannot show Cloudflare challenges or blocks: the dashboard has no safe way to read them (a Cloudflare token must never sit in the browser). The screen (8b) will link to the Cloudflare Security Events page instead.
- v0.92.0 (Part 8b-1): `renderSecurity(h, view)` draws the screen with the dashboard helper `h`: two level cards, a red note for `watch` and `high`, a plain notice when the numbers could not be read, the lists with a "Mark done" button, and ONE outside link (the start page of Cloudflare). `readLastDone`, `markDone`, `writeLastDone` and `reviewLists` keep the "last done" times as text (the file never touches storage). Decision: the times will be kept in the browser only (`localStorage`, key `adm.security.lastDone`). The wiring into `app.js` (route `#/security`, menu entry, the two analytics calls) is 8b-2 and needs a real jsdom test run.
- v0.93.0 (Part 8b-2): the screen is in the dashboard: menu entry "Security" and the address `#/security`, admin only (the `analytics` permission). It calls the analytics Worker twice (`range=24h` and `range=7d`) with the same address and sign-in token as the Analytics screen, only when you open it or press Refresh (no timer). Without an analytics address it says so and still shows the two lists. "Mark done" saves the time in this browser only (`localStorage`, in try/catch). Tests: `tests/unit/admin-security.test.ts` (8 jsdom tests, written but not run when this version was made: run `npm test` first).

## Push announce job (v0.94.0, Phase 9 part 7d)
`.github/workflows/push.yml` runs `site/scripts/push-announce.mjs`. It sends the posts that went live in the last 2 hours to the push Worker (`POST /announce`, header `X-Announce-Secret`). It runs after a push to `main` (after a 120 second wait), every hour at minute 35 and by hand. Tests: `tests/unit/push-announce-script.test.ts` (23).

- It reads every `content/blogs` file, keeps the published ones dated within 120 minutes (no emoji, not `noindex`, `push` not `off`), sorts them newest first and sends at most 25. The key of a post is its permalink, so the Worker never sends the same post twice.
- A page that is not live yet is asked again (4 tries, 90 seconds apart); only `not_live` and `check_failed` are asked again. A 401, 413 or 500 stops at once with an error. A 503 or a missing setting ends well.
- Needs three GitHub secrets: `SITE_URL`, `PUSH_ENDPOINT` (the push Worker address) and `PUSH_ANNOUNCE_SECRET` (32 characters or more, the same text as `ANNOUNCE_SECRET` on the Worker). Without them it prints what is missing and does nothing.
- Look first, send nothing: in `site/` run `node scripts/push-announce.mjs --dry` (add `SITE_URL=https://your-site`). It prints the keys only.
- The log never holds the secret or a post text, only keys, statuses and reason words.
- The `push`, `pushTitle` and `pushBody` fields are read when a post has them (the editor box came in v0.96.0); a post without them is `auto`.

## Push fields in the post model (v0.95.0, Phase 9 part 7e-1)
A post file can have three optional fields (PLAN 31.5): `push: "auto"` (default; `off` never notifies, `force` skips only the importance part, never the reader's rules), `pushTitle` (up to 70 characters) and `pushBody` (up to 120 characters), which replace the headline and the description in the notification. Tests: `tests/unit/push-fields.test.ts` (11).

- The build (`src/content.config.ts`) and the dashboard check (`public/admin/js/validate.js`) use the same limits as the Worker and refuse an emoji in the notification text. The copyright, registered and trade mark signs are fine. The limits also hold for drafts.
- The dashboard writes the fields after `trending`; empty ones are not written. The announce job (`scripts/push-announce.mjs`) reads them.
- The editor controls came in v0.96.0 (part 7e-2, next section).

## Notifications box in the editor (v0.96.0, Phase 9 part 7e-2)
In the post editor, under Details, the box **Notifications** has: "Notify readers" (Auto, Off, Force), "Notification title" (up to 70 characters, empty means the headline) and "Notification text" (up to 120 characters, empty means the description), each with a counter. The side column shows "Notification preview": exactly the text the Worker will cut and send (same word-boundary cut as `cutText` in `workers/push/lib.js`).
- `auto` and empty texts are never written to the post file (`cleanPush` in `public/admin/js/push-fields.js`), so normal posts do not change.
- The limits and the emoji rule are checked at save by `validate.js` (v0.95.0); an error stops the save with a clear line.
- Force still obeys every reader's choices. The note under the choice says when Force or Off has no use (a draft, a noindex page).
- Tests: `tests/unit/push-editor.test.ts` (17, 6 of them jsdom tests on the real dashboard).

## Push feedback (v0.98.0, Phase 9 part 8a)
The push Worker answers `POST /feedback { sub, token, event, tag }` from the service worker. `event` is `open`, `close` or `less`; `tag` is the story thread key. The Worker finds the category from its own `push_sent` and `push_posts` rows for that reader and moves one learned weight: open +10 percent of the way to 1 (engagement +1), close -0.04, less -0.25, always between -1 and 1. The reader's own choices are never removed.
- Deploy the push Worker again: `cd workers/push ; npx wrangler deploy`. No migration, no new variable or secret.
- Unknown event, empty tag, the test tag, or a story never sent to this reader: answer 200 `{ ok: true, applied: false }`, nothing changes.
- The weekly fade (v0.99.0, part 8b): in the hourly clean-up tick all weights are multiplied by 0.95 to the power of 1/168 (5 percent a week); a weight under 0.005 is removed. Deploy the push Worker again; no migration.
- "Less like this" count (v0.100.0, part 8c-1): each tap is also written to `push_less` (category and time, kept 30 days, at most 20 rows for one reader and category). `POST /preferences` (read) then adds `suggestRemove: [{ category, count }]` for a followed category with 3 or more taps in 30 days. **Run once: `cd workers/push ; npx wrangler d1 execute <database-name> --remote --file=migrate-0.100.0.sql`, then deploy the push Worker again.** Safe to run again. Without the table everything else still works.
- The offer on the page (v0.101.0, part 8c-2): `/notifications/` shows "You tapped Less like this for Sports 3 times. Remove Sports?" with the button "Remove Sports" for each category with 3 or more counted taps that the reader still follows. One tap saves only that change; the site never removes a choice by itself, and the last choice cannot be removed this way. Saving choices without a category deletes its counted taps. **Deploy the push Worker again** (`npx wrangler deploy`); no migration.
- Not yet built: the adaptive limit and the pause after no opens (part 8d and later).
- Tests: `tests/unit/push-feedback.test.ts` (18) `tests/unit/push-fade.test.ts` (16) `tests/unit/push-less.test.ts` (18), `tests/unit/push-less-clear.test.ts` (11) and `tests/unit/notifications-offer.test.ts` (21).

## Analytics: the source "Push notification" (v0.97.0, Phase 9 part 7e-3)
The link in a push notification ends with `?pn=1`. When the page address has `pn=1`, the beacon (`src/lib/beacon-client.js`) adds the optional number `pn: 1` to its message. The analytics Worker then stores the reserved source `(push)` for that visit (`PUSH_SOURCE` in `workers/analytics/lib.js`) and the lists show it as **Push notification**, in the Analytics screen (Traffic sources) and in the red note per source of the Security screen.
- Only the number 1 counts. Look-alikes (`?pn=10`, `?xpn=1`, `?PN=1`, `pn` as text) are not a push visit.
- No database change. Old rows keep their old source. Deploy the analytics Worker before the site build: an old Worker refuses the new field.
- The page path stored in the data never has the query part.
- Anyone can type `?pn=1`, so the number is a measure, not a proof.
- Tests: `tests/unit/analytics-push-source.test.ts` (14) and 4 tests in `tests/unit/beacon.test.ts`.

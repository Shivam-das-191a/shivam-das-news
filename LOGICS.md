# LOGICS.md: Core Rules and Algorithms

Plain pseudocode for the important systems. Names are examples; implement in TypeScript.

## 1. Slug / Permalink
```
slug(title):
  lower-case, strip accents, remove stop words (the, a, an, of, to, in)
  replace non [a-z0-9] with "-", collapse repeats, trim "-"
  cut to 60 chars at a word boundary
  if slug exists site-wide: append "-2", "-3"...
```

## 2. URL Builder
```
postUrl(post)  = "/" + YYYY + "/" + MM + "/" + DD + "/blogs/" + category.slug + "/" + post.slug + "/"
pageUrl(page)  = "/" + YYYY + "/" + MM + "/" + DD + "/pages/" + page.slug + "/"
ampUrl(url)    = url + "amp/"
```
Date = first publish date in the site time zone, locked after publish.

## 3. Redirect Resolution
```
on save(post):
  newUrl = postUrl(post)
  if post.lastUrl exists and post.lastUrl != newUrl:
      post.redirects.add(post.lastUrl)
  post.lastUrl = newUrl

at build:
  map = all (oldUrl -> currentUrl)
  for each oldUrl: follow to final URL (max 10 hops) -> store oldUrl -> final
  drop entries where oldUrl is a live URL (prevents loops)
  emit _redirects (301) and stub pages as fallback
  also emit the same for oldUrl + "amp/"
```

## 4. Auto Internal Linking
```
phrases = titles + focus keywords + tags + category names + manual map
sort phrases by length desc
for each post body paragraph (skip headings, code, existing links, first paragraph optional):
   for phrase in phrases:
      if phrase found as a whole word and target != self and target not yet linked in this post:
          link first occurrence; count++
      stop when count == limit (about 1 link per 250 words, max 5)
prefer targets: same category > shared tags > newer > higher traffic
```

## 5. Related Posts Score
```
score = 3*sharedTags + 2*sameCategory + 2*keywordOverlap + recencyBoost + 0.5*popularity
top 4 to 6, never the same post, no duplicates of the auto links already used
```

## 6. Trending Score
```
trending = (views_24h * 1.0 + views_1h * 3.0) * (0.5 + readTimeFactor) / (1 + ageHours/24)
readTimeFactor = min(avgReadSeconds / 60, 1)
```

## 7. Geo Ad Decision
```
visitorCountry = fetch("/geo")  (edge header, never cached per user)
if fail or timeout: ads = OFF (configurable)
if country in blockList (IN): adsterra = OFF
else: adsterra = ON (per-format switches apply)
if page excluded (legal/contact/policy) or post.ads.hideAll: OFF
popunder: only if sessionViews >= 2 and not shownThisSession
load scripts after idle or first interaction
```

## 8. News Sitemap
```
include post if status == published and type == news and now - publishedAt <= 48h
max 1000 URLs; fields: publication name, language "en", publication_date, title
rebuild hourly (cron)
```

## 9. Read Time and Engagement
```
estimated = ceil(words / 220) minutes
measured: add 1 second per second while tab visible AND user active in last 30 s
send on pagehide with sendBeacon; include max scroll depth
```

## 10. Analytics Rollup
```
raw events -> hourly rollup (every hour) -> daily rollup (midnight UTC)
live (5 min)  = raw events
1 h, 24 h     = raw + hourly
7 days        = hourly/daily
lifetime      = daily totals
delete raw events older than 7 days
```

## 11. Category Page with Lifetime Posts
```
posts = all published posts where category == X, sorted by date desc
paginate 20 per page: /category/x/, /category/x/page/2/
page 2+ has self canonical and links to prev/next
```

## 12. Scheduled Publishing
```
cron every 10 minutes:
  find posts with status "scheduled" and publishAt <= now
  set "published", rebuild, ping IndexNow
```

## 13. Pre-publish Gate
```
required: title, permalink, category, featured image (>=1200 px), alt text,
          meta description (50 to 160 chars), author, one H1 only, valid heading order
warn: no internal links, under 300 words, clickbait title, duplicate title
```

## 14. Chat Routing
```
visitor opens chat -> creates conversation id
message -> Worker validates (Turnstile, rate limit) -> store -> push to admin inbox
admin reply -> store -> push to visitor
admin offline -> show message form, email admin
```

## 15. XML Import
```
parse XML -> items (posts, pages)
map: title, content, published date, labels(first -> category, rest -> tags), author, images
download images, rewrite paths, sanitize HTML
build old Blogger URL -> new URL redirect
preview -> confirm -> commit as Markdown
```

## 16. Hard Rule: Ads Only on Article Pages
```
loadAds(page):
  if page.type != "article": return          // home, category, tag, author, search, pages, 404
  run Geo Ad Decision (Section 7)
build check: fail if any non-article HTML contains an ad script, ad slot or ad network domain
```

## 17. Category Auto-Detect (Active Categories Only)
```
windowDays = 7
active(category) = exists post where post.category == category
                   and post.status == "published"
                   and post.publishedAt >= now - windowDays
menuCategories = categories where active == true (respect admin "always show/hide")
home sections, footer, widgets use the same list
inactive categories: not in menus, not on home; stay reachable by URL and by search
search index: includes ALL categories and posts
rebuild trigger: every publish + scheduled build every 6 hours
```

## 18. Hard Rule: No Emojis, SVG Icons Only
```
icon(name):  look name up in svg-icons (24 x 24, currentColor, aria-hidden); unknown name: stop the build
build check: for every built HTML page:
               text = page with numeric and symbol entities turned into characters (a number code becomes the character)
               if text has a pictograph, emoji selector, keycap mark or flag: fail with file name and code point
test check:  templates, scripts, dashboard, design preview, config, plan files:
               fail on any emoji, and (templates and scripts only) on arrows, shapes and dingbats used as icons
allowed:     copyright, registered, trade mark signs, quotes, dashes, middle dot, rupee sign, every script (joiners next to Bengali letters are fine)
```

## 19. Push Notifications: Matching, Scoring and Delivery (PLAN 31)
Plain pseudocode. Every constant sits in `workers/push/lib.js` and is tested.
```
CONSTANTS
  MAX_AGE_MIN = 120          IMPORT_GUARD = 3 (posts per announce)   IMPORT_KEEP = 2
  LEVEL_MIN   = { breaking_only: breaking required, important: 65, balanced: 48, everything: 30 }
  LEVEL_CAP   = { important: 2, balanced: 4, everything: 8 }          (the reader may choose 1, 2, 4 or 8)
  MIN_GAP_MIN = 30           EXTRA_BREAKING = 2   EXTRA_HIGH = 1 (score >= 90)
  TTL_SEC     = { breaking: 7200, normal: 21600, digest: 43200 }
  MAX_TERMS   = 10 follow keywords, 10 muted keywords       MIN_FOLLOWERS_REPORT = 5

tokens(text):                                  // English only
  lower-case, remove accents, split on anything that is not a letter or digit
  drop stop words (the, a, an, of, to, in, on, for, and, ...)
  light stem: words longer than 4 letters lose a final "es", "s", "ing" or "ed" (never below 3 letters)

cleanKeyword(input):                           // used on the page AND in the Worker
  t = tokens(input)
  refuse if: no token, token count > 4, any token shorter than 3 letters (unless it is an upper-case acronym like "UN"), total length > 40,
             characters other than letters, digits, space, hyphen, apostrophe,
             only common words (news, today, latest, india, world, update ...)
  return t.join(" ")

postFields(post):  title, focus, tags, description, bodyStart (first 300 words), category, author  -> each as token lists

phraseIn(phrase, tokenList):  true when the phrase tokens appear next to each other in that order

keywordHit(phrase, post):
  if phraseIn(phrase, post.title)                         return 1.00
  if phraseIn(phrase, post.focus) or in post.tags         return 0.90
  if phraseIn(phrase, post.description)                   return 0.60
  if phrase has 2+ tokens and every token is in title+tags+description (any order)   return 0.50
  if phraseIn(phrase, post.bodyStart)                     return 0.35
  return 0

STEP 1: may this post be pushed?                     (announce)
  require: post key never announced before   (unique key = permalink or any key in its redirect history)
           live check: GET url -> 200, robots allow index
           age = now - publishedAt;  age <= MAX_AGE_MIN
           status published, not archived, not sponsored, push != "off"
           no emoji in title/description/pushTitle/pushBody
  if announce has more than IMPORT_GUARD posts:
       keep the IMPORT_KEEP posts with the highest importance(post); keep any with push == "force"; skip the rest
  importance(post):  breaking 25 | push == "force" 25 | featured 12 | in trending top 5 (last 24 h) 10 | else 0
  save post summary in push_posts (kept 3 days, used for digests)

STEP 2: candidates (no full scan)
  S = subscribers in category list [post.category]
    + subscribers in keyword index for any token of title, tags, focus, description (verify with keywordHit later)
    + subscribers in author list [post.author]
    + if post.breaking: subscribers with breaking_all = true
  remove: paused (paused_until > now), status != active, failures >= 5

STEP 3: score each candidate s
  // 3a hard blocks
  for each muted phrase m of s:  if keywordHit(m, post) >= 0.60 on title, tags or focus:  SKIP s
  // 3b explicit choices
  cat    = 1 if post.category in s.categories else 0
  kw     = best keywordHit over s.keywords;  extra = min(0.30, 0.15 * (number of OTHER keywords with hit >= 0.50))
  kwScore= min(1, kw + extra)
  auth   = 1 if post.author in s.authors else 0
  explicit = min(1, 0.60*cat + 0.80*kwScore + 0.40*auth)         // 0..1
  breakingAny = post.breaking and s.breaking_all
  if explicit == 0 and not breakingAny:  SKIP s                    // the gate: no invented interests
  // 3c the other parts
  implicit  = rank of post.category in s.topCategories:  1st 1.0, 2nd 0.6, 3rd 0.3, else 0     (only if s.learn_on)
  affinity  = s.weight[post.category]  in -1..+1                                                    (learned, 31.8)
  fresh     = max(0, 1 - ageMinutes / 120)
  fatigue   = min(20, 5 * (notifications sent to s in last 3 hours)) + (10 if same category sent in last 60 min)   // so it can reach 30 (PLAN 31.6 says "down to minus 20": the pseudocode wins, v0.50.0)
  score = 60*explicit + 8*implicit + 10*affinity + importance(post) + 7*fresh - fatigue
  score = clamp(score, 0, 100)
  // 3d level
  if s.level == breaking_only:  require post.breaking, else SKIP
  else if breakingAny and explicit == 0:  PASS   // v0.50.0: a breaking story for a reader who asked for "breaking news from any category" is not held back by a number (without a category match its own score is at most about 50, below the Balanced and Important lines)
  else require score >= LEVEL_MIN[s.level]

STEP 4: delivery rules for each remaining s (in this order)
  thread = post.focus normalized, or the two most common tags joined       // story key
  update = s was sent the same thread in the last 12 hours                  // replaces, does not count
  local  = now converted to s.tz (the zone NAME is stored, so daylight saving is right)
  if local is inside s.quiet:
        if post.breaking and s.breaking_in_quiet:  continue
        else hold(s, post, score) up to 5 items for 6 h;  SKIP now
  cap = s.dailyLimit + (EXTRA_BREAKING if post.breaking) + (EXTRA_HIGH if score >= 90)
  if not update:
        if s.sent_today >= cap:                       SKIP (drop; digest may still show it)
        if now - s.last_sent < MIN_GAP_MIN and not post.breaking:   hold or SKIP (same as quiet)
  if s.digest_mode is on and not post.breaking and not update:   hold for the next digest; SKIP now
  queue(s, post, score, thread, ttl = post.breaking ? TTL.breaking : TTL.normal, urgency = post.breaking ? high : normal)

STEP 5: send (cron every minute, batch of 40 on the free plan)
  take up to 40 queued rows ordered by (breaking first, higher score, older first)
  for each: build payload { title, body, url + "?pn=1", tag = thread, image, breaking }  (text cut so the encrypted payload stays under 4,000 bytes)
            encrypt (aes128gcm), sign (VAPID), POST to the subscriber's push service with TTL, Urgency, Topic = short hash of thread
            201 -> mark sent; s.sent_today += (update ? 0 : 1); s.last_sent = now; write one compact "sent" row (duplicate guard)
            404 or 410 -> delete subscriber and their terms
            429 -> stop the batch, wait for Retry-After
            other error -> retry up to 2 times, then s.failures += 1 (5 in a row pauses s)
  drop queued rows older than their TTL

STEP 6: digest (cron, every 15 minutes)
  for each s whose local time just reached a digest hour (not yet sent today):
      items = held items + posts from push_posts (last 12 h) that pass STEP 3 for s and were not sent to s
      take the best 3 by score; if none: send nothing
      one notification: title "N stories for you", body = the first headline, url = the address of the first story, tag "digest"

STEP 7: feedback (service worker -> POST /feedback with the manage token)
  event opened:        s.weight[cat] += 0.10 * (1 - s.weight[cat]);   s.engagement = 0.9*s.engagement + 0.1
  event closed:        s.weight[cat] -= 0.04;                          s.engagement = 0.9*s.engagement
  event less_like_this s.weight[cat] -= 0.25;  count it; after 3 in 30 days for one category: only SHOW a hint on the preference page
  weights are kept between -1 and +1;  every week every weight moves 5 percent back to 0
  adaptive limit: after >= 20 sent and opened/sent < 0.05: dailyLimit = max(1, floor(dailyLimit / 2)) and offer the digest
  pause: >= 60 sent or 45 days with no open -> status paused;  no visit for 90 days -> delete

STEP 8: cleanup (daily cron)
  delete sent rows older than 30 days, push_posts older than 3 days, expired held rows, subscribers past retention
```
Checks the tests must cover: the same post announced twice sends once; a muted word blocks even a breaking post for that reader; a post with no explicit match is never sent (except breaking to "any category" readers); an import of 50 posts sends at most 2; quiet hours across midnight and across a daylight saving change; a reader's limit and the extra breaking slots; a story update replaces and does not use a slot; 404 and 410 delete the subscriber; the payload stays under 4,000 bytes with the longest allowed title and body; no emoji reaches the payload; the keyword index returns a subscriber for a stemmed word ("launches" finds "launch").

## 20. Title Match and Lifetime Redirects (PLAN 32)
```
strictKey(t) = decode entities once -> NFC -> drop zero-width and invisible marks -> non-breaking and wide spaces become " " -> collapse spaces -> trim
               (case, punctuation, quote style and every letter are kept)
looseKey(t)  = strictKey -> NFKD, drop accents -> lower-case -> curly quotes straight -> punctuation to space   (reports only)

oldPathOf(url): host must be <blog>.blogspot.<country form>; path must be /YYYY/MM/slug.html or /p/slug.html; query and hash dropped; else null

match(oldPosts, newPosts):
  group both lists by strictKey
  key on both sides, exactly 1 and 1  -> pair (old path -> new address)
  key on both sides, more than 1      -> ambiguous (skipped, listed)
  key on one side only                -> onlyOld / onlyNew (no redirect)
  onlyOld title with the same looseKey as an onlyNew title -> near match (listed, no redirect)

mergeLifetime(stored, pairs, today):          // append only
  for each pair:
    not stored                                -> add {from, to, title, since: today}
    stored, same target                       -> nothing
    stored, target is an earlier address of the same new post (its redirects list) -> move `to` to the current address
    stored, any other target                  -> keep, report a conflict
  stored entries that are not in pairs stay untouched

checkEntries: from is an old Blogger address; to starts with "/", is not "//", has no space, "*", ":", "?" or "#"; else the script writes nothing

build: entries go into the normal redirect builder after the post lists and the hand-made list
       (chain collapse, loop guard, live target, 2000 lines). A dead target is dropped for that build; the stored entry stays.
Blogger side: the snippet maps old path -> new path, adds the fixed canonical origin itself and calls location.replace
```
Checks the tests must cover: exact titles pair; entity and space differences pair; one letter, case or quote difference does not; a title used twice pairs nothing; one-sided posts get no redirect; country hosts and "?m=1" are read; a lookalike host is refused; a stored entry survives when its pair is gone; the same post at a new address moves the entry; a different post is a conflict; a full address or "//host" as a target is refused; the snippet redirects a mapped path and ignores any other.


## 21. Search Engine Listing and File Editor (PLAN 33)
```
listing(post):                                   (pure, same functions as src/lib/seo.ts)
  title       = post.metaTitle  or  post.title + " | " + site.name
  description = post.description  or  plainText(post.summary or first paragraph) cut to 155 at a word end
  handle      = post.permalink  or  slug(post.title)
  shown       = { title: cut(title, 60), description: cut(description, 160), url: origin + path(post) }
  auto flags  = which of the three came from the fallback (shown as "auto")

limits:   title warn > 60, stop > 70;  description warn > 160, stop > 320;  handle: [a-z0-9-]+, 1 to 120 characters
hard errors (block publish): empty title, handle already used in the same category and date, emoji in title or description, featured image under 1200 px
everything else is a warning

changeHandle(post, newHandle):
  if post is published for more than 24 hours  -> redirect old URL to new URL is required (feeds the redirect builder, chain collapse, loop guard)
  if post is younger                           -> redirect on by default, may be switched off
  the handle can never be an empty text or the handle of another live post

hideFromSearch(post, on):   robots = "noindex,follow";  excluded from sitemaps, news sitemap, push announce (reason noindex)

media file rename(old, new):  write redirect old -> new, rewrite references in posts, config/media.json key moves, one commit; stop if any step fails
media delete(file):           refused while "Used in" is not empty
alt text:                     post.imageAlt wins over config/media.json for the featured image; both cut at 125 for the check
```
Checks the tests must cover: every fallback (title, description, handle), the cut at a word end, every limit edge (60, 61, 70, 71, 160, 161, 320, 321), the handle rule, a handle change on an old and a young post, noindex excludes from the sitemap, emoji refused, rename keeps the old address, delete refused while used, alt text priority.


## 22. Auto Image Hosting (PLAN 34)
```
findExternal(post):   markdown images, <img src>, <img srcset>, front matter image and ogImage
                      keep only https/http addresses whose host is not ours and not a data: address; each address once, in order

safeToFetch(url):     scheme https, port 443 or none, no user:password, host is a name or a public IP
                      refuse: localhost, *.local, *.internal, private and link-local IP ranges, a name that resolves to one
                      redirects: at most 3, every hop passes safeToFetch again

fetchImage(url):      limits 10 MB, 5 s idle, 15 s total; retry once without referrer on 403
                      accept only if the first bytes are JPEG, PNG, WebP, AVIF or GIF (SVG refused); else reason "not_image"

host(post):
  for each url in findExternal(post):
     if host is on the agency list and not confirmed              -> result "needs_confirm"
     if config/media.json has sourceUrl == url or sha256 == hash  -> reuse the file, no new write
     bytes = fetchImage(url)  (failure -> result "failed", reason word, the reference stays unchanged)
     out   = optimize(bytes)  (WebP, width <= 2400, quality 85, no EXIF; GIF <= 5 MB stays GIF)
     name  = seoName(img, post);  path = public/media/YYYY/MM/ + name   (YYYY/MM from post.date)
  write all files + changed post + config/media.json in ONE commit; if any write fails, nothing is committed

seoName(img, post):
  source text = first non-empty of: img.alt, img.caption, nearest heading, post.focusKeyword + post.title words, meaningful old file name
  words = lower case ASCII words of the text, accents removed, stop words dropped, first 6, max 60 characters
  reject camera or random names (IMG_/DSC/PXL_/Screenshot/untitled/download/hash/long number)
  if fewer than 3 words: add words from the post title, then fall back to post.handle + "-image-" + n
  if the path is taken (a different picture): add -2, -3 ...

autoAlt(img, post):   if alt is empty: caption, else nearest heading, else post title; mark autoAlt = true
attributes:           width and height always; loading=lazy except the first picture (fetchpriority=high); srcset 480, 800, 1200, 1600 when wide enough
```
Checks the tests must cover: every place an outside picture can be found; our own and `data:` addresses skipped; every refused address (http, port, credentials, localhost, private ranges, a redirect to a private address, a fourth redirect); size, time and byte checks (a text file named `.jpg`, an SVG); the same picture twice, and the same address met again; every naming step and the rejected camera names, the 3 to 6 word rule, the 60 character cut, the duplicate number; the path uses the post date; one commit or nothing; a 404 leaves the post unchanged; the agency host asks first; auto alt is marked; no emoji in any name or text.


## 23. AI Operator Checks (PLAN 35)
```
checkPost(file):    parse front matter with the same Zod schema as src/content.config.ts
                    status in [draft, scheduled, published, archived];  "scheduled" -> warn: use published with a future date
                    published -> image and imageAlt present, description 50 to 160 characters, image file exists in public/
                    permalink unique across all posts;  category and permalink are slugs
                    headings: first body heading H2, no skipped level
                    no emoji;  date has a time zone offset
                    if the file existed on main and (date, category or permalink) changed and status was published
                         -> the old address must be in redirects, else error
checkRedirects():   array of { from, to }; both normalized paths; from is not a live page; no duplicate from; at most 2000
checkJson(file):    valid JSON; every key of the previous version still present
secretScan():       reject text that looks like a token or key (ghp_, github_pat_, sk-, -----BEGIN, a 64 hex string in a config value)
```
Checks the tests must cover: each rule above with a passing and a failing file, the schedule warning, the address change with and without the redirect, a removed JSON key, a token-like string.

## 24. Auto Language and Location Schema (PLAN 36)
```
langTag(locale):  "en_US" -> "en-US" | "en_gb" -> "en-GB" | "en" -> "en" | unusable or empty -> "en"
inLanguage = langTag(site.locale)  on every schema block

detectLocations(post, ownerList):
  if location == ["none"]            -> no place, source none
  dateline = first line of body matches  CITY[, extra] [(agency)] <long dash>   (long dash only: em dash, en dash or --)
  created  = dateline city (title case), skipped for Breaking, Update, Exclusive, Live, Watch, Opinion, Analysis
  if location has names              -> those names (max 3), source manual; created still set
  else for each known place (owner list + all countries + short names):
         score = 3 if the title has it (whole word, case sensitive)
               + 2 for each tag equal to it
               + 1 for each mention in the first 300 words (max 3)
               + 3 if it is the dateline city
         ambiguous names (Georgia, Jordan, Chad, Turkey, Niger, Guinea, Mali, Nauru): only tags count (3 each)
         keep score >= 3
       sort by score, then name; keep 3; put the dateline city first if it was not found
       source: text (or dateline when only the dateline gave a place); none if empty
placeLd(place): Country -> {Country, name} | State -> AdministrativeArea | City -> City | other -> Place
                a city or state with a country code gets address.addressCountry
article(): contentLocation (object for 1, list for 2 to 3), locationCreated; both dropped when empty
```
Checks the tests must cover: every locale form, the shouted headline that is not a dateline, a passing mention that is not enough, a tag plus one mention that is enough, an ambiguous name, whole words only (Indiana is not India), an owner alias, the manual list and `["none"]`, the limit of 3, broken owner entries, and no place field when nothing is found.

## 25. Direct Code Writing Rules (PLAN 37; plan only, nothing built yet)

### 25.1 The sanitizer (HTML block)
1. Parse the code into a tree (never use string replace).
2. Keep only allowed tags: h2 to h6, p, br, hr, ul, ol, li, table and its parts, figure, figcaption, img, a, strong, em, b, i, u, s, small, mark, sup, sub, blockquote, q, code, pre, kbd, details, summary, span, div, audio, video, source, and iframe from an allowed host.
3. Keep only allowed attributes: `class`, `id` (checked for a clash with the site), `style` (see 4), `href`, `src`, `srcset`, `alt`, `title`, `width`, `height`, `loading`, `target` (then `rel="noopener noreferrer"` is added), `colspan`, `rowspan`, `controls`, `poster`, `lang`, `dir`, `aria-*`, `data-*`.
4. `style` values are cut to a safe list of properties (colour, background, margin, padding, border, font, text, display up to flex and grid, width, height, gap). No `position: fixed`, no `url()` that is not our own, no `expression`, no `behavior`.
5. Addresses: only `https:`, `mailto:`, `tel:`, a site path and an in-page `#`. Everything else (`javascript:`, `data:` except a small picture, `vbscript:`) is removed.
6. Pictures from another host are queued for hosting (PLAN 34).
7. The result and a list of what was removed are returned. The dashboard shows the list in plain words. The build runs the same function again and fails if the result differs from the saved text (the file was edited by hand).

### 25.2 The marker
An HTML block is a line with three colons and `html`, the code, and a line with three colons. It cannot be nested. A block that is not closed fails the build with the line number.

### 25.3 Page CSS scope
Every rule is placed under the post scope class. A rule for `body`, `html`, `:root`, `header`, `footer`, `nav` or an ad slot class is dropped. `@media` and `@supports` are kept, `@import`, `@font-face` with an outside url and `@namespace` are dropped.

### 25.4 Page JavaScript
Wrapped as an immediately called function with a try and catch. An address in `src` must be on the script host list. No ad network address, no `document.write`, no `eval`, no `new Function` (checked by the build; a script that needs them is refused with the reason). The hash is written to `_headers` for the page path.

### 25.5 Roles
The build reads the author of the commit that last changed the file and the roles file. Page JavaScript from anyone but an admin fails the build. HTML blocks and Page CSS from an author fail the build.

### 25.6 What counts as text
Code blocks, HTML blocks, Page CSS and Page JavaScript are not text: they are not counted in the word count and the read time, not linked automatically, not used in the auto description, and not read to the SEO score.

### 25.7 Done When
`tests/unit/custom-code.test.ts` (planned) holds the table of bad inputs for 25.1, the scope tests for 25.3, the host list tests for 25.4 and the role tests for 25.5.

## 26. Connected Apps Rules (PLAN 38; plan only, nothing built yet)

### 26.1 One rule file for build and API
`workers/shared/content-rules.js` holds every post rule once: front matter fields and types, status rules (published needs image, imageAlt, description 50 to 160), permalink (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 100 characters, unique site-wide), category (same pattern), tags, heading levels (H2 first, none skipped, no H1), no emoji, no ad network address, the picture file must exist. `validate-content.mjs` (Phase 3d) and `workers/api` import it. A rule change is made in one place.

### 26.2 Check order for every request
1. Token present and well formed, else 401. 2. Token found by its SHA-256, not revoked, not expired, app not paused, global pause off, else 401 (the same words for every reason, so nothing leaks). 3. Rate limit, else 429 with `Retry-After`. 4. Scope for this route, else 403 naming the missing scope in plain words. 5. Input shape and size (body at most 200 KB, 2 MB for a picture), else 413 or 422. 6. Path rule (26.3). 7. Content rules (26.1), else 422 with the list of problems. 8. `If-Match` (26.4). 9. If `dry_run`, answer now. 10. Commit. 11. Activity line. The order never changes, so the cheapest refusal comes first.

### 26.3 Path allow list
The Worker builds every file path itself from validated parts (`content/blogs/{category}/{permalink}.md`, `content/authors/{slug}.json`, `config/redirects.json`, `config/categories.json`, `public/media/YYYY/MM/{name}.webp`). It never takes a path from the request. A permalink with a dot, a slash, a backslash, a percent sign or a space is refused before any path is built, so `../` tricks cannot happen. Any path outside the list is refused even if a bug asked for it, by a final check on the finished commit tree.

### 26.4 Versions and conflicts
`version` is the Git blob hash of the file as read. `PATCH`, `PUT` and status changes need `If-Match`. If the hash is not the current one: 412 with `currentVersion` and `currentText`. Create needs no version but is refused (409) if the permalink exists anywhere on the site. The commit itself is made on the head commit just read; if the branch moved before the final update, the Worker reads again once and redoes the change only if the file it touches is unchanged, otherwise it answers 412. It never forces.

### 26.5 Idempotency
`Idempotency-Key` (8 to 64 safe characters) plus the token id plus the route are stored for 24 hours with the answer. The same key and the same body returns the stored answer. The same key with a different body is 422.

### 26.6 Dry run shape
`{ "dryRun": true, "wouldChange": [{ "path": "...", "action": "create|edit|delete", "diff": "first 40 changed lines" }], "problems": [] }`. A dry run makes no commit, is logged as `dry_run`, and does not use the daily write budget.

### 26.7 Delete and archive
Archive sets `status: archived` (the 410 rule of PLAN 9). Delete forever needs the scope `delete_forever` AND `?confirm={permalink}`; before the commit it lists the internal links and redirects that point to the post. A deleted post's old address then answers 404, so the answer says that archive is better for a post that was ever public.

### 26.8 Activity line
`id, time, app id, token id (last 4 characters), route, target, result (ok, refused, error, dry_run), problem codes, commit sha, country of the caller`. No body text, no token, no full IP address. Kept 90 days, then deleted by the hourly clean-up.

### 26.9 Tokens
Format `sdn_` + 43 base64url characters (32 random bytes). Stored: SHA-256, the last 4 characters, scopes, expiry, created by, last used (updated at most once a minute). Created by an admin through the dashboard, shown once. Replacing a token revokes the old one at the same moment. Expired and revoked tokens are kept 30 days for the activity list, then deleted.

### 26.10 Pause and kill
`apps_paused` in the Worker's settings row stops every app at step 2 within 60 seconds (no longer cache). Pausing one app is the same check on its row.

## 27. Automatic Sign-in Rules (PLAN 39; plan only, nothing built yet)

### 27.1 The session
Cookie `adm_session`: `HttpOnly; Secure; SameSite=Strict; Path=/admin-auth`. Value: base64url of `iv + AES-GCM(JSON{ token, login, iat, seen, kv })` with the key from `SESSION_KEY` (32 random bytes). `kv` is the key version (27.5). A cookie that does not decrypt, is older than 30 days, or has `seen` older than 7 days is treated as no session. `seen` is renewed at most once an hour.

### 27.2 Who may ask
`GET /admin-auth/session` answers only if `Sec-Fetch-Site` is `same-origin` (or absent and `Origin` equals the site origin) and the login is still in `ALLOWED_USERS` and in the roles list. Otherwise 401 with no detail. The answer is `{ token, login }` with `Cache-Control: no-store`. The page keeps it in a JavaScript variable, never in storage.

### 27.3 The redirect flow
`/auth?return=%23/authors`: the return value is kept in the `oauth_state` cookie next to the state, accepted only if it matches `^#/[a-z0-9/_-]{0,80}$`, else `#/`. `/callback` checks the state as today, asks GitHub for the token and the user, checks the allow list, sets `adm_session`, and answers 302 to `/admin/` plus the return hash. No token ever goes into a URL.

### 27.4 One automatic try
Flag `adm.auto` in `sessionStorage` (no secret) is set before the redirect. If the page loads with no session and the flag is already set, it does not redirect again and shows the button and the reason.

### 27.5 Logout and all devices
`POST /logout` (same-origin only): revoke the token at GitHub, clear the cookie, answer 204. Revoke failure is shown but the cookie is cleared anyway. "All devices" raises `kv` in the Worker settings row; any cookie with an older `kv` is no session.

### 27.6 Scope
`GITHUB_SCOPE` default `public_repo`. The Setup screen reads `repoInfo().private` and shows a red note when the repository is private and the scope is `public_repo`.

## 28. Link Rules (PLAN 40; plan only, nothing built yet)

### 28.1 Normalise, then check, in this order
1. Trim. 2. Add nothing: a value without a scheme is refused (no guessing). 3. `http://` becomes `https://` with a note. 4. Any other scheme is refused. 5. Parse with `new URL`; refuse on failure. 6. Host to lower case; must contain a dot; no spaces; at most 2048 characters. 7. Remove `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`; keep other parameters. 8. Remove a lone trailing `?`; keep the path as typed. 9. Duplicate key: host without `www.`, plus the path without a trailing slash, in lower case.

### 28.2 Type
Detect by the host table of PLAN 40.2, matching the host or a parent domain (`m.facebook.com` is Facebook). `whatsapp.com` is WhatsApp Channel only when the path starts with `/channel/`. No match: Website. A hand-picked type is kept.

### 28.3 Label
2 to 40 characters after trim, no emoji (the `no-emoji-lib.mjs` test), no line break. Empty: the type name; for Website the host without `www.`.

### 28.4 Limits and warnings
At most 10 links per author, 20 for Settings and footer lists. Refuse: bad scheme, bad host, duplicate, long address, bad label. Warn only: short-link host, ad network host (the list of the ad loader), a bare host with no path on a social type.

### 28.5 Same rules everywhere
`link-rules.ts` (build) and `link-rules.js` (dashboard) export the same functions; a test feeds both the same list of 60 cases and compares the answers. The API of PLAN 38 (`PUT /authors/{slug}`) calls the same rules and returns problems as `{ field, code, message }`.

### 28.6 sameAs
`sameAs` of the Person is every author link address after 28.1, in row order, https only, no duplicates. Type Other is included only when the owner has not ticked "Do not tell search engines" (one tick per row, hidden in "More").

## 29. Author Page Rules (PLAN 41; plan only, nothing built yet)

### 29.1 Live or not
`live = publishedPosts(author) >= 1 || (showPage === true && profileComplete)`. `profileComplete` = name, bio of 120 characters or more, at least one link. If `showPage` is true but the profile is not complete, the page is not built and the build prints one line naming the missing item.

### 29.2 Index-ready
`indexReady = live && bio.length in 120..600 && !/https?:\/\//i.test(bio) && links.length >= 1 && (publishedPosts >= 1 || showPage)`. If not index-ready the page is built with `noindex,follow`, left out of `sitemap-authors.xml` and the HTML sitemap, and linked only from its articles' bylines. Photo and role are recommended and never block.

### 29.3 Title and description
Title `{name}, Author at {siteName}`; if longer than 60 characters, `{name} | {siteName}`. Page 2 and later add ` - Page N` (as today). Description: `truncate(bio, 155)`; if the bio is empty, `{name} writes for {siteName}.` Never the same text as another author.

### 29.4 Writes about
Count the author's published posts per category. Take the top three categories with at least 2 posts each, by count and then by name. Shown as plain names with links. The same list is `knowsAbout` in the data. Fewer than two qualifying posts: the line is not shown.

### 29.5 Since
`since` is the month and year of the author's oldest published post, never the date of the author file. No post: not shown.

### 29.6 ProfilePage data
`@id` is `{origin}{authorUrl}#profile`. `dateCreated` = oldest published post date; `dateModified` = the later of `updated` and the newest post date; both left out when there is no value. `mainEntity` Person: `@id` `{origin}{authorUrl}#person`, `name`, `url`, `description` (the bio), `image` (when a photo is set), `jobTitle` (when `role` is set), `worksFor` (`{ "@type": "NewsMediaOrganization", "name": siteName, "url": origin }`), `knowsAbout`, `sameAs` (PLAN 40, LOGICS 28.6). Any field with no real value is omitted, never an empty string. The article data's `author` is `{ "@type": "Person", "@id": ..., "name": ... }`.

### 29.7 The `/authors/` page
Built when the number of live, index-ready authors is 2 or more. Fewer: no page, no link, no sitemap line. Order: most published posts first, then name. Each entry: photo, name, role, `truncate(bio, 120)`, story count.

### 29.8 Sitemap and pings
`lastmod` = the later of `updated` and the newest post of that author. The build never uses the build time. When `content/authors/<slug>.json` changes in a commit, the IndexNow step adds that author's address to the list (PLAN 10). IndexNow does not notify Google.

### 29.9 Real people only
An author file is a real person. `role`, bio and photo come from that person. The build cannot check this; the dashboard text and AI_OPERATIONS 18 say it, and a bio that contains a web address, "AI-generated" language, or a list of awards without a link gets a warning.

## 30. Theme Rules (PLAN 42; plan only, nothing built yet)

### 30.1 One source
`theme/tokens.json` shape: `{ looks: { newsroom: { light: {...}, dark: {...} }, playful: { light: {...}, dark: {...} } }, accents: { sunset: { fill, textLight, textDark }, ... } }`. `scripts/make-theme.mjs` writes `src/styles/tokens.css`: one block `:root` (light), one `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` and one `:root[data-theme="dark"] { ... }`, for the active look through `[data-look]`. The file starts with a hash of `tokens.json`; the build recomputes it and fails on a mismatch.

### 30.2 Contrast gates (the test reads `tokens.json`)
For each look, mode and accent: `text`, `text-body` and `muted` on `bg`, `surface` and `surface-2` at 4.5 : 1 or more; `acc-t` on `bg` and `surface` at 4.5 : 1; white on `acc` at 4.5 : 1; `border-strong` on `bg` and `surface` at 3 : 1; `border` on `surface` at 1.4 : 1 (Newsroom only). Playful keeps today's pairs. A failing pair names the token and the ratio.

### 30.3 Mode
`localStorage.mode` is `system`, `light` or `dark`; missing or any other value is `system`. The inline head script: for `light` or `dark` set `data-theme` and `style.colorScheme`; for `system` remove `data-theme`, so the media query decides. A `change` listener on `prefers-color-scheme` updates the `theme-color` meta when the mode is `system`. The button cycles system, light, dark and writes `aria-label` such as "Colour mode: System. Press for Light."

### 30.4 theme-color
Two tags: `<meta name="theme-color" media="(prefers-color-scheme: light)" content="{bg light}">` and the dark twin. When `data-theme` is forced, the script sets a single untargeted tag to the forced colour and restores the pair when the mode returns to system.

### 30.5 Look and accent
`data-look` on `<html>` comes from `config/theme.json`; `data-style` stays as today for the accent. Unknown values fall back to `newsroom` and `sunset`. The saved reader choice (`style` in `localStorage`) still overrides the accent only.

### 30.6 Dark surfaces
Elevation order: `bg` < `surface` < `surface-2`. Shadows are `none` in dark. A component never sets its own hex colour; it uses a token. A test greps `global.css` for raw hex values outside the generated file and fails on any (except in the Playful block).

### 30.7 Images and ads in dark
`img.photo` gets `filter: brightness(.92)` in dark; images with a transparent background that carry `data-plate` sit on `--surface-2` with 8 px padding. An ad slot is a `.ad` box with `--surface`, a 1 px `--border`, and the label "Advertisement" in `--muted`; the ad's inner content is untouched.

### 30.8 Forced colors and print
`@media (forced-colors: active)`: borders `1px solid CanvasText`, focus `Highlight`, no background images. `@media print`: tokens of the light Newsroom.

### 30.9 Category bar
Shown from 768 px: the top six menu categories by the existing menu order, the rest under a "More" item. Below 768 px: one scrolling row of chips under the header, with a fixed height to avoid layout shift (CLS 0).

## 31. Task Rules (PLAN 43; the files exist, the checks are planned)

### 31.1 Card shape
File `tasks/open/T-NNNN.md` (four digits, next free number) or `tasks/done/T-NNNN.md`. Front matter keys: `id` (equals the file name), `title` (1 to 100 characters), `owner` in {ai, human, either}, `risk` in {green, yellow, red}, `status` in {idea, ready, in-progress, review, verify, done, blocked}, `time` (text), `needs` (list of task ids and `decision-N`), `paths` (list), `approved-by`, `claimed-by`, `blocked-by`, `created` (YYYY-MM-DD). Sections, in this order: Goal, Why it matters, Steps, Done when, Evidence, If it goes wrong, Stop and ask the owner if, Log.

### 31.2 Transitions
idea to ready: owner or editor, and the Ready rule (31.4) holds. ready to in-progress: needs resolved, `claimed-by` set, and for red `approved-by` set. in-progress to review: Evidence not empty. review to verify: the doer. verify to done: by risk (31.6). Any status to blocked: `blocked-by` not empty. blocked back: the owner or the claimer, with the reason gone. A card in `tasks/done/` has status `done`; a card in `tasks/open/` never does.

### 31.3 Risk of a card
The risk is the highest of its `paths` by this order: red when a path starts with `workers/`, `.github/`, `site/public/admin/`, or is `site/package.json`, `site/package-lock.json`, or the task names a secret, a deploy, DNS, an outside account or a permanent delete; yellow when a path is under `site/src/`, `site/tests/`, `site/scripts/`, `site/config/` (except the two green files), or is a root `.md` file; green when every path is under `site/content/`, `site/public/media/`, `site/config/redirects.json` or `site/config/categories.json`. A card that states a lower risk than this is refused by the check.

### 31.4 Ready rule
Goal one sentence; `owner`, `risk`, `paths` set (a human-only card may have an empty `paths`); at least one numbered step; at least one "Done when" line; an "If it goes wrong" line; for red, `approved-by` with a name and a date.

### 31.5 Claims
`claimed-by` holds a name or tool and a date. One in-progress card per claimer at a time. A claim is stale when the newest Log line is older than 24 hours; a stale claim may be released by anyone, with a Log line. Two in-progress cards must not share a path (the check compares `paths`).

### 31.6 Who closes
green: the doer, with Evidence. yellow: a second key (a name different from `claimed-by`, written as "Confirmed by <name>, <date>" in the Log). red: the owner (a login in `ALLOWED_USERS`, written the same way). The check refuses a close where the confirmer equals the claimer.

### 31.7 Evidence validators
Evidence passes when it holds a link or a commit id, a list of files, and a check result line; for a card with a public result it also holds an address and a word of what was seen, or the text "not verified live" (then the status stays `verify`). A line that is only "done" or "ok" fails. A secret pattern (long random token, `ghp_`, `github_pat_`, `sdn_`, a private key header) anywhere in a card fails the check and blocks the commit.

### 31.8 Needs
`needs` entries are task ids or `decision-N`. A card is blocked while a needed task is not in `tasks/done/` or a needed decision has no `Decided` line. The Tasks screen shows the chain.

### 31.9 Paths check
For a pull request named `ai/T-NNNN` or `human/T-NNNN`, every changed file must match a `paths` entry of that card (a folder entry matches everything inside). Extra files fail the check. Changes to `tasks/open/T-NNNN.md` itself are always allowed.

### 31.10 Document budgets (decision 43)
Word counts of root `.md` files: `AI_START_HERE.md` at most 900; `INCOMPLETE.md` at most 8,000; `CHANGELOG.md` at most 20,000; any other at most 25,000. Warn at 90 percent, fail above. Archive moves whole blocks (an "Open Items After vX" block, or whole changelog entries) to `docs/archive/<name>-<first>-<last>.md`; the sum of words is unchanged; the newest changelog entry always stays at the top of `CHANGELOG.md`.

### 31.11 Live check
`verify-live` takes a base address and a list of paths. For each: status 200 (or the expected redirect), one canonical equal to the address, no `noindex` unless the card says so, JSON-LD parses, no mixed content, response time under 3 seconds. A new post card must list the post's address in "Done when". The result is one line per address and a final PASS or FAIL.

### 31.12 Handoff note
Log line shape: `YYYY-MM-DD, <who>. Done: ... Not done: ... Risks: ... Next: ... Files: ...`. A card moved to `review` without a Log line today is refused by the check.

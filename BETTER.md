# BETTER.md: Improvements and Smarter Options

Ways to make the plan stronger. Ranked by value.

## High Value
1. **Cloudflare Pages from GitHub** instead of pure GitHub Pages: real 301 redirects, custom headers, edge functions for geo/analytics/chat, all free.
2. **Pagefind for search**: no server, tiny index, instant results.
3. **Clean ad approach first**: launch with AdSense-safe layout, get Google News and AdSense approved, then add Adsterra formats gradually on selected pages. Protects approvals and long-term traffic.
4. **Strong author and trust system**: real author pages, editorial policy, corrections log. This is the biggest factor for Google News and Discover.
5. **Discover-ready templates**: large hero image, `max-image-preview:large`, clean headline, fast load.
6. **Search Console API in dashboard**: clicks, impressions, queries per post, right inside the admin.
7. **Incremental builds**: keeps publishing fast even with thousands of articles.

## Medium Value
8. Web Stories generator for Discover.
9. Push notifications for breaking news. Designed in detail in PLAN Section 31 and LOGICS Section 19: each reader picks categories, keywords, authors, alert level, daily limit and quiet hours, and the score decides what is sent.
10. Topic cluster pages for key subjects.
11. Auto social posting (Telegram, X, Facebook page).
12. Content decay alerts and refresh reminders.
13. Lighthouse and link checking as required CI gates.
14. Self-hosted fonts and system-font fallback.

## Nice to Have
15. Listen-to-article (text to speech).
16. Newsletter with weekly digest from RSS.
17. Reading history and personalized "For you" using local storage only.
18. Dark launch previews for drafts.

## Simplifications to Keep Scope Manageable
- Build one great template first; add variants later.
- Start with core 8 categories chosen by owner; do not over-split.
- Ship analytics v1 with live, 24 h, 7 days, lifetime, then add maps and filters.
- Keep AMP optional; normal pages stay the main experience.

---

# New Ideas Added in v0.70.1 (not in any earlier file)

Every idea below was checked against all the `.md` files and none was written before (a few only had a one-line hint, noted). Nothing here is built. Effort: S = under a day, M = a few days, L = a week or more. Value: H, M, L. Statuses start as `[ ]`.

## First Picks (best value for the effort)
1. N1 Private drafts repo (fixes decision 17 without making the whole site private)
2. N2 Post-publish verifier (the site checks itself after every publish)
3. N3 Remote kill switch for ads and push (no rebuild)
4. N4 Place hub pages (finishes the v0.70.0 location work and adds crawl paths)
5. N5 Real-user Core Web Vitals
6. N6 Follow page: Google preferred source, WhatsApp Channel, Telegram
7. N7 Free-tier usage meter

## A. Follow-ups of the Language and Location Schema (PLAN 36)
- [ ] **N4. Place hub pages `/place/{place}/` (M, H).** Built from the detected places of all posts, like tag pages: a list of lifetime posts, `CollectionPage` schema, noindex while fewer than the thin-tag limit (`thinTagMinPosts`). Gives readers a way to browse by place, adds internal links, and supports the local relevance goal in SEARCH_ENGINE_UPDATES section 2. Needs: one more page template, one sitemap type, the post list per place from `geo-schema.ts`.
- [ ] **N8. Places to follow in push (M, M).** A "Places" block on `/notifications/` next to Authors (PLAN 31). The reader picks places; the push scoring treats a place match like a category match. Needs the detected places saved in `push_posts` at `/announce`.
- [ ] **N9. Richer owner list (S, M).** Optional fields in `config/locations.json`: `wikidata` (adds `sameAs`) and `lat`, `lng` (adds `geo` with `GeoCoordinates`). Helps search engines tell Kolkata, India from other places with the same name. Values must be real; empty fields are dropped as in PLAN 36.
- [ ] **N10. Visible place label and "Near you" (M, M).** Show the dateline city before the date in the byline (from `locationCreated`). A small "Near you" block on the home page that uses the country from the existing geo Worker to put local stories first. Both only when real data exists (PLAN 25).
- [ ] **N11. Place box in the dashboard (S, M).** In the post editor: the detected places shown live, a field for `location`, a "none" switch, and a build report that lists published posts with no place. This is the open item from v0.70.0.

## B. Smarter Schema
- [ ] **N12. `about` and `mentions` (M, M).** `about` from the focus keyword and main tag, `mentions` from the other tags and detected people or organisations, each with an optional `sameAs` to a Wikidata or Wikipedia page from a small owner list (`config/entities.json`). Tells search engines what the story is about, not only which words it uses.
- [ ] **N13. `speakable` (S, L).** Mark the headline and the key points box as speakable for voice assistants. Also gives the "Listen to this article" idea (PLAN 19, item 17) its text source.
- [ ] **N14. Corrections and fact checks in schema (M, M).** Each entry of the corrections log becomes a `correction` property (`CorrectionComment`) on the post. A post marked as a fact check can carry `ClaimReview`. Only written when the data is real.
- [ ] **N15. Sources block with `citation` (S, M).** The source block of PLAN 28.4 also writes `citation` in the schema and uses `rel` values for each link (for example `nofollow` for unknown sites).

## C. Trust and Safety
- [ ] **N16. Archive of cited sources (M, M).** At publish, a GitHub Action asks the Wayback Machine to save each outside link of the source block and writes the archive link next to it. Protects the story when a source page disappears. Failures are only reported, never block a publish.
- [ ] **N17. Image provenance fields (M, L).** Write creator, credit and source into the picture file metadata (IPTC or XMP) where the format allows, using the credit and source already stored by PLAN 34. Check which fields the WebP format and `sharp` support before building.
- [ ] **N18. Sensitive text check (S, M).** A warning only, in the pre-publish gate: phone numbers, e-mail addresses, ID-like numbers and the names of minors in the text. The editor decides (BUGS V-group style: report, never decide).
- [ ] **N19. Accessibility statement page (S, L).** A thirteenth required page (the generator makes twelve): what the site does for accessibility and how to report a problem. Text comes from `config/publisher.json` and POLISH.md.

## D. Growth and Reader Habit
- [ ] **N6. Follow page `/follow/` (S, H).** One page with: "Add Shivam Das News as a preferred source on Google" (SEARCH_ENGINE_UPDATES had only a one-line hint; check Google's current instructions for the exact link), the WhatsApp Channel link, the Telegram link, the RSS feed, the newsletter and `/notifications/`. Links come from `config/footer.json` style settings and stay hidden until filled.
- [ ] **N20. Headline test (L, M).** After publish, two headlines are shown to equal halves of readers by the analytics beacon; after a set number of views the better one stays. The URL never changes. Risk: Google News compares the page title with the headline, so the test must end fast, and the final headline must match the schema headline. Build only after launch and only if traffic is high enough.
- [ ] **N21. Date archive pages (S, M).** The URL has the date (`/2026/11/15/blogs/...`) but `/2026/11/` and `/2026/11/15/` give a 404 today. Add archive pages (or redirect them to `/archive/`) so a shortened address never dead-ends. Noindex, follow at first.
- [ ] **N22. Editor link suggestions (M, M).** While writing, the dashboard lists related posts and categories to link, using the same engine as the build-time auto links (PLAN 7). The editor chooses; the auto links still run at build.

## E. Operations and Cost
- [ ] **N1. Private drafts repo (M, H).** Drafts, scheduled and archived posts live in a private repository. When a post is published, a GitHub Action copies only that post (and its pictures) to the public repository. Fixes decision 17 (a public repo shows unpublished work) while the code and the published site stay open. Needs: the Action, a deploy key as a secret, a rule that the dashboard and the AI save drafts to the private repo.
- [ ] **N2. Post-publish verifier (M, H).** After a deploy, an Action opens the live address of each new post and checks: status 200, one H1, canonical, `inLanguage`, schema present, picture opens, in the sitemap and news sitemap, IndexNow answered. Writes one line per check and opens an issue on failure. This is the "report only after the deploy is green" rule of BUGS V8, made automatic.
- [ ] **N3. Remote kill switch and flags (M, H).** A small Worker answer `/flags` (kept in Cloudflare KV) with `ads`, `popunder`, `push`. The ad loader and the push client read it, so ads can be switched off in seconds if a network or a policy problem appears, with no rebuild. Today only push has a pause variable (`PUSH_PAUSED`). Default when the answer is missing: ads off (BUGS A1 spirit).
- [ ] **N5. Real-user Core Web Vitals (M, H).** The beacon sends LCP, CLS and INP of real readers (sampled, no personal data) to the analytics Worker. The Analytics screen shows the 75th percentile per page type and per country and warns when it passes the PLAN 4 targets. Lab scores (Lighthouse) do not show what a phone on 4G sees.
- [ ] **N7. Free-tier usage meter (M, H).** The dashboard shows D1 rows, Worker requests, push sends and the repo size against the free limits, with a warning at 70 percent. Answers the open risk "free-tier limits must be checked" (INCOMPLETE, Risks to Verify Early) with real numbers instead of an estimate.
- [ ] **N23. Smart cache purge (M, M).** On publish, clear the cache only for the changed address, its category, the home page and the feeds, so an update is live in seconds without a full purge. Check the current `_headers` rules first.
- [ ] **N24. India privacy notice (S, M).** The consent bar covers the EU, EEA, UK and Switzerland. Readers in India also give data (push subscription, analytics). Ask a lawyer what the current Indian data protection rules need (notice, consent, a way to withdraw) and write the result as a notice on `/notifications/` and in the Privacy page. This is not legal advice; the check is the task.

## E. Faster AI Work (added in v0.101.2; see AI_OPERATIONS Section 15)
Every idea checked against all `.md` files: none was written before. Nothing here is built.
- [ ] **N25. One-command task script `site/scripts/ai-task.mjs` (M, H).** `node scripts/ai-task.mjs publish <permalink>`, `unpublish`, `delete`, `schedule <permalink> <date>`, `author-bio <slug> "<text>"`. It reads the file from GitHub, applies the change, runs the same checks as the build (the Phase 3d content check), and makes ONE commit with the Git Data API code that `github.js` already has. Same job as a dashboard click, in seconds, no browser. Needs: the token rules of AI_OPERATIONS 15 and Phase 3d Part 2.
- [ ] **N26. Content task Action `.github/workflows/content-task.yml` (M, H).** A `workflow_dispatch` form with fields: task, permalink, value. It runs `ai-task.mjs`, runs the tests, commits and writes the result in the run summary. The owner can start it from the GitHub mobile app, and an AI with only Actions access can start it without write access to the files. Needs N25.
- [ ] **N27. Checks before direct commits (S, H).** Build Phase 3d Parts 2 to 4 (`validate-content.mjs`, `validate.yml`) FIRST. After that, direct commits to `main` for content-only paths are safe, because a broken post is caught by the check and the old site stays up. Today there is no such check, so direct commits depend only on the AI following AI_OPERATIONS.
- [ ] **N28. Retry on conflict in the dashboard (S, M).** In the dashboard, an Archive or Save that ends in GitHub 409 or 422 reads the file again, shows the changed lines and asks once ("The file changed while you worked. Save on top of the new version?"). Today the dashboard only says "Try again" (`commitFiles` in `github.js`). The 409 seen in the ChatGPT test on 2026-11-16 should be reproduced first: find out whether it came from a stale file hash in `remove()` or from the branch moving.
- [ ] **N29. Path guard for AI commits (S, H).** A small Action on every push: if the commit author is the AI account (a separate GitHub user, for example `shivam-das-ai`) and the commit touches `workers/`, `.github/`, `site/src/` or `site/public/admin/`, the run fails with a plain message. A separate GitHub user also makes it easy to see in the history which commits an AI made and to switch the token off in one place.
- [ ] **N30. Task log `ai-log/YYYY-MM.md` (S, M).** One line per AI task: time, task, commit link, check result. The owner can read what the AI did without opening the history. Written by `ai-task.mjs` and by the Action; an AI doing it by hand appends one line in the same commit.
- [ ] **N31. Speed note in the task prompt (S, M).** A fixed first line for any AI chat that works on this repo: "Use the GitHub connector or the repo clone. Do not use a browser robot. Read AI_OPERATIONS Section 15 first." Saves the minutes lost in the TinyFish test and keeps the dashboard login out of AI hands.

- [ ] **N32. Webhooks out (M, M).** After a publish through a Connected app the Worker can call the owner's own addresses (push announce, IndexNow, a Telegram bot), signed with a secret. Like Shopify webhooks. Needs PLAN 38 Part 5.
- [ ] **N33. Plain-words permission preview (S, M).** Before the token is made the screen lists "This app will be able to: ... This app will NOT be able to: ..." from the ticked rights. Same idea as the Shopify install screen.
- [ ] **N34. Read-only mode for all apps (S, H).** One switch that turns every write scope off for a day (for example while the owner checks a problem) without revoking tokens. Needs PLAN 38 Part 8.
- [ ] **N35. Assistant status line (S, L).** In the Connected apps screen, a line per assistant that says which plan it needs for the connector (from PLAN 38.2) and the date of the last check, so the owner is not surprised by a plan change.

## F. Sign-in and Links (added in v0.101.4; see PLAN 39 and 40)
Every idea checked against all `.md` files: none was written before. Nothing here is built.
- [ ] **N36. Passkey sign-in (M, M).** After the GitHub sign-in the owner can add a passkey (WebAuthn) for this device, and the next sign-in is a fingerprint or face check, no GitHub round trip. Needs PLAN 39 Part 2 first.
- [ ] **N37. Device list (S, M).** The Security screen lists the devices with a live session (browser, country, last seen) and a Sign out button for each. Needs a session id inside the encrypted cookie and one small table in the Worker.
- [ ] **N38. Sign-in alert (S, M).** An e-mail or Telegram message to the owner when a session starts from a new country, with a one-tap "This was not me" that signs out every device.
- [ ] **N39. Author link health (S, L).** The link rows show a small "last checked" note from the weekly report of PLAN 40 Part 6, so a dead profile link is seen where the owner edits it.
- [ ] **N40. Author verification links (S, M).** A "Verify" helper that adds the reverse link text for profile systems that ask for it (`rel="me"` pages), with the instructions in plain words per type.
- [ ] **N41. One-time helper link for browser robots (M, L).** Only if ever needed: PLAN 39.7. An editor-role session, 30 minutes, single use, logged. Not recommended while Connected apps exist.

## G. Authors and Theme (added in v0.101.5; see PLAN 41 and 42)
Every idea checked against all `.md` files: none was written before (N6 is the follow page and is only linked here). Nothing here is built.
- [ ] **N42. "Get alerts from this author" (S, M).** A button on the author page that opens the notification settings with that author already ticked (the author filter of PLAN 31 exists). Needs Phase 3i Part 3.
- [ ] **N43. Follow page link on the author page (S, M).** One line "Add us as a preferred source" linking to `/follow/` (N6) on the author page and the author box.
- [ ] **N44. Theme presets (M, M).** A gallery in the Theme screen: Newsroom, Magazine, Compact, Playful; each is a saved set of `theme.json` values with a live preview. Needs Phase 3j Part 7.
- [ ] **N45. Visual snapshots in CI (M, H).** A Playwright step takes screenshots of home, article, author page and the menu at 360, 768 and 1280 px in light and dark, and fails on a large unexpected change. Extends the Playwright line of Phase 6.
- [ ] **N46. SVG logo for both modes (S, M).** The logo as one SVG with `currentColor` parts, so it looks right on light and dark without a plate.
- [ ] **N47. Contrast report page in the dashboard (S, L).** A table of every text and background pair of the active theme with its ratio and a pass mark, from `tokens.json`. Needs Phase 3j Part 1.

## H. Finishing Work Properly: Humans and AI (added in v0.101.6; see PLAN 43)
Every idea checked against all `.md` files: none was written before. Nothing here is built except the starter files of Phase 3k Part 1.
- [ ] **N48. Weekly project report (S, H).** An Action opens one Issue every Monday: open tasks by owner, tasks waiting for the owner with their `time`, stale claims, blocked tasks and what blocks them, undecided decisions, failing checks, size of the documents, age of the last deploy and the result of the last live check.
- [ ] **N49. Owner digest (S, H).** One short message (e-mail or Telegram) that lists only what waits for the owner, newest first, with the minutes each needs. Built from the same data as N48.
- [ ] **N50. "10-minute tasks" filter (S, M).** The Tasks screen shows owner tasks that take 10 minutes or less first, so small steps get done between other work.
- [ ] **N51. Reviewer kit (S, H).** A saved reviewer prompt and checklist that tries to break the change (empty field, very long title, bad address, dark mode on a phone, 320 px width), used by the second key. A first version is in AI_OPERATIONS 19.
- [ ] **N52. Golden examples (S, H).** A folder `examples/` with one perfect finished card, one perfect post, one perfect author file and one perfect pull request, so an AI copies the shape instead of guessing.
- [ ] **N53. Post-mortem card (S, M).** When a task fails or is reverted, a short card: what happened, why, the fix, how to prevent it; the prevention becomes a row in `BUGS.md`. Feeds the same list that the tests use.
- [ ] **N54. Preview address on every pull request (M, H).** Cloudflare Pages already builds previews per branch; the pull request template and `verify-live` use that address so a check runs before merge, not after.
- [ ] **N55. Stale claim release (S, M).** An Action that releases a claim older than 24 hours with a Log line and tells the owner, so no card is stuck on a session that ended.

## Suggested Order
1. Safety and trust first: N1, N3.
2. Proof it works: N2, N5, N7.
3. Finish the location work: N11, N4, N9, N10, N8.
4. Growth: N6, N21, N22, N12.
5. Later, when traffic exists: N20, N16, N14, N13, N15, N17, N18, N19, N23, N24.
6. Faster AI work (added in v0.101.2): N27 first, then N29, N25, N26, N28, N30, N31.
7. Connected apps (added in v0.101.3, PLAN 38): N27 and Phase 3f Parts 1 to 5 first, then N33, N34, N32, N35. N25 (the script) and N26 (the Action) stay as the free-plan fallback.
8. Sign-in and links (added in v0.101.4): Phase 3g Parts 1 to 5 first (the daily annoyance and the safer permission), then Phase 3h Parts 1 to 4, then N37, N38, N36, N39, N40. N41 only if Connected apps cannot do a job.
9. Authors and theme (added in v0.101.5): Phase 3j Parts 1 to 4 first (dark mode fixed, same look), then Phase 3i Parts 1 to 5, then Phase 3j Parts 5 to 8, then N45, N42, N43, N47, N44, N46.
10. Finishing work properly (added in v0.101.6, PLAN 43): Phase 3k Parts 2 and 3 first (the check and preflight), then Part 4 (live check), N52, N51, Part 5, N48, N49, N54, then the Tasks screen (Parts 7 and 8), N50, N53, N55.

# News Website Master Plan (GitHub-Hosted, Blogger-Style, SEO-First)

> Goal: an English-only news website that lives on GitHub, works like Blogger (easy dashboard, XML import/export, H1 titles, permalinks), and is built to rank in Google Search, Google Discover and Google News, with Adsterra + AdSense monetization, live analytics and a built-in chat system.

---

## 0. Read This First: Honest Constraints

GitHub (GitHub Pages) hosts **static files only**. Several of your requirements need a small backend. The plan solves this without paying for a server:

| Need | Why static can't do it alone | Solution (free tier) |
|---|---|---|
| Live analytics (5 min / 1 h / 24 h / 7 d / lifetime) | Needs to store and query visits | Cloudflare Worker + D1 (or Firebase) |
| User-to-admin chat | Needs real-time messages | Firebase Firestore / Cloudflare Durable Objects |
| Admin dashboard login + publish | Must write to the repo securely | Decap CMS or custom admin using GitHub OAuth (via Cloudflare Worker) |
| Geo-based ad switching (India off) | Needs visitor country | Cloudflare Worker `/geo` endpoint (reads `CF-IPCountry`) |
| True 301 redirects | GitHub Pages cannot send 301 | Host on **Cloudflare Pages** (still deploys from GitHub) OR use generated redirect pages (see Section 9) |

**Recommended hosting:** code lives 100% on GitHub; deploy via **Cloudflare Pages connected to the GitHub repo** (free, real 301 redirects, custom headers, edge functions). Pure GitHub Pages also works but with weaker redirects (meta-refresh + canonical only).

---

## 1. Tech Stack

- **Framework:** Astro (fastest static output, great Core Web Vitals, Markdown/MDX content collections)
- **Content:** Markdown files with YAML front matter in `/content/blogs` and `/content/pages`
- **Admin dashboard:** Decap CMS (GitHub backend) with a Blogger-like editor, or a custom admin SPA
- **Build/automation:** GitHub Actions (build, sitemap, redirects, search index, IndexNow ping)
- **Styling:** Tailwind CSS, mobile-first, dark/light mode
- **Search:** Pagefind (static, fast, no server) or Fuse.js index
- **Backend-lite:** Cloudflare Workers + D1 (analytics, geo, chat)
- **Images:** auto-convert to WebP/AVIF, responsive `srcset`, lazy loading

---

## 2. Requirement Map (Your 20 Points)

| # | Requirement | Where it's covered |
|---|---|---|
| 1 | English only | Section 3 |
| 2 | Auto SEO system | Section 5 |
| 3 | Search, Discover, Google News friendly | Section 6 |
| 4 | All devices and browsers | Section 4 |
| 5 | Auto internal linking | Section 7 |
| 6 | Auto schema | Section 8 |
| 7 | Auto index system | Section 10 |
| 8 | XML upload like Blogger | Section 11 |
| 9 | Title is H1 | Section 5.2 |
| 10 | Permalink, meta description and more options | Section 12 |
| 11 | Adsterra with India off | Section 13 |
| 12 | Google AdSense | Section 13.5 |
| 13 | User-friendly, easy | Section 12, 20 |
| 14 | Blog URL format | Section 3.2 |
| 14b | Pages URL format | Section 3.2 |
| 15 | Site name, description, logo, favicon, icons | Section 14 |
| 16 | Auto redirect on permalink/category change | Section 9 |
| 17 | Live analytics | Section 15 |
| 18 | Important pages + chat | Section 16 |
| 19 | Category shows lifetime posts | Section 17 |
| 20 | Search | Section 18 |
| 21 | Direct code writing in the editor (HTML, CSS, JavaScript, Java and more), like Blogger and Shopify | Section 37 |
| 22 | AI assistants connect like a Shopify custom app: a token with limited rights, no browser robot, no dashboard login | Section 38 |
| 23 | Automatic dashboard sign-in (stay signed in on this device, no new login for every tab) | Section 39 |
| 24 | A professional link editor (rows, types, checks) for authors, social profiles and the footer | Section 40 |
| 25 | Author pages that Google can index (live profile, ProfilePage data, authors index, sitemap) | Section 41 |
| 26 | A professional "Newsroom" theme and a much better dark mode (tokens, three-state switch, checked contrast) | Section 42 |
| 27 | A task system so that humans and AI finish work properly (task cards, risk levels, evidence, second key, live check) | Section 43 |

---

## 3. Language and URL Structure

### 3.1 Language
- English only: `<html lang="en">`, `og:locale = en_US` (configurable `en_GB`/`en_IN`).
- All UI strings in a single `strings.en.json` for easy edits.
- **Auto language schema (v0.70.0):** every JSON-LD block carries `inLanguage`, made from the `locale` in `config/site.json` (`en_US` gives `en-US`). Nothing to type per post. Details in Section 36.

### 3.2 URL formats (as requested)

```
Blog post : https://domain.com/YYYY/MM/DD/blogs/{category}/{permalink}/
Page      : https://domain.com/YYYY/MM/DD/pages/{permalink}/
Category  : https://domain.com/category/{category}/
Tag       : https://domain.com/tag/{tag}/
Author    : https://domain.com/author/{author}/
Search    : https://domain.com/search/?q=...
```

Example: `https://domain.com/2026/11/13/blogs/technology/new-phone-launched/`

Rules:
- Date in URL = **publish date**, locked at first publish so URLs never change by accident.
- Lowercase, hyphen-separated, ASCII-only slugs; auto-generated from title, editable.
- Trailing slash consistent; non-slash version redirects to slash version.
- Option (Settings): switch date format to `YYYY/MM` or off, without breaking old URLs (old URLs auto-redirect).

---

## 4. All Devices and All Browsers

- Responsive layouts: 320 px phone to 4K desktop. Mobile-first CSS.
- Test matrix: Chrome, Safari (iOS and macOS), Firefox, Edge, Samsung Internet, Opera, UC Browser, older Android WebView.
- No unneeded JavaScript: pages work with JS disabled (progressive enhancement).
- Autoprefixer and browserslist for CSS compatibility.
- Core Web Vitals targets: LCP < 2.0 s, CLS < 0.05, INP < 150 ms.
- Accessibility (WCAG 2.1 AA): alt text, contrast, keyboard navigation, ARIA labels.
- PWA: installable, offline fallback page, add-to-home-screen.
- Dark mode, adjustable font size, AMP **not** needed (Google no longer requires it).

---

## 5. Auto SEO System

### 5.1 Auto-generated for every page
- `<title>` pattern: `{Post Title} | {Site Name}` (configurable, max ~60 chars with live counter)
- Meta description (auto from first 150-160 chars if left empty; editable)
- Canonical URL
- Open Graph and Twitter Card tags (image 1200x630 auto-generated if none uploaded)
- `robots` meta (index/noindex per post), `max-image-preview:large`, `max-snippet:-1`, `max-video-preview:-1` (needed for Discover)
- Breadcrumbs (visible + schema)
- Hreflang not needed (English only)
- Pagination `rel` handled with canonical self-reference

### 5.2 H1 rule (like Blogger)
- Post title is the **only H1** on the page.
- Site name is H1 only on the homepage.
- Content headings must start at H2, enforced by the editor and a build-time linter that warns on broken heading order.

### 5.3 On-page SEO checker (in the editor, live score)
- Title length, meta description length, focus keyword in title/H1/first paragraph/slug
- Image alt text check, internal link count, external link count
- Readability (sentence length, paragraph length)
- Word count (recommend 400+ for news, 800+ for evergreen)
- Duplicate title/slug warning

### 5.4 Technical SEO
- Clean semantic HTML, minimal DOM, preloaded critical fonts, inline critical CSS
- Image optimization with width/height set (no layout shift)
- `robots.txt` auto-generated, editable in admin
- Security headers, HTTPS only, HSTS
- 404 page with search and latest posts
- Soft-404 and orphan-page detector in build report

---

## 6. Google Search, Discover and Google News Friendly

### Google Search
- Fast, mobile-friendly, structured data, strong internal links, fresh sitemap.

### Google Discover (checklist enforced by the editor)
- Featured image **at least 1200 px wide**, high quality, 16:9 recommended, `max-image-preview:large`
- Clickable but non-misleading headlines (warn on clickbait words/ALL CAPS)
- Author name and publish/updated date visible
- Original content, no thin or copied text

### Google News (publisher requirements)
- Required pages: About, Contact, Editorial Policy, Privacy Policy, Terms, Corrections Policy, Ethics/Ownership, Authors pages
- Clear bylines and dates on every article
- **News sitemap** (`/news-sitemap.xml`) with articles from the last 2 days, auto-generated
- Separate section URLs (categories) with stable structure
- `NewsArticle` schema, `datePublished`, `dateModified`
- No hidden text, no deceptive ads, no intrusive interstitials over content
- Register in **Google Publisher Center** (manual step by owner, guide included in README)

---

## 7. Auto Internal Linking

- Build-time engine scans each post and links the first mention of known phrases to the best-matching internal post/category/tag.
- Source of anchor phrases: post titles, focus keywords, tags, category names, and a manual "keyword to URL" map in admin.
- Rules: max 3 to 5 auto links per 1,000 words, never in headings, never self-link, no duplicate target twice, skip already-linked text and code blocks.
- Per-post toggle: "Disable auto links".
- "Related posts" block (same category + tag overlap + keyword similarity), "Read next" and "Trending" blocks.
- Orphan-page report: pages with zero inbound links are flagged and auto-linked from related posts.
- Breadcrumb and category-hub linking for crawl depth under 3 clicks.

---

## 8. Auto Schema (JSON-LD)

Auto-injected, no manual work:

| Page | Schema |
|---|---|
| Homepage | `WebSite` + `SearchAction` (sitelinks search box), `Organization`/`NewsMediaOrganization` |
| Blog post | `NewsArticle` (headline, image[], datePublished, dateModified, author, publisher, mainEntityOfPage, articleSection, keywords, wordCount) |
| Any page | `BreadcrumbList` |
| Category/Tag | `CollectionPage` + `ItemList` |
| Author | `Person` / `ProfilePage` |
| About / Contact | `AboutPage` / `ContactPage` |
| Blog post (auto, v0.70.0) | `inLanguage` on every block, `contentLocation` (up to 3 places found from the title, tags, dateline and first 300 words) and `locationCreated` (from the dateline). Section 36 |
| FAQ block (optional) | `FAQPage` |
| Video embed (optional) | `VideoObject` |
| Live news (optional) | `LiveBlogPosting` |

- Schema validator runs in GitHub Actions; a broken schema fails the build.
- Per-post override: choose `NewsArticle`, `Article` or `BlogPosting`.

---

## 9. Auto Redirect System

### What triggers a redirect
- Permalink changed
- Category changed (category is part of the URL)
- Post date changed
- Category slug renamed
- Page permalink changed
- Post deleted (optional: redirect to category or a chosen URL, else 410 Gone)

### How it works
1. The editor saves old URL to the post's `redirects:` history list.
2. Build step creates a central `redirects.json` map (old URL to new URL).
3. Output depends on hosting:
   - **Cloudflare Pages:** `_redirects` file with real **301** redirects (best for SEO).
   - **GitHub Pages:** static stub pages with `<meta http-equiv="refresh">`, `<link rel="canonical">` to the new URL and a JS redirect (works but is not a true 301).
4. Redirect chains are collapsed (A to B to C becomes A to C). Loops are blocked.
5. Admin screen "Redirect Manager": view, add manual redirects, bulk import CSV, export.
6. Sitemap always lists only the new URL.

---

## 10. Auto Index System

- `sitemap-index.xml` containing: posts, pages, categories, tags, authors, images, **news sitemap**
- Auto-regenerates on every publish/update through GitHub Actions
- `lastmod` accurate (only changes when content really changes)
- **IndexNow** ping (Bing, Yandex, Seznam, others) on publish/update/delete
- Google: sitemap submitted once in Search Console; Google re-crawls automatically. (Note: Google's Indexing API is officially only for job posting and livestream pages, so it is **not** used for news.)
- Built-in "Submit to Search Console" checklist and a status page showing last ping and last build.
- RSS and Atom feeds (`/feed.xml`, per-category feeds) for faster discovery.
- WebSub (PubSubHubbub) ping for feed subscribers.

---

## 11. XML System (Blogger-Style)

- **Import:** upload a Blogger backup `.xml` (also WordPress WXR `.xml`) in the dashboard.
  - Parses posts, pages, labels to categories/tags, dates, authors, images, comments (optional).
  - Preview screen before import, with duplicate detection.
  - Old Blogger URLs are mapped into `redirects.json` automatically.
- **Export:** one-click full backup `.xml` (posts, pages, categories, settings) for safety and migration.
- **Sitemap/robots editor:** view generated sitemap, edit `robots.txt`, add custom sitemap URLs.
- Note: GitHub hosts files only, so "upload" runs as a browser-side parser that commits the converted Markdown files to the repo through the GitHub API (progress bar included).

---

## 12. Admin Dashboard (Blogger-Like, Easy)

### Editor fields per post
- Title (becomes H1), **permalink** (auto + editable), category (single primary + optional secondary), tags
- Featured image + alt text + caption + credit
- **Meta description**, meta title override, focus keyword
- Canonical URL override, robots (index/noindex, follow/nofollow)
- Publish date/time, schedule post, last updated date
- Author (multiple authors supported), reviewer/fact-checker
- Direct code: Code block, HTML tab, HTML block, Page CSS and Page JavaScript (Section 37)
- **Search engine listing box** (Google preview, page title, meta description, URL handle, hide from search engines) as in PLAN 33
- Excerpt/summary, key points box
- Breaking/Trending/Featured flags, "Developing story" label
- Open Graph title/description/image overrides
- Schema type selector
- Ad controls: hide ads on this post, hide popunder, etc.
- Disable auto internal links
- Status: Draft, Scheduled, Published, Archived

### Editor experience
- WYSIWYG + Markdown toggle, drag-and-drop images, paste-from-Word cleanup
- Auto-save, revision history (via Git history, one-click restore)
- Embed blocks: YouTube, X/Twitter, Instagram, Facebook, Google Maps, polls
- Live SEO score and Discover/News checklist
- Hotlinked pictures are downloaded, renamed for SEO and hosted on our own CDN automatically (PLAN 34)
- Mobile-friendly dashboard (publish from phone)

### Management screens
Posts, Pages, Categories, Tags, Authors, Media Library, Files editor (PLAN 33), Redirect Manager, Ads Manager, Analytics, Chat Inbox, Settings, Import/Export, Build Status.

---

## 13. Ads System

### 13.1 Adsterra formats
Smartlink, Popunder, Native Banner, Social Bar.

### 13.2 Geo rule
- **India (IN): all Adsterra ads OFF.**
- All other countries: ON.
- Detection: Cloudflare Worker `/geo` returns the country code (from `CF-IPCountry`). Ad scripts load **only after** the check passes. If detection fails, ads default to OFF for safety (configurable).
- Admin "Ads Manager" lets you add more country rules (allow/block lists) and set per-format toggles.
- **Datacenter networks (v0.82.0): all ads OFF** for a visitor on a cloud or hosting network (the same list the analytics Worker uses; BOT_PROTECTION section 8). Switch `BLOCK_DATACENTERS`, on by default.

### 13.3 Placement controls
- Per-format on/off, per-page-type on/off (home, post, category, page)
- Popunder frequency cap (for example once per session)
- Smartlink used on buttons/links, not forced redirects
- Native Banner after paragraph N and in "Related" area
- Social Bar enabled/disabled globally
- No ads on legal/contact/policy pages by default

### 13.4 Layout and speed
- Reserved ad slots to prevent layout shift
- Ad scripts load lazily, only after one real user event (press, key, touch or scroll), to protect Core Web Vitals and to keep bots from loading ads (changed in v0.81.0: idle time alone no longer loads ads; BOT_PROTECTION section 8)

### 13.5 Google AdSense (when approved)
- Settings field for Publisher ID (`ca-pub-...`) and auto ads toggle
- Auto-creates `ads.txt` (AdSense + Adsterra lines) at the site root
- Manual ad units: in-article, display, multiplex
- Cookie consent banner (Google CMP/Funding Choices) for EU/UK visitors
- Per-country control, same as Adsterra
- **Important warning:** AdSense policies and Google News/Discover quality systems dislike aggressive popunders and redirects. Recommended path: keep the site clean (no popunder/smartlink redirects) while applying for AdSense and Google News, then enable Adsterra formats carefully after approval, or on pages where AdSense is disabled. The Ads Manager includes a "Compliance mode" switch for this.

---

## 14. Branding and Site Settings

- Site name, tagline, site meta description, default OG image
- Logo (light + dark), favicon, Apple touch icon, Android/PWA icons (192/512), Safari mask icon, MS tile
- **Auto icon generator:** upload one 512x512 image and every icon size and `site.webmanifest` is created
- Theme color, accent color, fonts
- Social links (auto into `sameAs` schema)
- Google Search Console, Bing, Yandex verification codes
- Google Analytics / Tag Manager optional fields
- Header/footer menus editable
- Publisher info: organization name, address, email, founding date, ownership/ethics links

---

## 15. Live Analytics Page

Self-built, privacy-friendly, no extra cost.

### Collected per visit (lightweight beacon, under 1 KB)
- Page URL, timestamp, session ID (random, no personal data)
- Country (from edge), time zone (from browser)
- Referrer / traffic source (Google, Discover, Google News, Facebook, X, direct, other site)
- **Read time** (active time on page) and scroll depth
- Device type, browser, OS

### Dashboard views
- **Live (last 5 min):** active visitors now, top pages, top countries, sources, live map
- **Last 1 hour**, **Last 24 hours**, **Last 7 days**, **Lifetime**
- Charts: visitors over time, top posts, top categories, countries, referrers, average read time, bounce/engaged rate
- Time-zone selector (shows data in your chosen time zone)
- Per-post analytics inside the post editor
- Revenue estimate widget (manual entry or ad network reports)

### Storage and privacy
- Cloudflare Worker + D1; raw events rolled up into hourly/daily tables to stay inside free limits
- No cookies for analytics, IP never stored (country only), consent banner for regions that require it
- Dashboard behind admin login (optional public "Trending now" widget on the site)

---

## 16. Important Pages and Chat System

### Auto-created pages (editable templates, English)
About Us, Contact Us, Privacy Policy, Terms and Conditions, Disclaimer, Cookie Policy, DMCA, Editorial Policy, Corrections Policy, Ethics and Fact-Checking Policy, Ownership and Funding, Advertise With Us, Team/Authors, Sitemap (HTML), Affiliate Disclosure.
Page URL format: `domain/YYYY/MM/DD/pages/{permalink}/`

### Contact Us + Chat
- Contact form (name, email, subject, message, spam protection with Turnstile/hCaptcha) delivered to admin inbox
- **Separate live chat** between visitor and admin:
  - Chat bubble on the Contact page (and optional site-wide)
  - Visitor enters name and email, then chats in real time
  - Admin Chat Inbox: conversation list, unread count, reply, close, mark spam, canned replies
  - Email notification (and optional Telegram/WhatsApp alert) to admin on new message
  - Offline mode: if admin is away, chat becomes a message form
  - Chat history stored in Firebase/D1; auto-delete after N days (configurable)
  - Rate limiting and profanity/spam filter

---

## 17. Category Pages (Lifetime Posts)

- Each category page lists **all posts ever published** in that category, newest first.
- Paginated (for example 20 per page) with clean URLs `/category/{name}/page/2/`, or "Load more" with crawlable links.
- Category description, featured image and its own meta title/description (editable).
- Breaking/Trending sub-sections on the category page.
- Renaming a category updates all post URLs and creates redirects (Section 9).
- Optional sub-categories.

---

## 18. Search

- Site-wide instant search (Pagefind): searches title, content, tags, categories
- Search suggestions, recent searches, "no results" page with trending posts
- Filters: category, date range, sort by relevance/newest
- `/search/` is `noindex` to avoid thin pages; `SearchAction` schema points to it
- Search analytics (top searched terms) shown in admin

---

## 19. More Ideas (Bonus Features)

**Traffic and growth**
1. Web push notifications for breaking news and for each reader's own categories and keywords: built in this project, see Section 31 (the OneSignal idea is dropped)
2. Newsletter signup (Buttondown/Mailchimp) plus RSS-to-email
3. Auto-post to Telegram, X and Facebook page on publish
4. Social share buttons and "copy link", WhatsApp share (very strong on mobile)
5. Web Stories (Google Discover loves them)
6. Trending bar and Breaking News ticker
7. Google News "Top Stories" friendly layouts with Live Blog template

**Content quality and trust**
8. Fact-check badge and corrections log on articles
9. "Updated" timestamp with update history
10. Estimated reading time and Table of Contents on long posts
11. Author profile pages with bio, photo and social links (E-E-A-T)
12. Plagiarism/duplicate content checker warning in editor
13. Image credit and caption fields enforced

**Engagement**
14. Comments (Giscus on GitHub Discussions, free) with moderation
15. Reactions (like/helpful), polls and quizzes
16. Bookmark/save for later (local storage)
17. Text-to-speech "Listen to this article"
18. Dark mode, font size control

**Technical**
19. Image CDN and automatic WebP/AVIF
20. Broken-link checker and redirect-chain checker in GitHub Actions
21. Lighthouse CI on every push with score gates (fail build under 90)
22. Scheduled publishing via GitHub Actions cron
23. Automatic backups (Git history + XML export zipped weekly)
24. Role system: Admin, Editor, Author (via GitHub collaborators or Worker auth)
25. Multi-ad-network fallback and `ads.txt` manager
26. Social card auto-generation (title over branded template)
27. Trending algorithm using live analytics (views in last 24 h)
28. Email alerts for traffic spikes or downtime
29. Search Console API integration to show clicks/impressions in dashboard
30. Dark launch/preview links for drafts

**More ideas:** 24 new ones (private drafts repo, post-publish verifier, remote kill switch, place hub pages, real-user Core Web Vitals, follow page and others) are written in `BETTER.md`, section "New Ideas Added in v0.70.1".

**Bot protection:** the full plan to keep only real readers (Cloudflare rules, Turnstile, Worker checks, human score, ad safety) is in `BOT_PROTECTION.md`. Nothing is built yet.

---

## 20. Content Data Model (Front Matter)

```yaml
---
title: "Post title becomes H1"
permalink: "post-slug"
category: "technology"
tags: ["phones", "launch"]
date: 2026-11-13T09:30:00Z
updated: 2026-11-13T11:00:00Z
author: "jane-doe"
description: "Meta description, 150-160 chars"
metaTitle: ""
focusKeyword: "new phone launch"
image: "/media/2026/11/phone.webp"
imageAlt: "Alt text"
imageCredit: "Photo: Source"
canonical: ""
robots: "index,follow"
location: []          # optional, up to 3 place names; empty = found automatically; ["none"] = no place
schemaType: "NewsArticle"
breaking: false
featured: false
trending: false
autoLinks: true
ads:
  hideAll: false
  hidePopunder: false
redirects: []        # old URLs, filled automatically
status: "published"  # draft | scheduled | published | archived
---
```

---

## 21. Repository Structure

```
/content
  /blogs/{category}/{slug}.md
  /pages/{slug}.md
/src
  /layouts, /components, /pages, /lib (seo, schema, linking, redirects)
/public
  /admin            (dashboard)
  /media
  _redirects, robots.txt, ads.txt, site.webmanifest
/workers
  analytics/, geo/, chat/, push/    (Cloudflare Workers)
/.github/workflows
  build.yml, indexnow.yml, lighthouse.yml, backup.yml, schedule-publish.yml
/config
  site.json, ads.json, menus.json, strings.en.json
README.md
```

---

## 22. Build Roadmap

| Phase | Scope | Result |
|---|---|---|
| 1 | Repo, Astro setup, layouts, URL structure, categories, search, responsive UI | Working site |
| 2 | SEO engine, schema, sitemaps, news sitemap, RSS, robots, auto icons | Search-ready |
| 3 | Admin dashboard, editor, SEO score, media, settings, branding | Blogger-like control |
| 4 | Redirect manager, auto internal linking, XML import/export | Safe migration and editing |
| 5 | Ads manager, geo rule, Adsterra formats, AdSense, ads.txt, consent | Monetization |
| 6 | Live analytics Worker + dashboard | Real-time stats |
| 7 | Chat system + contact + required pages | Trust and support |
| 8 | Performance, QA on all browsers, Lighthouse gates, launch checklist | Production |
| 9 | Smart push notifications by category, keyword and choice (Section 31) | Readers get only what they chose |

---

## 23. Decisions Needed From You

1. **Hosting:** Cloudflare Pages from GitHub (recommended, real 301 redirects) or pure GitHub Pages?
2. **Admin:** Decap CMS (faster to build) or fully custom Blogger-style dashboard (more work, more control)?
3. **"XML upload":** Blogger/WordPress backup import (assumed here), or also uploading your own sitemap XML?
4. **Date format in URLs:** `YYYY/MM/DD` (assumed) or `YYYY/MM`?
5. **Chat storage:** Firebase (easiest real-time) or Cloudflare?
6. **Domain name and site name** (for branding and schema).
7. **Ad strategy:** start clean for AdSense/Google News approval, then enable Adsterra?

---

## 24. Launch Checklist

- [ ] Domain connected, HTTPS on
- [ ] All required pages published
- [ ] 20+ original articles before applying to Google News/AdSense
- [ ] Sitemap submitted in Search Console and Bing Webmaster
- [ ] Google Publisher Center set up
- [ ] `ads.txt` live
- [ ] Geo rule tested (India off, other countries on) using VPN
- [ ] Lighthouse 90+ on mobile
- [ ] Rich Results Test passes for NewsArticle
- [ ] Redirect tests for permalink/category change
- [ ] Analytics and chat tested end to end
- [ ] Push notifications tested on Android Chrome, desktop, and the iPhone installed app (only if push is switched on)
- [ ] Backup export tested

---

## 25. No Demo Content Rule (100% Real)

The theme ships **completely empty and production-real**. Nothing fake, nothing placeholder.

- No demo posts, dummy categories, sample authors, lorem ipsum, stock "Hello World" content or fake images.
- Fresh install shows a real empty state with a "Write your first post" button, not fake articles.
- No fake numbers anywhere: analytics, counters, trending and related blocks show only real data. Empty blocks stay hidden until real content exists.
- No placeholder ads or fake ad boxes. Ad slots render only when an ad network is configured and allowed for the visitor's country.
- No sample comments, fake chat messages or fake reviews.
- No placeholder logo, favicon or site name. Setup wizard asks for the real ones on first login, and the site will not go public until required fields are filled.
- Required pages (About, Contact, Privacy and others) are created as **real editable templates with the owner's real details filled in during setup**, not generic dummy text.
- Real-only defaults: no "Your Site Name", no "example.com" anywhere in output, schema or sitemap.
- Build check fails if it finds lorem ipsum, "example.com", "TODO", "demo" or "test" text in published output.
- Admin shows an empty state with guidance on every screen until real data exists.

---

## 26. AMP Version (Full Content + Ads)

AMP is added as a second version of every article, as you requested. (Earlier note: AMP is no longer required by Google, but it is fully supported and optional here.)

- **URL:** `domain/YYYY/MM/DD/blogs/{category}/{permalink}/amp/` (also for pages).
- **Full content:** AMP pages carry the complete article: all text, images, headings, embeds (YouTube, X, Instagram via AMP components), tables, FAQ, author box, related posts, categories and tags. Nothing trimmed.
- **Linking:** normal page has `<link rel="amphtml">`, AMP page has `<link rel="canonical">` to the normal page.
- **Auto-generated:** AMP builds from the same Markdown at build time, no extra work per post. Per-post toggle "Disable AMP" and a global on/off switch.
- **Same SEO:** title, H1, meta description, Open Graph, NewsArticle schema, breadcrumbs and internal links are all included.
- **Validation:** `amphtml-validator` runs in GitHub Actions; invalid AMP pages fail the build.
- **Sitemap:** AMP URLs are not listed separately; the canonical URL stays in the sitemap.
- **Redirects:** permalink/category change also redirects the old AMP URL automatically.
- **Analytics:** `amp-analytics` sends the same events (page, country, read time, source) to the live analytics Worker, so AMP traffic appears in the same dashboard.
- **Search and chat:** AMP has search through `amp-form` linking to the normal search page; chat link opens the Contact page.

### Ads on AMP
| Network | AMP support | How it runs |
|---|---|---|
| Google AdSense | Official | `amp-ad` (type `adsense`) and `amp-auto-ads` once approved |
| Adsterra Native Banner / Banner | No official AMP tag | Placed in a sandboxed `amp-iframe` that loads a small hosted ad page from your site (must be below the first screen) |
| Adsterra Popunder / Smartlink / Social Bar | Not possible (AMP blocks custom JavaScript) | Not on AMP; Smartlink can be a normal text/button link to the ad URL |

- **Geo rule stays:** India off, all other countries on. On AMP this uses `amp-geo` and `amp-iframe` conditional loading, so Adsterra frames render only outside India.
- Ad slots are reserved to avoid layout shift, and the ads manager has separate AMP on/off toggles.
- `ads.txt` is shared with the normal site.
- Note: because AMP cannot run popunder or social bar scripts, AMP revenue per visit is lower than the normal site; the normal site stays the main earner.

---

## 27. Every Article = Complete HTML + CSS + JavaScript

Each article is generated as a **complete, standalone, fully rendered page**. Nothing loads later to show the content.

- **HTML:** full article text, headings, images, links, schema, meta tags and internal links are written directly into the page file at build time (not rendered by JavaScript). Google and every crawler see everything instantly.
- **CSS:** the page's CSS is **inlined in the HTML** (`<style>`), so it renders with no extra request. Only the CSS the page actually uses is included (unused CSS is removed). Large shared CSS (if any) loads as a cached file after first paint.
- **JavaScript:** the scripts the page needs (search, dark mode, share buttons, read-time tracker, geo/ads loader, analytics beacon, chat link) are bundled, minified and included in the page or as one small cached file. Content never depends on JS, so the article still reads fully with JS off.
- **Self-contained output:** every article exists as its own `index.html` in its URL folder, e.g. `/2026/11/13/blogs/technology/new-phone-launched/index.html`.
- **Per-article control:** the post editor can add custom HTML, CSS or JS for that one article (for special layouts or embeds). It is sanitized and stays only on that page. The full rules, roles and screens are in Section 37.
- **Size and speed:** target under 100 KB HTML+CSS+JS (compressed, excluding images). Brotli/gzip on, images lazy-loaded.
- **AMP exception:** the AMP version of the article has full HTML and inline CSS (AMP limit 75 KB) but **cannot contain custom JavaScript**; AMP components replace it.
- **Check:** the build verifies that every article has its full text in the HTML source, inline CSS, valid JS, no console errors, and no broken links.

---

## 28. Extra Logic and Ideas (Added by Claude)

### 28.1 Smart Publishing Logic
- **Pre-publish gate:** a post cannot publish if it has no featured image, no meta description, no category, broken heading order, or a duplicate permalink. Admin shows exactly what to fix.
- **Duplicate/near-duplicate detector:** warns if the new title or text is too close to an existing post (prevents keyword cannibalization).
- **Smart slug:** auto-removes stop words ("the", "a", "of"), keeps slug under 60 characters, blocks dates inside the slug.
- **Update vs republish:** editing an old article only changes `dateModified`; the URL date never changes. Big rewrites can be marked "Updated" to show a badge and re-ping IndexNow.
- **Evergreen vs news tag:** news posts older than 48 h leave the news sitemap automatically; evergreen posts stay in the main sitemap and get refreshed reminders every 6 months.
- **Content decay alerts:** posts losing traffic for 30 days are listed as "needs update".

### 28.2 Traffic and Ranking Boosters
- **Topic clusters:** pillar post per category, with supporting posts auto-linked to it and back.
- **Trending engine:** score = views in last 24 h weighted by recency and read time; feeds the homepage "Trending" and "Most Read" blocks.
- **Homepage logic:** Breaking strip, top story, latest per category, trending, editor's picks, all driven by flags and real data.
- **"Developing story" threads:** group updates about one event under one topic page (great for Google News).
- **Auto Table of Contents** with jump links for long posts (can earn sitelinks in results).
- **Key takeaways box** at the top of each article (good for Discover and featured snippets).
- **Related searches/People also ask** block built from your own search analytics.
- **Image SEO:** auto-descriptive filenames, alt-text reminders, image sitemap, `ImageObject` schema.
- **Google Web Stories** generator from an article (swipe format shown in Discover).
- **RSS for Google News/Publisher Center** and per-category feeds.

### 28.3 Revenue Logic
- **Smart ad density:** the number of ad slots scales with article length (short post, fewer ads) so quality stays high.
- **Best-slot learning:** analytics tracks which slot earns/clicks most and suggests moving ads.
- **Traffic-source rules:** show ads differently to Google Discover, social and direct visitors (for example, lighter ads for Discover).
- **New-visitor protection:** no popunder on the first page view of a session.
- **Ad-blocker friendly notice** (polite message, never blocking content).
- **Revenue dashboard:** manual or API entry of Adsterra/AdSense earnings per day, with RPM per country and per category.
- **Affiliate link manager:** auto `rel="sponsored nofollow"` and disclosure label.
- **Sponsored post label:** a "Sponsored" flag adds the right schema and disclosure.

### 28.4 Trust and Safety (important for Google News approval)
- Author page for every author with real photo, bio and social links.
- Fact-checked-by and reviewed-by fields.
- Corrections log shown at the bottom of changed articles.
- Source/citation block for each article.
- Spam, hate-speech and copyright filter before publish (warning only, admin decides).
- DMCA takedown form that creates a ticket in the admin inbox.
- Report-a-problem button on every article.

### 28.5 Performance and Reliability
- Preload the top image and fonts; self-host fonts (no Google Fonts request).
- Service worker caching: homepage and last 20 articles available offline.
- Image CDN rules with automatic AVIF/WebP and `fetchpriority="high"` on the hero image.
- Uptime monitor and build-failure alert by email/Telegram.
- Automatic rollback: a bad build never replaces the last good one.
- Weekly Git backup tag plus XML export stored in a separate private repo.
- Rate limiting on analytics, chat and contact endpoints against bots.
- Bot filter in analytics (known crawlers excluded from visitor counts).

### 28.6 Admin Convenience
- **Setup wizard** on first login: site name, logo, domain, ads IDs, Search Console, required pages.
- Bulk actions: change category, add tag, change author, delete, noindex for many posts.
- Bulk find-and-replace across all posts (with preview and undo).
- Keyboard shortcuts in the editor, slash-commands for blocks.
- Draft sharing link for review before publishing.
- Editorial calendar with scheduled posts.
- Activity log: who changed what and when.
- Global "Health Check" page: broken links, missing alt text, orphan pages, redirect chains, schema errors, slow pages.

### 28.7 Reader Experience
- Reading progress bar, estimated read time, sticky share bar on mobile.
- "Next article" auto-load at the end of an article (infinite scroll, with proper URL updates).
- Save/bookmark, text size control, listen-to-article.
- Clean print view and "copy link" button.
- Cookie and privacy preferences panel by region (EU/UK consent, US state privacy opt-outs).

### 28.8 Smart Redirect and URL Logic
- Case, trailing-slash and `index.html` variants all redirect to the one canonical URL.
- Old Blogger-style URLs (`/2020/05/post.html`) auto-map to new URLs during import.
- Soft-404 recovery: unknown URLs suggest the closest matching article using search.
- Redirect hit counter shows which old URLs still get traffic.

### 28.9 Security
- Admin protected by GitHub login with 2FA; roles (Admin, Editor, Author).
- Content Security Policy tuned for ad networks, plus HTTPS-only headers.
- Sanitized embeds and uploads (SVG cleaning, file-type and size limits).
- Hotlink protection for images.
- Honeypot and Turnstile on forms and chat.

---

## 29. Hard Rules (Added Later, These Override Earlier Sections)

### 29.1 Ads Only Inside Articles (HARD RULE)
- Ads (Adsterra: Smartlink, Popunder, Native Banner, Social Bar, and Google AdSense) run **only on article pages** (`/YYYY/MM/DD/blogs/{category}/{permalink}/`).
- **No ads anywhere else:** home page, category pages, tag pages, author pages, search page, static pages (About, Contact, Privacy, etc.), 404, feeds, admin.
- Popunder and Social Bar scripts are loaded **only by the article template**, never by shared layout files, so they cannot appear on other pages.
- The India rule still applies on article pages: India off, other countries on.
- AMP: only the AMP version of an article may show ads (see Section 26); no other AMP page.
- **Enforcement:** the ad loader checks `data-page-type="article"` before loading anything; the build fails if any ad script, ad slot or ad network URL is found in a non-article HTML file; the Ads Manager shows page-type switches locked to "article only".
- Design preview: ad slot exists only in the article layout (inside the article, after the content).

### 29.2 Category Auto-Detect (Only Active Categories Are Shown)
- A category is **active** if it has at least **one published post in the last 7 days** (window is configurable, default 7).
- **Active categories** appear in the header menu, home page sections, footer category list and category widgets.
- **Inactive categories** (no new post in 7 days) are **hidden everywhere in the theme**: menu, home page, footer, widgets.
- Inactive categories can still be found **only through search** (search results show matching category and its posts).
- The category page and all its posts stay live at their normal URLs (no 404, no redirect); old links keep working and the category's lifetime posts remain intact (Section 17).
- A hidden category reappears automatically when a new post is published in it.
- Detection runs at every build, and a scheduled rebuild every 6 hours is needed because a category can expire without any new publish.
- Edge cases: if no category is active, the menu shows only "Latest"; a scheduled post counts only after it actually publishes; unpublished or draft posts never count.
- Admin: Categories screen shows each category's status (Active / Hidden) and last post date. Optional per-category override "Always show" or "Always hide".
- SEO note: hidden categories lose menu links, so keep them linked from breadcrumbs and article category labels, and keep them in the sitemap.

### 29.3 No Emojis, SVG Icons Only (HARD RULE)
- **No emoji anywhere on the site.** Not in the header, menus, buttons, footer, pager, article pages, category pages, error pages, the admin dashboard, the design preview, the web manifest or any generated file.
- **Every icon is an inline SVG.** That includes search, dark mode, menu, arrows, warnings, share buttons, check marks and anything new. Letters and symbols used as pictures are also not allowed: no arrow characters, no half-circle or three-dot symbols, no check marks, no stars (use an SVG instead).
- Icons are drawn once in `site/src/lib/svg-icons.ts` and used with the `Icon` component (`<Icon name="search" />`). They use `currentColor`, so light mode, dark mode and hover colours work without extra files. Each one is decorative (`aria-hidden="true"`); the button or link around it has the text or `aria-label` that screen readers read.
- Plain text characters are fine: the copyright, registered and trade mark signs, quotes, dashes, the middle dot, the rupee sign, digits, and every script (Bengali, Hindi and others).
- Article text: the author does not type emojis. If imported or pasted text contains one, the build stops and names the page and the character; remove it or replace it with a normal word.
- **Enforcement:** `npm run build` fails if any built page contains an emoji (also when written as an HTML entity written as a number code); `tests/unit/no-emoji.test.ts` fails if a template, script, dashboard file, design preview, config file or plan file (.md) has an emoji or a symbol used as an icon, and checks that every `Icon` name exists.
- Design preview: the preview file uses the same inline SVG icons.

---

## 30. Brand and Default Author

- **Brand / site name:** **Shivam Das News**. Used in the logo wordmark, `<title>` pattern (`{Post Title} | Shivam Das News`), `og:site_name`, `WebSite` and `NewsMediaOrganization` schema (`name`), footer copyright, About page, RSS feed title, web manifest name and short name, and the icon/favicon set.
- **Default author:** **Shivam Das**. Every new post is pre-filled with this author; it appears in the byline, the author box, `NewsArticle` schema (`author`), the author archive page `/author/shivam-das/` and the About/Team page.
- The author profile (photo, bio, social links) is filled with the owner's real details in the setup wizard; the author can still be changed per post, and more authors can be added later.
- Both are stored in `config/site.json` and the authors collection, so a later rename updates everything automatically.
- This replaces the "[Site Name]" and "[Author name]" placeholders used in the design preview.

---

## 31. Smart Push Notifications (Interest-Based, Own System)

> Goal: a reader gets a notification only when a story matches what they chose: their categories, their keywords and their alert level. Nothing is sent that they did not ask for. This section replaces the "OneSignal" idea in Section 19 (point 1): the system is built in this project (Web Push standard, free, no third-party service). Hard rules of Section 29 still apply.

### 31.0 Honest Notes First
- Push works only where the browser allows it: Chrome, Edge, Firefox, Opera, Samsung Internet on Android and desktop; Safari on macOS 13 or newer; Safari on iPhone and iPad (16.4 or newer) **only after the reader adds the site to the Home Screen**. The manifest already exists (v0.2.1). The page shows these steps to iPhone readers. No push on browsers that do not support it, and none with JavaScript off.
- A reader can say No at any time. A "denied" answer is final: the site never asks again.
- Free-plan limits decide how many readers one Worker can serve (see 31.11). The numbers there are estimates and must be checked against the current Cloudflare pages before the build.
- Nothing is faked: no fake subscriber counts, no sample notifications, no placeholder keys. `config/push.json` ships empty and the whole feature stays off until the owner fills it.

### 31.1 What the Reader Chooses (Preference Centre)
All choices live on one page, `/notifications/` (a utility page: no ads, not in the sitemap, `noindex`), and in a small panel opened from the soft prompt. Each choice has a plain default.

| Choice | Options | Default |
|---|---|---|
| Categories | any number, taken from **all** categories (an inactive category is listed with the note "no new stories lately", PLAN 29.2) | none: the reader must pick at least one category, one keyword or "Breaking news" |
| Keywords to follow | up to 10; one word or a short phrase (2 to 4 words); English letters, digits, space, hyphen, apostrophe | none |
| Keywords to mute | up to 10, same rules | none |
| Authors to follow | any number of authors that have an author page | none |
| Alert level | Breaking only / Important / Balanced / Everything I follow | Balanced |
| Daily limit | 1, 2, 4, 8 | 2 for Important, 4 for Balanced, 8 for Everything |
| Breaking news from any category | on / off | on |
| Quiet hours | start and end in the reader's own time zone, or off | 22:00 to 07:00 |
| Digest | off / morning / evening / both, and the hour | off |
| Learn from what I read | on / off (see 31.8) | on outside the consent countries, off inside them |
| Pause | 1 day, 7 days, until I turn it on | not paused |

Buttons: "Send me a test notification", "Save", "Unsubscribe and delete my data". A reader with no account is identified only by the browser's own push subscription plus a random manage token kept in that browser (31.3). A new browser or a cleared browser is a new subscriber (no cross-device profile, on purpose).

Keyword entry help: suggestions come from the site's real tags and category names (and, when search analytics exists, the real top searches). A word that is too common ("the", "news", "today", "india" alone) is refused with a plain message. A keyword that appears in no published post yet is allowed; the page says "No story has used this word yet" so nobody is surprised.

Article page extras: a bell button on the article ("Get alerts for this topic") that opens the panel with the article's category and focus keyword already filled in but **not saved** until the reader presses Save. Built in v0.63.0 (a link to `/notifications/?cat=...&kw=...`; the page fills the form and saves nothing). Later option: "Follow this developing story" (PLAN 28.2 threads).

### 31.2 When to Ask (Soft Prompt Rules)
- Never on the first visit. Never on the home page, category pages, legal pages, Contact, 404 or the preference page itself on arrival.
- The soft prompt (an inline card at the end of the article text, with an inline SVG bell) appears only when the reader has read at least 2 articles in this browser, or has been active on one article for 45 seconds and scrolled past 50 percent.
- The card asks one thing: "Choose the topics you want to hear about." The browser's permission box opens **only after** the reader presses that button and picks at least one topic.
- It never covers the article (no full-screen or sticky interstitial, because of the Google News rule against intrusive interstitials, Section 6).
- Dismissed once: not shown again for 14 days. Dismissed 3 times: never again in this browser. Permission "denied": never again.
- A small bell link in the header opens `/notifications/` at any time.
- Not an ad: it follows no ad rule, and it never loads an ad script. It also never shifts the layout (reserved height, BUGS A2).

### 31.3 Data Kept (and Not Kept)
Kept per subscriber in D1: a random id; the push endpoint address and its two public keys (needed to send); the hash of the manage token; level, daily limit, time zone name, quiet hours, digest times; categories, keywords, muted keywords, followed authors; a small learned weight per category; an engagement number; counters (sent today, last sent time, failures); status and dates.
**Never kept:** IP address, name, email, user agent text, exact location, reading history (the reading history stays in the browser, 31.8).
- The endpoint address is treated like a password: never printed in logs, never shown in full in the dashboard.
- Country (from the edge, two letters) is kept only to apply the consent rule and to show an aggregate map.
- Retention: a subscriber with no successful delivery and no visit for 90 days is deleted. Delivery logs older than 30 days are deleted. A failed endpoint (the push service answers 404 or 410) is deleted at once.
- Reports that show keywords show only keywords followed by at least 5 different subscribers (so nobody can be singled out).
- The Privacy Policy and Cookie Policy pages must describe push before it is switched on (the page generator gets a push paragraph that is written only when `config/push.json` is filled).

### 31.4 The Pipeline (From Publish to Phone)
1. **Publish.** The post is built and deployed as today.
2. **Announce.** (Part 6a built in v0.64.0: the route, the secret, the checks and the import guard. Part 6b built in v0.65.0: the live check, the Worker opens each page that passed the checks and needs status 200, HTML and no noindex; a page that is not live yet is not recorded, so the deploy job can ask again. Part 7d built in v0.94.0: `.github/workflows/push.yml` and `site/scripts/push-announce.mjs` send the posts of the last 2 hours after a deploy and every hour, and ask again only for pages that are not live yet.) After the deploy, a GitHub Actions job (`push.yml`, same idea as `indexnow.yml`) sends the newly live posts to the push Worker: `POST /announce` with a secret header. Each post is sent as: key (its permalink), URL, title, description, category, tags, focus keyword, author, flags (breaking, featured), the `push` setting, image address, publish time, word count.
3. **Check.** The Worker decides whether the post may be pushed at all (31.5).
4. **Find the audience.** Candidate subscribers are found through indexes (category list, keyword index, author list, breaking-all list), never by scanning everyone (31.6).
5. **Score.** Each candidate gets a score from 0 to 100 (LOGICS 19). Below the reader's threshold: skipped.
6. **Rules.** Daily limit, minimum gap, quiet hours, pause, story-thread merge (31.7).
7. **Queue and send.** Messages are encrypted and sent in small batches by a cron every minute (31.11).
8. **Result.** Delivered, expired (delete) or failed (retry later, then give up).
9. **Feedback.** The reader's tap or dismiss comes back and adjusts their weights (31.8).

### 31.5 Which Posts May Be Pushed
A post is pushed only if **all** are true:
- It is live: the Worker (or the Action) opens the URL and gets status 200 with `index` robots. Draft, scheduled-not-yet-live, archived, `noindex` and sponsored posts are never pushed.
- It was published less than 2 hours ago (`maxAgeMinutes`, default 120). This stops a flood when old posts are re-saved, re-built or imported.
- It was never announced before (the key is the permalink: a rebuild every 6 hours cannot send it twice; a changed slug keeps the old key through the redirect history).
- Its `push` setting is not `off`.
- Its title and description contain no emoji (PLAN 29.3 applies to notification text too). The Action stops with the post name; the Worker also refuses such text.
- **Import guard:** if one deploy announces more than 3 posts, only the 2 with the highest importance are considered and the rest are skipped, unless the editor set `push: force` on them. An XML import therefore can never notify the whole audience.

Front matter fields added to the post model (Section 20; built in v0.95.0: the schema, the dashboard check and the front matter order; the editor controls were built in v0.96.0, part 7e-2):
```yaml
push: "auto"        # auto | off | force   (auto = the algorithm decides; force = skip the importance part, never the reader's rules)
pushTitle: ""       # optional, up to 70 characters, replaces the headline in the notification
pushBody: ""        # optional, up to 120 characters, replaces the description
```
`breaking: true` (already in the model) is the one flag that raises priority. `force` still obeys each reader's choices: it never sends to someone who muted the topic, paused, or reached the limit (a force post can use the 2 extra slots described in 31.7).

### 31.6 Matching and Scoring (Summary)
Full pseudocode is in LOGICS.md, Section 19.
- **Candidates:** a subscriber is a candidate when the post's category is in their list, or one of their keywords shares a word with the post's title, tags, focus keyword or description, or the post's author is followed, or the post is breaking and the subscriber wants breaking news from any category.
- **Keyword match strength** (0 to 1): the whole phrase in the title 1.0; in the focus keyword or tags 0.9; in the description 0.6; every word of the phrase in title, tags and description but not together 0.5; in the first 300 words of the text 0.35. Words are lower-cased, accents removed, stop words dropped, plural and "-ing/-ed" endings reduced (light stemming, English only).
- **Mute** is a hard block: a muted keyword that matches the title, tags or focus keyword (strength 0.6 or more) removes the subscriber for this post, whatever the score.
- **Explicit part (up to 60 points):** the reader's own choices: category, keyword, author.
- **Other parts:** learned weight for the category (plus or minus 10), reading habit from the browser (up to 8), importance of the story (breaking 25, featured 12, trending 10), freshness (up to 7), and a fatigue penalty for what was sent recently (down to minus 20).
- **Gate:** without an explicit match (category, keyword or author) a non-breaking post is never sent. The algorithm never invents interests.
- **Thresholds by alert level:** Breaking only: the post must be breaking. Important: 65. Balanced: 48. Everything I follow: 30.
- The weights are constants in one file and are covered by tests; changing them follows VERSIONING.md.

### 31.7 Delivery Rules
- **Daily limit** per subscriber (the reader's number). Breaking news may use up to 2 extra slots per day. A post with score 90 or more may use 1 extra.
- **Minimum gap:** 30 minutes between two notifications (breaking is exempt).
- **Quiet hours:** computed at send time in the reader's own time zone (daylight saving safe). Non-breaking posts in quiet hours are held (up to 5 per reader, 6 hours). If the reader has a morning digest they go into it; otherwise they are dropped when they are older than 6 hours. Breaking news inside quiet hours is sent only if the reader turned on "Breaking news during quiet hours" (off by default).
- **Digest:** at the reader's digest hour, one notification lists up to 3 best unsent stories from the last 12 hours that match their choices ("3 stories for you"). A digest counts as one notification.
- **Story thread merge:** if a story with the same focus keyword (or two shared tags) was sent to this reader in the last 12 hours, the new notification **replaces** the old one (same `tag`, no new sound) and does not use a daily slot.
- **Site-wide daily cap** (`siteDailyMax`, default 8 campaigns per day, breaking exempt up to 3 more). The dashboard shows how many are used.
- **Time to live:** breaking 2 hours, normal 6 hours, digest 12 hours. A phone that was off does not wake up to old news.
- **Urgency header:** high for breaking, normal for others, low for digests.
- **Quiet failure:** if the push service answers "too many requests", the batch waits for the time it names (`Retry-After`). If it answers 404 or 410 the subscriber is deleted. Other errors are retried 2 times, then counted; 5 failures in a row pause the subscriber.

### 31.8 Learning From the Reader (Without Spying)
Two signals, both under the reader's control:
1. **Taps on notifications** (always on, needed for the feature to work): shown, opened, closed, "Less like this".
   - Opened: the category weight rises a little (0.10 of the remaining distance to +1); engagement goes up.
   - Closed without opening: the weight falls a little (minus 0.04).
   - "Less like this": the weight falls a lot (minus 0.25). After 3 such taps in 30 days for one category (counted since part 8c-1, v0.100.0: table `push_less`, answer field `suggestRemove`; the page text and the one-tap button since part 8c-2, v0.101.0; saving choices without the category clears its counted taps, so the offer does not come back), the preference page shows "You tapped Less like this for Sports 3 times. Remove Sports?" with a one-tap button. **The site never removes a choice the reader made by itself.** It only lowers the score within the limits above.
   - How the taps arrive (built in part 8a, v0.98.0, `workers/push/feedback.js`): the service worker (v0.54.0) sends `POST /feedback { sub, token, event, tag }` to the push Worker, `event` is `open`, `close` or `less`, `tag` is the story thread key. The Worker finds the category from its own record of what it sent under that tag; the text of the story is never sent back.
   - All weights move back toward 0 by 5 percent a week, so old habits fade (built in part 8b, v0.99.0: every hour in the clean-up tick, `FADE_SQL` in `workers/push/feedback.js`).
2. **Reading habit** (the switch "Learn from what I read"): the article page keeps, **in the browser only**, a count of articles read per category for the last 30 days. When the switch is on, only the top 3 categories (names, no counts) are sent along with preference saves. It never leaves as a history. Where consent is required (EU, EEA, UK, Switzerland, from the geo Worker's `consent` flag) the switch starts off.
- **Adaptive limit:** if after at least 20 notifications fewer than 5 percent were opened, the daily limit is halved (never below 1) and the preference page offers the digest. After 60 notifications or 45 days with none opened, the subscriber is paused; after 90 days of no visit, deleted.
- **Cold start:** a new subscriber starts with weight 0 and the limits they chose.
- **Smart timing** (optional, later part): remember the hours of the day when this reader usually opens notifications and use them to place the digest and to delay a non-breaking alert by at most 3 hours when the story is still fresh. Breaking is never delayed.

### 31.9 What the Notification Looks Like
- **Title:** the headline (or `pushTitle`), up to 70 characters, cut at a word boundary. **Body:** the description (or `pushBody`), up to 120 characters. No emoji or symbol icons anywhere (PLAN 29.3): the picture comes from an image file.
- **Icon:** the site icon (192 px). **Badge:** a one-colour badge image (new file `badge-96.png`, made by `npm run icons`). **Image:** the featured image when it is at least 1200 px wide (shown where the device supports it).
- **Buttons (two):** "Read now" and "Less like this". Plain text, no symbols.
- **Link:** the article URL with `?pn=1`. The canonical URL of the page stays clean (the parameter is ignored by the page), and the analytics beacon reads `pn=1` to count the source "Push notification" (Phase 6 source names; built in v0.97.0: the beacon sends `pn: 1`, the Worker stores `(push)`).
- **Tag:** the story thread key, so an update replaces the earlier one. Breaking news sets "renotify" so a replaced breaking alert still alerts.
- **Language:** English only (PLAN 3.1).
- **Encryption and signing:** payload encrypted with the standard `aes128gcm` method (RFC 8291) and the request signed with VAPID (RFC 8292), both done with the Worker's built-in WebCrypto: no outside library or service. The encrypted payload must stay under 4,000 bytes; text is cut to fit.

### 31.10 Safety for the Owner
- **Kill switch:** one setting turns all sending off at once (the Worker still accepts subscriptions).
- **Dry run:** before a `force` post is sent, the dashboard shows "This will notify about N subscribers" and a sample of the first 5 anonymous scores, and asks to confirm.
- **Test to myself:** sends one notification to the admin's own browser only.
- **No surprise sends:** only the GitHub Action (with the secret) and an admin (with the dashboard sign-in) can announce. A visitor can never trigger a send.
- **Audit log:** each announce (post key, who or what, number of candidates, number sent, time) is kept for 30 days and shown in the dashboard.
- **When unsure, do not send:** a failed live check, a missing field, a database error or a clock that looks wrong stops the announce and writes one line in the log. Nothing is sent with half the information.

### 31.11 Capacity on Free Plans (Estimates, Check Before Building)
- A free Worker call can make only a small number of outgoing requests (at the time of writing 50), and each push is one outgoing request. So sending is done in batches of about 40 by a cron that runs every minute and drains a queue table. Delivery of a large audience therefore takes minutes, not seconds. (Cloudflare Queues or the paid Workers plan lift this; check the current limits.)
- Rough planning figure: about 3,000 subscribers at 4 notifications a day is about 12,000 sends a day, which fits the free database write limit when only one row per send is written (a compact "sent" row for duplicate protection). Above that, plan for the paid Workers plan. The owner decides (INCOMPLETE.md).
- Indexes make the audience search cheap: the Worker reads only the subscribers who share a category, keyword or author with the post.
- Rate limits: subscribe and preference calls are limited per browser and in total; the announce call accepts the Action only.

### 31.12 Admin "Push" Screen (Admins Only)
- Audience: subscribers now, new this week, unsubscribes, paused, by country (aggregate), by alert level, by browser type.
- Interests: top categories and top keywords (only keywords with 5 or more followers).
- Sends: last 30 days, delivered, expired, failed, opened (click-through rate), closed, "Less like this" taps; per post: candidates, sent, opened.
- Health: last announce, queue size, kill switch, VAPID key status, free-limit warnings.
- Settings: site daily cap, max age, default levels, import guard, kill switch, quiet-hours default.
- Post editor: the `push` field (auto, off, force) and the two text fields, with a live preview of the notification (title and body length counters, emoji check).

### 31.13 Files and Setup (Plan)
```
/workers/push/        index.js  lib.js  prefs.js  announce.js  livecheck.js  audience.js  plan.js  sender.js  control.js  vapid.js  webpush.js  schema.sql  wrangler.toml   (cleanup.js: the hourly clean-up of old rows, v0.83.0; control.js: the kill switch PUSH_PAUSED, planning after /announce and the cron tick, v0.69.0; audience.js: the audience search of step 4, v0.66.0; plan.js: score, delivery rules and the queue of steps 5 and 6, v0.67.0; sender.js: one batch from the queue, send, retry and results of step 7 and 8, v0.68.0; prefs.js: subscribe, preferences and unsubscribe rules, v0.52.0; vapid.js and webpush.js: signing, encryption and the send function, v0.53.0)
/site/public/push-sw.js            (the service worker: show, click, close, "Less like this"; v0.54.0)
/site/src/lib/push-client.js       (subscribe, preference calls; v0.54.0; sendTest v0.62.0. The soft prompt rules and card are part 5)
/site/public/badge-96.png          (notification badge, made by npm run icons; v0.54.0)
/site/src/pages/notifications.astro (the preference page, noindex; core choices in v0.57.0, keywords to follow and mute in v0.58.0, quiet hours in v0.59.0, digest and pause in v0.60.0, authors in v0.61.0, the test notification button in v0.62.0, the rest in part 5c)
/site/src/lib/notifications-page.js (the page logic; v0.57.0, keyword boxes v0.58.0, quiet hours v0.59.0, digest and pause v0.60.0, authors v0.61.0, test button v0.62.0)
/site/src/components/PushPrompt.astro  (the soft prompt card; v0.56.0)
/site/src/lib/push-prompt-client.js    (the rules of 31.2 in the browser; v0.56.0)
/site/config/push.json             { "endpoint": "", "vapidPublicKey": "" }  (ships empty = feature off)
/site/scripts/make-vapid.mjs        (npm run vapid: prints one VAPID key pair, writes no file; v0.53.0)
/.github/workflows/push.yml        (announce new posts after deploy)
```
Secrets (never committed): `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a mailto address), `PUSH_ANNOUNCE_SECRET` (also a GitHub secret), `ALLOWED_USERS` for the dashboard calls.

### 31.14 Done When
A test reader who follows the category "Technology" and the keyword "iPhone" on a real phone receives a notification within one minute of a matching article going live; does not receive one for a Sports article; does not receive one for a Technology article that contains a muted word; receives a second article of the same story within 12 hours as a replacement, not as a new alert, and a different matching article inside the 30 minute gap not at all (it is held or dropped); and after "Unsubscribe and delete my data" no row remains.

---

## 32. Same-Title Match and Lifetime Redirects from the Old Blogger Blog

> Goal: a post that has the exact same title on the old blog (`https://shivam-das-news-usa.blogspot.com/`) and on this site (`https://www.shivam-das.online/`, the one canonical host, BUGS S10) gets a permanent redirect from its old address to its new address, kept for life. Code: `site/src/lib/title-match.js`, `site/scripts/title-match.mjs`. Algorithm: LOGICS 20. Bugs: BUGS group T. The hard rules of Section 29 still apply (the redirect work adds no ad code and no emoji).

### 32.1 Honest Limit
A `blogspot.com` address cannot send a real 301, and Cloudflare cannot sit in front of a name that is not yours. So:
- **New site:** a real 301 in `_redirects` for the old Blogger-style address (`/YYYY/MM/slug.html`, pages `/p/slug.html`). It helps when the new domain once served the Blogger blog and old links to it exist. For life, because the list is a file in Git that only grows.
- **Old blog:** a small script in the Blogger theme (generated as `blogger/redirect-snippet.html`) sends the visitor to the new address. Google follows it when it renders the page, which is weaker and slower than a 301. Blogger Custom redirects (Settings, Errors and redirects) may do better; try one row, because it is not known whether a target on another domain is accepted. All of this lasts only while the Blogger blog exists: keep it, and do not delete its posts.
- The direction is old blog to new site. The bare `shivam-das.online` goes to `www` with one Cloudflare Redirect Rule (the `_redirects` file cannot match on a host name).

### 32.2 Match Rule
- The key is the title after a safe clean-up only: entities, Unicode form (NFC), invisible and non-breaking spaces, repeated spaces. Case, punctuation, quote style and every letter must be equal ("Big News" is not "big news").
- Exactly one old and one new post per key. A title used twice on either side is skipped and listed; a person adds a hand-made redirect.
- Near matches (same words, different case or quote style) are only listed, so a person can fix one title; the next run pairs it. The code never guesses.
- No match, no redirect. A post on one side only is never sent to the home page or a category (soft 404).

### 32.3 Lifetime Rule
`config/title-redirects.json` is append only. An entry stays when the old post is deleted, when its title is edited, or when the new post is archived (the build drops the line for that build and the entry returns when the post is live again). When the new post changes slug, category or date, the entry moves with it. If the same old address now matches a different post, the entry is kept and a conflict is printed. An entry is removed only by a person, with a line in the changelog.

### 32.4 Pipeline
A daily Action (`title-match.yml`) reads the whole Blogger feed (posts and pages; it stops if the count differs from the feed total) and `/title-index.json` of the site, merges the pairs into the list, checks every entry and commits a change, which starts the normal deploy. The build adds the entries to the normal redirect builder (chain collapse, loop guard, live target, 2000 line limit). The script writes nothing when a list is empty, a fetch fails or an entry is unsafe. The Blogger snippet is pasted into the theme by hand (Blogger has no way to receive it) and pasted again when the Action changes it.

### 32.5 Done When
A post with the same title on both sides: its old `.html` address answers a 301 on the new site, and the old Blogger address opens the new article. "Big News" against "big news" and a title used twice are listed and not redirected. After the old post is deleted and the script runs again, the entry is still in the list. A slug change on the new post keeps the old Blogger address working in one hop.


---

## 33. Search Engine Listing and File Editor (Shopify-Style)

> Added in v0.65.1. Plan only: nothing in this section is built yet. Build order is in CODING_PLAN.md, Phase 3b.

### 33.1 The Idea
Shopify shows every product, page and blog post with one small box called "Search engine listing": a preview of how the page looks in Google, and an Edit link that opens three plain fields (page title, meta description, URL handle). A non-technical owner can fix SEO without knowing any code. The same box is added to every editor of this dashboard. It sits on top of the live SEO score of PLAN 5.3, it does not replace it.

### 33.2 The Search Engine Listing Box (in every editor)
Where: post editor, page editor, category, tag and author screens, and the home page settings.

**Closed state:** a Google-style preview card: the page title in link style, the address as a breadcrumb path, the description under it, a Mobile and Desktop switch, and an "Edit" link. A grey "auto" label shows when a value is made by the system.

**Open state (after Edit):**
| Field | What it does | Counter and limit |
|---|---|---|
| Page title | `metaTitle`; empty = the headline plus the site name | warn above 60 characters (where Google usually cuts), stop at 70 |
| Meta description | `description`; empty = the first 155 characters of the summary or first paragraph, plain text | warn above 160, stop at 320 |
| URL handle | `permalink` (the slug). The fixed part of the address is shown in front and cannot be edited, only the handle | lower case letters, digits and hyphens only |

Rules:
- The preview changes while typing, and uses the same cut and fallback functions as the real page head (`src/lib/seo.ts`), so what the owner sees is what Google receives.
- Each field has a "Reset to auto" link.
- **Change of a handle on a published post** asks one question: "Create a 301 redirect from the old address?" It is on by default and cannot be switched off for a post that has been live more than 24 hours (PLAN 9, BUGS A group).
- **Hide this page from search engines** (a switch): sets `robots: noindex,follow`, removes the page from the sitemaps and from push notifications. A red note appears if the post is breaking or featured.
- **Advanced fold:** canonical override, Open Graph title, description and image (with a share-card preview and "Use the featured image"), schema type.
- The box shows the checks of `admin/js/seo.js` next to the fields (focus keyword in title, description and handle, length, duplicates). Hard errors block Publish (empty title, a handle already used, an emoji in the title or description, a featured image under 1200 px wide). Everything else is a warning.
- No emoji in any field (PLAN 29.3); the preview never shows one.

### 33.3 The File Editor (Media Files)
A "Files" screen next to the Media Library. A grid and a list view with search. Opening a file shows one editor:
- Preview, file name, type, size, width and height.
- **Alt text** (counter, recommended up to 125 characters), caption, credit, and the "Used in" list of posts and pages that show this file.
- **Image SEO checks:** alt text present, a readable file name (not `IMG_1234`), width of at least 1200 px for a featured image, WebP, size inside the speed budget.
- **Rename:** the old address is kept working (a redirect for the file path) and the posts that use it are updated in the same commit.
- **Replace file:** the address stays the same.
- **Delete:** refused while a post uses the file, with the list of posts.
- **Bulk alt text:** a table of all files without alt text, edited in one screen and saved in one commit.
- Where it is kept: alt text, caption and credit of a file are in `config/media.json` (file path to fields); a post still keeps its own `imageAlt` for the featured image, and the post value wins.

### 33.4 The Content File View
Each post and page is one Markdown file with front matter (PLAN 20). The editor shows the form on top and a "File" tab with the raw Markdown and front matter, read-only for writers and editable for admins. Saving always goes through the validators (headings, emoji, handle, dates). Older versions come from Git history with one-click restore (PLAN 12).

### 33.5 Who May Do What
Writers edit title, description and alt text. Only editors and admins change the handle of a published post, switch noindex, set a canonical or rename or delete a file. All of it is checked again on the server side of the save (GitHub commit), not only in the screen.

### 33.6 Done When
A non-technical user opens a post on a phone, sees the preview, edits the three fields, sees the counters and the preview change, and publishes. Changing the handle of a live post gives a working 301. The noindex switch adds the robots tag and removes the page from the sitemap. Alt text edited in the Files screen shows in the article. Unit tests cover the fallbacks, the limits, the handle rules, the preview cut, and the checks; the screen is tested in jsdom like the other admin screens.


---

## 34. Auto Image Hosting: Hotlinked Pictures Become Our Own Files (Own CDN, SEO Names)

> Added in v0.65.2. Plan only: nothing in this section is built yet. Build order is in CODING_PLAN.md, Phase 3c. It extends the image re-hosting of the XML import (v0.13.0), which today works only during an import and names files after the old address.

### 34.1 The Idea
Any picture that is **hotlinked** (the address points to another website) is downloaded automatically, optimized, given an SEO-friendly file name, saved in our own media folder, served from our own CDN, and the post is changed to use the new address. The editor does it for the writer: paste a post with outside pictures, press Save, and every picture is ours. No outside address stays in a published post.

Why: a hotlinked picture can disappear, change, slow the page, leak the reader's visit to another site, be blocked in Discover, and gives no image SEO to us.

### 34.2 When It Runs (four doors, one engine)
1. **Editor, on Save** (and on Paste, as a preview): finds outside pictures in the body, the featured image and the Open Graph image. The screen shows "Hosting 3 pictures" and the result of each. A setting lets the owner choose "ask first" instead of automatic.
2. **XML import** (Blogger, WordPress): the same engine replaces the old naming of v0.13.0.
3. **Safety net, GitHub Action `hotlink.yml`:** on every push and once a day it scans all content files for outside pictures (a file edited by hand, a bad import) and fixes them in one commit.
4. **Build gate:** a published post that still has an outside picture gives a warning (a hard block can be switched on in settings).

### 34.3 What Happens to One Picture
1. **Find.** Markdown images, HTML `<img>` and `srcset`, the front matter fields `image` and `ogImage`. Only addresses on another host. Already hosted ones and `data:` pictures are skipped.
2. **Check the address.** https only, port 443, no user name or password, a public host (never localhost, a private or internal address, or a name that points to one), at most 3 redirects and each redirect is checked again.
3. **Download** through a small Worker (`workers/images`, see 34.8), because a browser cannot read another site's picture (CORS). Limits: 10 MB, 5 seconds without data, 15 seconds in all, at most 30 pictures in one call. If a site refuses a request without a referrer, try once more without one; the code never fakes a referrer.
4. **Check the bytes.** The real content is an image (the first bytes, not only the header): JPEG, PNG, WebP, AVIF, GIF. SVG is refused by default. A file that is not an image is refused.
5. **Same picture twice?** The SHA-256 of the bytes and the outside address are looked up in `config/media.json`. A known picture reuses the old file and nothing new is saved.
6. **Optimize.** WebP, width capped at 2400 px, quality 85, EXIF and location data removed, width and height read. A small GIF stays a GIF; a GIF over 5 MB is refused.
7. **Name and path** (34.4).
8. **Write, rewrite, record.** The file is saved, the post is changed to the new address, and the details are written to `config/media.json` (34.6), in **one commit**: all or nothing.

### 34.4 SEO File Name and Path
The name comes from the best text available, in this order:
1. the picture's alt text; 2. its caption; 3. the nearest heading above it; 4. the focus keyword plus the main words of the post title; 5. the old file name if it is meaningful; 6. the post handle plus a number (`phone-launch-image-2`).

Rules for the name:
- lower case English letters, digits and hyphens only; accents removed; other scripts transliterated or dropped;
- 3 to 6 words, 60 characters at most, stop words dropped (a, the, of, in);
- never a camera or random name (`IMG_1234`, `DSC0001`, `Screenshot`, `untitled`, `download`, a hash, a long number), never a query string, never the other site's name;
- a name already taken gets `-2`, `-3` and so on; two different pictures never share a name;
- the extension is `.webp` (or `.gif`).

Example: `https://other.com/wp-content/uploads/IMG_20261113_0934.jpg?w=900` with alt text "New phone launch event in Delhi" becomes `/media/2026/11/new-phone-launch-event-delhi.webp`.

Path: `public/media/YYYY/MM/<name>.webp`, served as `/media/YYYY/MM/<name>.webp`. YYYY and MM are the **post's publish date**, not the day of the download, so the path is stable. A name is final once saved: a later change of the post title does not rename it (the rename tool of PLAN 33.3 can, with a redirect).

### 34.5 Automatic Image SEO
- **Alt text:** the writer's alt text is kept. If it is missing, it is built from the caption, the nearest heading or the post title and marked "auto, please review". Facts are never invented, and nothing is sent to an AI service unless the owner adds that later.
- `width` and `height` written on every picture (no layout shift), `loading="lazy"` except the first picture, which gets `fetchpriority="high"`; `srcset` sizes 480, 800, 1200 and 1600 where the picture is wide enough.
- **Credit and source:** kept in `config/media.json` (source address and host, credit if the writer typed one, date, hash). The page shows the credit line when there is one.
- **Discover check:** a hosted featured image under 1200 px wide is a warning (PLAN 6).
- The image sitemap and `og:image` use the hosted file. The old outside address is never used again.
- **Rights notice, always shown:** "Hosting a picture here does not give you the right to publish it. Check the licence and add the credit." Pictures from known agency and stock hosts (a list in `config/images.json`, for example Getty, Shutterstock, Alamy, wire agencies) are **not** hosted automatically: the writer must confirm first. The owner is responsible for the rights; the tool only helps and keeps the source.

### 34.6 What Is Stored
`config/media.json` (shared with PLAN 33.3), one row for each hosted file:
```
"/media/2026/11/new-phone-launch-event-delhi.webp": {
  "alt": "", "caption": "", "credit": "",
  "sourceUrl": "https://other.com/...jpg", "sourceHost": "other.com",
  "sha256": "...", "width": 1600, "height": 900, "bytes": 84210, "hostedAt": "2026-11-16T10:00:00Z", "autoAlt": true
}
```
The outside address is kept so that the same picture met again (a re-import, another paste) is found and reused.
When smaller copies exist (34.5), the row also holds `"variants": [480, 800, 1200]`, the widths of the copies saved next to the picture (`name.480w.webp`). The copies and this note are saved in the same commit, so a `srcset` never names a copy that is missing. No `variants` key means no copies.

### 34.7 Own CDN
- **Default:** the files live in the repo under `public/media/` and Cloudflare Pages serves them from its global edge network (our own domain, no other host in the address). `_headers` gives `/media/*` the header `Cache-Control: public, max-age=31536000, immutable`; this is safe because a name never changes after it is saved.
- **Option for a big site:** a Cloudflare R2 bucket on a custom domain such as `media.yourdomain.com`, selected in `config/images.json` (`storage: "r2"`). Honest note: a repo should stay under about 1 GB; at roughly 150 KB a picture that is about 5000 pictures, so move to R2 before that. The addresses written in posts follow the setting.

### 34.8 The Worker (`workers/images`)
A private endpoint, `POST /fetch` with a list of addresses. Only a signed-in dashboard user (the same login as the other Workers) or the Action (a secret header) may call it; the answer holds the bytes and a short result word for each address. It does the address check, the redirect check, the size and time limits and the byte check of 34.3. It stores nothing and logs no query strings. A rate limit applies.

### 34.9 When Something Fails
- A picture that cannot be fetched (404, timeout, blocked address, too big, not an image) **stays as it was** and is listed in the dashboard with the reason and a Retry button. A post is never changed to a broken address and no original reference is lost.
- Mixed results are fine: the pictures that worked are hosted, the others are flagged.
- The build gate lists posts that still have outside pictures.

### 34.10 Settings (`config/images.json`)
On or off; automatic or ask first; maximum size and width; quality; storage (`repo` or `r2`); the agency host list; the allow list and block list of hosts; hard block at publish (off by default); the naming order (34.4 is the default).

### 34.11 Done When
A post with three outside pictures is saved: all three are in `/media/YYYY/MM/` with SEO names, the post uses the new addresses, missing alt text is filled and marked for review, the same picture twice uses one file, a 404 picture is flagged and not lost, a private address is refused, an agency host asks first. A built site has no outside `img` address in any published post. The tests of LOGICS 22 pass, and the Worker is tested with fake sites.


---

## 35. AI Operator: Running the Site Through GitHub (Plan)

> Added in v0.65.3. Plan plus a new guide file, `AI_OPERATIONS.md`. The code of the site does not change.

### 35.1 Why It Works
The site has no database for content. Posts, pages, authors, settings and redirects are files in Git, and a commit starts the deploy. The dashboard is only a friendly screen that makes the same commits. So an AI assistant with write access to the repository can create, edit, publish, unpublish, schedule, delete and redirect, as long as it writes the files exactly as the build expects.

### 35.2 What Is Possible and What Is Not
| Task | By an AI through GitHub |
|---|---|
| Create, edit, delete a post or page | Yes |
| Publish, unpublish (draft or archived 410), schedule (future date) | Yes |
| Redirects: create, update, delete (post `redirects` list, `config/redirects.json`) | Yes |
| Authors, site settings, ad and push settings files | Yes (values only) |
| Pictures | Only if the connector writes binary files; otherwise through the dashboard |
| Cloudflare Workers, secrets, D1, R2, DNS | No |
| Search Console, AdSense, Adsterra accounts | No |
| Run tests and the build | Only through GitHub Actions |
| Live traffic numbers | Only through the dashboard or the Analytics Worker |

### 35.3 Safe Working Rules
Branch and pull request, one task per commit, a green check before merge, no secrets, no emoji, no invented fields (the full list is in `AI_OPERATIONS.md`). A mistake in a published post's front matter stops the build, so the checks come first.

### 35.4 What the Plan Adds (CODING_PLAN Phase 3d)
1. `AI_OPERATIONS.md`, the exact recipes (done in v0.65.3).
2. A content check script `site/scripts/validate-content.mjs` that uses the same Zod schema as the build.
3. A workflow `validate.yml` that runs the tests and the build on branches and pull requests.
4. Optional auto-merge of a pull request when the check is green, for content-only changes, if the owner switches it on.
5. A plain-language "AI task log" file written on every AI commit message pattern, so the owner can see what was changed (Git history is the log).

### 35.5 Risks
- A public repository shows drafts and scheduled posts. Consider a private repository.
- An AI can make a wrong edit. Git history restores any file with one click; protect `main`.
- The hourly rebuild means a scheduled post can be up to an hour late.

### 35.6 Done When
The owner asks the AI in chat to "publish this draft", "schedule it for tomorrow 9 am", "unpublish it", "redirect /a/ to /b/" and "delete that redirect", and each one ends as a green commit with the right result on the live site, with no change made outside the files named in `AI_OPERATIONS.md`.

---

## 36. Auto Language and Location Schema (v0.70.0)

> Every post gets its language and its place in the JSON-LD by itself. The editor types nothing. Code: `site/src/lib/geo-schema.ts`. Rules: LOGICS Section 24. Tests: `site/tests/unit/geo-schema.test.ts`.

### 36.1 Language (automatic, no field)
- `inLanguage` is written on every schema block: the post (`NewsArticle`, `Article`, `BlogPosting`), `WebSite`, `CollectionPage`, and every `WebPage`, `AboutPage` and `ContactPage`.
- The value comes from `locale` in `config/site.json`: `en_US` gives `en-US`, `en_GB` gives `en-GB`, `en` stays `en`. A missing or unusable value gives `en` (the site is English only, Section 3.1).
- Change the locale once and every page follows at the next build. `<html lang="en">` and `og:locale` are unchanged.

### 36.2 Location (automatic, one optional field)
Two schema properties are written only when a place is really found. An empty value is dropped, never faked (Section 8 rule).
- `contentLocation`: where the story happens. One place is an object, two or three are a list. At most 3.
- `locationCreated`: where the story was written, taken from the dateline at the very start of the text (`KOLKATA — ...`, `NEW DELHI, Nov 16 (Reuters) — ...`). Only a long dash counts, so a shouted headline is never read as a dateline.

Order of work for one post:
1. The front matter `location` list, if it has names (up to 3). It wins over everything. `["none"]` switches the place off for that post.
2. Otherwise the post is scanned automatically: the title (3 points), each matching tag (2 points), the first 300 words of the text (1 point for each mention, at most 3) and the dateline city (3 points). A place needs 3 points or more. A passing mention in the text alone is not enough.
3. Names that are also people or common words (Georgia, Jordan, Chad, Turkey, Niger, Guinea, Mali, Nauru) count only when the post has them as a tag or in `location`.

What is known as a place:
- **All countries**, read from the computer's own ICU data (`Intl.DisplayNames`), plus the short names USA, UK, UAE, Britain, Turkey, Burma, Holland. Nothing to maintain.
- **The owner list** `site/config/locations.json` for cities, states and other places. It ships empty (`[]`, Section 25: no demo content). Each entry: `{ "name": "Kolkata", "type": "City", "country": "IN", "aliases": ["Calcutta"] }`. `type` is `City`, `State`, `Country` or `Place`. A city or state with a `country` is written with a postal address, so the country is stated too.

### 36.3 What Is Written (example)
```json
"inLanguage": "en-US",
"contentLocation": [ { "@type": "City", "name": "Kolkata", "address": { "@type": "PostalAddress", "addressCountry": "IN" } } ],
"locationCreated": { "@type": "Place", "name": "Kolkata" }
```

### 36.4 Limits (honest)
- Only English text is scanned. A place missing from the owner list and not a country is found only through the dateline or the `location` field.
- A wrong guess is possible, for example a country named in a title that is not the story's place. The editor can fix it with `location` or switch it off with `["none"]`.
- The dashboard has no field for `location` yet (open item). It is kept when a post is saved, and an AI can write it (AI_OPERATIONS Section 3).
- No page text shows the place. This is schema only.

### 36.5 Done When
A post with a dateline and a country in its title shows `inLanguage`, `contentLocation` and `locationCreated` in its page source, the Rich Results Test shows no error, and a post with no place shows none of the two place fields.

---

## 37. Direct Code Writing in the Editor (Blogger HTML View and Shopify "Show HTML") (plan added in v0.101.1)

> Goal: the editor of a post can take code written directly, in any language, without leaving the dashboard, and it stays easy for a person who never wrote code. Two different needs, kept apart on purpose: (A) SHOW code to readers (a tutorial with Java, Python, CSS, HTML and so on) and (B) RUN code on the page (a custom layout, a table, an embed, a small script). Nothing is built yet; the parts are in CODING_PLAN Phase 3e. Rules: LOGICS Section 25. Risks: BUGS group K. This section is the full version of the one line in Section 27 ("custom HTML, CSS or JS for that one article") and it wins where they differ.

### 37.1 What the owner gets (plain words)
- A new tab row above the body: **Write**, **HTML**, **Preview**. Write is the Markdown box that exists today. HTML is the raw page code, like the HTML view of Blogger. Preview shows the real article look.
- Two new toolbar buttons: **Code** (a code block to show to readers) and **HTML block** (code that runs on the page).
- A **Page CSS** box and a **Page JavaScript** box in a fold called "Advanced code" for that one article.
- One big **full screen code editor** (button "Full screen") with line numbers, tab key, auto close of tags, find, undo and a word wrap switch. It works on a phone.
- Every box has one help line in plain words and a red note where the code runs on the live page.

### 37.2 Part A: Code blocks (show code to readers, safe for everyone)
- Button **Code** asks one thing: the language, from a short list with a search box: HTML, CSS, JavaScript, TypeScript, JSON, Java, Kotlin, Python, PHP, C, C++, C#, Go, Rust, Swift, Ruby, SQL, Bash, PowerShell, YAML, XML, Markdown, Plain text. Default: the language used last.
- Optional: a file name label (for example `style.css`), line numbers on or off.
- Stored as a normal Markdown fence with the language name (three backticks and the name). Nothing special, so the file stays readable and XML export and import keep working.
- Colours are made **at build time** (Astro's built-in highlighter, no JavaScript sent to the reader). Light and dark colours both pass contrast 4.5 to 1. Long lines scroll inside the box; the page never scrolls sideways at 320 px.
- A **Copy** button on every block (an inline SVG icon, Section 29.3, and a text label for screen readers). It is the only script, it is tiny, and the code is readable with JavaScript off.
- Code text is never run, never linked automatically (Section 7), never counted in the reading time and the word count, and never used for the auto meta description.
- All roles may use code blocks, including the author role.

### 37.3 Part B: HTML block (code that runs on the page)
- Button **HTML block** inserts a marked block in the body: a line with three colons and the word html, the code, and a line with three colons. The editor shows it as a box with a red edge.
- What may be inside (the allow list, LOGICS 25.1): headings from H2 down, paragraphs, lists, tables, figures, images, links, buttons used as links, details and summary, blockquote, code and pre, span and div with class and style, audio and video from our own files, and **iframes only from the allowed hosts** (YouTube no-cookie, Vimeo, Google Maps, Spotify, and hosts the owner adds in settings). Everything else is removed at save and the editor says what was removed.
- Always removed: the H1 tag (Section 5.2), `on...` handlers, `javascript:` addresses, `<script>` (scripts have their own box, 37.4), `<style>` (CSS has its own box), `<link>`, `<meta>`, `<base>`, `<form>` that posts to another site, `<object>` and `<embed>`.
- Pictures from other sites inside an HTML block are hosted by us at publish (Section 34), same as in the Markdown body.
- Who: **editor and admin** only. The author role sees the button locked with the words "Ask an editor".
- Size: up to 50 KB per block, 100 KB for all blocks of a post.

### 37.4 Page CSS and Page JavaScript (for that one article)
- **Page CSS** (up to 20 KB): put at build in a style tag of that page only, and every rule is wrapped so it can touch only the article text area (`@scope` with a class made from the post, with a safe fallback prefix). It cannot restyle the header, the footer, the menu or the ad slot. Blocked: `@import`, a url that is not our own file or a data picture, and a fixed or sticky box that covers the screen (an overlay is an intrusive interstitial, Section 6).
- **Page JavaScript** (up to 20 KB): **admin only.** Runs after the page is ready, inside a function so it makes no global names. Scripts from outside only from the allowed hosts (cdnjs and jsDelivr, pinned version). It cannot be added to category, tag, author or home pages, only to articles and pages.
- For every Page JavaScript the build writes the sha256 hash to `site/public/_headers` for that page, so the script keeps working when the content security policy changes from report only to enforcing (BOT_PROTECTION Part 6b). Without a hash an enforcing policy would block it.
- The AMP version of an article drops HTML blocks that need scripts, Page CSS beyond the AMP limit and all Page JavaScript (Section 26). Code blocks stay.

### 37.5 The HTML tab (like Blogger)
- Shows the whole body as HTML. Changes made here go back to the Markdown body when the HTML can be written as Markdown (headings, paragraphs, lists, links, images, bold, italic, quotes, code); the part that cannot becomes an HTML block automatically and the editor says so in one line.
- A page that was imported from Blogger and has layout that Markdown cannot hold is kept as one HTML block, so the look is not lost (Section 11).
- The tab is read and write for editor and admin, read only for the author role.

### 37.6 Safe preview (the dashboard holds the GitHub token)
- Preview of HTML blocks and Page JavaScript runs in a **sandboxed iframe without same origin** (`sandbox="allow-scripts"` and nothing else), so the code can never read the token, the cookies or the dashboard. The dashboard policy needs one small change for this (frame source `about:srcdoc` only), listed in CODING_PLAN.
- The Google, Discover and social previews use the text of the post, never the code.

### 37.7 Rules that hold everywhere
- **One H1** (Section 5.2): the build linter reads the HTML blocks too; two H1 or a skipped heading level is a warning and the Publish button shows it.
- **No emoji, SVG icons only** (Section 29.3): the build also scans code blocks, HTML blocks and Page CSS and JavaScript. A code sample that really needs an emoji character must be written with its escape text, not the character.
- **Ads only inside articles** (Section 29.1): the build fails if an HTML block or Page JavaScript holds an ad network address or an ad slot. Custom code cannot add, move or hide the real ad slots.
- **Real content** (Section 25): no sample code left in a published post. The editor shows a warning for text such as lorem ipsum or example.com inside code.
- **Speed**: the whole article stays under the size target of Section 27. The editor shows the size and turns red when it is over.
- **Feeds and push**: RSS and the Google News sitemap carry the text and code blocks, never scripts or HTML blocks that only make a layout.
- **Safety copy**: every save of an HTML block or a script keeps the last good version (autosave and undo), and a red "Undo my last code change" button restores it.

### 37.8 Roles
| Action | Author | Editor | Admin |
|---|---|---|---|
| Code block (show code) | yes | yes | yes |
| HTML tab, HTML block | read only | yes | yes |
| Page CSS | no | yes | yes |
| Page JavaScript | no | no | yes |
| Add a host to the allow list | no | no | yes (Settings) |

The real lock is still GitHub write access (the roles file says so). The roles only decide what the dashboard offers and what the build accepts.

### 37.9 Open decisions (see INCOMPLETE items 19 to 22)
Who may add scripts (proposed: admin only), highlight at build or in the browser (proposed: at build), the HTML tab with two way conversion or read only raw view (proposed: two way with the automatic HTML block), and the first allow list of iframe hosts.

### 37.10 Done When
An editor on a phone writes a post with a Java code block and a Python code block, adds an HTML table in an HTML block, turns on Page CSS, publishes, and the live page shows coloured code with a Copy button, the table, the CSS only inside the article, one H1, no console error, and the page source holds the full text. An author tries the HTML block and sees it locked. An admin adds one small script and it works; the same script pasted into an HTML block is removed with a clear message.

---

## 38. Connected Apps: Professional AI and Tool Connection, Like a Shopify Custom App (plan added in v0.101.3)

> Goal: ChatGPT, Claude or any other tool works on the site through a proper, limited, switch-off-able connection, and never by logging in to the dashboard through a browser robot. The model is the Shopify "Develop apps" screen: the owner makes an app, ticks what it may do, gets a token once, and can see every action and cancel the app with one click.

### 38.1 What the owner gets (plain words)
- A new dashboard screen **Connected apps** (admin only). Button **Create app**: a name (for example "ChatGPT"), a list of tick boxes in plain words ("Write and edit posts", "Publish and unpublish", "Archive posts", "Edit authors", "Edit redirects", "Read traffic numbers"), an expiry (90 days proposed). Then **Create token**.
- The token is shown **once**, with a Copy button, like Shopify's Admin API access token. The site keeps only a fingerprint of it, so even the owner cannot read it again; a lost token is replaced, never recovered.
- For each app: last used, what it did (the activity list), a **Pause** switch, and **Revoke** (the token stops working at once).
- A job that took 6 minutes with a browser robot (the test of 2026-11-16: delete a test post, rewrite one author bio) takes seconds and one request.

### 38.2 Honest limits (read first)
1. The connection needs **one new Cloudflare Worker** (`workers/api`) and **one GitHub App**. The owner creates both once (steps in the README, Part 4 and Part 8). An AI cannot do this for the owner (AI_OPERATIONS Section 0).
2. **Which assistants can use it depends on the assistant's own plan, not on this site.** Checked on the web on 2026-11-16 (sources disagree in places, so check again on the day): ChatGPT Free cannot add a custom connector; custom MCP servers need a paid ChatGPT plan, and one dated report says Plus did not list the tools while the help pages limit full write access to Business, Enterprise and Edu. Claude allows custom connectors on every plan, with one connector on Free. Codex, Claude Code and any script can use the plain API with a token on any plan they run on. The owner's ChatGPT account in the screenshot is Free; on Free the best path stays AI_OPERATIONS Section 15 path 1 (the GitHub connector).
3. ChatGPT asks the person to confirm before each write. That is a safety rail and it also means no job finishes while the owner is away.
4. This is not Shopify's app store. It is the core only: scoped token, API, activity log, revoke. No public apps, no billing.

### 38.3 How it works
```
Assistant  --HTTPS + token-->  Worker workers/api  --GitHub App key-->  GitHub (one commit)  -->  Cloudflare Pages builds
                                 | checks: token, scope, expiry, pause, rate limit
                                 | checks: the same content rules as the build (LOGICS 26)
                                 | writes: one line in the activity log
```
- The assistant never sees a GitHub key, a Cloudflare key or the dashboard. It sees only its own token, which can do only what was ticked.
- The Worker holds the **GitHub App** private key as a secret. For each job it asks GitHub for a short token (about 1 hour) limited to this one repository, and uses it for one commit with the Git Data API (the same method as `commitFiles` in `github.js`).
- The GitHub App has only: Contents read and write, Pull requests read and write, Metadata read. No Administration, no Actions, no Secrets, no other repository.
- Every commit says who made it: author "ChatGPT (Connected app)" and a line `Via: app <app id>, token <last 4 characters>`.

### 38.4 Rights (scopes), in plain words
| Scope | Plain words | Default |
|---|---|---|
| `read_posts` | Read posts, pages, authors, redirects and the build status | on |
| `write_posts` | Create and edit drafts and published posts | off |
| `publish_posts` | Publish, schedule and unpublish | off |
| `archive_posts` | Archive a post (the address answers 410, PLAN 9) | off |
| `delete_forever` | Delete a post file for good | **off, shown in red, one app at a time** |
| `write_authors` | Edit author files and bios | off |
| `write_redirects` | Add and remove redirects | off |
| `write_media` | Upload pictures (WebP only, size limit) | off |
| `read_analytics` | Read the numbers of the Analytics screen | off |

Never possible for any app, whatever is ticked: settings files (`config/`, except redirects and categories names), `workers/`, `.github/`, `site/src/`, `site/public/admin/`, `package.json`, keys. These need a person and a pull request.

### 38.5 The API (version 1)
Base address `https://<api host>/v1`. JSON in, JSON out. `Authorization: Bearer <token>`.
| Request | Scope | What it does |
|---|---|---|
| `GET /status` | any | Token name, rights, expiry, last commit, last build result |
| `GET /posts` and `GET /posts/{permalink}` | read_posts | List (filter by status, category, date) and read one, with its `version` |
| `POST /posts` | write_posts | Create a post (JSON fields as in AI_OPERATIONS 3; the Worker writes the Markdown file) |
| `PATCH /posts/{permalink}` | write_posts | Change some fields. Needs `If-Match: <version>` |
| `POST /posts/{permalink}/publish` and `/schedule` and `/unpublish` | publish_posts | Status changes (a date change makes the redirect of PLAN 9) |
| `POST /posts/{permalink}/archive` | archive_posts | Status archived |
| `DELETE /posts/{permalink}?confirm={permalink}` | delete_forever | Removes the file, only with the confirm word |
| `GET /authors/{slug}`, `PUT /authors/{slug}` | read_posts, write_authors | Read and replace the author file (for example the bio) |
| `GET /redirects`, `POST /redirects`, `DELETE /redirects/{id}` | read_posts, write_redirects | Hand-made redirects only |
| `POST /media` | write_media | One WebP picture, max 2 MB, file name rules of PLAN 34 |
| `GET /activity` | read_posts | The activity list of this token |
| `GET /openapi.json` | none | The machine description (for assistants that read an OpenAPI file) |
| `POST /mcp` | by tool | The same actions as MCP tools (Part 9) |

### 38.6 Rules every write follows (the part that makes it professional)
1. **Dry run first.** Any write accepts `?dry_run=true` and returns what would change (file path, a short diff, the list of problems) without a commit.
2. **Problems come back as a list, like Shopify's `userErrors`:** `[{ field, code, message }]`, one entry per problem, in plain words. A bad post is refused before any commit, so the build never breaks.
3. **No lost updates.** Every read returns a `version` (the file hash). A change must send it in `If-Match`. If the file changed meanwhile the answer is **412 with the new version and the new text**, so the assistant redoes the change on the fresh file. This replaces the blind 409 of the browser test (see BETTER N28).
4. **No double actions.** A write may carry `Idempotency-Key`; the same key within 24 hours returns the first answer and makes no second commit.
5. **One task, one commit.** A post with its picture is one commit, one deploy.
6. **Safe delete.** Archive is the normal way. Delete forever needs its own scope and the confirm word, and the answer lists what links to the post.
7. **Same content rules as the build** (LOGICS 26): one H1 rule, no emoji, no skipped heading level, description 50 to 160, image rules, no ad network address in a post, permalink rules. One shared code file, so API and build cannot disagree.
8. **Write mode.** Setting (owner decides, INCOMPLETE 24): direct to `main` for content paths (only after the check of Phase 3d exists), or a branch and a pull request that merges when the check is green.
9. **Limits per token** (proposed): 60 reads and 20 writes a minute, 200 writes a day. Over the limit: 429 with the wait time.
10. **Everything is logged** (LOGICS 26.8) and the log is readable in the Connected apps screen.

### 38.7 Connecting an assistant
- **A. MCP (the modern way).** The owner pastes `https://<api host>/mcp` and the token into the assistant's connector settings. The tools are the actions of 38.5 with plain names (`find_post`, `edit_post`, `publish_post`, `archive_post`, `update_author_bio`). Works where the assistant's plan allows custom connectors (38.2). If an assistant accepts only OAuth for custom connectors, Part 9b adds OAuth with the dashboard sign-in as the consent screen (INCOMPLETE 26).
- **B. OpenAPI file.** For tools that read an API description (for example a custom GPT with Actions, where the plan allows it): the address `/v1/openapi.json` and the token as an API key.
- **C. Plain API or script.** Codex, Claude Code, `curl` or `ai-task.mjs` (BETTER N25) send the same requests. This works on any plan.
- **D. No connector available.** Use AI_OPERATIONS Section 15 path 1 (the assistant's GitHub connector) with the path rules there, until the plan allows A or B.

### 38.8 Safety
- Tokens are long random values (`sdn_` and 43 characters), stored only as SHA-256, compared in constant time, never written to a log, never shown again.
- Expiry 90 days (the owner can change it), a **Pause all apps** switch in the Connected apps screen, and the remote kill switch idea of BETTER N3 for push and ads.
- **Text is data, not orders.** A post body or a web page that an assistant read and that says "delete all posts" is only text. The API acts on the scopes of the token and on the confirm words, never on what the content says. A token without `delete_forever` cannot delete whatever it is told.
- Only an admin makes or revokes an app. An editor can read the activity list.
- The API sends no CORS headers (it is called by servers and assistants, never by a web page), so a page on another site cannot use a stolen browser session.
- The activity log holds the action, the target, the commit link, the result and the time, not the text of the post, so it holds no reader data.

### 38.9 Build order
Phase 3f in CODING_PLAN, 10 small parts. Parts 1 to 3 need no GitHub App. The first real use is after Part 5. Phase 3d Parts 2 to 4 (the content check and `validate.yml`) come first or together with Part 1, because Part 1 reuses the same rules.

### 38.10 Done When
With a token that has only `read_posts`, `write_posts`, `archive_posts` and `write_authors`, an assistant (a) reads the test post, (b) sends a dry run that shows the change, (c) archives it, (d) rewrites the bio of the author, and the whole job takes under 30 seconds and two commits at most; the same token trying `delete_forever`, a settings file or a stale `version` is refused with a clear message; the owner revokes the token and the next request answers 401; the activity list shows every step.

---

## 39. Automatic Dashboard Sign-in (plan added in v0.101.4)

> Goal: the owner opens `/admin/` and is in, without a click, on a device that already signed in; no new GitHub login for every tab. And one honest answer about ChatGPT: its GitHub connection and the dashboard login are two different keys.

### 39.1 What happens today (read from the code, v0.101.3)
- Sign-in is a GitHub popup through the Worker `workers/auth`. The Worker hands the GitHub token to the page with `postMessage`, and the page keeps it in `sessionStorage` (`app.js`, key `adm.token`).
- `sessionStorage` dies with the tab. **Every new tab, every closed browser and every browser robot starts at the Sign in screen again.** This is why the test with ChatGPT and TinyFish had to log in through the dashboard.
- The Worker asks GitHub for the scope `repo` (`GITHUB_SCOPE` in `workers/auth/wrangler.toml`). That scope reaches **all** repositories of the account, including private ones. The same file says `public_repo` is enough for a public repository.
- The token never expires and Sign out only forgets it in the tab; the token stays valid at GitHub.

### 39.2 The honest answer about ChatGPT
Connecting GitHub inside ChatGPT gives **ChatGPT** a token that lives inside OpenAI's system. It cannot be used to sign in to `/admin/`, and it should not be: a token that was given to one app must never be reused by another. So "connect GPT to GitHub and the dashboard logs in by itself" is not possible and not safe. Two separate, correct paths:
1. **For the owner:** automatic sign-in on the owner's own devices (39.3 to 39.5).
2. **For an AI:** it does not need the dashboard at all. It uses the GitHub connector of its own (AI_OPERATIONS 15) or a Connected app token (PLAN 38, AI_OPERATIONS 16). The dashboard stays a screen for people.

### 39.3 Stay signed in on this device (the main change)
- The sign-in Worker is served **from the site's own address** (`https://<site>/admin-auth/...`, a Pages Function next to `site/functions/_middleware.js`) so the browser treats the cookie as first party. A Worker on `workers.dev` cannot give a cookie to `pages.dev`.
- After the GitHub sign-in the Worker sets one cookie: `adm_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/admin-auth`, life 30 days with a 7 day idle limit (proposed). Its content is the GitHub token and the login name **encrypted** with AES-GCM and a Worker secret (`SESSION_KEY`). The page's script cannot read the cookie.
- On every load of `/admin/` the page asks `GET /admin-auth/session`. The Worker answers only a same-origin request (`Sec-Fetch-Site: same-origin`, the `Origin` of the site), checks the login against `ALLOWED_USERS` again, and returns the token. The page keeps the token **in memory only**. Nothing is written to `sessionStorage` or `localStorage` any more.
- New tab, reload, next morning: the dashboard opens signed in. Removing a person from `ALLOWED_USERS` or the roles list cuts them off at their next load.

### 39.4 Automatic first sign-in
- If there is no session and the person was signed in on this device before (a plain flag in `localStorage`, no secret), the page shows "Signing you in..." and makes **one full-page redirect** to GitHub, not a popup. A device that is already signed in to GitHub and has already allowed this app comes back at once with no click and no password; otherwise GitHub asks once.
- The way back keeps the place: the Worker returns to `/admin/#/authors` and the like. Only a hash that starts with `#/` and holds letters, digits, slash and hyphen is accepted, so nobody can send the owner to another site.
- One automatic try per tab. If it fails, the normal "Sign in with GitHub" button shows with the reason in plain words. No loops.

### 39.5 Sign out that really signs out
- **Sign out** clears the cookie and asks GitHub to revoke the token (the Worker does this with the client secret; `DELETE /applications/{client_id}/token`). The token is then dead everywhere, not only in the tab.
- **Sign out on all devices** (Security screen): the Worker raises a number inside the encrypted session key set; old cookies stop working.

### 39.6 A smaller GitHub permission
- Proposed: `public_repo` while the repository is public (INCOMPLETE 17), which stops the dashboard token from reaching any private repository of the owner.
- Better later: a **GitHub App user token** (short life, refresh, only this repository), the same App family as PLAN 38. Needs one more decision (INCOMPLETE 30).
- If the repository becomes private, the scope must go back to `repo`; the Setup screen says so.

### 39.7 Helper access for browser robots (not built by default)
The plan does **not** give a robot a login. If the owner ever wants one (idea N41), it is a **one-time helper link**: made by an admin, valid 30 minutes, single use, role editor at most (never admin), shown in the activity list, revoked by Pause all. Connected apps (PLAN 38) make it unnecessary for content work, so it stays an idea.

### 39.8 Done When
The owner signs in once, closes the browser, opens `/admin/#/authors` in a new window next day and sees the Authors screen with no click. Sign out in one tab signs out the other tabs at their next action. The GitHub token no longer appears in `sessionStorage`, `localStorage` or the page source. A request to `/admin-auth/session` from another site is refused. After Sign out the old token gets 401 from GitHub.

---

## 40. Professional Link Editor (authors, social profiles, footer) (plan added in v0.101.4)

> Goal: adding a link is as easy and as safe as in Shopify's menu editor: one row per link, a type, a label, an address, live checks. Today (`#/authors`, `app.js`) links are one text box with lines like `Label | https://...`; a wrong line is silently dropped, and a wrong address that passes `z.string().url()` can still look wrong on the live page.

### 40.1 What the owner gets
- Rows instead of a text box. Each row: **Type** (a list), **Label**, **Address**, **Up** and **Down** buttons, **Remove**, and **Open** (opens the address in a new tab to test it). Below the rows: **Add link**.
- **Paste and it fills itself.** Pasting `https://x.com/shivamdas_191a` into an empty row sets the type to X and the label to "X". Pasting a site address sets the type to Website and the label to the site name from the host.
- Live checks next to each row in plain words (40.3). A row with a problem shows the reason and cannot be saved. Nothing is dropped silently.
- A short preview "How it looks on the author page" under the list.
- The old data opens as rows with the types detected, with no migration.

### 40.2 Types (proposed list)
Website (own site), X, Facebook, Instagram, YouTube, LinkedIn, Threads, Telegram, WhatsApp Channel, GitHub, Wikipedia, Other. Detected from the host: `x.com` and `twitter.com`, `facebook.com` and `fb.com`, `instagram.com`, `youtube.com` and `youtu.be`, `linkedin.com`, `threads.net` and `threads.com`, `t.me`, `whatsapp.com/channel`, `github.com`, `wikipedia.org`. Unknown host: Website. The owner can change the type by hand.

### 40.3 The checks (one rule file for the dashboard, the build and the API, LOGICS 28)
- Address must be `https://`. `http://` is upgraded to `https://` with a note. Every other kind (`javascript:`, `data:`, `mailto:`, `tel:`, no scheme) is refused with a plain message.
- A real host (with a dot), no spaces, at most 2048 characters. Tracking parts (`utm_*`, `fbclid`, `gclid`) are removed and the owner is told.
- Label 2 to 40 characters. No emoji (PLAN 29.3). Empty label is filled from the type.
- At most 10 links per author. The same address twice (host and path in lower case, trailing slash ignored) is refused.
- Warn (not block): a short-link host (`bit.ly`, `t.co` and similar), an ad network host, a page that is clearly not a profile.
- **Link check Action** (weekly, report only, never blocks a publish): asks each saved address once and lists those that answer 404 or an error.

### 40.4 Data stays compatible
`content/authors/<slug>.json` keeps `links: [{ "label": "...", "url": "..." }]` and gets one optional field `type`. `content.config.ts` accepts it as an optional enum. Files without it work as before. The build writes `sameAs` of the Person from all author links (PLAN 8), in the order of the rows.

### 40.5 What the reader sees
The author page and the author box show "Find Shivam Das online": one line per link with a small inline SVG icon of the type (PLAN 29.3, neutral shapes from `svg-icons.ts`), the label, `target="_blank"` and `rel="me noopener"` for the owner's own pages and profiles, `rel="noopener nofollow"` for type Other. Links in the author bio text itself stay out of the bio (the bio is plain text; the links list is the place for them).

### 40.6 One editor in many places
The same row editor (`site/public/admin/js/link-rows.js`) is used in: the Authors screen, Settings "Social profile links" (`sameAs`, today a text box with one address per line), and the footer links of `config/footer.json`. One rule file, one look, one set of tests.

### 40.7 Done When
On a phone the owner opens Authors, sees the three existing links as rows with the types Website, Website and X, pastes an Instagram address into a new row (type and label fill themselves), moves it to the top, tries `javascript:alert(1)` (refused with a plain message), tries the X address twice (refused as a duplicate), saves, and the live author page shows the four links with icons; the page source holds `sameAs` with the same four addresses in that order; the build passes.

---

## 41. Author Pages That Get Indexed (plan added in v0.101.5)

> Goal: each real author has a public, indexable profile page that tells Google and readers who the person is, and every article points to it. "Indexed" means Google chooses to keep the page; the site can only make the page easy to find, complete and worth keeping.

### 41.1 What the code does today (read in v0.101.4, screenshot of 2026-11-16)
- `src/pages/author/[author]/[...rest].astro` builds a page **only for an author who has at least one published post** (rule of v0.2.2). The site has **no published post**, so there is **no author page, nothing in `sitemap-authors.xml` (empty sitemaps are not published) and nothing to index**. This is the real reason the author is not indexed.
- There is no `/authors/` page (an index of all authors).
- The article byline links to the author with `rel="author"`. The author box at the bottom of the article shows only the first letter of the name in a circle and the bio; it has **no link and no photo**.
- The profile data (`profilePage` in `src/lib/schema.ts`) has name, address, bio, photo and `sameAs` only. No `@id`, no job title, no dates, no link to the publisher, and the article's author is not tied to the profile by `@id`.
- The page title today is the name plus the site name ("Shivam Das | Shivam Das News"), which repeats itself.
- The author file has no `role` and no "last updated" date.

### 41.2 When an author page is live
- Rule A (today, kept): the author has at least one published post.
- Rule B (new): the owner turns on **Show author page now** in the Authors screen. Allowed only when the profile is complete enough to be worth indexing: name, bio of at least 120 characters, at least one link. Otherwise the switch refuses with the missing item named.
- A live page with no posts is shown with the calm empty message "Stories by this author will appear here." and is `index,follow` only if it is index-ready (41.4); if not, it is `noindex,follow` and left out of the sitemap.
- The honest part: with zero published posts the page can exist, but Google rarely keeps a profile with nothing under it. **Publishing real articles is still the strongest step.**

### 41.3 What the author page shows (real data only, PLAN 25)
Photo (or the initial letter as a fallback), name as H1, **role line** (new field, for example "Entertainment news writer"), bio, "Find Shivam Das online" (the link list of PLAN 40), **Writes about** (the author's top three categories, automatic, shown from two posts), **Writing for Shivam Das News since Month Year** (date of the first published post, automatic), a count of stories, the latest stories, and a link to the follow page (BETTER N6). Nothing is invented: no field is shown unless the owner or the posts supply it.

### 41.4 Index-ready checklist (also the badge in the dashboard)
1. Real name. 2. Photo set (recommended, not blocking). 3. Role set (recommended). 4. Bio 120 to 600 characters, no web address inside. 5. At least one link. 6. The page is live (41.2). 7. The page has at least one published post, or the owner switched it on. **Index ready** = 1, 4, 5, 6 and 7 are all yes. A page that is not index-ready is `noindex,follow` and not in the sitemap.

### 41.5 Title, description, data
- Title: `{Name}, Author at {Site}` (falls back to `{Name} | {Site}` when longer than 60 characters). Description: the bio cut at a word boundary to 155 characters.
- `ProfilePage` JSON-LD gets: `@id` of the page, `dateCreated` (first published post), `dateModified` (the later of the author file's `updated` and the newest post), and a `mainEntity` Person with its own `@id` (`/author/<slug>/#person`), `name`, `url`, `description`, `image`, `jobTitle`, `worksFor` (the publisher), `knowsAbout` (the Writes about list) and `sameAs`.
- Every article's `author` points to the same Person `@id`, so Google can join the article, the person and the page into one entity.

### 41.6 Links to the page (how Google finds it)
From the byline of every article (kept), from the **author box** (new: photo, name as a link, bio, role), from the `/authors/` page, from the HTML sitemap and from the footer when there are two or more authors. The XML sitemap `sitemap-authors.xml` lists only live, index-ready pages with `lastmod` from the author file's `updated` and the newest post.

### 41.7 The `/authors/` page
Live only when **two or more** author pages are live; with one author it does not exist and nothing links to it (a list with one name is a thin page). It lists photo, name, role, short bio and story count, uses `CollectionPage` and `ItemList` data, sits in `sitemap-pages.xml` and in the HTML sitemap.

### 41.8 The Authors screen helps
A box "How this looks in Google" (title, address, description, like the SERP preview of PLAN 33), a bio character counter (120 to 600), the checklist of 41.4 with ticks, the **Show author page now** switch, and the `updated` date set automatically on every save.

### 41.9 Speeding up, honestly
- Google finds the page through the sitemap and links; Search Console's "Request indexing" is a manual step the owner may use once the page is live.
- IndexNow (already planned) reaches Bing and Yandex, **not Google**; it also pings the author address when `content/authors/<slug>.json` changes.
- An author file describes **a real person**. Invented names, invented credentials or a made-up photo are not allowed (Google News and E-E-A-T rules). This is a rule for people and for AI alike (AI_OPERATIONS 18).

### 41.10 Done When
With one published post (or the switch on) the owner opens `/author/shivam-das/` and sees photo, role, bio, links, Writes about, the since date and the stories; the page source has `index,follow`, the title "Shivam Das, Author at Shivam Das News", a `ProfilePage` whose Person `@id` equals the `author` of the article; the author box of the article links to the page; `sitemap-authors.xml` lists it; the Authors screen shows "Index ready". With a one-line bio the page is `noindex,follow`, is not in the sitemap, and the screen says exactly which item is missing.

---

## 42. A Professional "Newsroom" Theme and a Better Dark Mode (plan added in v0.101.5)

> Goal: the site looks like a trusted newsroom on a phone and on a desk, in light and dark, and the owner can change colours and fonts from the dashboard without breaking readability. Taste is the owner's; the plan gives a default, a way to keep the old look, and numbers instead of opinions where numbers exist.

### 42.1 What the code does today (measured in v0.101.4)
**Look.** Every card has a 2 px outline in the text colour, a hard 5 px bottom shadow, 18 px corners, a tilted logo and heavy Lexend 800 headings. It is a playful, "sticker" style. It is distinctive, but it reads as a hobby blog more than as a news desk, and the header hides all categories behind a three-dot menu.

**Dark mode** (`src/styles/global.css`, `Base.astro`), checked with the contrast formula of `tests/unit/contrast.test.ts`:
1. **Cards almost vanish.** Card colour against the page: **1.08 : 1**. The outline colour `#050a18` against the page is only **1.16 : 1**, and the hard shadow is the same near-black, so edges look muddy instead of crisp.
2. **The browser bar stays orange.** There is one `theme-color` (`#d94a00`, from `site.json`) for both modes. On a dark page the phone's address bar is a bright orange strip.
3. **Two-state switch.** The half-moon button flips light and dark and saves the choice; after one tap the site never follows the phone's own setting again (no "System" choice).
4. **No `color-scheme` in the CSS.** When the person forces dark on a light phone, scroll bars and native pickers can stay light.
5. **Dark colours are written ten times** (system query, forced dark, and each accent twice). One edit can leave the others behind.
6. **Nothing is dimmed or framed.** Photos glare, transparent logos have no plate, ad slots keep their own bright colours.
7. **The dashboard has dark mode only by system setting** (`admin.css`), with its own colours; the site and dashboard do not share tokens.

**Other things visible in the screenshot.** The footer has no About, Privacy, Contact or Editorial links because the required pages are not generated yet (the publisher file lacks address, founding year and funding summary; `INCOMPLETE.md`). The home page says "No stories yet". Both matter to reviewers more than any colour.

### 42.2 Three looks, one switch (Shopify-style theme settings)
`config/theme.json`: `{ "look": "newsroom", "accent": "sunset", "headlineFont": "lexend", "radius": "md", "categoryBar": true }`.
- **Newsroom** (proposed default): calm. 1 px soft borders, soft light shadow (none in dark), 10 px corners, level surfaces, a visible category bar, byline with photo, the logo straight.
- **Playful**: today's look, kept exactly (`data-look="playful"`), so nothing is lost.
- **Compact** (later, BETTER N44): denser lists for a high-volume desk.

### 42.3 The Newsroom colours (contrast measured)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0b1220` | page |
| `--surface` | `#f4f6fa` | `#111a2e` | cards, boxes |
| `--surface-2` | `#e9edf4` | `#18233d` | raised: menu, hover, header |
| `--text` | `#0f172a` | `#e6ebf5` | headlines, UI |
| `--text-body` | `#0f172a` | `#dbe3f1` | article body (softer in dark, 14.5 : 1) |
| `--muted` | `#475569` | `#9fb0cc` | dates, captions |
| `--border` | `#d5dce8` | `#2a3752` | soft dividers |
| `--border-strong` | `#7a8aa3` | `#5f7090` | inputs, buttons (3 : 1 or better) |
| `--acc` (fill, white text) | `#c2410c` | `#c2410c` | buttons, key points |
| `--acc-t` (accent text) | `#b43a0a` | `#ff8f55` | links, kicker |

Measured: light text on page 17.9 : 1; muted on page 7.6 : 1; accent fill with white text 5.18 : 1; accent text on page 5.9 : 1. Dark: text on page 15.7 : 1; muted on page 8.5 : 1; accent text on card 7.7 : 1; strong border on page 3.75 : 1. (Today: dark card on page 1.08 : 1.)
The other three accent styles keep the same rule (fill 4.5 : 1 with white; text 4.5 : 1 on its own surfaces): sky `#1d4ed8` (dark text `#7aa2ff`), mint `#047857` (`#34d399`), grape `#6d28d9` (`#b794ff`); all measured 5.1 : 1 or better.

### 42.4 Dark mode, the rules
1. Depth comes from **lighter surfaces**, not from black shadows: bg, surface, surface-2. No shadow in dark.
2. **No pure white text and no pure black page.** Headlines `--text`, article text `--text-body` (less glare for long reading).
3. **Borders you can see**: soft borders at 1.4 : 1 or more against the surface; input and button borders at 3 : 1 or more.
4. **Accent text is lighter in dark** than the fill, so links stay readable.
5. Photos are dimmed a little (`brightness .92`), logos and transparent images sit on a neutral plate, SVG icons use `currentColor`.
6. Code, tables and quotes get their own dark colours (PLAN 37 dual theme).
7. Ads sit in a framed neutral slot with the word "Advertisement"; their own colours are not changed.
8. `color-scheme: light` or `dark` is set on the root for the active mode, so scroll bars, form controls and pickers match.
9. Print is always light.
10. In Windows high-contrast (`forced-colors`) the site uses the system colours for borders and focus; nothing depends on colour alone.

### 42.5 The mode switch
Three states in the menu: **System** (default), **Light**, **Dark**; a quick button in the header cycles them and shows which is active (text for screen readers). "System" follows the phone, including at sunset. No flash: the tiny inline script in `<head>` sets the mode before the first paint. **Two `theme-color` tags** (light page colour and dark page colour, by `media`) and a script update when the mode changes, so the browser bar matches the page.

### 42.6 Newsroom layout changes
- **Header:** logo, a visible category bar on tablets and desktops (the top six categories; the rest in the menu; on phones a scrolling chip row under the header), search, alerts, mode switch. Date line optional.
- **Cards:** image, category kicker, headline, time. No thick outline.
- **Article:** 18 px text at 1.7 line height, 70 characters per line, headline weight 700, byline with the author photo and the author link, a tidy "Key points" box, related stories.
- **Footer:** links to About, Editorial policy, Corrections, Privacy, Terms, Contact and Sitemap (when the pages exist), then the projects and social rows.
- **Type:** the headline font is a theme choice (Lexend today; a self-hosted serif such as Source Serif 4 is offered as the "newspaper" choice). Two weights per family at most, `font-display: swap`, size-adjusted fallbacks (PLAN 4, CLS rules).

### 42.7 One source of colours
`theme/tokens.json` is the only place colours are written. `npm run theme` generates `src/styles/tokens.css` once for light, system-dark and forced-dark, and the contrast test reads the **same** file for every look, mode and accent. A stale generated file fails the build, like `npm run pages`. The dashboard (`admin.css`) uses the same tokens, so the site and the dashboard match.

### 42.8 The dashboard Theme screen
Settings has a **Theme** screen (admin only): look, accent, headline font, corner size, category bar on or off, with a live preview of a home page and an article in light and dark side by side (built on the existing `theme/theme-preview.html`). A colour that fails the contrast rule cannot be saved; the reason is shown in plain words. The dashboard also gets the same three-state mode switch.

### 42.9 Done When
On a 360 px phone and on a 1280 px desktop, in System, Light and Dark: cards are clearly separated in dark; the browser bar follows the page colour; nothing flashes at load; the switch has three states and returns to System; form fields have a visible border; the contrast test passes for all looks, modes and accents; the owner changes the accent in the Theme screen and both modes stay readable; switching `look` to Playful restores today's design exactly.

---

## 43. A Task System So Humans and AI Finish Work Properly (plan added in v0.101.6; the starter files already exist)

> Goal: every piece of work, whether a person or an AI does it, has a clear goal, a named owner, a risk level, a list of allowed files, checks that anyone can run, and **evidence** that it is really finished. Nothing is "done" because somebody said so.

### 43.1 What went wrong in real work (read from this project)
- **Too much to read.** The documents hold about 140,000 words (`INCOMPLETE.md` about 27,800, `CHANGELOG.md` about 43,000, with "Open Items After vX" blocks piling up). No assistant reads that in one session, so open work gets missed or repeated.
- **No definition of done.** In the ChatGPT test of 2026-11-16 the AI first said it could not confirm the post was deleted (a GitHub 409), then reported "cleanup succeeded" after writing straight to `main`. Nothing said what proof counted.
- **Tasks lived in chat only.** Tasks, decisions and results are spread over conversations; the next session starts from nothing.
- **Red tests were accepted.** Twelve tests fail on purpose-free reasons (the owner filled in settings) and everyone knows it.
- **Two documents disagree** and nobody owns the fix (time zone: `site.json` said `America/New_York`, the plan said `Asia/Kolkata`; resolved on 2026-11-18 by T-0003: `America/New_York`).
- **Decisions wait forever.** Decisions 23 to 46 have no owner date; many tasks wait behind them.
- **The owner's own steps** (Cloudflare secrets, GitHub App, facts about the company) have no checklist, so they are forgotten.
The common pattern: unclear done, no evidence, no owner, no stop rule, too much to read.

### 43.2 The model: one task, one card
A task is one file in `tasks/open/T-0000.md` (template `tasks/TEMPLATE.md`) with fields `id`, `title`, `owner` (ai, human, either), `risk` (green, yellow, red), `status`, `time`, `needs`, `paths`, `approved-by`, `claimed-by`, `blocked-by`, and sections Goal, Why it matters, Steps, Done when, Evidence, If it goes wrong, Stop and ask the owner if, Log. A GitHub Issue form (`.github/ISSUE_TEMPLATE/task.yml`) creates the same shape from the GitHub website or phone. The first nine cards are already written from the findings of this review.

### 43.3 States and who may move them
`idea` (anyone proposes) to `ready` (owner or editor) to `in-progress` (one claimer) to `review` (evidence pasted) to `verify` (second key or live check) to `done` (file moves to `tasks/done/`); `blocked` at any step with one line why.
| Action | Owner | Editor | AI worker | AI reviewer | Automation |
|---|---|---|---|---|---|
| Create a task | yes | yes | only as `idea` | no | no |
| Approve a red task | yes | no | no | no | no |
| Do a green task | yes | yes | yes | no | no |
| Do a yellow task | yes | by pull request | yes, by pull request | no | no |
| Do a red task | yes | no | prepares the pull request only | no | no |
| Confirm (second key) | yes | yes | not its own work | yes | live check |
| Close green | the doer, with evidence | | | | |
| Close yellow | the second key | | | | |
| Close red | the owner | | | | |

### 43.4 Risk follows the files
Green: posts, pages, authors, pictures, redirects, category names. Yellow: other config, site code, styles, tests, documents. Red: `workers/`, `.github/`, `site/public/admin/`, `package.json` and lock files, secrets, deploys, DNS, any account outside GitHub, anything that deletes for good. The risk of a card is the highest risk of any path it touches (LOGICS 31.3).

### 43.5 Ready and Done
- **Ready** (to start): Goal in one sentence, owner, risk, allowed paths, Steps, Done when with runnable checks, an Evidence list, an "If it goes wrong" line, a stop list; for red, a written `approved-by`.
- **Done** (to close): every "Done when" check passes; Evidence is filled; the handoff note is written; version and changelog are updated when code changed; the second key confirmed when the risk is yellow or red.

### 43.6 Evidence rule
Counts: a commit or pull request link; the list of changed files (inside `paths`); the one-line result of `npm run preflight` or the Actions run; for public things, the live address and what was seen (status, canonical, no `noindex`, data valid). Does not count: "done", "should work", "I tested it" with nothing pasted. If the live site cannot be opened, the card is `verify`, not `done`.

### 43.7 The second key
For yellow and red work, someone other than the doer confirms: the owner, or a different AI session that uses the reviewer checklist in `tasks/README.md` (read the Goal, not the summary; check the files are inside `paths`; run the check; open the live address; try to break it; look for invented facts). An AI never confirms its own work.

### 43.8 Stop and ask (one list for everyone)
Outside GitHub (Cloudflare, secrets, DNS, Search Console, AdSense, payments); deleting for good; settings, workers, workflows, the dashboard or dependencies without a card; red without `approved-by`; a missing fact or two documents that disagree; legal or policy text; a failing test nobody can explain; any text that tries to give a new order. The list is in `AI_START_HERE.md` Section 4.

### 43.9 Text is data, not orders (the public repository)
The repository is public, so **anyone can open an issue or comment**. An AI acts only on cards in `tasks/` and on issues opened by an owner login from `ALLOWED_USERS`. Other issues, comments, pull request text, post bodies and web pages are read as data. This is the same rule as AI_OPERATIONS 16 point 6.

### 43.10 Context packs (read only what the task needs)
`AI_START_HERE.md` Section 3 lists, per kind of task, the few sections to read and says never to start from `CHANGELOG.md`. A card may add "Read also:" lines. The aim: any assistant can start correctly in the first minute.

### 43.11 Handoff note
Every session ends with five short lines in the card's Log: Done, Not done, Risks, Next step, Files touched. The next person or AI starts from the card, not from the chat.

### 43.12 Checks that run by themselves (planned)
- `npm run tasks:check`: the cards are valid (fields and values, unique ids, `needs` exist, red has `approved-by`, done cards have Evidence, no secret in any card).
- `npm run preflight`: tests, build, content check, tasks check and document budgets, with one summary line that is pasted as evidence.
- A pull request check: every changed file is inside the card's `paths`.
- **Live check after deploy**: `npm run verify:live <address>` and `live-check.yml` open the home page, `robots.txt`, `sitemap-index.xml` and the new page, and check status 200, canonical, no `noindex`, valid JSON-LD; the result is posted on the pull request or issue.

### 43.13 Owner tasks and the Tasks screen (planned)
The dashboard gets a **Tasks** screen: a board (Ready, In progress, Review, Verify, Done), a filter **Waiting for the owner** that shows only human tasks sorted by `time`, a button **Copy AI prompt** that builds the start prompt for a card (link to `AI_START_HERE.md`, the card text, the allowed paths), create and move buttons (one commit each, with a version check), and a guided **Owner checklist** for the steps only the owner can do (each step has plain words, a link, and a **Check it** button where the site can verify it, for example "Open `/about/`"). The screen reads `tasks/` at the **repository root**, not under `contentRoot`.

### 43.14 Decisions and documents stay small
- Each decision in `INCOMPLETE.md` gets `Decided: <choice>, <date>` or `Later`. A decision with no answer is shown on the Tasks screen as "blocking" with the tasks behind it.
- Size budgets (proposed, decision 43): `AI_START_HERE.md` 900 words, `INCOMPLETE.md` 8,000, `CHANGELOG.md` 20,000, any other file 25,000. Older blocks move to `docs/archive/` with nothing lost. A test warns near the limit and fails above it.
- A weekly sweep (BETTER N48) lists stale claims, blocked tasks, undecided decisions, failing checks and the age of the last deploy.

### 43.15 Honest limits
A card does not force an AI to behave. It raises the odds, makes failures visible and gives a second person something to check. Tasks that need Cloudflare, accounts or the owner's facts stay with the owner. Whether a given AI tool can read GitHub issues or run `npm` depends on that tool; the card works as a plain file with every tool.

### 43.16 Done When
A new AI session, given only the repository and the card `T-0006`, reads `AI_START_HERE.md` and the card, works in a branch, touches only the allowed paths, runs the check, pastes the evidence, writes the handoff note and stops at `review`; a second session confirms; the card moves to `tasks/done/`. The owner opens the Tasks screen and sees what only the owner can do, with the time each needs, and finishes one in 10 minutes.

# SEARCH_ENGINE_UPDATES.md: Google and Other Search Engine Updates

Researched on 2026-11-13. Update this file after each major change. Sources are listed at the end.

## 1. Google: What Is Happening Now

### Current: November 2026 Core Update (live right now)
- Started **November 10, 2026**, global, all languages; Google says it may take up to about two weeks (finish around November 24).
- Google called it a regular update and gave no specific targets.
- It is the eighth ranking update on the Search Status Dashboard this year.
- Action: do not make big structural changes to a live site during rollout; wait at least a full week after it finishes before judging results in Search Console.

### 2026 Timeline
| Date | Update |
|---|---|
| Dec 11 to 29, 2025 | December 2025 core update (hit many publishers and Discover hard) |
| Feb 5 to 27, 2026 | **February 2026 Discover core update** (first update Google labeled Discover-only) |
| Mar 24 to 25, 2026 | March 2026 spam update |
| Mar 27 to Apr 8, 2026 | March 2026 core update |
| May 21 to mid June, 2026 | May 2026 core update |
| Aug 2026 | August 2026 spam update |
| Sep 2026 | September 2026 spam update (two phases, finished early October) |
| Oct 1, 2026 | Google edited its "helpful, reliable, people-first content" guidance page |
| Nov 10, 2026 | November 2026 core update (rolling out) |

Pattern: updates now come every few weeks. Build the site to be stable, not tuned to one update.

## 2. Google Discover (very important for this news site)
The February 2026 Discover core update had three stated goals:
1. Show more **locally relevant content from publishers based in the reader's country**.
2. Reduce **clickbait and sensational** content.
3. Surface deeper **expertise by topic** (expertise judged per topic, not only per whole site).

At launch it applied to English-language users in the US, with expansion to other countries and languages planned. Data after the update showed more topics but fewer publishers getting top placements, so sites with a clear topic focus do better.

**What this means for our plan**
- Choose a clear niche/topic focus per category; do not publish random topics.
- Honest, non-clickbait headlines (the editor already warns about clickbait).
- Show real author expertise, bios and sources on every article.
- Make country/audience clear in About and Editorial pages (where the publisher is based matters for local relevance).
- Keep large images (1200 px+), fast pages, `max-image-preview:large`.
- Track Discover traffic separately in Search Console and in our analytics.

## 3. Google News and Publisher Rules
- Publisher Center now uses automatically generated publication pages; many customization options and country restrictions were removed. Keep `NewsMediaOrganization` schema, news sitemap and RSS accurate instead.
- Trust anchors Google quality raters check: detailed About page, editorial policy, visible corrections policy, real authors.
- Subscription Linking policy was added to Publisher Center help in June 2026 (relevant only if paywalls are added later).
- **Site reputation abuse policy:** Google formalized EEA-specific rules in August 2026; the policy is unchanged elsewhere. Do not host unrelated third-party content (coupons, sponsored sections) on the news domain to borrow its authority.
- Manual actions list for News/Discover includes deceptive practices and impersonating or hiding who made the content. Keep ownership info honest and visible.

## 4. AI Search (Google and Others)
- Reports say a large share of Google searches now show AI Overviews, and Google keeps expanding AI Mode.
- Traditional search share of traffic to news publishers has fallen as Discover and AI surfaces grow. Do not depend on one source.
- **Plan changes:**
  - Write clear, factual, quotable summaries at the top of articles (key points box).
  - Use structured data and clean headings so AI systems can understand and cite.
  - Keep `robots.txt` choices deliberate: decide which AI crawlers to allow or block (Googlebot, Google-Extended, OAI-SearchBot, Bingbot, PerplexityBot and others). Add this as a setting in the admin.
  - Build brand/direct traffic: newsletter, push notifications, "Preferred sources" guide for readers.

## 5. Bing, Microsoft and IndexNow
- **IndexNow**: open protocol to ping search engines when a URL is added, updated or removed. Participants listed (October 2026): Bing, Yandex, Seznam, Naver, Yep, Internet Archive, Amazon. **Google is not a participant**, so Google still relies on sitemaps and crawling.
- **Bing Webmaster Tools AI Performance** (public preview since Feb 10, 2026): shows how often your pages are cited in Copilot and Bing AI answers. On June 16, 2026 Microsoft added Intents, Topics, Citation Share and Compare.
- Bing's index also feeds Yahoo, DuckDuckGo, Ecosia and is used by some AI search tools, so verifying in Bing Webmaster Tools is worth doing.
- **Plan changes:** keep the IndexNow workflow; add Bing Webmaster Tools verification and sitemap submission to the launch checklist; add an "AI citations" widget idea for later.

## 6. Other Engines to Register With
| Engine | Action |
|---|---|
| Google Search Console | Verify, submit sitemap index and news sitemap, watch Discover and News reports |
| Bing Webmaster Tools | Verify (can import from GSC), submit sitemap, IndexNow, AI Performance |
| Yandex Webmaster | Verify, submit sitemap (IndexNow supported) |
| Naver Search Advisor | Optional, only if Korean traffic matters |
| DuckDuckGo, Yahoo, Ecosia | Covered through Bing |
| Baidu | Skip (English-only site, not targeting China) |

## 7. What to Do With This (Action List for the Build)
- [ ] Do not launch changes mid-rollout of a core update; schedule big releases between updates.
- [ ] Add Discover-specific tracking in analytics (Discover referrals).
- [ ] Add topic focus rules: each category needs a defined subject and named expert authors.
- [ ] Add clickbait and sensational-wording check in the editor (already planned; keep strict).
- [ ] Add "country/publisher location" fields to publisher settings and About page.
- [ ] Add AI crawler allow/block settings to the admin robots editor.
- [ ] Add Bing Webmaster Tools and Yandex to launch checklist.
- [ ] Keep Core Web Vitals strong; keep content original and people-first.
- [ ] Re-check this file monthly and after every confirmed update on the Google Search Status Dashboard.

## 8. Where to Watch for Updates
- Google Search Status Dashboard and Search Central Blog
- Search Engine Land, Search Engine Roundtable, Search Engine Journal
- Bing Webmaster Blog
- IndexNow documentation

## Sources
- [Google November 2026 core update starts rolling out (Search Engine Journal)](https://www.searchenginejournal.com/google-november-2026-core-update/596614)
- [November 2026 core update guide (Launchcodex)](https://launchcodex.com/?p=9436)
- [Google November 2026 core update (PPC Land)](https://ppc.land/googles-core-update-shifts-rankings-for-up-to-2-weeks-before-black-friday/)
- [Google May 2026 core update (Search Engine Land)](https://searchengineland.com/google-may-2026-core-update-rolling-out-now-478430)
- [Google March 2026 core update (Search Engine Land)](https://searchengineland.com/google-march-2026-core-update-rolling-out-now-472759)
- [May 2026 core update complete (TechWyse)](https://www.techwyse.com/news/ai-search/google-may-2026-core-update-complete-next-steps)
- [February 2026 Discover core update (PPC Land)](https://ppc.land/googles-discover-feed-gets-a-content-shakeup-targeting-clickbait-and-boosting-local-news/)
- [Discover core update finished (Search Engine Journal)](https://www.searchenginejournal.com/googles-discover-core-update-finishes-rolling-out/568413/)
- [Discover update early data (Search Engine Journal)](https://www.searchenginejournal.com/google-discover-update-early-data-shows-fewer-domains-in-us/568091/)
- [Discover scorecard (NewzDash)](https://www.newzdash.com/guide/google-discover-feb-2026-core-update-scorecard-data-shows-what-actually-changed)
- [Google EEA spam policy change (Brussels Signal)](https://brusselssignal.eu/2026/08/google-eases-eu-spam-rules-on-publisher-sites-after-brussels-probe/)
- [Google stops demoting EU publishers (The Next Web)](https://thenextweb.com/news/google-eu-spam-policy-demotions-dma)
- [Subscription Linking policy (PPC Land)](https://ppc.land/google-drops-subscription-linking-help-page-then-restores-it-on-june-25/)
- [Publisher Center automatic publication pages (Search Engine Roundtable)](https://www.seroundtable.com/google-news-automatically-generated-publications-39149.html)
- [November 2026 webmaster report (Search Engine Roundtable)](https://seroundtable.com/november-2026-google-webmaster-report-42431.html)
- [Bing Webmaster Tools and IndexNow for AI search](https://eseospace.com/blog/bing-webmaster-tools-indexnow-ai-search/)
- [Bing AI reporting update, June 2026 (Let's Data Science)](https://letsdatascience.com/news/microsoft-adds-ai-visibility-insights-to-webmaster-tools-ec8cb5d2)
- [Bing Webmaster Tools setup and IndexNow (GEO Toolbox)](https://geotoolbox.ai/blog/bing-webmaster-tools)

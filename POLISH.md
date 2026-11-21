# POLISH.md: Final Quality and Finish Checklist

## Visual
- [ ] One consistent spacing scale and type scale
- [ ] Readable article width (65 to 75 characters per line)
- [ ] Body text 17 to 19 px on desktop, 16 to 18 px on mobile, line height 1.6
- [ ] Strong headline hierarchy, clear category labels, visible dates and bylines
- [ ] Clean cards: image ratio 16:9 everywhere, no stretched images
- [ ] Light and dark mode tested on every page
- [ ] Smooth but minimal motion; respect `prefers-reduced-motion`
- [ ] No emoji anywhere; every icon is an inline SVG in `currentColor` (PLAN 29.3), checked in light and dark mode

## Speed
- [ ] LCP under 2.0 s on mobile 4G, CLS under 0.05, INP under 150 ms
- [ ] Hero image preloaded and `fetchpriority="high"`
- [ ] All other images lazy-loaded with width and height
- [ ] Fonts self-hosted, `font-display: swap`, one or two weights
- [ ] Ads load only after one real reader event; slots reserved

## Mobile
- [ ] Tap targets at least 44 px
- [ ] Sticky header small, no big sticky ads covering content
- [ ] Share bar at the bottom on mobile
- [ ] Menu opens fast, search reachable in one tap
- [ ] No horizontal scroll on 320 px screens

## Accessibility
- [ ] Skip to content link, visible focus ring
- [ ] Contrast at least 4.5:1
- [ ] Alt text on all content images
- [ ] Landmarks: header, nav, main, article, aside, footer
- [ ] Forms have labels and clear error messages

## Content Pages
- [ ] Friendly 404 with search and latest posts
- [ ] Empty states for new categories and zero search results (real messages only)
- [ ] Author boxes, "updated" labels and corrections shown clearly
- [ ] Print stylesheet

## Admin Polish
- [ ] Setup wizard, inline help on every field
- [ ] Live character counters for title and description
- [ ] Preview as Google result, Discover card and social card
- [ ] Autosave and undo
- [ ] Clear success/error messages after every action
- [ ] Works on phone
- [ ] Hotlinked pictures: progress line while hosting, a result for each picture, Retry for a failed one, the rights notice (PLAN 34)
- [ ] Search engine listing box in every editor: preview, Edit link, three fields, counters, Reset to auto (PLAN 33)
- [ ] Files screen: alt text, rename, replace, bulk alt text (PLAN 33)
- [ ] Dashboard icons are SVG, never emoji
- [ ] Direct code (PLAN 37): the tabs Write, HTML and Preview work on a phone; the Code button asks only for the language; every code box has one help line and the live page ones have the red note; the full screen editor has line numbers, tab key, find and word wrap; code colours pass contrast 4.5 to 1 in light and dark; a long line scrolls inside the block; the Copy button works with the keyboard; an author sees the locked buttons with the words "Ask an editor"
- [ ] Connected apps (PLAN 38): the screen works on a phone; the token is shown once with a Copy button and a plain warning; every right has one plain-words line and delete forever is red; Pause all and Revoke work in one tap; the activity list is readable without technical words
- [ ] Sign-in (PLAN 39): a new tab opens the dashboard signed in with no click; the failure message says what to do; Sign out and Sign out on all devices are one tap; no token in browser storage
- [ ] Link editor (PLAN 40): works on a phone with 44 px buttons; pasting an address fills type and label; every refusal is a plain sentence next to the row; the author page shows the links with SVG icons and no emoji
- [ ] Author pages (PLAN 41): photo, role, bio, links, Writes about, since date and stories show with real data only; the article author box links to the page; the Authors screen checklist matches the page; a one-line bio gives `noindex` and a clear message
- [ ] Theme and dark mode (PLAN 42): at 320, 360, 768 and 1280 px in System, Light and Dark: cards are clearly separated, no flash at load, the browser bar matches the page, three-state switch returns to System, form borders are visible, photos do not glare, ads sit in a labelled frame, print is light, Windows high contrast keeps borders and focus
- [ ] Tasks (PLAN 43): a new AI session starts correctly from `AI_START_HERE.md` and one card; every card has a Goal, Done when, Evidence and an undo line; the Tasks screen shows only the owner steps first with the minutes each needs; Copy AI prompt works; no secret in any card; the word budgets hold

## Final Pre-launch Sweep
- [ ] No lorem ipsum, example.com or test text anywhere
- [ ] No picture in a published post is loaded from another website (PLAN 34)
- [ ] No emoji and no symbol used as an icon on any page, in the dashboard or in the design preview (the build and `no-emoji.test.ts` check this)
- [ ] All links work, all forms deliver
- [ ] The AI trial of PLAN 35.6 passed and its test post was removed; the repository setting (public or private) is decided
- [ ] Favicon and icons correct on iOS, Android, desktop
- [ ] Share cards render on WhatsApp, Facebook, X, Telegram
- [ ] Tested on Chrome, Safari, Firefox, Edge, Samsung Internet

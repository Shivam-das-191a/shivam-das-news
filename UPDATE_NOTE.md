# UPDATE NOTE: v0.101.180 (2026-11-21)

- Part 8cb: a paragraph written twice in a row is a build warning. New: `repeat-check-lib.mjs`, `repeat-check.test.ts`, `T-0178.md`. Changed: `validate-html.mjs`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `package.json`, `package-lock.json`. Copy these and the files of v0.101.100 to v0.101.179 below into your repository (do not copy over `site/content/` unless an older section below says so), then `git add -A && git commit -m "v0.101.180: a paragraph written twice in a row shown by the build gate" && git push`.

# UPDATE NOTE: v0.101.179 (2026-11-21)

- Part 8ca: a run of 10 or more words in capital letters in the body text is a build warning. New: `allcaps-check-lib.mjs`, `allcaps-check.test.ts`, `T-0177.md`. Changed: `validate-html.mjs`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `package.json`, `package-lock.json`. Copy these and the files of v0.101.100 to v0.101.178 below into your repository (do not copy over `site/content/` unless an older section below says so), then `git add -A && git commit -m "v0.101.179: a long run of capital words shown by the build gate" && git push`.

# UPDATE NOTE: v0.101.178 (2026-11-21)

- Part 8bz: a word typed with Caps Lock on (`hELLO`) is a build warning. New: `capslock-check-lib.mjs`, `capslock-check.test.ts`, `T-0176.md`. Changed: `validate-html.mjs`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `package.json`, `package-lock.json`. Copy these and the files of v0.101.100 to v0.101.177 below into your repository (do not copy over `site/content/` unless an older section below says so), then `git add -A && git commit -m "v0.101.178: a word typed with Caps Lock on shown by the build gate" && git push`.

# UPDATE NOTE: v0.101.177 (2026-11-21)

- Part 8by: a pile of `!!` or `???` in the body text is a build warning. New: `exclaim-check-lib.mjs`, `exclaim-check.test.ts`, `T-0175.md`. Changed: `validate-html.mjs`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `package.json`, `package-lock.json`. Copy these and the files of v0.101.100 to v0.101.176 below into your repository (do not copy over `site/content/` unless an older section below says so), then `git add -A && git commit -m "v0.101.177: a pile of exclamation or question marks shown by the build gate" && git push`.

# UPDATE NOTE: v0.101.176 (2026-11-21)

## What is new in v0.101.176
- Part 8bx: a missing space after a colon (`Note:Read`) is a build warning. New: `colon-check-lib.mjs`, `colon-check.test.ts`, `T-0174.md`. Changed: `validate-html.mjs`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `package.json`, `package-lock.json`. Copy these and the files of v0.101.100 to v0.101.175 below, then push.

# UPDATE NOTE: v0.101.175 (2026-11-21)

## What is new in v0.101.175
- Added `site/scripts/dash-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bw, POLISH): the build gate now checks the title and the body text of every built page for two hyphens where a dash belongs (`left--then`, `2020--2021`, `left -- then`). It is a warning only, one message per page with the number of places. Three or more hyphens, a command option in a sentence (`run --help`), a pair at the start or end of a paragraph, a single hyphen, an en or em dash, code and preformatted text are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/dash-check.test.ts` (60 cases).
- Card `tasks/open/T-0173.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.175) are updated. The files of v0.101.100 to v0.101.174 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file (the commit message is the only difference).

# UPDATE NOTE: v0.101.174 (2026-11-21)

## What is new in v0.101.174
- Added `site/scripts/sentence-space-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bv, POLISH): the build gate now checks the title and the body text of every built page for a missing space after the end of a sentence (`left.Then`, `Why?Because`, `Wow!Great`). It is a warning only, one message per page with the number of places. The short forms of titles and names (Mr, Mrs, Dr, St and the like), an address that starts with `www`, an e-mail address, an ellipsis, a single letter, a number, a word after the mark with one small letter, code and any text in another script are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/sentence-space-check.test.ts` (72 cases).
- Card `tasks/open/T-0172.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.174) are updated. The files of v0.101.100 to v0.101.173 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.173 (2026-11-21)

## What is new in v0.101.173
- Added `site/scripts/quote-space-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bu, POLISH): the build gate now checks the title and the body text of every built English page for the gaps around curly double quotes. A space just inside a quote, no space before an opening quote that follows a word and no space after a closing quote that is followed by a word are warnings only, one message per kind with the number of places. Straight quotes, single quotes, a German style quote, a gap written as `&nbsp;`, code, attributes, the meta description and any page whose `lang` is not English are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/quote-space-check.test.ts` (57 cases).
- Card `tasks/open/T-0171.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.173) are updated. The files of v0.101.100 to v0.101.172 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.172 (2026-11-21)

## What is new in v0.101.172
- Added `site/scripts/bracket-space-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bt, POLISH): the build gate now checks the title and the body text of every built page for the gaps around brackets. A space just inside a bracket (`( word )`), no space before an opening bracket that follows a word (`said(see below)`) and no space after a closing bracket that is followed by a word (`(see below)then`) are warnings only, one message per kind with the number of places. A smiley, `word(s)`, `f(x)`, `Title(2020)`, `( ... )`, a gap written as `&nbsp;`, an address, code, attributes and the meta description are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/bracket-space-check.test.ts` (57 cases).
- Card `tasks/open/T-0170.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.172) are updated. The files of v0.101.100 to v0.101.171 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.171 (2026-11-21)

## What is new in v0.101.171
- Added `site/scripts/bracket-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bs, POLISH): the build gate now checks the title and the body text of every built page for brackets and double quotes that are opened and never closed. A round or square bracket (counted per paragraph), a curly double quote and a straight double quote are warnings only, one message per kind with the number of places. A smiley, a list marker such as `1)`, a quotation that runs over several paragraphs, `5'10"`, a German style quote, the single quote, code, attributes and the meta description are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/bracket-check.test.ts` (65 cases).
- Card `tasks/open/T-0169.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.171) are updated. The files of v0.101.100 to v0.101.170 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.170 (2026-11-21)

## What is new in v0.101.170
- Added `site/scripts/punct-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8br, POLISH): the build gate now checks the title and the body text of every built page for slips in punctuation. A space before a comma or full stop, repeated commas or dots (two dots, or four or more) and no space after a comma or semicolon are warnings only, one message per kind with the number of places. An ellipsis of three dots, `&nbsp;` before a mark, numbers, times, web addresses, abbreviations, code, attributes and the meta description are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/punct-check.test.ts` (70 cases).
- Card `tasks/open/T-0168.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.170) are updated. The files of v0.101.100 to v0.101.169 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.169 (2026-11-21)

## What is new in v0.101.169
- Added `site/scripts/garble-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bq, POLISH): the build gate now checks the title and the body text of every built page for broken characters. The replacement mark (U+FFFD), text saved in one encoding and read in another (a curly apostrophe shown as three odd letters) and a hidden control character (U+0080 to U+009F) are warnings only, one message per kind with the number of places. Real accented text, `&nbsp;`, other scripts, code, attributes and the meta description are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/garble-check.test.ts` (57 cases).
- Card `tasks/open/T-0167.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.169) are updated. The files of v0.101.100 to v0.101.168 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.168 (2026-11-21)

## What is new in v0.101.168
- Added `site/scripts/doubled-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bp, POLISH): the build gate now checks the text of every built page for a word of 3 or more letters repeated twice in a row (`the the`). It is a warning only, one message per page with the number of places and the first pair. `had had`, `that that`, a mark after the first word (`the, the`), a block tag between the words, and code, preformatted text and attributes are not read. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/doubled-check.test.ts` (64 cases).
- Card `tasks/open/T-0166.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.168) are updated. The files of v0.101.100 to v0.101.167 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.167 (2026-11-20)

## What is new in v0.101.167
- Added `site/scripts/shout-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bo, POLISH): the build gate now checks the title and the headings (`h1` to `h3`) of every built page for shouting. A title or heading of 12 or more letters with no small letter, and one with `!!`, `??` or three or more `!` and `?` marks in a row, are warnings only, one message per kind with the number of places. Short capital headings such as `FAQ` and one single `!` or `?` are fine. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/shout-check.test.ts` (39 cases).
- Card `tasks/open/T-0165.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.167) are updated. The files of v0.101.100 to v0.101.166 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.166 (2026-11-20)

## What is new in v0.101.166
- Added `site/scripts/blank-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bn, POLISH): the build gate now checks every built page for empty text boxes and gaps made by hand. An empty paragraph (`<p></p>` or `<p>&nbsp;</p>`), an empty list item, an empty quote or caption, and two or more `&nbsp;` in a row are warnings only, one message per kind with the number of places. An empty box that a script fills later (`role`, `aria-live`, `id` or a `data-` attribute) is not a fault. Nothing stops the build. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/blank-check.test.ts` (48 cases).
- Card `tasks/open/T-0164.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.166) are updated. The files of v0.101.100 to v0.101.165 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.165 (2026-11-20)

## What is new in v0.101.165
- Added `site/scripts/break-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bm, POLISH): the build gate now checks the line breaks of every built page. A stray `</br>` stops the build. Two or more `<br>` in a row, a paragraph that holds only a `<br>`, a `<br>` at the start or end of a paragraph, next to a block tag or directly inside a list or table, and an end tag of an empty element such as `</img>` are warnings only, one message per kind with the number of places. One `<br>` between two pieces of text is fine. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/break-check.test.ts` (40 cases).
- Card `tasks/open/T-0163.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.165) are updated. The files of v0.101.100 to v0.101.164 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.164 (2026-11-20)

## What is new in v0.101.164
- Added `site/scripts/media-query-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bl, POLISH): the build gate now checks the media query of every `media` attribute on a link, picture source, style block and theme-colour tag of a built page. Unclosed or empty brackets, a missing `and`, a media type that is not real, a length or resolution with no unit, a bad colour scheme, motion or orientation value and a mistyped feature name stop the build. A media type that matches nothing (`tv`) and a min-width larger than the max-width are warnings only. No built page has a `media` attribute today, so the build still ends with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/media-query-check.test.ts` (49 cases).
- Card `tasks/open/T-0162.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.164) are updated. The files of v0.101.100 to v0.101.163 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.163 (2026-11-20)

## What is new in v0.101.163
- Added `site/scripts/integrity-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bk, POLISH): the build gate now checks the integrity fingerprint of every script and style sheet of a built page. A word that is not a real `sha256`, `sha384` or `sha512` fingerprint, and a fingerprint on a file from another website with no `crossorigin` attribute, stop the build. An empty integrity, one on a tag that does not read it, and a script or style sheet from a library host (cdnjs, jsDelivr, unpkg, jQuery, Google, Bootstrap) with no integrity are warnings only. Ad, analytics and Turnstile scripts are left alone. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/integrity-check.test.ts` (54 cases).
- Card `tasks/open/T-0161.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.163) are updated. The files of v0.101.100 to v0.101.162 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.162 (2026-11-20)

## What is new in v0.101.162
- Added `site/scripts/alt-text-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bj, POLISH and BUGS U): the build gate now checks what the alt text of every picture of a built page says. An alt that is only a file name or a camera or screenshot name (`IMG_2041.jpg`, `DSC00123`) stops the build. An alt that is one empty word (`image`, `photo`), one that starts with `image of`, one over 125 characters and one of blanks or marks only are warnings only. An empty `alt=""` is still fine. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/alt-text.test.ts` (38 cases).
- Card `tasks/open/T-0160.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.162) are updated. The files of v0.101.100 to v0.101.161 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.161 (2026-11-20)

## What is new in v0.101.161
- Added `site/scripts/structure-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bi, POLISH): the build gate now checks the skeleton of every built page. A second `<html>`, `<head>` or `<body>`, a `<head>` after the `<body>` starts, a tag or text in the head that a head may not hold (it ends the head early), a canonical link in the body and a `<title>` only in the body stop the build. A second `<title>` in the body, a `<meta>` with `name`, `property`, `http-equiv` or `charset` in the body, content after `</body>` or `</html>` and a page with no `<head>` or no `<body>` tag are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/structure-check.test.ts` (50 cases).
- Card `tasks/open/T-0159.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.161) are updated. The files of v0.101.100 to v0.101.160 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.160 (2026-11-20)

## What is new in v0.101.160
- Added `site/scripts/noscript-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bh, POLISH): the build gate now checks the `<noscript>` blocks of every built page. A `<noscript>` in the head that holds anything but `link`, `style` and `meta` (or text) and a `<noscript>` that is never closed stop the build. An empty `<noscript>`, a `<script>` inside a `<noscript>` and a `</noscript>` with no opening one are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/noscript-check.test.ts` (33 cases).
- Card `tasks/open/T-0158.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.160) are updated. The files of v0.101.100 to v0.101.159 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.159 (2026-11-20)

## What is new in v0.101.159
- Added `site/scripts/url-attr-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bg, POLISH): the build gate now checks the address attributes `action`, `formaction`, `cite`, `ping`, `poster` and `longdesc` of every built page. A `javascript:`, `file:` or `data:` address (`data:` is fine in a poster) and a `formaction` to `http://` stop the build. A `ping` to `http://` and one of these attributes on a tag that ignores it are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/url-attr-check.test.ts` (42 cases).
- Card `tasks/open/T-0157.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.159) are updated. The files of v0.101.100 to v0.101.158 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.158 (2026-11-20)

## What is new in v0.101.158
- Added `site/scripts/doctype-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bf, POLISH): the build gate now checks the first line of every built page. A page with no `<!doctype html>`, a mistyped one (`<!doctyp html>`, `<doctype html>`), one that does not come first and one with a name other than `html` stop the build. An old public or system identifier, a second doctype and a comment before the doctype are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/doctype-check.test.ts` (35 cases).
- Card `tasks/open/T-0156.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.158) are updated. The files of v0.101.100 to v0.101.157 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.157 (2026-11-20)

## What is new in v0.101.157
- Added `site/scripts/handler-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8be, POLISH): the build gate now checks the event handler attributes (`onclick`, `onload`, `onsubmit` ...) of every built page. An attribute that is a typo of a real event (`onclik`, `onlaod`) and handler code that is not valid JavaScript (a bracket or a quote never closed) stop the build. An empty handler and code that starts with `javascript:` are warnings only. A working inline handler passes quietly. The code is only compiled, never run. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/handler-check.test.ts` (58 cases).
- Card `tasks/open/T-0155.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.157) are updated. The files of v0.101.100 to v0.101.156 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.156 (2026-11-20)

## What is new in v0.101.156
- Added `site/scripts/style-block-lib.mjs` and changed `site/scripts/validate-html.mjs` and `site/scripts/style-attr-lib.mjs` (Phase 3c Part 8bd, POLISH): the build gate now checks the `<style>` blocks of every built page. A `{` never closed, a `}` with no opening one, a `{` with no selector, a comment or a quote never closed, and in each rule a declaration with no colon or no value, a property that is a typo of a real one (`backgroud`), a number with no unit in a length (`width:300`), a unit or a keyword that is a typo, a bad hex color and two declarations joined with no semicolon stop the build. An empty `<style>` block and the same property written twice with the same value are warnings only. Today's content still builds with `Validation passed.` and prints no new message. `style-attr-lib.mjs` only moved its declaration loop into the exported function `checkDeclarations`; what it reports is the same. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/style-block.test.ts` (76 cases).
- Card `tasks/open/T-0154.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.156) are updated. The files of v0.101.100 to v0.101.155 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.155 (2026-11-20)

## What is new in v0.101.155
- Added `site/scripts/style-attr-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bc, POLISH): the build gate now checks the `style="..."` attributes of every built page. A declaration with no colon or no value, a property that is a typo of a real one (`backgroud`), a number with no unit in a length (`width:300`), a unit or a keyword that is a typo (`10xp`, `position:abosolute`), a hex color that is not 3, 4, 6 or 8 digits, a bracket or a quote never closed, a pasted rule (`p{color:red}`) and two declarations joined with no semicolon stop the build. An empty style attribute, `expression(` and the same property written twice with the same value are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/style-attr.test.ts` (96 cases).
- Card `tasks/open/T-0153.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.155) are updated. The files of v0.101.100 to v0.101.154 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.154 (2026-11-20)

## What is new in v0.101.154
- Added `site/scripts/jsonld-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8bb, POLISH): the build gate now checks the structured data blocks (`application/ld+json`) of every built page. A script type that is a typo of `application/ld+json`, a block that is not valid JSON, an `@type` that is a typo of a real schema.org type (`NewsArtcle`) or has the wrong capital letters, and a `datePublished` or `dateModified` that is not a real ISO date stop the build. An empty block, a node with no `@context` or `@type`, an `@context` that is not `https://schema.org`, an HTML entity (`&amp;`) in a text and a `dateModified` before the `datePublished` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/jsonld-check.test.ts` (84 cases). One older test, `site/tests/unit/img-priority.test.ts`, now uses real ISO dates in its fake article.
- Card `tasks/open/T-0152.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.154) are updated. The files of v0.101.100 to v0.101.153 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.153 (2026-11-20)

## What is new in v0.101.153
- Added `site/scripts/share-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ba, POLISH): the build gate now checks the share tags of every built page. A tag name that is a typo of a real one (`og:titel`), a `twitter:card` or `og:type` that is a typo of a real value (`summary_large_img`), an `og:image:width` or `og:image:height` that is not a whole number, an `og:locale` not written like `en_US`, an article time that is not a real ISO date and a `twitter:image` that is not a full address stop the build. An empty content, a value no platform knows, a share tag written twice, an `og:` tag written with `name=` and a large image card with no picture are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/share-check.test.ts` (65 cases).
- Card `tasks/open/T-0151.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.153) are updated. The files of v0.101.100 to v0.101.152 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.152 (2026-11-20)

## What is new in v0.101.152
- Added `site/scripts/robots-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8az, POLISH): the build gate now checks the words of the robots meta tags of every built page. A word that is a typo of a real one (`noindx`), a wrong value of `max-image-preview`, `max-snippet` or `max-video-preview`, `follow` with `nofollow` and a meta name that is a typo of `robots` (`robot`) stop the build. An empty content, an unknown word, a list with spaces and no commas and an old word such as `noodp` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/robots-check.test.ts` (62 cases).
- Card `tasks/open/T-0150.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.152) are updated. The files of v0.101.100 to v0.101.151 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.151 (2026-11-20)

## What is new in v0.101.151
- Added `site/scripts/input-rules-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ay, POLISH): the build gate now checks the input rules of every built page. A `pattern` of an `<input>` that is not a regular expression in any browser stops the build. A pattern that only new browsers drop (`[\w-]+`), a `pattern`, `accept` or `multiple` on a field that does not read it and a `minlength` above the `maxlength` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/input-rules.test.ts` (59 cases).
- Card `tasks/open/T-0149.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.151) are updated. The files of v0.101.100 to v0.101.150 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.150 (2026-11-20)

## What is new in v0.101.150
- Added `site/scripts/langtag-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ax, POLISH): the build gate now checks the language tags of links and subtitles of every built page. An `hreflang` of a link (`a`, `area`, `link`) and a `srclang` of a `track` that is not a language code (`english`, `en_US`, `french`) stop the build. An empty `hreflang` and a subtitles track with no `srclang` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/langtag-check.test.ts` (44 cases).
- Card `tasks/open/T-0148.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.150) are updated. The files of v0.101.100 to v0.101.149 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.149 (2026-11-20)

## What is new in v0.101.149
- Added `site/scripts/target-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8aw, POLISH): the build gate now checks the link targets of every built page. A `target` or `formtarget` that starts with an underscore and is not `_blank`, `_self`, `_parent` or `_top` (`_blnk`, `_new`), and one of those words with a space around it, stop the build. The plain word `blank`, `self`, `parent`, `top` or `new` with no underscore is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/target-check.test.ts` (44 cases).
- Card `tasks/open/T-0147.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.149) are updated. The files of v0.101.100 to v0.101.148 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.148 (2026-11-20)

## What is new in v0.101.148
- Added `site/scripts/bool-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8av, POLISH): the build gate now checks the on/off attributes of every built page. `disabled`, `checked`, `selected`, `required`, `readonly`, `multiple`, `open`, `hidden`, `autoplay`, `async` and the other on/off attributes written as `false`, `0`, `no` or `off` stop the build, because the browser still switches them on. A value that is not nothing and not the attribute's own name (`disabled="true"`) is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/bool-check.test.ts` (56 cases).
- Card `tasks/open/T-0146.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.148) are updated. The files of v0.101.100 to v0.101.147 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.147 (2026-11-20)

## What is new in v0.101.147
- Added `site/scripts/ref-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8au, POLISH): the build gate now checks the attributes that point to another element by its id. A name in `headers` of a table cell, the `list` of an input, the `form` of a field, a name in `for` of an output and the `popovertarget` of a button that is not an id on the page stop the build. A `headers` that is not a `<th>`, a `list` that is not a `<datalist>`, a `form` that is not a `<form>` and a `popovertarget` with no `popover` attribute are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/ref-check.test.ts` (49 cases).
- Card `tasks/open/T-0145.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.147) are updated. The files of v0.101.100 to v0.101.146 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.146 (2026-11-19)

## What is new in v0.101.146
- Added `site/scripts/map-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8at, POLISH): the build gate now checks the image maps (clickable pictures) of every built page. An `<img usemap>` that is not `#` and a name or that names a map that is not on the page, a `<map>` with no name, a name with a space or a repeated name, an `<area>` with an unknown shape, with no `coords`, with `coords` that are not numbers or of the wrong length and an `<area>` with an `href` and no `alt` stop the build. A map that no picture uses, an `<area>` outside a `<map>` and an old shape name are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/map-check.test.ts` (60 cases).
- Card `tasks/open/T-0144.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.146) are updated. The files of v0.101.100 to v0.101.145 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.145 (2026-11-19)

## What is new in v0.101.145
- Added `site/scripts/range-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8as, POLISH): the build gate now checks the range values of every built page. A `max` or `value` of a `<progress>`, a `min`, `max`, `low`, `high`, `optimum` or `value` of a `<meter>` and a `min`, `max` or `step` of a number or range field that is not a number stop the build. A progress `max` of 0 or below, a value outside its range, a `min` above its `max`, a meter `low` above its `high` and a `step` of 0 or below are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/range-check.test.ts` (64 cases).
- Card `tasks/open/T-0143.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.145) are updated. The files of v0.101.100 to v0.101.144 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.144 (2026-11-19)

## What is new in v0.101.144
- Added `site/scripts/number-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ar, POLISH): the build gate now checks the number attributes of every built page. A `width` or `height` of a picture, video or canvas that is not a number, a `colspan`, `rowspan`, `span`, `rows`, `cols` or `size` that is not a whole number and an `ol` `start` or `li` `value` that is not a whole number stop the build. A size written as `640px` or `100%`, a `colspan` or `span` out of range and a `rows`, `cols` or `size` of 0 are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/number-check.test.ts` (56 cases).
- Card `tasks/open/T-0142.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.144) are updated. The files of v0.101.100 to v0.101.143 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.143 (2026-11-19)

## What is new in v0.101.143
- Added `site/scripts/picture-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8aq, POLISH): the build gate now checks every `<picture>` of every built page. A picture with no `<img>`, a picture with more than one `<img>`, a `<source>` after the `<img>` and a `<source>` with no `srcset` stop the build. A `<source>` with neither type nor media, a type that is not an image type and an empty media are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/picture-check.test.ts` (40 cases).
- Card `tasks/open/T-0141.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.143) are updated. The files of v0.101.100 to v0.101.142 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.142 (2026-11-19)

## What is new in v0.101.142
- Added `site/scripts/svg-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ap, POLISH): the build gate now checks every inline SVG of every built page. A `<script>` inside an `<svg>`, an svg `<use>` or `<image>` from `http://` and an `<svg role="img">` with no name stop the build. An svg with no name that is not hidden, a hidden svg that has a name, an svg with a size and no `viewBox`, a `<foreignObject>` and a `<use>` that points to a missing id are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/svg-check.test.ts` (57 cases).
- Card `tasks/open/T-0140.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.142) are updated. The files of v0.101.100 to v0.101.141 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.141 (2026-11-19)

## What is new in v0.101.141
- Added `site/scripts/object-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ao, POLISH): the build gate now checks plug-in content of every built page. Flash in an `<object>`, `<embed>` or `<param>` and an `<object>` or `<embed>` from `http://` stop the build. Any other `<object>` or `<embed>` is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/object-check.test.ts` (39 cases).
- Card `tasks/open/T-0139.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.141) are updated. The files of v0.101.100 to v0.101.140 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.140 (2026-11-19)

## What is new in v0.101.140
- Added `site/scripts/meta-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8an, POLISH): the build gate now checks the document settings of every built page. A character set other than UTF-8, a `<meta http-equiv="refresh">` with a delay over 0 seconds, a `<base href>` from `http://` and a second `<base>` stop the build. A refresh of 0 seconds to an address, a `<base>` that does nothing, a character set declared twice and a `<meta charset>` after the first 1024 bytes are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/meta-check.test.ts` (46 cases).
- Card `tasks/open/T-0138.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.140) are updated. The files of v0.101.100 to v0.101.139 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.139 (2026-11-19)

## What is new in v0.101.139
- Added `site/scripts/script-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8am, POLISH): the build gate now checks the scripts and style sheets of every built page. A script or a style sheet that loads from `http://` and a `<script>` with an empty `src` stop the build. A script `src` that also holds text, `async` or `defer` on an inline classic script, `nomodule` on a module script, the same classic script loaded twice and `document.write(` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/script-check.test.ts` (56 cases).
- Card `tasks/open/T-0137.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.139) are updated. The files of v0.101.100 to v0.101.138 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.138 (2026-11-19)

## What is new in v0.101.138
- Added `site/scripts/form-behavior-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8al, POLISH): the build gate now checks the forms of every built page. A form that sends to an `http://` address and a password field in a form that sends with GET (the default when there is no method) stop the build. A file field without `method="post"` and multipart, a field with no name, a name used twice, a lone radio button and a `select` with no `option` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/form-behavior-check.test.ts` (59 cases).
- Card `tasks/open/T-0136.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.138) are updated. The files of v0.101.100 to v0.101.137 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.137 (2026-11-19)

## What is new in v0.101.137
- Added `site/scripts/paragraph-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ak, POLISH): the build gate now checks every built page for a block tag inside a paragraph. A `div`, a list, a table, a heading, a figure, a `pre`, a `form` and the like opened while a `<p>` is still open stop the build. A block tag or a `<p>` directly inside an inline tag (`span`, `b`, `em`, `strong`, `label` and the like) or a heading is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/paragraph-check.test.ts` (56 cases).
- Card `tasks/open/T-0135.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.137) are updated. The files of v0.101.100 to v0.101.136 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.136 (2026-11-19)

## What is new in v0.101.136
- Added `site/scripts/parent-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8aj, POLISH): the build gate now checks that list items, description terms, options, figure captions, legends, summaries, sources and tracks of every built page sit inside their own parent tag. An `li` outside a list, a `dt` or `dd` outside a `dl`, an `option` outside a `select`, a `figcaption` outside a `figure`, a `legend` outside a `fieldset`, a `summary` outside `details`, a `source` outside `picture`, `video` or `audio` and a `track` outside `video` or `audio` stop the build. A list with a direct child that is not an `li`, a `dl` with a stray child, a `details` with no `summary` and a `fieldset` with no `legend` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/parent-check.test.ts` (53 cases).
- Card `tasks/open/T-0134.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.136) are updated. The files of v0.101.100 to v0.101.135 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.135 (2026-11-19)

## What is new in v0.101.135
- Added `site/scripts/entity-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ai, POLISH): the build gate now checks the character references of every built page. A common reference escaped twice (`&amp;amp;`) and a numeric reference that is empty, 0, in the surrogate range or above 10FFFF stop the build. A common name with no semicolon (`&nbsp`) and a reference to a control character or an old Windows code (`&#146;`) are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/entity-check.test.ts` (46 cases).
- Card `tasks/open/T-0133.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.135) are updated. The files of v0.101.100 to v0.101.134 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.134 (2026-11-19)

## What is new in v0.101.134
- Added `site/scripts/nest-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ah, POLISH): the build gate now checks that links, buttons and forms of every built page are not nested. A link in a link, a button in a button and a form in a form stop the build. A button in a link, a link in a button and a field in a link or a button are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/nest-check.test.ts` (41 cases).
- Card `tasks/open/T-0132.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.134) are updated. The files of v0.101.100 to v0.101.133 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.133 (2026-11-19)

## What is new in v0.101.133
- Added `site/scripts/tag-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ag, POLISH): the build gate now checks the tags of every built page. A tag with the same attribute twice and a tag HTML has dropped (`marquee`, `blink`, `frame`, `frameset`, `applet` and the like) stop the build. An old tag (`center`, `font`, `big`) and an old attribute (`align`, `bgcolor`, `valign`) are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/tag-check.test.ts` (44 cases).
- Card `tasks/open/T-0131.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.133) are updated. The files of v0.101.100 to v0.101.132 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.132 (2026-11-19)

## What is new in v0.101.132
- Added `site/scripts/srcset-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8af, POLISH): the build gate now checks the `srcset` and `sizes` of every picture of a built page. An empty srcset, a descriptor that is not real, a mix of `w` and `x`, the same descriptor twice, an `http://` address, an empty `sizes` and a `sizes` that does not end with a real length (`100%`) stop the build. A `w` srcset with no `sizes` and a `sizes` that does nothing are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/srcset-check.test.ts` (46 cases).
- Card `tasks/open/T-0130.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.132) are updated. The files of v0.101.100 to v0.101.131 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.131 (2026-11-19)

## What is new in v0.101.131
- Added `site/scripts/input-hints-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ae, POLISH): the build gate now checks the input hints of every built page. An `autocomplete` word that is not a real field name, and an `inputmode`, `enterkeyhint`, `autocapitalize`, `spellcheck`, `translate`, `contenteditable`, `draggable` or textarea `wrap` that is not a real value stop the build. `autocomplete="off"` on a password field is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/input-hints.test.ts` (45 cases).
- Card `tasks/open/T-0129.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.131) are updated. The files of v0.101.100 to v0.101.130 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.130 (2026-11-19)

## What is new in v0.101.130
- Added `site/scripts/rel-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ad, POLISH): the build gate now checks the rel words and the preload hints of every built page. A `rel` word that is a typo of a real word (`noopner`, `nofolow`), an empty `rel` on a `<link>`, a `<link>` that needs a file and has no `href`, and a `preload` with no `as` or a wrong one stop the build. A font preload with no `crossorigin` and `rel="opener"` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/rel-check.test.ts` (45 cases).
- Card `tasks/open/T-0128.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.130) are updated. The files of v0.101.100 to v0.101.129 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.129 (2026-11-19)

## What is new in v0.101.129
- Added `site/scripts/attr-values-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ac, POLISH): the build gate now checks the fixed-choice attributes of every built page. A `loading`, `decoding`, `fetchpriority`, `referrerpolicy`, `crossorigin`, form `method` or `enctype` or `ol` type that is not a real value stops the build. `referrerpolicy="unsafe-url"` is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/attr-values.test.ts` (30 cases).
- Card `tasks/open/T-0127.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.129) are updated. The files of v0.101.100 to v0.101.128 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.128 (2026-11-19)

## What is new in v0.101.128
- Added `site/scripts/lang-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8ab, POLISH): the build gate now checks the language code and the text direction of every built page. A `lang` or `xml:lang` that is not a language code and a `dir` that is not `ltr`, `rtl` or `auto` stop the build. A tag with a `lang` and an `xml:lang` that differ is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/lang-check.test.ts` (31 cases).
- Card `tasks/open/T-0126.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.128) are updated. The files of v0.101.100 to v0.101.127 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.127 (2026-11-19)

## What is new in v0.101.127
- Added `site/scripts/form-controls-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8aa, POLISH): the build gate now checks the type of every `<input>` and `<button>` and the length numbers of every built page. An input type that is not real, a button type that is not submit, reset or button and a `maxlength` or `minlength` that is not a whole number stop the build. A `<button>` inside a `<form>` with no type is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/form-controls.test.ts` (32 cases).
- Card `tasks/open/T-0125.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.127) are updated. The files of v0.101.100 to v0.101.126 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.126 (2026-11-19)

## What is new in v0.101.126
- Added `site/scripts/time-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8z, POLISH): the build gate now checks every `<time>` of every built page. A `datetime` that is empty, not a real value or a date or time that does not exist stops the build. A `<time>` with no `datetime` and unreadable text is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/time-check.test.ts` (31 cases).
- Card `tasks/open/T-0124.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.126) are updated. The files of v0.101.100 to v0.101.125 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.125 (2026-11-19)

## What is new in v0.101.125
- Added `site/scripts/tabindex-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8y, POLISH): the build gate now checks the Tab key order of every built page. A `tabindex` that is not a whole number and a `tabindex` above 0 stop the build. An `accesskey` and an `onclick` on a plain tag with no role are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/tabindex-check.test.ts` (25 cases).
- Card `tasks/open/T-0123.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.125) are updated. The files of v0.101.100 to v0.101.124 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.124 (2026-11-19)

## What is new in v0.101.124
- Added `site/scripts/aria-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8x, POLISH): the build gate now checks the ARIA words of every built page. A role that is not real, an `aria-` name that does not exist, a wrong value where the list is fixed, `aria-hidden="true"` on `body` or `html` and `aria-hidden="true"` on a link, button or field that the Tab key reaches stop the build. An empty `aria-label`, `aria-hidden` around a link inside, `role="presentation"` on something the Tab key reaches and a role the tag already has are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/aria-check.test.ts` (44 cases).
- Card `tasks/open/T-0122.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.124) are updated. The files of v0.101.100 to v0.101.123 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.123 (2026-11-19)

## What is new in v0.101.123
- Added `site/scripts/href-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8w, POLISH): the build gate now checks every link address (`a` and `area` with href) of every built page. An empty href, a `javascript:`, `vbscript:` or `file:` address, a `mailto:` with no address and a `tel:` with no number stop the build. `href="#"`, a link on `http://`, a bare web address with no scheme and a link to localhost are warnings only. Today's content has none of these, so it still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/href-check.test.ts` (32 cases).
- Card `tasks/open/T-0121.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.123) are updated. The files of v0.101.100 to v0.101.122 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.122 (2026-11-19)

## What is new in v0.101.122
- Added `site/scripts/media-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8v, POLISH): the build gate now checks every video and audio of every built page. A video that plays by itself with sound, an audio with autoplay, a video or audio with no `controls` (except a silent looping video) and a source on `http://` stop the build. A video with no captions track, no preload, no poster and no width and height are warnings only. No built page has a video or audio today, so it still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/media-check.test.ts` (38 cases).
- Card `tasks/open/T-0120.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.122) are updated. The files of v0.101.100 to v0.101.121 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.121 (2026-11-19)

## What is new in v0.101.121
- Added `site/scripts/table-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8u, POLISH): the build gate now checks every table of every built page. A `scope` that is not col, row, colgroup or rowgroup, and a `th` inside a table marked `role="presentation"` or `none`, stop the build. A table with no `th`, a table with no caption (and no aria-label, aria-labelledby or title) and a `th` with no text are warnings only. No public page has a table today, so it still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/table-check.test.ts` (35 cases).
- Card `tasks/open/T-0119.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.121) are updated. The files of v0.101.100 to v0.101.120 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.120 (2026-11-19)

## What is new in v0.101.120
- Added `site/scripts/iframe-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8t, POLISH): the build gate now checks every iframe of every built page. An iframe with no name (no title, aria-label or aria-labelledby), an `http://` address and a `javascript:`, `data:` or `vbscript:` address stop the build. A vague name, no `loading="lazy"`, no width and height, an address with no scheme, no `sandbox` on a frame from another website and no src or srcdoc are warnings only. Today's content has no iframe, so it still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/iframe-check.test.ts` (44 cases).
- Card `tasks/open/T-0118.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.120) are updated. The files of v0.101.100 to v0.101.119 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.119 (2026-11-19)

## What is new in v0.101.119
- Added `site/scripts/ids-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8s, POLISH): the build gate now checks the ids of every built page. An empty id, an id with a space in it and an id used twice on one page stop the build. An in-page link (`#name`) or an `aria-controls` or `aria-describedby` that points to a missing id is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/ids.test.ts` (30 cases).
- Card `tasks/open/T-0117.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.119) are updated. The files of v0.101.100 to v0.101.118 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.118 (2026-11-19)

## What is new in v0.101.118
- Added `site/scripts/new-tab-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8r, POLISH): the build gate now checks the links that open a new tab. A link with `target="_blank"` (or another window name) and no `noopener` or `noreferrer` in `rel`, and a `base` tag with such a target, stop the build. A link that never says "opens in a new tab" is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/new-tab.test.ts` (35 cases).
- Card `tasks/open/T-0116.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.118) are updated. The files of v0.101.100 to v0.101.117 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.117 (2026-11-19)

## What is new in v0.101.117
- Added `site/scripts/zoom-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8q, POLISH): the build gate now checks that a reader can zoom. `user-scalable=no`, a `maximum-scale` under 2, and a `touch-action` on html, body, :root, main or `*` that stops pinch zoom stop the build. A `maximum-scale` from 2 up to 5 and `text-size-adjust: none` are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/zoom-check.test.ts` (41 cases).
- Card `tasks/open/T-0115.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.117) are updated. The files of v0.101.100 to v0.101.116 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.116 (2026-11-19)

## What is new in v0.101.116
- Added `site/scripts/side-scroll-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8p, POLISH): the build gate now checks that nothing is made wider than a 320px phone screen. A fixed `width` or `min-width` over 320px with no cap (in the style, in an inline style, or as a `width` attribute on a table, cell or block) stops the build. `100vw`, an unprotected `white-space: nowrap`, pictures with no `max-width: 100%` rule and `pre` blocks that cannot scroll are warnings only. Today's content still builds with `Validation passed.` and prints no new message. New test: `site/tests/unit/side-scroll.test.ts` (55 cases).
- Changed `site/src/styles/global.css`: one rule split in two, `.brand` and `.brand span:last-child`. The site name keeps its look; a very long name is cut with an ellipsis instead of pushing the header wider.
- Card `tasks/open/T-0114.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.116) are updated. The files of v0.101.100 to v0.101.115 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.115 (2026-11-19)

## What is new in v0.101.115
- Added `site/scripts/landmarks-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8o, POLISH): the build gate now checks where the landmarks of every built page sit. An h1 outside `main`, a `main` inside a header, footer, nav, aside or article, and a story page with no `article`, with two, with its `article` outside `main` or with its h1 outside the `article` stop the build. An `aside` with no label is a warning only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/landmarks.test.ts` (32 cases). Changed test: `site/tests/unit/img-priority.test.ts` (one inserted `<article>` pair in its fake story page, no expectation changed).
- The owner's new logo (card `T-0113`): `site/brand/source-icon.png`, `site/public/favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `badge-96.png` and `og-default.png` are new. Copy them too.
- Cards `tasks/open/T-0112.md` and `tasks/open/T-0113.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.115) are updated. The files of v0.101.100 to v0.101.114 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.114 (2026-11-19)

## What is new in v0.101.114
- Added `site/scripts/head-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8n, POLISH): the build gate now checks the head of every built page. No title, an empty title, a canonical that is not a full address or that is there twice, a robots tag that says index and noindex, no og:title, or an og:url or og:image that is not a full address stops the build. A title over 70 characters, a description over 160 characters, a canonical on http, no og:image, no twitter:card, no theme-color and indexable pages with one shared title are warnings only. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/head-check.test.ts` (43 cases). Changed tests (one inserted run of head tags in their fake pages, no expectation changed): `contrast-check`, `css-polish`, `font-check`, `form-labels`, `heading-order`, `img-check`, `img-priority`, `img-ratio`, `link-names`, `page-basics`, `tap-targets`.
- Card `tasks/open/T-0111.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.114) are updated. The files of v0.101.100 to v0.101.113 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.113 (2026-11-19)

## What is new in v0.101.113
- Changed `site/src/components/Header.astro`, `site/src/components/PostCard.astro`, `site/src/components/Listing.astro` and `site/src/styles/global.css` (Phase 3c Part 8m, POLISH): the two titles of the menu drawer are `p` tags instead of `h3`, so no heading comes before the `h1`; the post cards on category, tag and author pages are `h2` (new prop `level`), so no level is skipped. The 17 heading warnings of v0.101.109 are gone; today's content builds with `Validation passed.` and only the SITE_URL note for a local computer is left. The drawer titles and the card titles keep their look. New test: `site/tests/unit/heading-templates.test.ts` (7 cases). No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed.
- Card `tasks/open/T-0110.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.113) are updated. The files of v0.101.100 to v0.101.112 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.112 (2026-11-19)

## What is new in v0.101.112
- Changed `site/src/styles/global.css` (Phase 3c Part 8l, POLISH): the `.dot` colour style buttons in the menu drawer are 44px by 44px, were 38px by 38px. The tap target warning of v0.101.110 is gone. Today's content still builds with `Validation passed.`; the only warnings left are the 17 heading warnings. Changed test: `site/tests/unit/tap-targets.test.ts` (the real rules case now expects no warning). No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed.
- Card `tasks/open/T-0109.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.112) are updated. The files of v0.101.100 to v0.101.111 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.111 (2026-11-19)

## What is new in v0.101.111
- Added `site/scripts/contrast-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8k, POLISH): the build gate now checks the contrast of text colours in the built style. The colour tokens (`--text`, `--muted`, `--acc-t` on `--bg` and `--card`, and white text on `--acc`) must keep 4.5:1 in every look (light, dark, and each colour style) or the build stops. A rule that sets both a text colour and a solid background is an error under 3:1 and a warning under 4.5:1. Gradients, pictures, colours with alpha, `hsl()`, rules with only one of the two colours, print rules and keyframes are left out. Today's content still builds with `Validation passed.` and prints no new message. No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/contrast-check.test.ts` (77 cases). No older test changed.
- Card `tasks/open/T-0108.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.111) are updated. The files of v0.101.100 to v0.101.110 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.110 (2026-11-19)

## What is new in v0.101.110
- Added `site/scripts/tap-targets-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8j, POLISH): the build gate now checks the size of buttons, links, menu summaries and fields in the built style. A control drawn under 24px wide or tall is an error and stops the build (WCAG 2.2, 2.5.8); one drawn under 44px is a warning only (the size this site uses for touch). Sizes in %, calc() or var(), checkboxes and radios, the hidden trap field, `::before` and `::after`, print rules and mouse only media queries are left out. Today's content still builds with `Validation passed.` and prints one new warning: the colour style buttons in the menu drawer (`.dot`) are 38px by 38px. The size is not changed here, because it changes the look; the owner decides (one line in `site/src/styles/global.css`). No setting added, no Worker changed, nothing in `site/content/`, `site/config/` or `site/src/` changed. New test: `site/tests/unit/tap-targets.test.ts` (72 cases). No older test changed.
- Card `tasks/open/T-0107.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.110) are updated. The files of v0.101.100 to v0.101.109 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.109 (2026-11-19)

## What is new in v0.101.109
- Added `site/scripts/heading-order-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8i, POLISH): the build gate now checks the headings (h1 to h6) of every built page. An empty heading is an error and stops the build. Headings that come before the h1 and a skipped level after the h1 (for example an h3 straight after the h1) are warnings only. Today's content still builds with `Validation passed.` and prints 17 warnings: every page starts with two `h3` headings of the menu drawer before its `h1`. When the first real post is published, the category, tag and author pages will also warn (the post card is an `h3`). These are warnings on purpose; an error would stop every build. The two templates are not changed here. No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/heading-order.test.ts` (27 cases). No older test changed.
- Card `tasks/open/T-0106.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.109) are updated. The files of v0.101.100 to v0.101.108 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.108 (2026-11-19)

## What is new in v0.101.108
- Added `site/scripts/link-names-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8h, POLISH): the build gate now checks that every link (a with href), every button and every input button of every built page has a name: text, a picture alt, a svg title, an aria-label, or an aria-labelledby to an element of the page. A link or button with no name is an error and stops the build; text inside `aria-hidden` does not count; a vague text such as "click here" or "read more" alone is only a warning. Today's content still builds with `Validation passed.` (382 links and 90 buttons on 17 pages, all named). No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/link-names.test.ts` (35 cases). No older test changed.
- Card `tasks/open/T-0105.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.108) are updated. The files of v0.101.100 to v0.101.107 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.107 (2026-11-19)

## What is new in v0.101.107
- Added `site/scripts/form-labels-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8g, POLISH): the build gate now checks that every form field (input, select, textarea) of every built page has a label: a label with text that points to it or wraps it, an aria-label, or an aria-labelledby to an element of the page. A field with only a placeholder is an error; a label that points to a missing id is a warning. Today's content still builds with `Validation passed.` (21 form fields on 2 pages, all named). No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/form-labels.test.ts` (28 cases). No older test changed.
- Card `tasks/open/T-0104.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.107) are updated. The files of v0.101.100 to v0.101.106 below must be copied too.
- Also in this ZIP, from the time zone card T-0003 (documents only, decided by the owner: US readers, `America/New_York`): `AI_OPERATIONS.md`, `NEWS_WEBSITE_PLAN.md`, `INCOMPLETE.md` (decision 8 and three mentions) and `tasks/open/T-0003.md`. `site/README.md` line 155 still says `Asia/Kolkata`; it is not in the paths of T-0003 and waits for the owner's yes.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.106 (2026-11-19)

## What is new in v0.101.106
- Added `site/scripts/font-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8f, POLISH): the build gate now checks the fonts. Every `@font-face` needs `font-display` swap, fallback or optional; a font file or import from another website, and a link to a font website such as Google Fonts, stop the build; more than four font faces only warns. Today's content still builds with `Validation passed.` (four faces, all swap, all on our own site). No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/font-check.test.ts` (26 cases). No older test changed.
- Card `tasks/open/T-0103.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.106) are updated. The files of v0.101.100 to v0.101.105 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.105 (2026-11-19)

## What is new in v0.101.105
- Added `site/scripts/css-polish-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8e, POLISH): the build gate now checks the final style of the site: a print rule (`@media print`), a visible focus ring (`:focus-visible` with an outline) and, when the style uses motion, a `prefers-reduced-motion` rule. Errors stop the build. Today's content still builds with `Validation passed.` No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/css-polish.test.ts` (21 cases); changed tests: `img-check.test.ts`, `img-priority.test.ts`, `img-ratio.test.ts`, `page-basics.test.ts` (their fake pages now have a small base style).
- Card `tasks/open/T-0102.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.105) are updated. The files of v0.101.100 to v0.101.104 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.104 (2026-11-19)

## What is new in v0.101.104
- Added `site/scripts/page-basics-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8d, POLISH): the build gate now checks the basics of every built page: `lang` on the html tag, the viewport meta, the skip link to `#main`, an element with id `main`, exactly one `main`, a header and a footer (errors stop the build), and several `nav` blocks where one has no label (warning). Today's content still builds with `Validation passed.` No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/page-basics.test.ts` (20 cases); changed tests: `img-check.test.ts`, `img-priority.test.ts`, `img-ratio.test.ts` (their fake pages now have a proper page shell).
- Card `tasks/open/T-0101.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.104) are updated. The files of v0.101.100 to v0.101.103 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.103 (2026-11-19)

## What is new in v0.101.103
- Added `site/scripts/img-ratio-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8c, POLISH): the build gate now checks that every thumbnail (class `thumb`) says a width and height of 16:9, and, when a page has a thumbnail, that the style of `.thumb` still has `aspect-ratio: 16/9` and `object-fit: cover`. A wrong ratio or a lost style stops the build. Today's content still builds with `Validation passed.` No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/img-ratio.test.ts` (21 cases); changed test: `site/tests/unit/img-priority.test.ts` (its fake article page now has the `.thumb` style).
- Card `tasks/open/T-0100.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.103) are updated. The files of v0.101.100, v0.101.101 and v0.101.102 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.102 (2026-11-19)

## What is new in v0.101.102
- Added `site/scripts/img-priority-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8b, POLISH): the build gate now also checks the loading of the pictures of every built page. A top picture of an article without `fetchpriority="high"`, a lazy top picture, or a picture that is both high priority and lazy stops the build; two high priority pictures, or an article picture that is not lazy, only give a warning. Today's content still builds with `Validation passed.` No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/img-priority.test.ts` (20 cases).
- Card `tasks/open/T-0099.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.102) are updated. The files of v0.101.100 and v0.101.101 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.101 (2026-11-19)

## What is new in v0.101.101
- Added `site/scripts/img-check-lib.mjs` and changed `site/scripts/validate-html.mjs` (Phase 3c Part 8a, POLISH): the build gate at the end of `npm run build` now checks the pictures of every built page. A picture with no `alt` attribute or an `http://` address stops the build; a picture from another website or without width and height only gives a warning. Today's content still builds with `Validation passed.` No setting added, no Worker changed, nothing in `site/content/` or `site/config/` changed. New test: `site/tests/unit/img-check.test.ts` (21 cases).
- Card `tasks/open/T-0098.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.101) are updated. The files of v0.101.100 below must be copied too.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.100 (2026-11-19)

## What is new in v0.101.100
- Changed `site/scripts/validate-content-lib.mjs` and `site/scripts/validate-content.mjs` (Phase 3c Part 7ae, BUGS U12): `npm run check:content` now adds up the size of `site/public/media/` and prints a warning when the pictures use more than 900 MB (a repository should stay under about 1 GB). It is a warning only; the check still passes. No setting added, no Worker changed, nothing changes on the site. New test: `site/tests/unit/media-size-warning.test.ts` (13 cases).
- Card `tasks/open/T-0097.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.100) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.99 (2026-11-19)

## What is new in v0.101.99
- Changed `site/public/admin/js/app.js`, `images-form-screen.js` and (comments only) `images-save.js` (Phase 3c Part 7ad): the Picture settings screen of the dashboard now has a button `Save picture settings` under the form. It writes `site/config/images.json` to GitHub in one commit, only when every value is right. It stops if someone else changed the file after you opened the page, and it writes nothing when nothing changed. Changed tests: `site/tests/unit/admin-images-form.test.ts` (18 new cases), `images-form-screen.test.ts`, `images-save.test.ts`. No setting added, no Worker changed. No file of `site/content/` is changed.
- Card `tasks/open/T-0096.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.99) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.98 (2026-11-19)

## What is new in v0.101.98
- Added `site/public/admin/js/images-save.js` (Phase 3c Part 7ac): the function `saveImagesSettings` that checks the values of the picture settings form and writes `site/config/images.json` to GitHub in one commit. It writes nothing when the file already says the same, and it stops when someone else changed the file after the form was opened. Nothing calls it yet (no button), so nothing changes on the site or in the dashboard. New test: `site/tests/unit/images-save.test.ts` (46 cases). No setting added, no Worker changed, no file of `site/content/` changed.
- Card `tasks/open/T-0095.md` (new); `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.98) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.97 (2026-11-19)

## What is new in v0.101.97
- Changed `site/public/admin/js/images-setting.js`, `hosting-hook.js`, `hosting-save.js` and `hosting-setup.js` (Phase 3c Part 7ab): the Save of the editor now uses the `allowHosts` setting of `site/config/images.json`. A picture from a listed website (exact name) is counted as ours: it is not fetched and not hosted. A name related to an agency website or to a blocked website is ignored, so this list cannot let such a picture through. The shipped list is empty (and a missing, wrong or broken file changes nothing), so nothing changes on the site until you add a website. Changed text in `site/public/admin/js/images-screen.js` (the row "Websites counted as ours"). New test: `site/tests/unit/hosting-allow-hosts-save.test.ts` (39 cases); changed test: `site/tests/unit/images-screen.test.ts`. No setting added, no Worker changed. No file of `site/content/` is changed.
- Card `tasks/open/T-0094.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.97) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.96 (2026-11-19)

## What is new in v0.101.96
- Changed `site/public/admin/js/images-setting.js`, `hosting-hook.js`, `hosting-save.js` and `hosting-setup.js` (Phase 3c Part 7aa): the Save of the editor now uses the `blockHosts` setting of `site/config/images.json`. A picture from a listed website (and from its sub names) is refused: it is not fetched and not hosted, and the writer reads "The owner blocked this host." The shipped list is empty (and a missing, wrong or broken file changes nothing), so nothing changes on the site until you add a website. Changed text in `site/public/admin/js/images-screen.js` (the row "Websites never allowed"). New test: `site/tests/unit/hosting-block-hosts-save.test.ts` (38 cases); changed test: `site/tests/unit/images-screen.test.ts`. No setting added, no Worker changed. No file of `site/content/` is changed.
- Card `tasks/open/T-0093.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.96) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.95 (2026-11-19)

## What is new in v0.101.95
- Changed `site/public/admin/js/images-setting.js`, `hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`, `hosting-pipeline.js`, `hosting-run.js`, `hosting-plan.js` and `hosted-meta.js` (Phase 3c Part 7z): the Save of the editor now uses the `askFirst` setting of `site/config/images.json`. When it is `true`, every outside picture that is not hosted yet waits for the writer to confirm instead of being hosted at once. The shipped value is `false` (and a missing, wrong or broken file changes nothing), so nothing changes on the site until you set `askFirst` to `true`. Changed text in `site/public/admin/js/images-screen.js` (the row "How it starts"). New test: `site/tests/unit/hosting-ask-first-save.test.ts` (51 cases); changed test: `site/tests/unit/images-screen.test.ts`. No setting added, no Worker changed. No file of `site/content/` is changed.
- Card `tasks/open/T-0092.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.95) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.94 (2026-11-19)

## What is new in v0.101.94
- Changed `site/public/admin/js/images-setting.js`, `hosting-hook.js`, `hosting-save.js` and `hosting-setup.js` (Phase 3c Part 7y): the Save of the editor now adds the `askHosts` of `site/config/images.json` to the list of agency websites, so a picture from those websites waits for the writer to confirm. The shipped list is empty (and a missing, wrong or broken file changes nothing), so nothing changes on the site until you add a website. Changed text in `site/public/admin/js/images-screen.js` (the row "Websites that ask first"). New test: `site/tests/unit/hosting-ask-hosts-save.test.ts` (34 cases); changed test: `site/tests/unit/images-screen.test.ts`. No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0091.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.94) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.93 (2026-11-19)

## What is new in v0.101.93
- Changed `site/public/admin/js/images-setting.js`, `hotlink.js`, `hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`, `hosting-pipeline.js` and `hosting-run.js` (Phase 3c Part 7x): the Save of the editor now names NEW pictures by the `nameOrder` of `site/config/images.json`. With the shipped order (or a missing, wrong or broken file) the names are made exactly as before, so nothing changes on the site until you change `nameOrder`. Changed text in `site/public/admin/js/images-screen.js` (the row "Order of picture names"). New test: `site/tests/unit/hosting-name-order-save.test.ts` (42 cases); changed test: `site/tests/unit/images-screen.test.ts`. No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0090.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.93) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.92 (2026-11-18)

## 00000000000000000000000000000000000000000000000000000000. What is new in v0.101.92
- Changed `site/public/admin/js/hosting-hook.js` and `site/public/admin/js/images-setting.js` (Phase 3c Part 7w): the Save of the editor now obeys the switch `enabled` of `site/config/images.json`. With `"enabled": false` it does not host pictures; with `true` (the shipped value), a missing file or a broken file it works as before. So nothing changes on the site until you set it. Changed text in `site/public/admin/js/images-screen.js` (the row "Picture hosting"). New test: `site/tests/unit/hosting-switch-save.test.ts` (31 cases); changed tests: `hosting-quality-save.test.ts`, `images-screen.test.ts`. No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0089.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.92) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.91 (2026-11-18)

## 0000000000000000000000000000000000000000000000000000000. What is new in v0.101.91
- Changed `site/public/admin/js/app.js` (Phase 3c Part 7v): the **Picture settings** screen (admins only) now shows a form under the read only list. The admin can type a change and see the sentences for wrong values, what would change and the text of the new `config/images.json`. There is NO save: nothing is written to GitHub. The live site does not change. New test: `site/tests/unit/admin-images-form.test.ts` (11 cases); changed: `site/tests/unit/images-form-screen.test.ts`, `AI_OPERATIONS.md` (Section 13). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0088.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.91) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file. After the deploy, open `/admin/#/images` and try the form once.

# UPDATE NOTE: v0.101.90 (2026-11-18)

## 000000000000000000000000000000000000000000000000000000. What is new in v0.101.90
- New file `site/public/admin/js/images-form-screen.js` (Phase 3c Part 7u): the form page of the picture settings, with the sentences for wrong values, the list of what would change and the text of the new `config/images.json`. No button and no save; nothing calls it yet, so the dashboard and the live site do not change. New test: `site/tests/unit/images-form-screen.test.ts` (27 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0087.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.90) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.89 (2026-11-18)

## 00000000000000000000000000000000000000000000000000000. What is new in v0.101.89
- New file `site/public/admin/js/images-form.js` (Phase 3c Part 7t): the logic of the picture settings form (strict checks, the new text of `config/images.json`, the list of changes). No page, no save; nothing calls it yet, so the dashboard and the live site do not change. New test: `site/tests/unit/images-form.test.ts` (64 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0086.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.89) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.88 (2026-11-18)

## 0000000000000000000000000000000000000000000000000000. What is new in v0.101.88
- Changed `site/public/admin/js/app.js` (Phase 3c Part 7s): a new dashboard menu item **Picture settings** (`#/images`, admins only) that shows the eleven settings of `config/images.json` in plain words, read only, using the screen file of v0.101.87. Nothing is written by it. The live site does not change; the dashboard gets one new menu item. New test: `site/tests/unit/admin-images-screen.test.ts` (9 cases); changed: `site/tests/unit/images-screen.test.ts`, the header of `site/public/admin/js/images-screen.js`, `AI_OPERATIONS.md` (Section 13). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0085.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.88) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file. After the deploy, open `/admin/` and look at **Picture settings** once.

# UPDATE NOTE: v0.101.87 (2026-11-18)

## 00000000000000000000000000000000000000000000000000. What is new in v0.101.87
- New file `site/public/admin/js/images-screen.js` (Phase 3c Part 7r): a read only screen that shows the eleven settings of `config/images.json` in plain words, with a line for each that says where it works today (`imagesRows`, `imagesScreen`). Nothing calls it yet, so the dashboard and the live site do not change. New test: `site/tests/unit/images-screen.test.ts` (26 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0084.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.87) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.86 (2026-11-18)

## 0000000000000000000000000000000000000000000000000. What is new in v0.101.86
- Changed `site/public/admin/js/images-setting.js` (Phase 3c Part 7q): it can now read all eleven settings of `config/images.json` in one careful step (`readImagesSettings`; a bad or missing value gets its shipped value). Nothing calls it yet, so the dashboard and the live site do not change. New test: `site/tests/unit/images-settings-all.test.ts` (13 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0083.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.86) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.85 (2026-11-18)

## 000000000000000000000000000000000000000000000000. What is new in v0.101.85
- Changed `site/config/images.json` (now also `"enabled": true`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7p): the new setting `enabled` (`true` or `false`, shipped `true`) and its check. Nothing reads the value yet, so nothing changes for pictures today; a wrong value fails `npm run check:content`. New test: `site/tests/unit/image-enabled-config.test.ts` (5 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0082.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.85) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.84 (2026-11-18)

## 00000000000000000000000000000000000000000000000. What is new in v0.101.84
- Changed `site/config/images.json` (now also `"nameOrder": ["alt", "caption", "heading", "keyword", "oldName", "handle"]`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7o): the new setting `nameOrder` (the order of the six ways to make a picture file name, as in PLAN 34.4) and its check. Nothing reads the list yet, so nothing changes for pictures today; a bad value fails `npm run check:content`. New test: `site/tests/unit/image-name-order-config.test.ts` (8 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0081.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.84) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.83 (2026-11-18)

## 0000000000000000000000000000000000000000000000. What is new in v0.101.83
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo", "askFirst": false, "askHosts": [] }`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7n): the new setting `askHosts` (a list of website names, shipped empty) and its check. Nothing reads the list yet, so nothing changes for pictures today; a bad value fails `npm run check:content`. New test: `site/tests/unit/image-ask-hosts-config.test.ts` (6 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0080.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.83) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.82 (2026-11-18)

## 000000000000000000000000000000000000000000000. What is new in v0.101.82
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo", "askFirst": false }`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7m): the new setting `askFirst` (`true` or `false`, shipped `false` = automatic) and its check. Nothing reads the value yet, so changing it has no effect on pictures today; a wrong value fails `npm run check:content`. New test: `site/tests/unit/image-ask-first-config.test.ts` (5 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0079.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.82) are updated.
- To put it on the site: same steps as in the newest entry at the top of this file.

# UPDATE NOTE: v0.101.81 (2026-11-18)

## 00000000000000000000000000000000000000000000. What is new in v0.101.81
- Content fix, no code: `site/config/publisher.json` (`country` is now `India`), `site/content/pages/about-us.md` and `site/content/pages/ownership-and-funding.md` ("based in India"). The Terms page is NOT changed: its "laws of US" sentence waits for the owner's decision.
- Card `tasks/open/T-0078.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `site/package.json`, `site/package-lock.json` (version 0.101.81) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository. NOTE: this time the ZIP also changes files under `site/content/pages/` and `site/config/publisher.json`; copy those three on purpose (still do not copy over your posts in `site/content/blogs/`). Then `git add -A && git commit -m "v0.101.81: publisher country India" && git push`.

# UPDATE NOTE: v0.101.80 (2026-11-18)

## 0000000000000000000000000000000000000000000. What is new in v0.101.80
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo" }`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7l): the new setting `storage` (the text `"repo"` or `"r2"`, shipped `"repo"`) and its check. Nothing reads the value yet, so changing it has no effect on pictures today (`"r2"` does not switch R2 on); a wrong value fails `npm run check:content`. New test: `site/tests/unit/image-storage-config.test.ts` (5 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0077.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.80) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.80: storage setting (repo)" && git push`.

# UPDATE NOTE: v0.101.79 (2026-11-18)

## 00000000000000000000000000000000000000000. What is new in v0.101.79
- Changed `site/public/admin/js/hosting-hook.js` and `site/public/admin/js/hosting-save.js` (Phase 3c Part 7k): the Save of the editor reads `quality` from `site/config/images.json` (only when picture hosting is on) and passes it to the picture steps. The number now changes NEW hosted pictures; hosting is still off in the shipped `admin/config.json`, so the live site does not change. New test: `site/tests/unit/hosting-quality-save.test.ts` (13 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0076.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.79) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.79: the Save reads the quality setting" && git push`.

# UPDATE NOTE: v0.101.78 (2026-11-18)

## 0000000000000000000000000000000000000000. What is new in v0.101.78
- New file `site/public/admin/js/images-setting.js` and changed `site/public/admin/js/hosting-setup.js` (Phase 3c Part 7j): the dashboard code that reads `quality` from `site/config/images.json`, and `hostingSetup` passes the number to the picture steps. The Save does not call the reader yet, so nothing changes on the site or in the dashboard today. New test: `site/tests/unit/images-setting.test.ts` (13 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0075.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.78) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.78: reader of the quality setting" && git push`.

# UPDATE NOTE: v0.101.77 (2026-11-18)

## 00000000000000000000000000000000000000. What is new in v0.101.77
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85 }`) and `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7i): the new setting `quality` (a whole percent from 1 to 100, shipped 85) and its check. Nothing reads the value yet, so changing it has no effect on pictures today; a wrong value fails `npm run check:content`. New test: `site/tests/unit/image-quality-config.test.ts` (5 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0074.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.77) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.77: quality setting (85)" && git push`.

# UPDATE NOTE: v0.101.76 (2026-11-18)

## 0000000000000000000000000000000000000. What is new in v0.101.76
- Changed `site/public/admin/js/image.js` and `site/public/admin/js/hosting-optimize.js` (Phase 3c Part 7h): the picture quality (in percent, 1 to 100) can now be given to the browser steps; the old fixed 85 is the default, so nothing changes in the dashboard or on the live site. New test: `site/tests/unit/image-quality.test.ts` (10 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0073.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.76) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.76: quality for the picture steps" && git push`.

# UPDATE NOTE: v0.101.75 (2026-11-18)

## 000000000000000000000000000000000000. What is new in v0.101.75
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0 }`), `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs` (Phase 3c Part 7g): a picture width warning. With a number above 0 in `maxWidth`, a published post whose top picture, share picture or a picture of our own site inside the text is wider than that many pixels gets a warning in `npm run check:content`; with 0 (as shipped) nothing changes. It is never an error. New test: `site/tests/unit/max-width.test.ts` (8 cases); changed test: `site/tests/unit/validate-content.test.ts` (the shipped config). No Worker changed. No secret is needed.
- Card `tasks/open/T-0072.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.75) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.75: width warning (off)" && git push`.

# UPDATE NOTE: v0.101.74 (2026-11-18)

## 00000000000000000000000000000000000. What is new in v0.101.74
- New file `site/scripts/image-size-lib.mjs` (Phase 3c Part 7f): `imageSize(bytes)` reads the pixel width and height of a PNG, JPEG, GIF or WebP. Nothing calls it yet, so nothing changes on the site or in any check. New test: `site/tests/unit/image-size.test.ts` (11 cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0071.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.74) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.74: picture size reader" && git push`.

# UPDATE NOTE: v0.101.73 (2026-11-18)

## 0000000000000000000000000000000000. What is new in v0.101.73
- Changed `site/scripts/validate-content-lib.mjs` (Phase 3c Part 7e): the picture size warning of v0.101.71 now also measures the pictures of our own site inside the text of a published post (Markdown and img tags; code skipped). It is a warning only and works only when `sizeWarnKb` in `site/config/images.json` is above 0; with 0 (as shipped) nothing changes. Changed test: `site/tests/unit/validate-content.test.ts` (6 new cases). No setting added, no Worker changed. No secret is needed.
- Card `tasks/open/T-0070.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.73) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.73: size warning for text pictures" && git push`.

# UPDATE NOTE: v0.101.72 (2026-11-18)

## 000000000000000000000000000000000. What is new in v0.101.72
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0 }`), `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs` (Phase 3c Part 7d): an allow list of websites. A picture from a name in `allowHosts` counts as our own, so it gets no outside-picture warning or error; with the list empty (as shipped) nothing changes. Changed test: `site/tests/unit/validate-content.test.ts` (7 new cases). No Worker changed. No secret is needed.
- Card `tasks/open/T-0069.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.72) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.72: allow list (empty)" && git push`.

# UPDATE NOTE: v0.101.71 (2026-11-18)

## 00000000000000000000000000000000. What is new in v0.101.71
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [], "sizeWarnKb": 0 }`), `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs` (Phase 3c Part 7c): a picture size warning. With a number above 0 in `sizeWarnKb`, a published post whose front matter `image` or `ogImage` file is bigger than that many KB gets a warning in `npm run check:content`; with 0 (as shipped) nothing changes. It is never an error. Changed test: `site/tests/unit/validate-content.test.ts` (6 new cases). No Worker changed. No secret is needed.
- Card `tasks/open/T-0068.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.71) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.71: size warning (off)" && git push`.

# UPDATE NOTE: v0.101.70 (2026-11-18)

## 0000000000000000000000000000000. What is new in v0.101.70
- Changed `site/config/images.json` (now `{ "hardBlock": false, "blockHosts": [] }`), `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs` (Phase 3c Part 7b): a block list of websites. With a name in `blockHosts`, a published or scheduled post whose text shows a picture from that website (or a sub-site of it) fails `npm run check:content`; with the list empty (as shipped) nothing changes. Changed test: `site/tests/unit/validate-content.test.ts` (7 new cases). No Worker changed. No secret is needed.
- Card `tasks/open/T-0067.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.70) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.70: block list (empty)" && git push`.

# UPDATE NOTE: v0.101.69 (2026-11-18)

## 000000000000000000000000000000. What is new in v0.101.69
- New file `site/config/images.json` (`"hardBlock": false`) and changed `site/scripts/validate-content-lib.mjs` and `site/scripts/validate-content.mjs` (Phase 3c Part 7a): a switch for the stricter rule. With `"hardBlock": true`, a published or scheduled post that still shows a picture from another website in its text fails `npm run check:content`; with `false` (as shipped) it is only a warning, as in v0.101.68. Changed test: `site/tests/unit/validate-content.test.ts` (5 new cases). No Worker changed. No secret is needed. Nothing changes until you set it to `true`.
- Card `tasks/open/T-0066.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.69) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.69: hard block setting (off)" && git push`.

# UPDATE NOTE: v0.101.68 (2026-11-18)

## 00000000000000000000000000000. What is new in v0.101.68
- Changed `site/scripts/validate-content-lib.mjs` and `site/scripts/validate-content.mjs` (Phase 3c Part 6a): `npm run check:content` (also inside `npm run preflight` and the validate workflow) now prints a warning for a published or scheduled post whose text still shows a picture from another website. It is a warning only; nothing fails and nothing is changed. Changed test: `site/tests/unit/validate-content.test.ts` (7 new cases). No Worker changed. No secret is needed. The live site is not affected.
- Card `tasks/open/T-0065.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.68) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.68: outside picture warning" && git push`.

# UPDATE NOTE: v0.101.67 (2026-11-18)

## 0000000000000000000000000000. What is new in v0.101.67
- Changed `site/src/lib/picture-set.ts`, `site/src/lib/picture.ts` and the article page (Phase 3c Part 4c-6): the pictures inside the article text get `srcset` and `sizes` when they have smaller copies, as the picture at the top already does. Changed test: `site/tests/unit/picture-set.test.ts` (7 new cases). No Worker changed. No secret is needed. Nothing changes on the live site until copies are switched on and a new picture is hosted.
- Card `tasks/open/T-0064.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.67) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.67: srcset in the text" && git push`.

# UPDATE NOTE: v0.101.66 (2026-11-18)

## 000000000000000000000000000. What is new in v0.101.66
- New file `site/src/lib/picture-set.ts` and changed `site/src/lib/picture.ts`, `site/src/components/PostCard.astro`, `site/src/pages/index.astro` and the article page (Phase 3c Part 4c-5): a picture that has smaller copies is written with `srcset` and `sizes`, so phones load a smaller file. A picture with no copy is written exactly as before. New test `site/tests/unit/picture-set.test.ts`. No Worker changed. No secret is needed. Nothing changes on the live site until copies are switched on and a new picture is hosted.
- Card `tasks/open/T-0063.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.66) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.66: srcset and sizes" && git push`.

# UPDATE NOTE: v0.101.65 (2026-11-18)

## 00000000000000000000000000. What is new in v0.101.65
- Changed `site/public/admin/js/hosting-setup.js` and `site/public/admin/config.json` (Phase 3c Part 4c-4e): a switch for the smaller picture copies. The new key `"imageCopies": false` is in `site/public/admin/config.json`. Copies are OFF; nothing changes on the live site or in the dashboard until you set it to `true` (and only after `imagesUrl` is set). Changed tests: `hosting-setup.test.ts`, `hosting-copies.test.ts`, `hosting-variants.test.ts`, `admin-files-copies.test.ts`. No Worker changed. No secret is needed.
- Card `tasks/open/T-0062.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.65) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.65: copies switch (off)" && git push`.
- To switch copies on later (your steps, not done here): deploy the images Worker and set `imagesUrl` (see v0.101.55), then change `"imageCopies": false` to `"imageCopies": true` in `site/public/admin/config.json`.

# UPDATE NOTE: v0.101.64 (2026-11-18)

## 0000000000000000000000000. What is new in v0.101.64
- New file `site/public/admin/js/file-replace.js` and changed `site/public/admin/js/app.js` and `site/public/admin/js/files-screen.js` (Phase 3c Part 4c-4d): replacing a picture in the Files screen also removes its old smaller copies and the `variants` note, in ONE commit. New tests `site/tests/unit/file-replace.test.ts` and `site/tests/unit/admin-file-replace-copies.test.ts`; changed tests: `admin-files-copies.test.ts`, `admin-file-replace.test.ts` (one source guard), `hosting-srcset.test.ts` (its import guard). No Worker changed. No secret is needed. No copy exists today, so the dashboard works as before.
- Card `tasks/open/T-0061.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.64) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.64: replace with copies" && git push`.

# UPDATE NOTE: v0.101.63 (2026-11-18)

## 000000000000000000000000. What is new in v0.101.63
- Changed `site/public/admin/js/file-rename.js`, `site/public/admin/js/app.js` and `site/public/admin/js/files-screen.js` (Phase 3c Part 4c-4c): renaming a picture in the Files screen also renames its smaller copies, adds a 301 for each copy and moves the notes, in ONE commit. Changed tests: `file-rename.test.ts`, `admin-files-copies.test.ts`, `admin-file-rename.test.ts`, `hosting-srcset.test.ts` (its import guard). No Worker changed. No secret is needed. No copy exists today, so the dashboard works as before.
- Card `tasks/open/T-0060.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.63) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.63: rename with copies" && git push`.

# UPDATE NOTE: v0.101.62 (2026-11-18)

## 00000000000000000000000. What is new in v0.101.62
- New file `site/public/admin/js/file-delete.js` and changed `site/public/admin/js/app.js` and `site/public/admin/js/files-screen.js` (Phase 3c Part 4c-4b): deleting a picture in the Files screen also deletes its smaller copies and their notes, in ONE commit. New file `site/tests/unit/file-delete.test.ts`; changed tests: `admin-files-copies.test.ts`, `admin-file-delete.test.ts` (one source guard), `hosting-srcset.test.ts` (its import guard). No Worker changed. No secret is needed. No copy exists today, so the dashboard works as before.
- Card `tasks/open/T-0059.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.62) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.62: delete with copies" && git push`.

# UPDATE NOTE: v0.101.61 (2026-11-18)

## 0000000000000000000000. What is new in v0.101.61
- Changed `site/public/admin/js/files-screen.js` (Phase 3c Part 4c-4a): the Files screen hides the smaller picture copies and shows how many are hidden; a picture that has copies cannot be deleted, renamed or replaced from the screen yet (one plain sentence). New file `site/tests/unit/admin-files-copies.test.ts`; one line changed in `site/tests/unit/hosting-srcset.test.ts` (its import guard). `app.js`, the Workers and the config did not change. No secret is needed. No copy exists today, so the dashboard looks as before.
- Card `tasks/open/T-0058.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.61) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.61: Files screen and copies" && git push`.

# UPDATE NOTE: v0.101.60 (2026-11-18)

## 000000000000000000000. What is new in v0.101.60
- New file `site/public/admin/js/hosting-copies.js` and changed `site/public/admin/js/hosting-commit.js` and `site/public/admin/js/hosting-pipeline.js` (Phase 3c Part 4c-3). The smaller picture copies are saved in the same ONE commit as the picture and the post, and the media row notes their widths (`variants`). It is off unless the optional dep `makeVariants` is given, and the dashboard does not give it yet, so the live site and the dashboard do not change. New file `site/tests/unit/hosting-copies.test.ts`; one line changed in each of `site/tests/unit/hosting-srcset.test.ts` and `site/tests/unit/hosting-variants.test.ts`. One sentence added to `NEWS_WEBSITE_PLAN.md` 34.6. No Worker changed. No secret is needed.
- Card `tasks/open/T-0057.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.60) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.60: copies in the one commit" && git push`.

# UPDATE NOTE: v0.101.59 (2026-11-18)

## 00000000000000000000. What is new in v0.101.59
- Changed `site/public/admin/js/hosting-optimize.js` (Phase 3c Part 4c-2): four new functions that make the smaller WebP copies of a hosted picture in the browser (480, 800, 1200, 1600 wide, only narrower than the picture). All or nothing. Nothing calls them yet, so the live site and the dashboard do not change. New file `site/tests/unit/hosting-variants.test.ts`; one line changed in `site/tests/unit/hosting-srcset.test.ts`. No Worker changed. No secret is needed.
- Card `tasks/open/T-0056.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.59) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.59: srcset copies in the browser" && git push`.

# UPDATE NOTE: v0.101.58 (2026-11-17)

## 0000000000000000000. What is new in v0.101.58
- New files `site/public/admin/js/hosting-srcset.js` and `site/tests/unit/hosting-srcset.test.ts` (Phase 3c Part 4c-1). They are the rules of the smaller picture copies for `srcset` (copy name `name.480w.webp`, which widths, planned size, the `srcset` text). Nothing calls them yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0055.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.58) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.58: srcset rules" && git push`.

# UPDATE NOTE: v0.101.57 (2026-11-17)

## 000000000000000000. What is new in v0.101.57
- Changed `site/public/admin/js/files-screen.js` and `site/public/admin/admin.css` (Phase 3c Part 4b): a picture with an automatic alt text is marked "alt text to review" on the Files screen (tile, count line, note in the editor); Save details clears the mark. New file `site/tests/unit/admin-files-review.test.ts`. `app.js`, the Workers and the config did not change. No secret is needed. No file has the mark today, so the dashboard looks as before until auto image hosting is switched on (`imagesUrl`).
- Card `tasks/open/T-0054.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.57) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.57: review marker" && git push`.

# UPDATE NOTE: v0.101.56 (2026-11-17)

## 00000000000000000. What is new in v0.101.56
- Changed `site/public/admin/admin.css` (Phase 3c Part 3c-8d): one new block at the end that gives the pictures list its style (box, rows, four tones, narrow screen), light and dark. New file `site/tests/unit/admin-hosting-style.test.ts`. Only CSS changed: no JavaScript, no Worker, no config. No secret is needed. The list shows only after the owner switches the feature on (`imagesUrl`).
- Card `tasks/open/T-0053.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.56) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.56: pictures list style" && git push`.

# UPDATE NOTE: v0.101.55 (2026-11-17)

## 0000000000000000. What is new in v0.101.55
- Changed `site/public/admin/js/app.js` (Phase 3c Part 3c-8c-2): `save()` of the post editor now calls the pictures hook. With `imagesUrl` empty in `site/public/admin/config.json` (today) it does nothing new, so the live dashboard works as before. New file `site/tests/unit/admin-app-hosting.test.ts`; one line changed in `site/tests/unit/hosting-hook.test.ts`. No Worker changed. No secret is needed.
- Card `tasks/open/T-0052.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.55) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.55: save hook wiring" && git push`.
- To switch the feature on later (your steps, not done here): `cd workers/images` then `npx wrangler deploy`; then add `"imagesUrl": "https://<your images worker>.workers.dev"` to `site/public/admin/config.json`.

# UPDATE NOTE: v0.101.54 (2026-11-17)

## 000000000000000. What is new in v0.101.54
- New files `site/public/admin/js/hosting-hook.js` and `site/tests/unit/hosting-hook.test.ts` (Phase 3c Part 3c-8c-1). It makes the decisions of the hook in Save as plain functions: Save goes on as before, the pictures flow already saved the post, or Save stops. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0051.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.54) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.54: save hook helper" && git push`.

# UPDATE NOTE: v0.101.53 (2026-11-17)

## 00000000000000. What is new in v0.101.53
- New files `site/public/admin/js/hosting-save.js` and `site/tests/unit/hosting-save.test.ts` (Phase 3c Part 3c-8b), and `site/tests/unit/hosting-setup.test.ts` has a stricter preview test. It is the adapter that tells Save whether to host pictures and builds the flow. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0050.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.53) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.53: hosting save adapter" && git push`.

# UPDATE NOTE: v0.101.52 (2026-11-17)

## 0000000000000. What is new in v0.101.52
- New files `site/public/admin/js/hosting-setup.js` and `site/tests/unit/hosting-setup.test.ts` (Phase 3c Part 3c-8a). It makes the `deps` of the flow from `admin/config.json` (optional key `imagesUrl`) and the signed-in GitHub client. Empty `imagesUrl` means off. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0049.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.52) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.52: hosting setup" && git push`.

# UPDATE NOTE: v0.101.51 (2026-11-17)

## 000000000000. What is new in v0.101.51
- New files `site/public/admin/js/hosting-flow.js` and `site/tests/unit/hosting-flow.test.ts` (Phase 3c Part 3c-7), and `site/public/admin/js/hosting-screen.js` has a new `say`. The flow joins the pipeline and the screen: the first Save, then Retry and Confirm. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0048.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.51) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.51: hosting flow" && git push`.

# UPDATE NOTE: v0.101.50 (2026-11-17)

## 00000000000. What is new in v0.101.50
- New files `site/public/admin/js/hosting-screen.js` and `site/tests/unit/hosting-screen.test.ts` (Phase 3c Part 3c-6). It is the screen that draws the result list: one row for each picture and the buttons Retry, Confirm and Show in post. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0047.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.50) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.50: result list screen" && git push`.

# UPDATE NOTE: v0.101.49 (2026-11-17)

## 00000000000. What is new in v0.101.49
- New files `site/public/admin/js/hosting-pipeline.js` and `site/tests/unit/hosting-pipeline.test.ts` (Phase 3c Part 3c-5). It is the one function that reads `config/media.json`, hosts the pictures of a post, builds the result list and makes ONE commit, or only previews. It has no screen and nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0046.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.49) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.49: pipeline" && git push`.

# UPDATE NOTE: v0.101.48 (2026-11-17)

## 0000000000. What is new in v0.101.48
- New files `site/public/admin/js/hosting-result.js` and `site/tests/unit/hosting-result.test.ts` (Phase 3c Part 3c-4). It is the data of the result list: one row for each picture with its sentence and its action (Retry, Confirm, Replace), the addresses for Retry and Confirm, a headline, and the two helpers `confirmFor` and `carryOver`. It writes nothing and nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0045.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.48) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.48: result list data" && git push`.

# UPDATE NOTE: v0.101.47 (2026-11-17)

## 000000000. What is new in v0.101.47
- New files `site/public/admin/js/hosting-client.js` and `site/tests/unit/hosting-client.test.ts` (Phase 3c Part 3c-3), and `site/public/admin/js/hosting-run.js` has four new reason words. It is the call to the images Worker with the GitHub token of the signed-in user. Nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0044.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.47) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.47: Worker call" && git push`.

## 00000000. What is new in v0.101.46
- New files `site/public/admin/js/hosting-commit.js` and `site/tests/unit/hosting-commit.test.ts` (Phase 3c Part 3c-2). It puts the new pictures, the post and `config/media.json` into ONE commit, all or nothing. It writes nothing by itself and nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0043.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.46) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.46: hosting commit" && git push`.

## 0000000. What is new in v0.101.45
- New files `site/public/admin/js/hosting-optimize.js` and `site/tests/unit/hosting-optimize.test.ts` (Phase 3c Part 3c-1). It lets the browser picture step serve the hosting run, and gives a GIF its true size. It writes nothing and nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0042.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.45) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.45: picture step" && git push`.

## 000000. What is new in v0.101.44
- New files `site/public/admin/js/hosting-run.js` and `site/tests/unit/hosting-run.test.ts` (Phase 3c Part 3b). It writes nothing and nothing calls it yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0041.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.44) are updated.
- To put it on the site: copy those files and the files of the older sections below from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.44: hosting run" && git push`.

## 00000. What is new in v0.101.43
- New files `site/public/admin/js/hosting-plan.js` and `site/tests/unit/hosting-plan.test.ts`; `site/public/admin/js/hotlink.js` now exports two helpers (Phase 3c Part 3a). Nothing calls them yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0040.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.43) are updated.
- To put it on the site: copy those files and the files of sections 0000, 000, 00 and 0 from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.43: hosting plan and rewrite" && git push`.

## 0000. What is new in v0.101.42
- New files `site/public/admin/js/hosted-meta.js` and `site/tests/unit/hosted-meta.test.ts`: the rules about the hosted picture (Phase 3c Part 4a). Nothing calls them yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0039.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.42) are updated.
- To put it on the site: copy those files and the files of sections 000, 00 and 0 from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.42: hosted picture rules" && git push`.

## 000. What is new in v0.101.41
- New files `workers/images/index.js` and `workers/images/wrangler.toml`, changed `workers/images/lib.js`, new tests `site/tests/unit/images-worker.test.ts`: the entry point of the future images Worker (Phase 3c Part 2b). It is NOT deployed and nothing calls it, so the live site does not change. No secret is needed now.
- Card `tasks/open/T-0038.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.41) are updated.
- To put it on the site: copy those files and the files of sections 00 and 0 from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.41: images worker entry point" && git push`.
- Optional, only when you want the Worker live: `cd workers/images` then `npx wrangler deploy`. Do it from inside the full repository. Nothing in the dashboard uses it yet.

## 00. What is new in v0.101.40
- New file `workers/images/lib.js` and its tests `site/tests/unit/images-lib.test.ts`: the fetch rules of the future images Worker (Phase 3c Part 2a). There is no `index.js` and no `wrangler.toml`, so there is nothing to deploy and nothing runs on the live site. No secret is needed.
- Card `tasks/open/T-0037.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json`, `site/package-lock.json` (version 0.101.40) are updated.
- To put it on the site: copy those files and the files of section 0 from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.40: images fetch rules" && git push`.

## 0. What is new in v0.101.39
- New file `site/public/admin/js/hotlink.js` and its tests `site/tests/unit/hotlink.test.ts`: the pure rules of auto image hosting (Phase 3c Part 1). Nothing calls them yet, so the live site and the dashboard do not change. No Worker changed. No secret is needed.
- Card `tasks/open/T-0036.md`; `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `site/package.json` and `site/package-lock.json` (version 0.101.39) are updated.
- To put it on the site: copy those files from the ZIP into your repository (do not copy over `site/content/`), then `git add -A && git commit -m "v0.101.39: hotlink rules" && git push`.
- Everything below is the v0.101.38 note. Its owner steps (build fix, trap Worker, push keys, `country`) still stand.

# v0.101.38 build fix (2026-11-17)

Site: https://shivam-das-news.pages.dev (free pages.dev address, no custom domain).
This ZIP is the full project. It was built from your GitHub repository (commit e84ede1, v0.101.37) plus the changes below. No news article was added. The Worker code did not change.

## 1. Why the Cloudflare Pages build failed
I built your real repository on a clean machine and it stopped on two errors. (The earlier ZIP built fine only because its `site/content/pages/` folder was empty, so it never built the twelve pages.)
1. `site/config/contact.json`: the endpoint ended at `.workers.dev`, but the build requires it to end with `/contact`. The Contact Us page could not be built.
2. `site/scripts/validate-html.mjs`: the rule "no ad code outside an article" searched for the plain word `adsterra`. Your Ownership and Funding page says "supported by advertising revenue through Adsterra", so the rule fired on a sentence.

## 2. What is now complete
- Both errors are fixed. On the real repository, `npm run build` now ends with `Validation passed.` and all 2,588 tests pass (2 new).
- A new test reads the real `contact.json`, so this exact mistake is caught by `npm test` before a push.
- The ad-code rule still blocks real ad code (a script from an Adsterra host, an ad slot, the ad loader). It no longer blocks the word in text.
- Trap Worker settings in the repository were already right: `TRAP_ENABLED = "true"`, `CF_ACCOUNT_ID` and `CF_LIST_ID` are 32-character ids. I only corrected an old comment that said the ids were empty.
- `CHANGELOG.md` (0.101.38), `INCOMPLETE.md` and card `tasks/open/T-0035.md` are updated.

## 3. What I could NOT do from here (no Cloudflare access)
- I did not deploy the trap Worker. Section 4 has the commands.
- I did not see the Cloudflare build log. The cause above was reproduced by building the repository myself. If the build still fails, paste the first red line of the log.
- VAPID keys: I did not make a new pair on purpose. `site/config/push.json` and `workers/push/wrangler.toml` already hold the same public key. A new pair would break existing subscribers and no longer match the private key already stored on `news-push`. I also cannot see that private key. Use the check in section 5.
- `country` in `site/config/publisher.json` is still "US" (card T-0003). That is why the Ownership and Funding page says "based in US" and the Terms page says "follow the laws of US" while the address is West Bengal, India. I did not guess your legal country. Tell me the correct value and I will change it.

## 4. What you click or run
### A. Put the fix on the site
1. Copy these files from the ZIP into your repository (do not copy over `site/content/pages/`): `site/config/contact.json`, `site/scripts/validate-html.mjs`, `site/tests/unit/live-config.test.ts`, `workers/trap/wrangler.toml`, `site/package.json`, `site/package-lock.json`, `tasks/open/T-0035.md`, `CHANGELOG.md`, `INCOMPLETE.md`, `UPDATE_NOTE.md`.
2. Commit to `main`:
   `git add -A && git commit -m "v0.101.38: fix build (contact endpoint, ad-code check)" && git push`
3. Cloudflare dashboard, Workers & Pages, shivam-das-news, Deployments: the newest deployment should turn green. Then open https://shivam-das-news.pages.dev/sitemap/ and the footer: the twelve pages should be listed.

### B. Deploy the trap Worker
1. Before you deploy: if you typed an `OWN_IPS` value in the dashboard, copy it into `OWN_IPS = ""` in `workers/trap/wrangler.toml` first. A deploy overwrites every `[vars]` value with the file.
2. Run on your computer:
   `cd workers/trap`
   `npx wrangler deploy`
3. Check that the secret is still there (it is not changed by a deploy):
   `npx wrangler secret list`
   You must see `CF_API_TOKEN`. If it is missing:
   `npx wrangler secret put CF_API_TOKEN`
4. In the dashboard, Workers & Pages, news-trap, Settings, Variables: `TRAP_ENABLED` is `true`, `CF_ACCOUNT_ID` and `CF_LIST_ID` show your ids.
5. Honest limit: on `pages.dev` the trap blocks nobody. A route and a WAF rule need a custom domain on your Cloudflare account. The hourly clean-up job will run; nothing else happens.

## 5. Optional: push keys (only if you are not sure the private key matches)
1. Check the secrets: `cd workers/push` then `npx wrangler secret list`. You need `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `STAMP_SECRET`, `ANNOUNCE_SECRET`.
2. If all four are there and you set the private key yourself with the key pair that made the public key, do nothing more. Deploy: `npx wrangler deploy`, then open `/notifications/` on the live site and press "Send me a test notification".
3. Only if you lost the private key: `cd site` then `npm run vapid` on your own computer. Copy the new public key into BOTH `workers/push/wrangler.toml` and `site/config/push.json`, then:
   `cd workers/push`
   `npx wrangler secret put VAPID_PRIVATE_KEY`
   `npx wrangler secret put VAPID_SUBJECT` (a `mailto:` or `https:` address)
   `npx wrangler deploy`
   Everyone who subscribed before will have to subscribe again. Never paste the private key into a chat or a file.

## 6. Still open (unchanged)
- No published story yet: the one welcome post is a draft. Nothing was added.
- Decide `country` (T-0003).
- Custom domain, if you want the trap, AdSense or Google News to work fully.
- The red cards that are in `review` can be closed only by you.

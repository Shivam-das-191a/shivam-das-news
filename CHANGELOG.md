# CHANGELOG.md

Newest first. Rules are in `VERSIONING.md`.

## 0.101.180 (2026-11-21): A paragraph written twice in a row is shown by the build (POLISH, Phase 3c Part 8cb)

**What changed**
- New `site/scripts/repeat-check-lib.mjs` with one plain function, `checkRepeatedParagraphs(html)`. It reads every `<p>` of a built page, in any language, and compares the text of each paragraph with the text of the paragraph right before it (the next `<p>` in the page). The text is read with its tags removed (an inline tag leaves no gap, a `<br>` is a space), a blank written as `&nbsp;` is a plain space, runs of spaces are one space and capital letters are small letters, so two copies that differ only in spacing or capitals count as the same. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\\u` escape, so the file stays plain ASCII.
- Errors: none. A repeated paragraph is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places hold a paragraph of 8 or more words that is the same as the paragraph right before it, and shows the first five words of the first one. Three copies in a row are two places.
- Left out on purpose, so there is no false alarm: a paragraph of 7 words or fewer; two equal paragraphs with any other `<p>` between them; the same text in a list item, a heading or a table cell; the same paragraph far apart on a page; an empty paragraph; code and preformatted text.
- Why it is a new check: `doubled-check-lib.mjs` (Part 8bp) finds one word written twice (`the the`); nothing found a whole paragraph written twice, which a story pasted two times or an import that ran two times leaves behind. An earlier try of this session, a check for a space before `?`, `!`, `:` and `;`, was dropped before delivery because `punct-check-lib.mjs` (Part 8br) already reports it.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/repeat-check.test.ts` (70 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a paragraph today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 268 files and 7763 tests passed (before: 267 and 7693); the run was split in 6 parts because the machine has one processor and one run takes longer than the 5 minute limit of the tool. `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): the same paragraph of 12 words written twice in a row, a 3 word line written twice and the same paragraph with another paragraph between added to the home page gave one warning that named the page and counted 1 place, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/repeat-check-lib.mjs`, `site/tests/unit/repeat-check.test.ts`, `tasks/open/T-0178.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.180), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.179 (2026-11-21): A long run of words in capital letters is shown by the build (POLISH, Phase 3c Part 8ca)

**What changed**
- New `site/scripts/allcaps-check-lib.mjs` with one plain function, `checkAllCapsRuns(html)`. It reads the body text of every built page. The title and the h1 to h3 blocks are not read here, because `shout-check-lib.mjs` (Part 8bo) reads them. Tags are removed (an inline tag leaves no gap); a block tag and a `br` end a run; a character reference ends a run; a non breaking space is a plain gap. Marks round a word (full stop, comma, quote, bracket, dash) are not part of the word. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A run of capitals is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places hold 10 or more words in a row written in capital letters (A to Z), at least 8 of them with 2 or more letters (the words `A` and `I` may sit inside the run), and shows the first four words of the first one.
- Left out on purpose, so there is no false alarm: a run of 9 words or fewer (`UNITED STATES OF AMERICA`, a short list of short forms); a run that is mostly one letter words; a word with a digit, a small letter, an apostrophe, a hyphen or a dot inside (`U.S.`, `COVID-19`, `DON'T`), which ends the run; code and preformatted text; text in another script.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/allcaps-check.test.ts` (66 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a run today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 267 files and 7693 tests passed (before: 266 and 7627); the run was split in 3 parts because one run takes longer than the 5 minute limit of the tool. `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a paragraph with 11 words in capitals, `NASA` and `UNITED STATES OF AMERICA` added to the home page gave one warning that named the page and counted 1 place, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/allcaps-check-lib.mjs`, `site/tests/unit/allcaps-check.test.ts`, `tasks/open/T-0177.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.179), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.178 (2026-11-21): A word typed with Caps Lock on is shown by the build (POLISH, Phase 3c Part 8bz)

**What changed**
- New `site/scripts/capslock-check-lib.mjs` with one plain function, `checkCapsLockSlips(html)`. It reads the title and the body text of every built page, in any language (only the letters A to Z are read, so text in another script is never flagged). Tags are removed (an inline tag leaves no gap, so `h<b>ELLO</b>` is read as `hELLO`); a block tag and a `br` end the run; a character reference ends the run. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A typing slip is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places hold a word of 5 or more letters (A to Z) whose first letter is small and whose other letters are all capital (`hELLO`, `cAPSLOCK`), and shows the first word.
- Left out on purpose, so there is no false alarm: words of 4 letters or fewer (`mRNA`, `iOS`); a word with a small letter after the capitals (`iPhone`, `eBay`, `macOS`); a word joined to a letter, a digit, an underscore, a dot, a slash, an at sign, a hash sign, a colon or a hyphen before it (an address, a handle, a hashtag, a file name); a word followed by a letter, a digit or an underscore; code and preformatted text.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/capslock-check.test.ts` (70 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a word today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 266 files and 7627 tests passed (before: 265 and 7557); the run was split in 3 parts because one run takes longer than the 5 minute limit of the tool. `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>The wORLD news is here. The mRNA and iOS are fine. cAPSLOCK was on.</p>` added to the home page gave one warning that named the page and counted 2 places, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/capslock-check-lib.mjs`, `site/tests/unit/capslock-check.test.ts`, `tasks/open/T-0176.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.178), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md` (kept short, because the document budget of 25,000 words is full; run `npm run docs:archive` after decision 43). Removed: nothing.

## 0.101.177 (2026-11-21): A pile of exclamation or question marks is shown by the build (POLISH, Phase 3c Part 8by)

**What changed**
- New `site/scripts/exclaim-check-lib.mjs` with one plain function, `checkExclaimRuns(html)`. It reads the body text of every built page, in any language. The title and the h1 to h3 blocks are not read here, because `shout-check-lib.mjs` (Part 8bo) reads them. Tags are removed (an inline tag leaves no gap, so `Wow!<b>!</b>` is read as `Wow!!`); a block tag and a `br` end the run; a character reference ends the run. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A pile of marks is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places hold a run of 2 or more of the marks `!` and `?` and shows the first run (`!!`, `??`, `!!!`, `?!?`, `?!?!` and longer runs).
- Left out on purpose, so there is no false alarm: the single pair `?!` or `!?`; one mark alone; a mark, a space and another mark; a word that holds a web address (`://` or `www.`); code and preformatted text; full width marks of other scripts.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/exclaim-check.test.ts` (67 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a pile today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 265 files and 7557 tests passed (before: 264 and 7490). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>Wow!! That was fast. Is it true?! Yes. Really???</p>` added to the home page gave one warning that named the page and counted 2 places, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/exclaim-check-lib.mjs`, `site/tests/unit/exclaim-check.test.ts`, `tasks/open/T-0175.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.177), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md` (kept short, because the document budget of 25,000 words is full; run `npm run docs:archive` after decision 43). Removed: nothing.

## 0.101.176 (2026-11-21): A missing space after a colon is shown by the build (POLISH, Phase 3c Part 8bx)

**What changed**
- New `site/scripts/colon-check-lib.mjs` with one plain function, `checkColonSpacing(html)`. It reads the title and the body text of every built page, in any language (only the letters A to Z are read, so text in another script is never flagged). Tags are removed (an inline tag leaves no gap, so `Note:<b>Read</b>` is read as `Note:Read`); a block tag and a `br` end the run; a character reference ends the run; a blank written as `&nbsp;` is not a plain space. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A missing space is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places have no space after a colon that ends a word of 2 or more letters (A to Z) and is followed at once by a word that starts with a capital letter and has 2 or more small letters after it (`Note:Read`, `He said:Then`).
- Left out on purpose, so there is no false alarm: the scheme of an address (http, https, ftp, file, mailto, tel, sms, data, javascript, urn, geo, git, ssh, sftp, ws, wss, irc, news, magnet; the case does not matter); a word that follows a dot, a slash, an at sign or an underscore; a time or a ratio (the colon follows a digit); a smiley (`:D`); a single letter before the colon; a word after the colon with only one small letter (`Node:Js`, `Note:Do`); a colon followed by a space, a quote, a bracket, another mark or a character reference; code and preformatted text.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/colon-check.test.ts` (64 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a gap today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 264 files and 7490 tests passed (before: 263 and 7426). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>Note:Read the rest. He said:Then she left. See https:Example and at 5:30.</p>` added to the home page gave one warning that named the page and counted 2 places, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/colon-check-lib.mjs`, `site/tests/unit/colon-check.test.ts`, `tasks/open/T-0174.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.176), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md` (kept short, because the document budget of 25,000 words is almost full; run `npm run docs:archive` after decision 43). Removed: nothing.

## 0.101.175 (2026-11-21): Two hyphens where a dash belongs are shown by the build (POLISH, Phase 3c Part 8bw)

**What changed**
- New `site/scripts/dash-check-lib.mjs` with one plain function, `checkDoubleHyphen(html)`. It reads the title and the body text of every built page, in any language. Tags are removed (an inline tag leaves no gap, so `left<b>--</b>then` is read as `left--then`); a block tag and a `br` end the run; a character reference ends the run; a blank written as `&nbsp;` is not a plain space. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A double hyphen is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places have exactly two hyphens with a letter or a digit on both sides (`left--then`, `2020--2021`) or with a space on both sides between two words (`left -- then`).
- Left out on purpose, so there is no false alarm: three or more hyphens (a drawn line); a command option written in a sentence (`run --help`, `--main-color`); a pair at the start or the end of a paragraph; a single hyphen, an en dash, an em dash and a minus sign; a pair written as character references; code and preformatted text.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/dash-check.test.ts` (60 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a pair today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 263 files and 7426 tests passed (before: 262 and 7366). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>He left--then she came -- and went. Run --help and wait---here.</p>` added to the home page gave one warning that named the page and counted 2 places, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/dash-check-lib.mjs`, `site/tests/unit/dash-check.test.ts`, `tasks/open/T-0173.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.175), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.174 (2026-11-21): A missing space after the end of a sentence is shown by the build (POLISH, Phase 3c Part 8bv)

**What changed**
- New `site/scripts/sentence-space-check-lib.mjs` with one plain function, `checkSentenceSpacing(html)`. It reads the title and the body text of every built page, in any language (only the letters A to Z are read, so text in another script is never flagged). Tags are removed (an inline tag leaves no gap, so `left.<b>Then</b>` is read as `left.Then`); a block tag and a `br` end the run; a character reference ends the run; a blank written as `&nbsp;` is not a plain space. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII.
- Errors: none. A missing space is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warning, printed only: one message per page that says how many places have no space after a full stop, question mark or exclamation mark that ends a word of 2 or more letters (A to Z) and is followed at once by a word that starts with a capital letter and has 2 or more small letters after it (`left.Then`, `Why?Because`, `Wow!Great`).
- Left out on purpose, so there is no false alarm: a full stop after the short form of a title or a name (Mr, Mrs, Ms, Dr, St, Jr, Sr, Prof, Mt, Ft, Gen, Sen, Rep, Gov, Rev, Hon, Lt, Col, Sgt, Capt, Inc, Ltd, Co, Corp, Dept, vs, no, est, approx, fig, vol, al; the case does not matter); an address that starts with `www` and an e-mail address (the word before the mark follows a dot, a slash, an at sign or an underscore); an ellipsis and any mark that follows another mark; a single letter (`U.S.Army`); a number; a mark followed by a space, a quote, a bracket or a character reference; a word after the mark with only one small letter (`Node.Js`); code and preformatted text.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/sentence-space-check.test.ts` (72 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a gap today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 262 files and 7366 tests passed (before: 261 and 7294). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>He left.Then she came. Why?Because it rained! Mr.Smith and www.Site.com are fine.</p>` added to the home page gave one warning that named the page and counted 2 places, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/sentence-space-check-lib.mjs`, `site/tests/unit/sentence-space-check.test.ts`, `tasks/open/T-0172.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.174), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.173 (2026-11-21): Gaps around curly double quotes in the text are shown by the build (POLISH, Phase 3c Part 8bu)

**What changed**
- New `site/scripts/quote-space-check-lib.mjs` with one plain function, `checkQuoteSpacing(html)`. It reads the title and the body text of a page whose `lang` is English (`en`, `en-US` and the like) or not given; a page in another language is not read, because other languages write their quote marks another way. Tags are removed (an inline tag leaves no gap); a block tag ends the run and a `br` does not; a blank written as `&nbsp;` is not a plain space. The references `&ldquo;`, `&rdquo;` and their number forms are read as the mark they stand for. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every curly mark in the file is a `\u` escape, so the file stays plain ASCII. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. A gap is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a space just inside a curly double quote (after the opening mark before a letter or a digit, or before the closing mark after a letter, a digit or a mark); no space before an opening curly double quote that follows a letter; no space after a closing curly double quote that is followed by a word of 2 or more letters (A to Z).
- Left out on purpose, so there is no false alarm: the straight quote (it opens and closes, so a gap cannot be judged); the single quote and the apostrophe; a German style quote (a low opening mark and a curly closing mark); a gap written as `&nbsp;`; a quote at the start or end of a paragraph; a quote next to a bracket, a dash or a mark; code and preformatted text; attributes and the meta description; a page in another language.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/quote-space-check.test.ts` (57 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a gap today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 261 files and 7294 tests passed (before: 260 and 7237). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a paragraph with a quote with spaces inside, a quote glued to the word before and a quote glued to the word after, added to the home page, gave three warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/quote-space-check-lib.mjs`, `site/tests/unit/quote-space-check.test.ts`, `tasks/open/T-0171.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.173), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.172 (2026-11-21): Gaps around brackets in the text are shown by the build (POLISH, Phase 3c Part 8bt)

**What changed**
- New `site/scripts/bracket-space-check-lib.mjs` with one plain function, `checkBracketSpacing(html)`. It reads the title and the body text of a built page. Tags are removed (an inline tag leaves no gap, so `(<b>word</b>)` is read as `(word)`); a block tag ends the run and a `br` does not; a blank written as `&nbsp;` is not a plain space. The references `&lpar;`, `&rpar;`, `&lsqb;`, `&rsqb;` and their number forms are read as the bracket they stand for. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every special character in the file is a `\u` escape, so the file stays plain ASCII. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. A gap is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a space just inside a bracket (`( word`, `word )`, `[ word`, `word ]`, next to a letter or a digit); no space before an opening round bracket that follows a word of 3 or more letters and starts a word of 3 or more letters (`said(see below)`); no space after a closing round bracket that holds 3 or more characters and is followed by a word of 2 or more letters (`(see below)then`).
- Left out on purpose, so there is no false alarm: a smiley (`:(`, `:)`, `(:`); a plural written `word(s)` and a bracket that holds 1 or 2 characters (`(es)`, `(ed)itor`); a function or a number next to a bracket (`f(x)`, `Title(2020)`); an omission mark inside a bracket (`( ... )`); a gap written as `&nbsp;` (French style); an address or a file name (`Rome_(city)`); code and preformatted text; attributes and the meta description.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/bracket-space-check.test.ts` (57 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has such a gap today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 260 files and 7237 tests passed (before: 259 and 7180). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>The vote ( see below ) ended, he said(see below) and (see below)then left.</p>` added to the home page gave three warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/bracket-space-check-lib.mjs`, `site/tests/unit/bracket-space-check.test.ts`, `tasks/open/T-0170.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.172), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.171 (2026-11-21): Open brackets and quotes in the text are shown by the build (POLISH, Phase 3c Part 8bs)

**What changed**
- New `site/scripts/bracket-check-lib.mjs` with one plain function, `checkBrackets(html)`. It reads the title and the body text of a built page. Tags are removed (an inline tag leaves no gap); a block tag (`p`, `li`, `div`, `h1` to `h6`, `td`, `th` and the like) ends a paragraph and a `br` does not. The references `&quot;`, `&ldquo;`, `&rdquo;`, `&lpar;`, `&rpar;`, `&lsqb;`, `&rsqb;` and their number forms are read as the mark they stand for. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Every curly mark in the file is a `\u` escape, so the file stays plain ASCII. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. An open bracket is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a round or square bracket that is opened and never closed or closed and never opened (counted per paragraph); a curly double quote that is closed with none open or opened and never closed; a straight double quote left open at the end of the page (an odd number of them).
- Left out on purpose, so there is no false alarm: a smiley (`:)`, `;(`, `(:`); a list marker with a closing bracket only when nothing is open (`1) one 2) two`, `a)`, `iv)`); a quotation that runs over several paragraphs (a paragraph that starts with a quote mark while the last quote is still open continues it); a straight quote after a digit (`5'10"`, `12" pizza`); a German style quote (a low opening mark and a curly closing mark); the single quote and the apostrophe; code and preformatted text; attributes and the meta description.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/bracket-check.test.ts` (65 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has an open bracket or quote today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 259 files and 7180 tests passed (before: 258 and 7115). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>The vote (see below ended late and he said "no and \u201cmaybe left.</p>` added to the home page gave three warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/bracket-check-lib.mjs`, `site/tests/unit/bracket-check.test.ts`, `tasks/open/T-0169.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.171), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.170 (2026-11-21): Slips in punctuation are shown by the build (POLISH, Phase 3c Part 8br)

**What changed**
- New `site/scripts/punct-check-lib.mjs` with one plain function, `checkPunctuation(html)`. It reads the title and the body text of a built page. Tags are removed (an inline tag leaves no gap, so `<b>word</b>,` is read as `word,`); a block tag (`p`, `li`, `div`, `h1` to `h6`, `br`, `td`, `th` and the like) and a character reference end the run, and a blank written as `&nbsp;` is not a plain space. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped. Attributes and the meta description are not read. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. A punctuation slip is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a space before a comma, full stop, semicolon, colon, `!` or `?` that follows a letter, a digit, a closing bracket or a closing quote; repeated punctuation (two or more commas, semicolons or colons in a row, exactly two dots, four or more dots); no space after a comma or semicolon between two words of 2 or more letters (A to Z).
- Left out on purpose, so there is no false alarm: an ellipsis of three dots (`wait... what`, `wait ... what`, `wait. . . what`); a space before a mark written with `&nbsp;` (French style); a number with a comma (`1,000`); a time (`5:30`); a web address, a file name and abbreviations (`example.com`, `e.g.`, `U.S.`); a comma next to a digit or a single letter (`a,b`); a mark followed by another mark (`:)`, `?!`, `.)`); code and preformatted text; attributes and the meta description; a mark at the start of the next paragraph, list item or table cell (a block tag ends the run).
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/punct-check.test.ts` (70 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has a punctuation slip today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 258 files and 7115 tests passed (before: 257 and 7045). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>The vote , which ended late,, said,then left..</p>` added to the home page gave three warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/punct-check-lib.mjs`, `site/tests/unit/punct-check.test.ts`, `tasks/open/T-0168.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.170), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.169 (2026-11-21): Broken characters in the text are shown by the build (POLISH, Phase 3c Part 8bq)

**What changed**
- New `site/scripts/garble-check-lib.mjs` with one plain function, `checkGarbledText(html)`. It reads the title and the body text of a built page. Tags are removed, so an attribute (`alt`, `title`) and the meta description are not read. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>` and `<noscript>` blocks are skipped. Every character in the file is a `\u` escape, so the file stays plain ASCII. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. Broken text is a fault of the words, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: the replacement mark U+FFFD (a letter was lost; a run of marks is one place); text saved in one encoding and read in another (a lead letter a-circumflex, A-tilde or A-circumflex followed by a symbol of the Windows-1252 table, for example a curly apostrophe shown as three odd letters, e-acute shown as two, a non breaking space shown as a hat and a space); a hidden control character U+0080 to U+009F (usually left by a bad paste; a run is one place, and one inside a wrong-encoding pair is not counted twice).
- Left out on purpose, so there is no false alarm: real accented text (an a-circumflex, A-circumflex or A-tilde inside a word, such as Romanian or Portuguese words); `&nbsp;` and other references; a real non breaking space; a lone lead letter; the zero width characters; text in other scripts; code and preformatted text; attributes and the meta description.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/garble-check.test.ts` (57 cases, with a fake dist folder run of the real gate).
- Found while building it: the first pattern missed a euro sign turned into odd letters; a test caught it and the pattern was widened (second place accepts any Windows symbol).
- Nothing changes on the site by itself: no built page holds a broken character today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 257 files and 7045 tests passed (before: 256 and 6988). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a paragraph with a curly apostrophe turned into three odd letters and a replacement mark, added to the home page, gave two warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/garble-check-lib.mjs`, `site/tests/unit/garble-check.test.ts`, `tasks/open/T-0167.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.169), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.168 (2026-11-21): A word repeated twice in a row is shown by the build (POLISH, Phase 3c Part 8bp)

**What changed**
- New `site/scripts/doubled-check-lib.mjs` with one plain function, `checkDoubledWords(html)`. It reads the text of the `<body>` of a built page. Tags are removed; a block tag (`p`, `li`, `div`, `h1` to `h6`, `br`, `td`, `th`, `blockquote`, `figcaption` and the like) and a character reference (except a blank such as `&nbsp;`) end the run, so two neighbouring menu items or a word on each side of a dash never count as a pair. Comments and `<head>`, `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<code>`, `<kbd>`, `<samp>`, `<svg>`, `<noscript>` and `<select>` blocks are skipped; the case is not read; only words of 3 or more letters (A to Z) count. Each page gives one message that says how many places it found and shows the first one.
- Errors: none. A doubled word is a slip of the pen, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a word of 3 or more letters repeated twice in a row (`the the`, `and and`, `The the`), also across an inline tag, a line break in the source or a non breaking space; three in a row count as one place.
- Left out on purpose, so there is no false alarm: `had had` and `that that` (real English); a first word with a mark glued to its end (`the, the`, `no. No`); words of 1 or 2 letters; words with digits or marks inside; two neighbouring list items, cells, buttons or paragraphs; code and preformatted text; attributes (`alt`, `title`) and the meta description; pages with no Latin letters.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/doubled-check.test.ts` (64 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page repeats a word today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 256 files and 6988 tests passed (before: 255 and 6924). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>The council voted on the the new budget.</p>` added to the home page gave one warning that named the page and showed `the the`, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/doubled-check-lib.mjs`, `site/tests/unit/doubled-check.test.ts`, `tasks/open/T-0166.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.168), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.167 (2026-11-20): Titles and headings that shout are shown by the build (POLISH, Phase 3c Part 8bo)

**What changed**
- New `site/scripts/shout-check-lib.mjs` with one plain function, `checkShouting(html)`. It reads the text of every `<title>`, `<h1>`, `<h2>` and `<h3>` of a built page (tags inside the heading are removed, a character reference is read as a blank). Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<svg>` and `<noscript>` blocks are skipped (so the `<title>` inside an svg is not read); the case of tag names is not read; only the letters A to Z count. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. A shouting headline is bad style, not a broken page, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: a title or heading with 12 or more letters and no small letter at all (all capital letters; it reads as clickbait and Google often rewrites such a title); a title or heading with `!!`, `??` or three or more `!` and `?` marks in a row.
- Left out on purpose, so there is no false alarm: a short heading in capitals (`FAQ`, `NASA`, `FBI RAID`: under 12 letters); a heading with one small letter or more; one single `!` or `?` and a `?!` pair; a heading with no Latin letters; the text of a paragraph, a link or a button; the meta description.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/shout-check.test.ts` (39 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: every title and heading of today's real build is in normal case, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 255 files and 6924 tests passed (before: 254 and 6885). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<h2>SHOCKING TRUTH ABOUT THE BUDGET</h2>` and `<h3>Big news!!!</h3>` added to the home page gave two warnings that named the page, and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/shout-check-lib.mjs`, `site/tests/unit/shout-check.test.ts`, `tasks/open/T-0165.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.167), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.166 (2026-11-20): Empty text boxes and gaps made by hand are shown by the build (POLISH, Phase 3c Part 8bn)

**What changed**
- New `site/scripts/blank-check-lib.mjs` with one plain function, `checkBlanks(html)`. It reads every `<p>`, `<li>`, `<blockquote>` and `<figcaption>` of a built page and the text of the page. Comments are skipped; `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>`, `<svg>` and `<noscript>` blocks are skipped for the text, and count as content when they sit inside a box; the case is not read. Each kind of fault gives one message per page that says how many places it found.
- Errors: none. An empty box does no harm to the reader, so the build never stops for it (the result keeps the same shape as the other checks).
- Warnings, printed only: an empty paragraph (`<p></p>`, or a `<p>` that holds only blank space, `&nbsp;`, a zero width space or empty `<span>`, `<b>`, `<i>`, `<em>`, `<strong>`); an empty list item; an empty quote; an empty caption; two or more `&nbsp;` in a row in the text (an indent or a gap made by hand; use CSS padding or margin).
- Left out on purpose, so there is no false alarm: an empty box that has a `role`, an `aria-live`, an `id` or a `data-` attribute (a place that a script fills later, such as `<p role="status"></p>`); a box that holds a picture, a video, an iframe, a link, a break, a list or any other tag; one single `&nbsp;` (a number glued to its unit, `5&nbsp;km`); an empty table cell; an empty heading (`heading-order-lib.mjs` reads it); an empty `<div>` or `<span>`; `<p><br></p>` (`break-check-lib.mjs` reads it).
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/blank-check.test.ts` (48 cases, with a fake dist folder run of the real gate).
- Found while building it: the first version warned about two real pages (`/contact-us/` and `/notifications/`), which hold an empty `<p role="status">` that a script fills. That was a false alarm, so the rule above (role, aria-live, id, data-) was added with four tests, and the real build is quiet again.
- Nothing changes on the site by itself: no built page has an empty box today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 254 files and 6885 tests passed (before: 253 and 6837). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>&nbsp;</p>`, `<ul><li></li></ul>` and `<p>&nbsp;&nbsp;&nbsp;Indent</p>` added to the home page gave three warnings that named the page and the build still ended with `Validation passed.`; the original pages gave no message.
- Added: `site/scripts/blank-check-lib.mjs`, `site/tests/unit/blank-check.test.ts`, `tasks/open/T-0164.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.166), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.165 (2026-11-20): The line breaks of a page are kept for line breaks only (POLISH, Phase 3c Part 8bm)

**What changed**
- New `site/scripts/break-check-lib.mjs` with one plain function, `checkBreaks(html)`. It reads every `<br>`, `<br/>` and `</br>` of a built page and the tags next to it. Comments and `<script>`, `<style>`, `<template>`, `<textarea>`, `<pre>` and `<svg>` blocks are skipped; the case is not read; blank space between two tags is ignored. Each kind of fault gives one message per page that says how many places it found.
- Error, which stops the build: a stray end tag `</br>` (every browser reads it as one more `<br>`, so the page has a line break nobody wrote).
- Warnings, printed only: two or more `<br>` in a row (close the paragraph and open a new `<p>`; the usual shape of an imported Blogger post); a paragraph or box that holds only a `<br>` (`<p><br></p>`, a blank line made by hand); a `<br>` right after the opening or right before the closing tag of a paragraph, list item, cell, box, heading, quote, caption or definition; a `<br>` next to a block tag (`</p><br>`, `<br><div>`, after an `<hr>`); a `<br>` directly inside a list, a table or a select, where it is not allowed; an end tag of an empty element (`</img>`, `</input>`, `</hr>`, `</meta>`, `</link>` and the others), which the browser ignores.
- Left out on purpose, so there is no false alarm: one `<br>` between two pieces of text (an address, a poem line); one `<br>` before or after an inline tag (`<b>`, `<a>`, `<span>`, `<em>`); a `<br>` in a `<pre>`; the number of `<br>` on a page.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/break-check.test.ts` (40 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has a `<br>` problem today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 253 files and 6837 tests passed (before: 252 and 6797). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<p>a</br>b</p>` and `<p>c<br><br>d</p>` added to the home page gave a failed gate that named the page, the stray end tag as an error and the double break as a warning; the original page gave `Validation passed.`.
- Added: `site/scripts/break-check-lib.mjs`, `site/tests/unit/break-check.test.ts`, `tasks/open/T-0163.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.165), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.164 (2026-11-20): The media queries of media attributes are kept readable by the build (POLISH, Phase 3c Part 8bl)

**What changed**
- New `site/scripts/media-query-check-lib.mjs` with one plain function, `checkMediaQueries(html)`. It reads the `media` attribute of every `<link>` (style sheet, preload, alternate, icon), `<source>`, `<style>` and `<meta name="theme-color">` of a built page. Comments and `<script>` and `<template>` blocks are skipped; the text of a `<style>` block is not read; the case is not read; a comma list is read one query at a time.
- Errors, which stop the build: brackets that do not close; empty brackets; two conditions with no `and` between them, or a type followed by a condition with no `and`; a query that starts or ends with `and`, `or`, `not` or `only`; a media type that is not real (`screeen`); a feature with no value; a width, height, device-width or device-height with no unit or with a unit that is not a length (`(min-width:600)`); a resolution with no unit; an aspect ratio written `16:9`; a colour scheme, motion, contrast, orientation, hover or pointer value that the feature does not have, or `min-` or `max-` in front of such a feature; a feature name one or two letters away from a real one (`min-widht`). A browser that cannot read a query treats it as "not all", so the style sheet, the picture source or the dark theme colour is silently never used.
- Warnings, printed only: a media type that matches nothing in a modern browser (`tv`, `tty`, `projection`, `handheld`, `braille`, `embossed`, `aural`); a `min-width` larger than the `max-width` of the same query (it never matches).
- Left out on purpose, so there is no false alarm: an empty media (`picture-check-lib.mjs` reads an empty `<source media>`); the range syntax (`(width >= 600px)`) and any bracket that holds another bracket (only their balance is checked); a feature name that is not near a real one, and vendor names; `media="all"` and `media="screen"`; the css inside a `<style>` block.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/media-query-check.test.ts` (49 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: no built page has a `media` attribute today, so the build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 252 files and 6797 tests passed (before: 251 and 6748). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a style sheet link with `media="(min-width:600)"` and one with `media="tv"` added to the head of the home page gave a failed gate that named the page, the missing unit as an error and the `tv` type as a warning; the original page gave `Validation passed.`.
- Added: `site/scripts/media-query-check-lib.mjs`, `site/tests/unit/media-query-check.test.ts`, `tasks/open/T-0162.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.164), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.163 (2026-11-20): The integrity fingerprints of scripts and style sheets are kept right by the build (POLISH, Phase 3c Part 8bk)

**What changed**
- New `site/scripts/integrity-check-lib.mjs` with one plain function, `checkIntegrity(html, ownHosts)`. It reads every `<script>` and `<link>` of a built page, and the `integrity` attribute on a picture, frame, link, video, audio, source, embed or object. Comments and `<template>` blocks are skipped; the case of a name is not read; several fingerprints separated by blanks and an option after a question mark are allowed.
- Errors, which stop the build: an integrity word that is not a real fingerprint (an unknown kind such as `sha1` or `md5`, a missing dash, letters that are not base64, or a length that does not fit `sha256` (44), `sha384` (64) or `sha512` (88)), because a browser ignores such a word with no message and the file is not checked; a file from another website that has an integrity but no `crossorigin` attribute, because the browser then blocks the file.
- Warnings, printed only: an empty integrity; an integrity on a tag that does not read it (a script with no `src`, a link that is not a style sheet, preload or modulepreload, a picture, a frame, a link); a script or a style sheet from a library host (`cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `code.jquery.com`, `ajax.googleapis.com`, the Bootstrap hosts) with no integrity.
- Left out on purpose, so there is no false alarm: scripts from ad, analytics and challenge hosts (Adsterra, AdSense, Cloudflare Turnstile), which change by design and cannot carry a fingerprint; any host that is not on the library list; an own file with or without integrity; a relative address; the text inside a script.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/integrity-check.test.ts` (54 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message (the Turnstile script and the search script are not on the library list). No older test was changed.
- Test run on the whole project: 251 files and 6748 tests passed (before: 250 and 6694). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a jsDelivr script with `integrity="sha1-abc"` and one with no integrity added to the home page gave a failed gate that named the page, the bad fingerprint as an error and the missing one as a warning; the original page gave `Validation passed.`.
- Added: `site/scripts/integrity-check-lib.mjs`, `site/tests/unit/integrity-check.test.ts`, `tasks/open/T-0161.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.163), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.162 (2026-11-20): The alt text of the pictures is kept useful by the build (POLISH, BUGS U, Phase 3c Part 8bj)

**What changed**
- New `site/scripts/alt-text-lib.mjs` with one plain function, `checkAltText(html)`. It reads the alt of every `<img>` of a built page. An empty `alt=""` (a decoration) and a tag with no alt are left alone (`img-check-lib.mjs` reads those). Comments and `<script>`, `<style>` and `<template>` blocks are skipped; the case is not read; `&amp;`, `&quot;`, `&#39;`, `&lt;`, `&gt;` and `&nbsp;` are turned into letters first.
- Errors, which stop the build: an alt that is only a file name (`IMG_2041.jpg`, `photo.png`, `logo.svg`) or a camera or screenshot name (`IMG 2041`, `DSC00123`, `PXL_20261120_101500`, `Screenshot 2026-11-20 at 10.15.22`).
- Warnings, printed only: an alt that is one empty word (`image`, `picture`, `photo`, `graphic`, `img`, `pic`, `thumbnail`, `banner`, `placeholder`, `untitled`, `screenshot`) or such a word with a number (`image 3`, `Figure 2`); an alt that starts with `image of`, `picture of`, `photo of`, `graphic of` or `screenshot of` (a screen reader says "image" already); an alt over 125 characters (put the long text in a caption); an alt of blanks or marks only (write `alt=""` for a decoration).
- Left out on purpose, so there is no false alarm: any alt with real words and no file name; `logo` and `icon`; pictures inside an svg; `<input type="image">` and `<area>`; the language of the alt.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/alt-text.test.ts` (38 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 250 files and 6694 tests passed (before: 249 and 6656). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a picture with `alt="IMG_2041.jpg"` and one with `alt="image"` added to the home page gave a failed gate that named the page, the file name as an error and the lone word as a warning; the original page gave `Validation passed.`.
- Added: `site/scripts/alt-text-lib.mjs`, `site/tests/unit/alt-text.test.ts`, `tasks/open/T-0160.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.162), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.161 (2026-11-20): The skeleton of a page (html, head, body) is kept right by the build (POLISH, Phase 3c Part 8bi)

**What changed**
- New `site/scripts/structure-check-lib.mjs` with one plain function, `checkStructure(html)`. It reads the page in order and follows where the browser is: before the head, in the head, after the head, in the body. Comments and `<script>`, `<style>`, `<template>`, `<noscript>` and `<textarea>` blocks are skipped, and everything inside an `<svg>` or `<math>` is skipped (an svg `<title>` is right); the case of names is not read.
- Errors, which stop the build: a second `<html>`, `<head>` or `<body>` (a whole page pasted into another one); a `<head>` after the `<body>` starts; a tag in the head that a head may not hold (only `title`, `meta`, `link`, `style`, `script`, `noscript`, `base` and `template` may stand there; the old `basefont`, `bgsound` and `noframes` are allowed) and text in the head, both of which end the head early so that every head tag after them (canonical link, share tags, structured data) lands in the body; a canonical link in the body; a `<title>` that stands only in the body.
- Warnings, printed only: a second `<title>` in the body; a `<meta>` with `name`, `property`, `http-equiv` or `charset` in the body; content after `</body>` and content after `</html>`; a page with no `<head>` tag or no `<body>` tag (the browser makes one).
- Left out on purpose, so there is no false alarm: a `<meta itemprop>` in the body (microdata); a `<link>` that is not canonical in the body; a blank page; an svg `<title>`; a head tag after an explicit `</head>` and before the body (the browser puts it back in the head).
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/structure-check.test.ts` (50 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 249 files and 6656 tests passed (before: 248 and 6606). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a `<div>` and a second canonical link added to the head and a `<p>` added after `</body>` of the home page gave a failed gate that named the page and each fault; the original page gave `Validation passed.`.
- Added: `site/scripts/structure-check-lib.mjs`, `site/tests/unit/structure-check.test.ts`, `tasks/open/T-0159.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.161), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.160 (2026-11-20): The noscript blocks of a page are kept right by the build (POLISH, Phase 3c Part 8bh)

**What changed**
- New `site/scripts/noscript-check-lib.mjs` with one plain function, `checkNoscript(html)`. It reads the page in order and finds every `<noscript>` block and whether it stands in the head or in the body. Comments and `<script>`, `<style>` and `<template>` blocks outside a `<noscript>` are skipped, so a tracking snippet that writes the word `<noscript>` inside a script is not read. The case of names is not read.
- Errors, which stop the build: a `<noscript>` in the head that holds a tag other than `link`, `style`, `meta` (`basefont`, `bgsound` and `noframes` are old and allowed) or that holds text (for a reader whose JavaScript is off the head ends early and the rest of it, the canonical link, the share tags and the structured data, lands in the body); a `<noscript>` with no `</noscript>` (for a reader whose JavaScript is on, the rest of the page becomes text).
- Warnings, printed only: an empty `<noscript>`; a `<script>` inside a `<noscript>` (it never runs); a `</noscript>` with no opening one.
- Left out on purpose, so there is no false alarm: a `<noscript>` in the body, whatever it holds (the three on today's site, in the contact form, the notifications page and the search page, hold a paragraph and pass quietly); a picture pixel in a body `<noscript>`.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/noscript-check.test.ts` (33 cases, with a fake dist folder run of the real gate).
- Found while testing: a first version read the text of a `<style>` block inside a head `<noscript>` as page text and refused a good page; the block is now read as one tag.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 248 files and 6606 tests passed (before: 247 and 6573). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a `<noscript><img ...></noscript>` added to the head and a `<noscript>` never closed added to the body of the home page gave a failed gate that named the page and both faults; the original page gave `Validation passed.`.
- Added: `site/scripts/noscript-check-lib.mjs`, `site/tests/unit/noscript-check.test.ts`, `tasks/open/T-0158.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.160), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.159 (2026-11-20): The address attributes of a page are kept safe by the build (POLISH, Phase 3c Part 8bg)

**What changed**
- New `site/scripts/url-attr-check-lib.mjs` with one plain function, `checkUrlAttrs(html)`. It reads the attributes `action`, `formaction`, `cite`, `ping`, `poster` and `longdesc` on every tag of one built page (`href` and `src` already have their own checks). The case is not read; a scheme broken up by a tab or a new line (`java<tab>script:`) is still read as `javascript:`; entities in the value are decoded first.
- Errors, which stop the build: a `javascript:` address (it runs code when the form is sent or the link is pinged), a `file:` address (it points to the reader's own disk) and a `data:` address (fine in a `poster`) in any of the six attributes; a `formaction` that starts with `http://` (a form `action` with `http://` stays with `form-behavior-check-lib.mjs`).
- Warnings, printed only: a `ping` to `http://`; a `ping` word that is not an address; `formaction` on a tag that is not a button or an input of type submit or image; `cite` on a tag that is not blockquote, q, ins or del; `ping` on a tag that is not a or area; `poster` on a tag that is not video. In each case the browser ignores the attribute.
- Left out on purpose, so there is no false alarm: an empty value; a relative address; `https://`, `mailto:` and `tel:`; text inside comments, `<script>`, `<style>` and `<template>`; a value that starts with `{` or holds `${...}`; names such as `data-action`.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/url-attr-check.test.ts` (42 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 247 files and 6573 tests passed (before: 246 and 6531). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a button with `formaction="javascript:go()"` and a blockquote with `cite="file:///a"` added to the home page gave a failed gate that named the page and both faults; the original page gave `Validation passed.`.
- Added: `site/scripts/url-attr-check-lib.mjs`, `site/tests/unit/url-attr-check.test.ts`, `tasks/open/T-0157.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.159), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.158 (2026-11-20): The doctype of a page is kept right by the build (POLISH, Phase 3c Part 8bf)

**What changed**
- New `site/scripts/doctype-check-lib.mjs` with one plain function, `checkDoctype(html)`. It reads the start of one built page (a byte order mark, blanks and comments are skipped; the case is not read).
- Errors, which stop the build: a page with no `<!doctype html>`; a doctype that is a typo (`<!doctyp html>`, `<!doctpye html>`) or is written `<doctype html>` with no `!`; a doctype that does not come first (text or a tag stands before it); a doctype with no name or with a name other than `html` (`<!doctype htm>`). In all these cases the browser draws the page in quirks mode (old box sizes, odd line heights) and shows no message.
- Warnings, printed only: a doctype with an old public or system identifier (HTML 4.01, XHTML 1.0; only `about:legacy-compat` is fine); a second doctype; a comment before the doctype.
- Left out on purpose, so there is no false alarm: any case or blanks in `<!DOCTYPE   HTML >`; `<!doctype html system "about:legacy-compat">`; the word `doctype` inside a script, a style block, a template or a comment.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/doctype-check.test.ts` (35 cases, with a fake dist folder run of the real gate).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 246 files and 6531 tests passed (before: 245 and 6496). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): the doctype taken off the home page gave a failed gate that named the page; the original page gave `Validation passed.`.
- Added: `site/scripts/doctype-check-lib.mjs`, `site/tests/unit/doctype-check.test.ts`, `tasks/open/T-0156.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.158), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.157 (2026-11-20): The event handler attributes of a page are kept right by the build (POLISH, Phase 3c Part 8be)

**What changed**
- New `site/scripts/handler-check-lib.mjs` with one plain function, `checkHandlers(html)`. It reads every attribute written `on` plus letters (`onclick`, `onload`, `onsubmit` ...) on every tag of one built page; comments, `<script>`, `<style>` and `<template>` blocks are skipped.
- Errors, which stop the build: an `on...` attribute that is a typo of a real event (`onclik`, `onlaod`, `onsumbit`), because the browser keeps it as plain text and nothing ever runs; handler code that is not valid JavaScript (a bracket, a brace or a quote never closed, a stray word). The code is only compiled to find the fault (`new Function`), it is never run.
- Warnings, printed only: an empty handler (it does nothing); handler code that starts with `javascript:` (the word is only a label there).
- Left out on purpose, so there is no false alarm: an `on...` name that is not close to any real event (`online`, a framework word); `x-on:click`, `@click` and `data-onclick`; a value that starts with `{` or holds `${...}`; the case of the name; a working inline handler (the public pages of the site allow inline code in their content policy, and the Notifications page already uses `onsubmit="return false"`); the meaning of the code, only its syntax is read.
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/handler-check.test.ts` (58 cases, with a fake dist folder run of the real gate and a read of eight real templates).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message (the Notifications page has one valid `onsubmit` and passes). No older test was changed.
- Test run on the whole project: 245 files and 6496 tests passed (before: 244 and 6438). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `<button onclik="go()">` and `<button onclick="go(">` added to the home page gave a failed gate that named the page and both faults; the original page gave `Validation passed.`.
- Found while testing: a first version also warned about every working inline handler, saying the content policy may block it. That is not true for the public pages (their policy has `'unsafe-inline'`), so the warning was removed before this release.
- Added: `site/scripts/handler-check-lib.mjs`, `site/tests/unit/handler-check.test.ts`, `tasks/open/T-0155.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.157), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.156 (2026-11-20): The style blocks of a page are kept right by the build (POLISH, Phase 3c Part 8bd)

**What changed**
- New `site/scripts/style-block-lib.mjs` with one plain function, `checkStyleBlocks(html)`. It reads every `<style>` block of one built page (no type, or `type="text/css"`); comments, `<script>` and `<template>` blocks are skipped. It walks the rules once, with nested rules and at-rules (`@media`, `@supports`, `@layer`, `@keyframes`, `@container`).
- Errors, which stop the build: a `{` that is never closed (the message names the rule); a `}` with no opening one; a `{` with no selector before it; a comment `/*` that is never closed; a quote that is never closed; and, inside each rule, every fault the style attribute check stops: a declaration with no colon or no value, a property that is a typo of a real one, a number with no unit in a length, a unit or a keyword that is a typo, a hex color that is not 3, 4, 6 or 8 digits, a bracket never closed, two declarations joined with no semicolon, a `!` that is not `!important`.
- Warnings, printed only: an empty `<style>` block; the same property written twice with the same value; `expression(` and `javascript:` in a rule.
- Left out on purpose, so there is no false alarm: the selectors and the words of at-rules; the declarations inside `@font-face`, `@property`, `@counter-style`, `@page`, `@font-feature-values` and `@view-transition`; custom and vendor properties; a `<style>` of another type (`text/less`); a `<style>` whose tag holds a template expression.
- Changed `site/scripts/style-attr-lib.mjs`: the loop that checks the declarations is now the exported function `checkDeclarations(parts, err, warn)`, so the attribute check and the block check share one set of rules. Nothing it reports changed (its 96 tests pass as they were).
- `site/scripts/validate-html.mjs` (the build gate) runs the new check on every built page and its first comment line names it.
- New test: `site/tests/unit/style-block.test.ts` (76 cases, with a fake dist folder run of the real gate and a read of the real style sheet `src/styles/global.css`, which passes with no message).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 244 files and 6438 tests passed (before: 243 and 6362). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): a block `.a{width:300;colour:red}.b{color:red` added to the home page gave a failed gate that named the page and all three faults; the original page gave `Validation passed.`.
- Added: `site/scripts/style-block-lib.mjs`, `site/tests/unit/style-block.test.ts`, `tasks/open/T-0154.md`. Changed: `site/scripts/style-attr-lib.mjs`, `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.156), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.155 (2026-11-20): The style attributes of a page are kept right by the build (POLISH, Phase 3c Part 8bc)

**What changed**
- New `site/scripts/style-attr-lib.mjs` with one plain function, `checkStyleAttrs(html)`. It reads the `style="..."` attribute of every tag of one built page; comments, `<script>`, `<style>` and `<template>` blocks are skipped.
- Errors, which stop the build: a declaration with no colon (`color red`); a name that cannot be a property; a property that is a typo of a real one (`backgroud`, `colour`, `widht`); a declaration with no value; a bracket `(` or a quote that is never closed, and a `)` with no opening one; a whole rule pasted into the attribute (`p{color:red}`); two declarations joined with no semicolon (`color:red background:blue`); a length property (`width`, `height`, `margin`, `padding`, `top`, `font-size`, `gap` and more) with a number that has no unit (`width:300`, `margin:10 px`) or a unit that is a typo (`10xp`); a keyword that is a typo of a real one for `display`, `position`, `float`, `clear`, `visibility`, `overflow`, `text-align`, `text-transform`, `white-space`, `font-style`, `box-sizing` and `object-fit` (`position:abosolute`); a hex color that is not 3, 4, 6 or 8 digits; a `!` that is not `!important`.
- Warnings, printed only: an empty style attribute; `expression(`, `javascript:`, `behavior:` or `-moz-binding` in a style; the same property written twice with the same value.
- Left out on purpose, so there is no false alarm: custom properties (`--name`) and their values; vendor properties (`-webkit-line-clamp`); a property or a keyword that is not close to a listed one (a new CSS property is fine); functions such as `var()`, `calc()` and `env()`; `line-height` and `opacity` with a plain number; the same property written twice with different values (a fallback is normal); a value that holds a template expression; the `data-style` attribute.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/style-attr.test.ts` (96 cases, with a fake dist folder run of the real gate and a read of eight real templates).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. No older test was changed.
- Test run on the whole project: 243 files and 6362 tests passed (before: 242 and 6266). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in a throw away copy of `dist` (not in the ZIP): `width:300` and `colour:red` added to the home page gave a failed gate that named the page and both faults; the original page gave `Validation passed.`.
- Added: `site/scripts/style-attr-lib.mjs`, `site/tests/unit/style-attr.test.ts`, `tasks/open/T-0153.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.155), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.154 (2026-11-20): The structured data blocks of a page are kept right by the build (POLISH, Phase 3c Part 8bb)

**What changed**
- New `site/scripts/jsonld-check-lib.mjs` with one plain function, `checkJsonLd(html)`. It reads every `<script type="application/ld+json">` block of one built page (the NewsArticle, the breadcrumbs, the publisher); comments and `<template>` blocks are skipped.
- Errors, which stop the build: a script whose type is a typo of `application/ld+json` (`application/ld-json`, `application/jsonld`, `text/ld+json`), because search engines never read it; a block that is not valid JSON (a comma too many, single quotes, a comment or a CDATA wrapper), with the reason from the parser; a block that holds a plain value and not an object or a list; an `@type` that is one letter away from a real schema.org type (`NewsArtcle`, `Organisation`) or has the wrong capital letters (`newsarticle`); a `datePublished`, `dateModified`, `dateCreated` or `uploadDate` that is not a real ISO date or time (`2026-02-30`, `20 November 2026`).
- Warnings, printed only: an empty block; a list entry or a `@graph` entry that is not an object; a node with no `@context` or with an `@context` that is not `https://schema.org`; a node with no `@type`; an HTML entity (`&amp;`, `&#8217;`) in a text, which search engines show as typed; a date with a space instead of `T`; a `dateModified` before the `datePublished`.
- Left out on purpose, so there is no false alarm: other data blocks (`application/json`, `importmap`, `speculationrules`); a block whose tag holds a template expression or `set:html`; an `@type` that is not close to a listed type (it may be a real schema.org type); an `@type` with a prefix (`schema:Article`); an `@context` that is a list or an object; the `@type` of a node deeper than the top node and the nodes of `@graph`; what Google asks of a type (a required headline or image), which is the job of the Rich Results Test.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check. The old plain line `invalid JSON-LD` of the gate is kept as it was, so a block that does not parse now gets that line and the new line with the reason.
- New test: `site/tests/unit/jsonld-check.test.ts` (84 cases, with a fake dist folder run of the real gate and a read of the base layout, the search page and the 404 page).
- Changed an older test: `site/tests/unit/img-priority.test.ts` wrote the fake dates `d` in its fake article; the new check rightly stopped them, so they are now real ISO dates. Nothing else in that test changed.
- Nothing changes on the site by itself: the site writes its structured data with `jsonLdString` (`src/lib/schema.ts`), so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 242 files and 6266 tests passed (before: 241 and 6182). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): the type changed to `application/ld-json` gave a failed gate and named the page; a comma put after the first brace gave a failed gate with the parser reason; `BreadcrumbList` written `BreadcrumbLis` gave a failed gate; a `datePublished` of `2026-02-30` gave a failed gate; the original page gave `Validation passed.`.
- Added: `site/scripts/jsonld-check-lib.mjs`, `site/tests/unit/jsonld-check.test.ts`, `tasks/open/T-0152.md`. Changed: `site/scripts/validate-html.mjs`, `site/tests/unit/img-priority.test.ts`, `site/package.json`, `site/package-lock.json` (version 0.101.154), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.153 (2026-11-20): The share tags of a page are kept right by the build (POLISH, Phase 3c Part 8ba)

**What changed**
- New `site/scripts/share-check-lib.mjs` with one plain function, `checkShareTags(html)`. It reads every `<meta>` tag of one built page in one pass whose `property` or `name` holds a colon (`og:`, `twitter:`, `article:`); comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a tag name that is a typo of a real share tag (`og:titel`, `og:imge`, `twiter:card`); a `twitter:card` that is a typo of `summary`, `summary_large_image`, `app` or `player` (`summary_large_img`); an `og:type` that is a typo of a real type (`artcle`, `webiste`); an `og:image:width` or `og:image:height` that is not a whole number of pixels (`1200px`, `0`); an `og:locale` or `og:locale:alternate` that is not written like `en_US` (`en-US`, `en_us`); an `article:published_time`, `article:modified_time` or `article:expiration_time` that is not an ISO date or time or is a date that does not exist (`2026-02-30`); a `twitter:image` that is not a full http or https address; an `og:image:secure_url` that is not https.
- Warnings, printed only: an empty content; a `twitter:card` or `og:type` no platform knows that is not a typo of one; an `og:locale` with only a language (`en`); a time written with a space instead of `T`; a modified time before the published time; an `og:image` or `twitter:image` from `http://`; a tag that holds one value written twice (`og:title`, `og:type`, `twitter:card` and the like); an `og:` or `article:` tag written with `name=` instead of `property=`; a `summary_large_image` card with no `twitter:image` or `og:image`; a `twitter:site` or `twitter:creator` that is not an `@name`.
- Left out on purpose, so there is no false alarm: the case of a name and a value; a content written as a template expression (`content={value}`); a name with no colon; a name no share tag is close to (`fb:app_id`, `al:ios:url`, `og:video:tag`, `twitter:label1`); `og:image`, `og:image:alt` and `article:tag`, which may repeat; what `head-check-lib.mjs` already reads (a missing `og:title`, `og:url`, `og:image` or `twitter:card`, an `og:url` or `og:image` that is not a full address, an `og:url` that is not the canonical); text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/share-check.test.ts` (65 cases, with a fake dist folder run of the real gate and a read of the base layout, the search page and the 404 page).
- Nothing changes on the site by itself: every share tag the site writes holds a real name and value, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 241 files and 6182 tests passed (before: 240 and 6117). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `twitter:card` set to `summary_large_img` gave a failed gate and named `dist/404.html`; `og:locale` set to `en-US` gave a failed gate; the same `og:type` written twice gave `Validation passed.` and a warning.
- Added: `site/scripts/share-check-lib.mjs`, `site/tests/unit/share-check.test.ts`, `tasks/open/T-0151.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.153), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.152 (2026-11-20): The words of robots meta tags are kept right by the build (POLISH, Phase 3c Part 8az)

**What changed**
- New `site/scripts/robots-check-lib.mjs` with one plain function, `checkRobots(html)`. It reads every `<meta>` tag of one built page in one pass; comments, script, style and `<template>` blocks are skipped. Read on: `robots`, `googlebot`, `googlebot-news` and `bingbot`.
- Errors, which stop the build: a word that is a typo of a real one (`noindx`, `no-index`, `nofolow`, `nosnipet`); a `max-image-preview` that is not `none`, `standard` or `large`; a `max-snippet` or `max-video-preview` that is not a whole number or is below -1; a parameter word written wrong (`max-snipet`); `follow` and `nofollow` in one tag; a meta name that is a typo of `robots` (`robot`, `robtos`).
- Warnings, printed only: an empty content; a word no crawler knows that is not a typo of one; a list with spaces and no commas (`noindex nofollow`); an old word that is ignored now (`noodp`, `noydir`); an `unavailable_after` with a date that cannot be read; `none` together with another word.
- Left out on purpose, so there is no false alarm: the case of a word, a name and a tag; spaces around a comma; more than one robots tag and `index` with `noindex` (head-check-lib reads those); a content written as a template expression (`content={value}`); a meta tag with another name; `data-` names; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/robots-check.test.ts` (62 cases, with a fake dist folder run of the real gate and a read of the base layout, the search page and the 404 page).
- Nothing changes on the site by itself: the four robots values the site writes are all real words, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 240 files and 6117 tests passed (before: 239 and 6055). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `content="noindx,follow"` gave exit code 1 and named the page; `content="noindex nofollow"` gave exit code 0 and a warning.
- Added: `site/scripts/robots-check-lib.mjs`, `site/tests/unit/robots-check.test.ts`, `tasks/open/T-0150.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.152), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.151 (2026-11-20): Input rules of form fields are kept right by the build (POLISH, Phase 3c Part 8ay)

**What changed**
- New `site/scripts/input-rules-lib.mjs` with one plain function, `checkInputRules(html)`. It reads every `<input>` and `<textarea>` of one built page in one pass; comments, script, style and `<template>` blocks are skipped. An entity in a pattern (`&#43;`, `&quot;`) is read as the character first.
- Errors, which stop the build: a `pattern` that is not a regular expression in any browser (`(abc`, `*abc`, `a{2,1}`). The browser drops it without a word and the field accepts anything.
- Warnings, printed only: a `pattern` that only new browsers drop because they read it with the `v` flag (`[\w-]+` and `[a-z_-]+`; write `\-`); a `pattern` on a checkbox, number, date, radio, file, range, color or hidden field or on a textarea; an `accept` on a field that is not `type="file"`; a `multiple` on a field that is not `type="email"` or `type="file"`; a `minlength` above the `maxlength` of the same field.
- Left out on purpose, so there is no false alarm: whether the pattern matches the title text; an empty pattern; a `minlength` or `maxlength` that is not a whole number (form-controls-lib reads it); the value of `multiple` (bool-check-lib reads it); the case of a tag and an attribute; an unknown `type` (read as text, like the browser); `data-` names; a tag that is not in the list; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/input-rules.test.ts` (59 cases, with a fake dist folder run of the real gate and a read of the base layout, the contact form, the search page and the notifications page).
- Nothing changes on the site by itself: no field of the site has a bad pattern, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 239 files and 6055 tests passed (before: 238 and 5996). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a field with `pattern="(abc"` gave exit code 1 and named the page; a text field with `accept="image/*"` gave exit code 0 and a warning.
- Added: `site/scripts/input-rules-lib.mjs`, `site/tests/unit/input-rules.test.ts`, `tasks/open/T-0149.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.151), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.150 (2026-11-20): Wrong language codes of links and subtitles are kept out by the build (POLISH, Phase 3c Part 8ax)

**What changed**
- New `site/scripts/langtag-check-lib.mjs` with one plain function, `checkLangTags(html)`. It reads every tag of one built page in one pass; comments, script, style and `<template>` blocks are skipped. The language code rule is `isValidLang` of `lang-check-lib.mjs` (`en`, `en-US`, `zh-Hant-TW`, `es-419` and a private code such as `x-default`).
- Errors, which stop the build: an `hreflang` of an `<a>`, `<area>` or `<link>` that is not a language code (`english`, `en_US`); a `srclang` of a `<track>` that is not a language code (`french`).
- Warnings, printed only: an empty `hreflang`; a `<track kind="subtitles">` with no `srclang` or an empty one.
- Left out on purpose, so there is no false alarm: the case of a value; a track of another kind with no `srclang`; `lang` and `xml:lang` (lang-check-lib reads them); `data-` names; the case of a tag and an attribute; a tag that is not in the list; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/langtag-check.test.ts` (44 cases, with a fake dist folder run of the real gate and a read of the base layout, the footer and the post card).
- Nothing changes on the site by itself: no template of the site has `hreflang` or `srclang`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 238 files and 5996 tests passed (before: 237 and 5952). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): an `<a hreflang="english">` gave exit code 1 and named the page; an `<a hreflang="">` gave exit code 0 and a warning.
- Added: `site/scripts/langtag-check-lib.mjs`, `site/tests/unit/langtag-check.test.ts`, `tasks/open/T-0148.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.150), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.149 (2026-11-20): Wrong link targets are kept out by the build (POLISH, Phase 3c Part 8aw)

**What changed**
- New `site/scripts/target-check-lib.mjs` with one plain function, `checkTargets(html)`. It reads every tag of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a `target` or `formtarget` that starts with an underscore and is not `_blank`, `_self`, `_parent` or `_top` (`_blnk`, `_new`; any case is fine for the four words), and one of the four words (or the plain word) with a space around it (`" _blank"`), which the browser reads with the space.
- Warnings, printed only: a `target` or `formtarget` that is the plain word `blank`, `self`, `parent`, `top` or `new` with no underscore; the browser opens a window with that name instead of reading a keyword.
- Read on: `a`, `area`, `form` and `base` (`target`) and `button` and `input` (`formtarget`).
- Left out on purpose, so there is no false alarm: a real window or frame name with no underscore (`target="gallery"`); an empty target; the case of a tag and an attribute; whether a new tab link has `noopener` (new-tab-lib reads that); `data-` and `aria-` names; a tag that is not in the list; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/target-check.test.ts` (44 cases, with a fake dist folder run of the real gate and a read of the footer, the base layout, the post card and the contact form).
- Nothing changes on the site by itself: the footer links use `target="_blank"`, which is right, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 237 files and 5952 tests passed (before: 236 and 5908). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a link with `target="_blnk"` gave exit code 1 and named the page; a link with `target="blank"` gave exit code 0 and a warning.
- Added: `site/scripts/target-check-lib.mjs`, `site/tests/unit/target-check.test.ts`, `tasks/open/T-0147.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.149), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.148 (2026-11-20): On/off attributes written as off are kept out by the build (POLISH, Phase 3c Part 8av)

**What changed**
- New `site/scripts/bool-check-lib.mjs` with one plain function, `checkBools(html)`. It reads every tag of one built page in one pass; comments, style and `<template>` blocks are skipped, and the opening tag of a `<script>` is read but its text is not.
- Errors, which stop the build: an on/off attribute whose value says off (`false`, `0`, `no` or `off`, any case). The browser still switches it on, so `<input disabled="false">` is a dead field, `<details open="false">` is open and `<script async="false">` is still async.
- Warnings, printed only: an on/off attribute with any other value than nothing or its own name (`disabled="true"`, `checked="1"`); it works, but HTML wants `disabled` or `disabled="disabled"`.
- Attributes read, each on the tags that take it: `disabled`, `checked`, `selected`, `required`, `readonly`, `multiple`, `open`, `controls`, `autoplay`, `loop`, `muted`, `playsinline`, `async`, `defer`, `nomodule`, `novalidate`, `formnovalidate`, `reversed`, `ismap`, `allowfullscreen`, `default`, and on any tag `hidden`, `inert`, `autofocus` and `itemscope`.
- Left out on purpose, so there is no false alarm: every `aria-` name (they hold a real true or false); `data-` attributes; `contenteditable`, `draggable` and `spellcheck` (a real false is allowed there); `hidden="until-found"`; the same attribute on a tag that does not take it; the case of a tag and an attribute; a custom tag; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/bool-check.test.ts` (56 cases, with a fake dist folder run of the real gate and a read of the base layout, the post card and the contact form).
- Nothing changes on the site by itself: no template of the site writes these attributes as off, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 236 files and 5908 tests passed (before: 235 and 5852). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a `<details open="false">` gave exit code 1 and named the page; a labelled `<input disabled="true">` gave exit code 0 and a warning.
- Added: `site/scripts/bool-check-lib.mjs`, `site/tests/unit/bool-check.test.ts`, `tasks/open/T-0146.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.148), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.147 (2026-11-20): Id references that point nowhere are kept out by the build (POLISH, Phase 3c Part 8au)

**What changed**
- New `site/scripts/ref-check-lib.mjs` with one plain function, `checkRefs(html)`. It reads every tag of one built page in two steps (first the ids, then the attributes that point to an id); comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a name in `headers` of a `<td>` or `<th>`, the `list` of an `<input>`, the `form` of an input, button, select, textarea, output, fieldset, object, meter or progress, a name in `for` of an `<output>` and the `popovertarget` of a `<button>` or `<input>` that is not an id on the page (the id counts upper and lower case; `headers` and `for` hold a list, each name is read; an empty value is left alone).
- Warnings, printed only: a `headers` that points to something that is not a `<th>`; a `list` that points to something that is not a `<datalist>`; a `form` that points to something that is not a `<form>`; a `popovertarget` that points to an element with no `popover` attribute.
- Left out on purpose, so there is no false alarm: `label for` (form-labels-lib reads it); `aria-labelledby`, `aria-describedby` and `aria-controls` (ids-lib and aria-check-lib read them); the same id on two elements (ids-lib); ids made by a script; the case of a tag and an attribute; a tag that is not in the list; an id inside a `<template>`; text inside comments, script and style.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/ref-check.test.ts` (49 cases, with a fake dist folder run of the real gate and a read of the base layout and the post card).
- Nothing changes on the site by itself: no template of the site has these attributes, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 235 files and 5852 tests passed (before: 234 and 5803). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a `<button popovertarget="menu">` with no such id gave exit code 1 and named the page; a `popovertarget` that points to an element with no `popover` attribute gave exit code 0 and a warning.
- Added: `site/scripts/ref-check-lib.mjs`, `site/tests/unit/ref-check.test.ts`, `tasks/open/T-0145.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.147), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.146 (2026-11-19): Broken clickable pictures (image maps) are kept out by the build (POLISH, Phase 3c Part 8at)

**What changed**
- New `site/scripts/map-check-lib.mjs` with one plain function, `checkMaps(html)`. It reads the `img`, `map` and `area` tags of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: an `<img usemap>` that is not `#` and a name, or that names a map that is not on the page (the name counts upper and lower case, as the browser reads it); a `<map>` with no name, an empty name, a name with a space or a name used by a second map; an `<area>` with a shape that is not `rect`, `circle`, `poly` or `default`, with no `coords` (a `default` shape needs none), with `coords` that are not numbers, with `coords` of the wrong length (rect 4, circle 3, poly an even number of at least 6) and an `<area>` with an `href` and no `alt`.
- Warnings, printed only: a `<map>` that no `<img usemap>` uses; an `<area>` outside a `<map>`; an old shape name (`rectangle`, `circ`, `polygon`) that browsers still read.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value (except a map name); a tag that is not in the list; names that only start with a listed word (`imgs`, `mapping`, `areas`); the `usemap` of an `<object>`; text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/map-check.test.ts` (60 cases, with a fake dist folder run of the real gate and a read of the base layout and the post card).
- Nothing changes on the site by itself: no template of the site has an image map, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 234 files and 5803 tests passed (before: 233 and 5743). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a picture with `usemap="#nope"` and no map gave exit code 1 and named the page; a `<map name="m">` that no picture uses gave exit code 0 and a warning.
- Added: `site/scripts/map-check-lib.mjs`, `site/tests/unit/map-check.test.ts`, `tasks/open/T-0144.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.146), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.145 (2026-11-19): Wrong progress, meter and number field values are kept out by the build (POLISH, Phase 3c Part 8as)

**What changed**
- New `site/scripts/range-check-lib.mjs` with one plain function, `checkRanges(html)`. It reads the `progress`, `meter` and `input` tags of one built page in one pass; only an `<input>` whose type is `number` or `range` is read; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a `max` or `value` of a `<progress>`, a `min`, `max`, `low`, `high`, `optimum` or `value` of a `<meter>` and a `min`, `max` or `step` of a number or range field that is not a number at all (`abc`, `100px`, empty); `step="any"` is real and passes.
- Warnings, printed only: a `<progress>` with a `max` of 0 or below and a `value` below 0 or above `max`; a `<meter>` with a `min` above its `max`, a `value`, `low`, `high` or `optimum` outside `min` to `max` and a `low` above its `high`; a number or range field with a `min` above its `max`, a `step` of 0 or below, a `value` that is not a number and a `value` outside `min` to `max`.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value; an `<input>` of any other type (date, text and so on); a tag that is not in the list; names that only start with a listed word (`progressive`, `meters`, `inputs`); text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/range-check.test.ts` (64 cases, with a fake dist folder run of the real gate and a read of the base layout and the post card).
- Nothing changes on the site by itself: no template of the site has a progress bar, a meter or a number field, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 233 files and 5743 tests passed (before: 232 and 5679). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a `<progress max="abc">` gave exit code 1 and named the page; a `<progress max="10" value="11">` gave exit code 0 and a warning.
- Added: `site/scripts/range-check-lib.mjs`, `site/tests/unit/range-check.test.ts`, `tasks/open/T-0143.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.145), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.144 (2026-11-19): Wrong number attributes are kept out by the build (POLISH, Phase 3c Part 8ar)

**What changed**
- New `site/scripts/number-check-lib.mjs` with one plain function, `checkNumbers(html)`. It reads the `img`, `video`, `canvas`, `td`, `th`, `col`, `colgroup`, `ol`, `li`, `textarea`, `input` and `select` tags of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a `width` or `height` of an `<img>`, `<video>` or `<canvas>` that is not a number at all (`auto`, `abc`, `-5`; an empty value is left to `img-check-lib.mjs`); a `colspan` or `rowspan` of a `<td>` or `<th>`, a `span` of a `<col>` or `<colgroup>`, `rows` or `cols` of a `<textarea>` and `size` of an `<input>` or `<select>` that is not a whole number (`abc`, `2.5`, `-1`, empty); a `start` of an `<ol>` and a `value` of an `<li>` that is not a whole number (a negative number is fine).
- Warnings, printed only: a `width` or `height` written as `640px`, `100%` or `640.5`; a `colspan` of 0 or above 1000; a `rowspan` above 65534 (0 is real: to the end of the group); a `span` of 0 or above 1000; `rows`, `cols` or `size` of 0.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value; the `width` and `height` of an `<iframe>` (a percentage is common there); tags that are not in the list; names that only start with a listed word (`imgs`, `tdx`, `olist`); text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/number-check.test.ts` (56 cases, with a fake dist folder run of the real gate and a read of the base layout and the post card).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 232 files and 5679 tests passed (before: 231 and 5623). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a picture with `width="auto"` and a `<td colspan="abc">` each gave exit code 1; a picture with `width="100%"` gave exit code 0 and a warning.
- Added: `site/scripts/number-check-lib.mjs`, `site/tests/unit/number-check.test.ts`, `tasks/open/T-0142.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.144), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.143 (2026-11-19): Broken picture and source tags are kept out by the build (POLISH, Phase 3c Part 8aq)

**What changed**
- New `site/scripts/picture-check-lib.mjs` with one plain function, `checkPicture(html)`. It reads the `picture`, `source` and `img` tags of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a `<picture>` with no `<img>`; a `<picture>` with more than one `<img>`; a `<source>` after the `<img>` inside a `<picture>` (the browser ignores it); a `<source>` inside a `<picture>` with no `srcset` or an empty one (a `src` is not read there, and the message says so).
- Warnings, printed only: a `<source>` with neither `type` nor `media` (the browser always picks it, so the sources after it and the `<img>` are never used); a `<source type>` that is not an image type; a `<source media>` that is empty.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value; a `<source>` inside `<video>` or `<audio>` or on its own; an `<img>` outside a `<picture>`; a `<picture>` that is never closed; names that only start with a listed word (`picture-box`, `sources`); text inside comments, script, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/picture-check.test.ts` (40 cases, with a fake dist folder run of the real gate and a read of the base layout and the post card). The first run failed because the new line in `validate-html.mjs` reused the name `pics`; it was renamed `pictr`.
- Nothing changes on the site by itself: the site writes `<img srcset>` and no `<picture>`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 231 files and 5623 tests passed (before: 230 and 5583). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a picture with no img and a source after the img each gave exit code 1; a source with neither type nor media gave exit code 0 and a warning.
- Added: `site/scripts/picture-check-lib.mjs`, `site/tests/unit/picture-check.test.ts`, `tasks/open/T-0141.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.143), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.142 (2026-11-19): Inline SVG pictures are checked by the build (POLISH, Phase 3c Part 8ap)

**What changed**
- New `site/scripts/svg-check-lib.mjs` with one plain function, `checkSvg(html)`. It reads the `svg`, `use`, `image`, `foreignObject`, `script` and `title` tags of one built page in one pass; comments, style and `<template>` blocks are skipped, and only the outer `<svg>` of a nested group is judged.
- Errors, which stop the build: a `<script>` inside an `<svg>`; a `<use>` or `<image>` inside an `<svg>` whose `href` or `xlink:href` starts with `http://`; an `<svg role="img">` (or `role="graphics-document"`) with no name (no `aria-label`, no `aria-labelledby`, no `<title>` with text) that is not `aria-hidden`.
- Warnings, printed only: an `<svg>` with no role, no name and no `aria-hidden`; an `<svg aria-hidden="true">` that still has a name; an `<svg>` with a width or height and no `viewBox`; a `<foreignObject>`; a `<use href="#name">` that points to an id the page does not have.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value; a `<title>` outside an `<svg>` (the page title); a `<use>` to another file; an `<svg>` with width or height 0 and no `viewBox`; names that only start with a listed word (`svg-icon`, `user`, `imagemap`); text inside comments, style and template.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/svg-check.test.ts` (57 cases, with a fake dist folder run of the real gate and a read of the icon component and the base layout).
- Nothing changes on the site by itself: the icon of this site already has `aria-hidden="true"` and a `viewBox`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 230 files and 5583 tests passed (before: 229 and 5526). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a `<script>` inside an svg and an `<svg role="img">` with no name each gave exit code 1; an svg with no name and no `aria-hidden` gave exit code 0 and a warning.
- Added: `site/scripts/svg-check-lib.mjs`, `site/tests/unit/svg-check.test.ts`, `tasks/open/T-0140.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.142), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.141 (2026-11-19): Flash and objects from http:// are kept out by the build (POLISH, Phase 3c Part 8ao)

**What changed**
- New `site/scripts/object-check-lib.mjs` with one plain function, `checkObjects(html)`. It reads the `object`, `embed` and `param` tags of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: an `<object>` or `<embed>` that loads Flash (type `application/x-shockwave-flash`, an address that ends in `.swf`, an `<object classid>`); a `<param name="movie">` or a `<param>` whose value ends in `.swf`; an `<object data>` or `<embed src>` that starts with `http://`.
- Warnings, printed only: any other `<object>` or `<embed>`, because `public/_headers` says `object-src 'none'`. It is kept back on a page that already has a Flash error, so the owner fixes the Flash first.
- Left out on purpose, so there is no false alarm: the case of a tag, an attribute and a value; an address with a query or a hash after `.swf` is still read; names that only start with a listed word (`object-box`, `embedded`, `params`); text inside comments, script, style and template; pictures, video, audio and iframes (other checks read them).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- New test: `site/tests/unit/object-check.test.ts` (39 cases, with a fake dist folder run of the real gate and a read of the base layout). One first test of an old Blogger player expected no warning; the library gave one for the outer `<object>`, and the library was changed (the warning is kept back next to a Flash error), not the test.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 229 files and 5526 tests passed (before: 228 and 5487). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a Flash `<embed>`, a Flash `<object>` and an `<object>` from `http://` each gave exit code 1 and `Validation failed`; a PDF `<embed>` gave exit code 0 and a warning.
- Added: `site/scripts/object-check-lib.mjs`, `site/tests/unit/object-check.test.ts`, `tasks/open/T-0139.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.141), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.140 (2026-11-19): A wrong character set, a page refresh with a delay and a base from http:// are kept out by the build (POLISH, Phase 3c Part 8an)

**What changed**
- New `site/scripts/meta-check-lib.mjs` with one plain function, `checkMeta(html)`. It reads the `meta` and `base` tags of one built page in one pass; comments, script, style and `<template>` blocks are skipped.
- Errors, which stop the build: a character set other than UTF-8 (in `<meta charset>` or in `http-equiv="content-type"`); a `<meta http-equiv="refresh">` with a delay over 0 seconds; a `<base href>` that starts with `http://`; more than one `<base>`.
- Warnings, printed only: a refresh of 0 seconds to an address (a real 301 in `config/redirects.json` is faster and keeps the search ranking); a `<base>` with no href and no target; a character set declared more than once; a `<meta charset>` that starts after the first 1024 bytes.
- Left out on purpose, so there is no false alarm: a page with no character set at all; other `http-equiv` values; a refresh whose content is not a number; the case of a tag, an attribute and a value; names that only start with a listed word (`meta-box`, `baseline`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- One rule of my first version was removed before it shipped: it warned about a page with no character set, and the older test `head-check.test.ts` builds fake pages with none and expects no warning. I did not change the older test.
- New test: `site/tests/unit/meta-check.test.ts` (46 cases, with a fake dist folder run of the real gate and a read of the base layout).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 228 files and 5487 tests passed (before: 227 and 5441). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a content-type with `iso-8859-1`, a refresh with 5 seconds and a base from `http://` each gave exit code 1 and `Validation failed`; a refresh of 0 seconds gave exit code 0 and a warning.
- Added: `site/scripts/meta-check-lib.mjs`, `site/tests/unit/meta-check.test.ts`, `tasks/open/T-0138.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.140), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.139 (2026-11-19): A script or style sheet cannot load from http:// and no script has an empty src, kept by the build (POLISH, Phase 3c Part 8am)

**What changed**
- New `site/scripts/script-check-lib.mjs` with one plain function, `checkScripts(html)`. It reads the `script` and `link` tags of one built page in one pass; comments and `<template>` blocks are skipped.
- Errors, which stop the build: a `<script src>` that starts with `http://`; a `<script>` with an empty `src` (it never runs); a `<link rel="stylesheet">` whose `href` starts with `http://`.
- Warnings, printed only: a `<script src>` that also holds text of its own (the browser ignores it); `async` or `defer` on a classic script with no `src` (both are ignored); `nomodule` on a `type="module"` script (a modern browser never runs it); the same classic script `src` loaded twice on one page; `document.write(` in an inline script.
- Left out on purpose, so there is no false alarm: `async` with `defer` on one script; JSON and data blocks (`application/ld+json`, `importmap`, `speculationrules`); a `rel` that is not `stylesheet`; relative and protocol-relative addresses; scripts from another website; the case of a tag, a type and a rel; names that only start with a listed word (`script-box`, `linkbar`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page and its first comment line names the new check.
- One rule of my first version was wrong and was removed before it shipped: it warned about `async` with `defer`. The real contact page writes both in the Cloudflare Turnstile snippet, so the real build showed a new warning. Now a test keeps that snippet passing.
- New test: `site/tests/unit/script-check.test.ts` (56 cases, with a fake dist folder run of the real gate and a read of the base layout).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 227 files and 5441 tests passed (before: 226 and 5385). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a script from `http://`, a style sheet from `http://` and a script with an empty `src` each gave exit code 1 and `Validation failed`; `document.write(` gave exit code 0 and a warning.
- Added: `site/scripts/script-check-lib.mjs`, `site/tests/unit/script-check.test.ts`, `tasks/open/T-0137.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.139), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.138 (2026-11-19): A form cannot send a password in the address or send to http://, kept by the build (POLISH, Phase 3c Part 8al)

**What changed**
- New `site/scripts/form-behavior-check-lib.mjs` with one plain function, `checkFormBehavior(html)`. It reads the `form`, `input`, `select`, `textarea` and `option` tags of one built page in one pass and remembers the open form (its method, enctype, field names and radio groups).
- Errors, which stop the build: a `<form>` whose `action` starts with `http://`; a password field in a form that sends with GET (the default when there is no method; `method="dialog"` sends nothing and is left alone).
- Warnings, printed only: a file field in a form that is not `method="post"` with `enctype="multipart/form-data"`; an `<input>` (not submit, button, reset or image), `<select>` or `<textarea>` with no name inside a form; two fields of one form with the same name; a radio button that is alone in its name; a `<select>` with no `<option>`.
- Left out on purpose, so there is no false alarm: fields outside any form; a disabled field; radio buttons, check boxes and names that end with `[]` sharing a name; a form with no action; the case of a tag, a method, a type and an enctype; text inside script, style, template and comments; names that only start with a listed word (`form-box`, `inputs`, `selection`, `optionbar`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/form-behavior-check.test.ts` (59 cases, with a fake dist folder run of the real gate and a read of five real templates: the contact form, the push prompt, the base layout, the search page and the notifications page). One first test of mine put a `<select>` with no option outside a form and expected no message; the check was right (a select with no option is reported anywhere) and the test was fixed.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 226 files and 5385 tests passed (before: 225 and 5326). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a password field in a form with no method and a form that sends to `http://x.org/` each gave exit code 1 and `Validation failed`; an `<input>` with no name inside a form gave exit code 0 and a warning.
- Added: `site/scripts/form-behavior-check-lib.mjs`, `site/tests/unit/form-behavior-check.test.ts`, `tasks/open/T-0136.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.138), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.137 (2026-11-19): No block tag sits inside a paragraph, kept by the build (POLISH, Phase 3c Part 8ak)

**What changed**
- New `site/scripts/paragraph-check-lib.mjs` with one plain function, `checkParagraphs(html)`. It keeps a small stack of the open tags of one built page and follows the browser rule: a block tag closes an open `<p>` (a button, a table cell, a table and an earlier list item stop the search), and the next `<p>` closes the one before it. The inside of `code`, `kbd`, `samp`, `textarea`, `xmp` and `pre` is not read, but the `<pre>` tag itself still counts as a block.
- Errors, which stop the build: a `div`, `ul`, `ol`, `dl`, `table`, `h1` to `h6`, `figure`, `blockquote`, `pre`, `form`, `hr`, `fieldset`, `details`, `address`, `section`, `article`, `aside`, `header`, `footer`, `nav` or `main` opened while a `<p>` is still open.
- Warnings, printed only: a block tag or a `<p>` directly inside an inline tag (`span`, `b`, `i`, `em`, `strong`, `u`, `s`, `small`, `abbr`, `cite`, `q`, `sub`, `sup`, `mark`, `label`, `var`, `time`) or directly inside a heading.
- Left out on purpose, so there is no false alarm: text inside script, style, template, svg, math and comments; a `<p>` closed by the next `<p>`; a block inside a link or a button that is not itself inside a `<p>`; a `<p>` left open in an earlier list item; closing tags with no opening tag; the case of a tag; names that only start with a listed word (`para-box`, `spanner`, `table-of-contents`, `divider`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/paragraph-check.test.ts` (56 cases, with a fake dist folder run of the real gate and a read of the real base layout `Base.astro` and ten real components). A first draft cut the whole `<pre>` out before reading, so a `<pre>` inside a `<p>` was missed; the test found it and it was fixed.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 225 files and 5326 tests passed (before: 224 and 5270). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a `<div>` inside a `<p>` and a `<ul>` inside a `<p>` each gave exit code 1 and `Validation failed`; a `<div>` directly inside a `<span>` gave exit code 0 and a warning.
- Added: `site/scripts/paragraph-check-lib.mjs`, `site/tests/unit/paragraph-check.test.ts`, `tasks/open/T-0135.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.137), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.136 (2026-11-19): List items, figure captions and options stay inside their parent tag, kept by the build (POLISH, Phase 3c Part 8aj)

**What changed**
- New `site/scripts/parent-check-lib.mjs` with one plain function, `checkParents(html)`. It keeps a small stack of the open tags of one built page and looks at the direct parent of ten tags. The end tags HTML lets a writer leave out (`</li>`, `</dt>`, `</dd>`, `</option>`) are understood: the next item closes the one before it.
- Errors, which stop the build: an `<li>` whose parent is not `<ul>`, `<ol>` or `<menu>`; a `<dt>` or `<dd>` whose parent is not `<dl>` (or a `<div>` inside a `<dl>`); an `<option>` whose parent is not `<select>`, `<datalist>` or `<optgroup>`; an `<optgroup>` whose parent is not `<select>`; a `<figcaption>` outside `<figure>`; a `<legend>` outside `<fieldset>`; a `<summary>` outside `<details>`; a `<source>` outside `<picture>`, `<video>` and `<audio>`; a `<track>` outside `<video>` and `<audio>`.
- Warnings, printed only: a `<ul>`, `<ol>` or `<menu>` with a direct child that is not `<li>`; a `<dl>` with a direct child that is not `<dt>`, `<dd>` or `<div>`; a `<details>` with no `<summary>`; a `<fieldset>` with no `<legend>`.
- Left out on purpose, so there is no false alarm: text inside script, style, template, svg, math, pre, code, kbd, samp, textarea, xmp and comments; closing tags with no opening tag; the case of a tag; names that only start with a listed word (`link`, `listing-box`, `optionbar`, `summaryline`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/parent-check.test.ts` (53 cases, with a fake dist folder run of the real gate and a read of the real base layout `Base.astro` and seven real components).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 224 files and 5270 tests passed (before: 223 and 5217). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a loose `<li>` and a loose `<figcaption>` each gave exit code 1 and `Validation failed`; a `<ul>` with a direct `<div>` gave exit code 0 and a warning.
- Added: `site/scripts/parent-check-lib.mjs`, `site/tests/unit/parent-check.test.ts`, `tasks/open/T-0134.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.136), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.135 (2026-11-19): No character is escaped twice and no number points to a character that does not exist, kept by the build (POLISH, Phase 3c Part 8ai)

**What changed**
- New `site/scripts/entity-check-lib.mjs` with one plain function, `checkEntities(html)`. It reads the character references of one built page (`&amp;`, `&nbsp;`, `&#8217;`). The text of the page is read for the double escape and the missing semicolon; the whole page, attributes included, is read for the numbers.
- Errors, which stop the build: in the text, a common reference escaped twice (`&amp;amp;`, `&amp;nbsp;`, `&amp;quot;`, `&amp;#8217;`, `&amp;#x2019;`); anywhere, a numeric reference with no number (`&#;`, `&#x;`), equal to 0, in the surrogate range D800 to DFFF, or above 10FFFF.
- Warnings, printed only: in the text, a common name with no semicolon (`&nbsp`, `&mdash`, `&copy`); a numeric reference to a control character or an old Windows code (1 to 8, 11, 14 to 31, 127 to 159, for example `&#146;`).
- Left out on purpose, so there is no false alarm: text inside `pre`, `code`, `kbd`, `samp`, `textarea` and `xmp` (a code sample that shows `&amp;` is written `&amp;amp;`); text inside script, style, template and comments; a name with no semicolon inside an attribute value such as a web address (`?a=1&copy=2`); a lone ampersand (`R&D`); `&#top` in a web address; a name that is not in the list of about 50 common names; names followed by letters or an equals sign.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/entity-check.test.ts` (46 cases, with a fake dist folder run of the real gate and a read of the real base layout `Base.astro`). A first draft of the number pattern would have flagged `&#top` in a web address; it was fixed before the test run and has its own case.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 223 files and 5217 tests passed (before: 222 and 5171). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `&amp;amp;` and `&#0;` each gave exit code 1 and `Validation failed`; `&nbsp` with no semicolon and `&#146;` each gave exit code 0 and a warning.
- Added: `site/scripts/entity-check-lib.mjs`, `site/tests/unit/entity-check.test.ts`, `tasks/open/T-0133.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.135), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.134 (2026-11-19): No link sits in a link, no button in a button, no form in a form, kept by the build (POLISH, Phase 3c Part 8ah)

**What changed**
- New `site/scripts/nest-check-lib.mjs` with one plain function, `checkNesting(html)`. It counts the opening and closing `a`, `button` and `form` tags of one built page and reads `input`, `select` and `textarea` (text inside script, style, template, svg, math and comments is ignored).
- Errors, which stop the build: an `<a>` inside an `<a>`; a `<button>` inside a `<button>`; a `<form>` inside a `<form>`.
- Warnings, printed only: a `<button>` inside a link; a link inside a `<button>`; an `<input>` (not hidden), `<select>` or `<textarea>` inside a link or a `<button>`.
- Left out on purpose, so there is no false alarm: everything inside svg and math; a hidden input; a closing tag with no opening tag; the case of a tag; names that only start with a listed word (`abbr`, `article`, `button-group`, `formula-box`, `input-box`); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/nest-check.test.ts` (41 cases, with a fake dist folder run of the real gate and a read of the real base layout `Base.astro`). The first draft of one case put a real button inside a link by mistake; the check was right and the test was fixed.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 222 files and 5171 tests passed (before: 221 and 5130). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a link in a link, a button in a button and a form in a form each gave exit code 1 and `Validation failed`; a button in a link gave exit code 0 and a warning.
- Added: `site/scripts/nest-check-lib.mjs`, `site/tests/unit/nest-check.test.ts`, `tasks/open/T-0132.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.134), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.133 (2026-11-19): No tag repeats an attribute and no dropped HTML tag is used, kept by the build (POLISH, Phase 3c Part 8ag)

**What changed**
- New `site/scripts/tag-check-lib.mjs` with one plain function, `checkTags(html)`. It reads every opening tag of one built page (text inside script, style, template, svg, math and comments is ignored).
- Errors, which stop the build: a tag that has the same attribute twice (the case of the name does not matter; the browser keeps the first and ignores the rest); a tag HTML has dropped: marquee, blink, frame, frameset, noframes, applet, bgsound, isindex, plaintext, xmp, listing, keygen, menuitem, noembed, spacer, command, nextid.
- Warnings, printed only: an old presentation tag (center, font, big, strike, tt, acronym, nobr, basefont, dir, rb, rtc); an old presentation attribute (align, valign, bgcolor, cellpadding, cellspacing, hspace, vspace).
- Left out on purpose, so there is no false alarm: everything inside svg and math; custom elements with a hyphen in the name; names that only end with a listed word (`data-align`); the case of a tag or an attribute; closing tags; text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/tag-check.test.ts` (44 cases, with a fake dist folder run of the real gate and a read of the real base layout `Base.astro`). The other Astro templates are not read: they hold `{...}` expressions that are not plain HTML and would give false alarms (the first draft of the test did read `Header.astro` and proved this).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 221 files and 5130 tests passed (before: 220 and 5086). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a repeated `class` and a `<marquee>` made the gate print `Validation failed`; a `<center>` passed and printed a warning.
- Added: `site/scripts/tag-check-lib.mjs`, `site/tests/unit/tag-check.test.ts`, `tasks/open/T-0131.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.133), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.132 (2026-11-19): The srcset and sizes of every picture can be read by a browser, kept by the build (POLISH, Phase 3c Part 8af)

**What changed**
- New `site/scripts/srcset-check-lib.mjs` with one plain function, `checkSrcset(html)`. It reads every `img` and `source` tag of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an empty `srcset`; a candidate whose descriptor is not a whole number plus `w` or a positive number plus `x` (`400px`, `400`, `0w`, `-1x`), or that has two descriptors; a srcset that mixes `w` and `x` (a plain address counts as `1x`); the same descriptor twice (`400w` and `400w`, `2x` and `2.0x`); a candidate address on `http://`; an empty `sizes`; a `sizes` whose last item is not a length (`100%`, `full`, `100`) or whose other items are not a media condition in brackets followed by a length.
- Warnings, printed only: a srcset with `w` descriptors and no `sizes` (the browser assumes the picture fills the screen); a `sizes` with no srcset, or with a srcset of `x` descriptors only (it does nothing).
- Left out on purpose, so there is no false alarm: a srcset with one plain address; `sizes="auto"`; the case of a value; a comma inside an address when no space follows it; `calc()`, `min()`, `max()` and `clamp()` as a length; text inside script, style, template and comments; the `imagesrcset` of a `<link>` (the tag is read by `rel-check-lib.mjs`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/srcset-check.test.ts` (46 cases, with a fake dist folder run of the real gate; it also reads the four real `SIZES` strings of `src/lib/picture-set.ts`).
- Nothing changes on the site by itself: no real story page exists yet, and the real `SIZES` strings pass, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 220 files and 5086 tests passed (before: 219 and 5040). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `sizes="100%"` made the gate fail with exit code 1; a srcset that mixes `400w` and `2x` also failed; a `w` srcset with no `sizes` passed with exit code 0 and printed a warning.
- Added: `site/scripts/srcset-check-lib.mjs`, `site/tests/unit/srcset-check.test.ts`, `tasks/open/T-0130.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.132), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.131 (2026-11-19): The input hints and the global fixed-choice attributes of every page are real, kept by the build (POLISH, Phase 3c Part 8ae)

**What changed**
- New `site/scripts/input-hints-lib.mjs` with one plain function, `checkInputHints(html)`. It reads every tag of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an `autocomplete` (on `input`, `select`, `textarea`, `form`) with a word that is not `on`, `off`, a real field name (`name`, `given-name`, `email`, `tel`, `postal-code`, `current-password` and the rest of the standard list), a real modifier (`shipping`, `billing`, `home`, `work`, `mobile`, `fax`, `pager`, `section-x`) or an empty value, or `on` or `off` joined with another word; an `inputmode` (none, text, tel, url, email, numeric, decimal, search), `enterkeyhint` (enter, done, go, next, previous, search, send) or `autocapitalize` (off, none, on, sentences, words, characters) that is not real; a `spellcheck` (true, false, or empty), `translate` (yes, no, or empty), `contenteditable` (true, false, plaintext-only, or empty) or `draggable` (true or false) that is not real; a `wrap` on a `<textarea>` that is not hard, soft or off.
- Warnings, printed only: `autocomplete="off"` on a password field, because a password manager cannot fill it.
- Left out on purpose, so there is no false alarm: the case of a value (`TRUE` is read as `true`); `autocomplete` on a tag that does not use it and `wrap` on any tag but a textarea; names that only end with these words (`data-inputmode`, `aria-autocomplete`); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/input-hints.test.ts` (45 cases, with a fake dist folder run of the real gate and a read of the real contact form and notifications page).
- Nothing changes on the site by itself: the real pages use `autocomplete` with `name`, `email` and `off`, and `autocapitalize="none"` and `spellcheck="false"`, all real, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 219 files and 5040 tests passed (before: 218 and 4995). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `autocomplete="firstname"` made the gate fail with exit code 1; `inputmode="number"` also failed; a password field with `autocomplete="off"` passed with exit code 0 and printed a warning.
- Added: `site/scripts/input-hints-lib.mjs`, `site/tests/unit/input-hints.test.ts`, `tasks/open/T-0129.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.131), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.130 (2026-11-19): The rel words and the preload hints of every page are real, kept by the build (POLISH, Phase 3c Part 8ad)

**What changed**
- New `site/scripts/rel-check-lib.mjs` with one plain function, `checkRel(html)`. It reads every `a`, `area` and `link` tag of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `rel` word that is almost, but not exactly, a real word (`noopner`, `noreferer`, `nofolow`, `sponsered`, `stylesheeet`, `prelaod`, `licence`), found by an edit distance of 1 for short words and 2 for long ones, where a swap of two neighbouring letters counts as one change; an empty `rel` on a `<link>`; a `<link>` with `rel` stylesheet, icon, manifest, preload, preconnect, dns-prefetch, prefetch, modulepreload or alternate and no `href` (a preload with `imagesrcset` needs none); a `preload` with no `as` or an empty one; an `as` on a `preload` or `modulepreload` that is not one of the twelve real destinations.
- Warnings, printed only: a font preload with no `crossorigin` (the browser fetches the font twice); `rel="opener"` on a link; a rel word that only works on a `<link>` tag (stylesheet, preload, icon, manifest, canonical, ...) written on an `a` or `area` tag.
- Left out on purpose, so there is no false alarm: a rel word that is not near any real word (the list is open: `apple-touch-icon`, `webmention`, `x-custom` pass); words shorter than 4 letters; the case of a word; the canonical link (`head-check-lib.mjs` reads it); a `modulepreload` with no `as` (script is the default); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/rel-check.test.ts` (45 cases, with a fake dist folder run of the real gate and a read of the real base layout, header and footer).
- Nothing changes on the site by itself: today's head links are canonical, icon, apple-touch-icon, manifest and alternate, all real with an `href`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 218 files and 4995 tests passed (before: 217 and 4950). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `rel="noopner"` made the gate fail with exit code 1; a `preload` with no `as` also failed; a font preload with no `crossorigin` and `rel="opener noopener"` passed with exit code 0 and printed a warning.
- Added: `site/scripts/rel-check-lib.mjs`, `site/tests/unit/rel-check.test.ts`, `tasks/open/T-0128.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.130), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.129 (2026-11-19): The fixed-choice attributes of every page hold a real value, kept by the build (POLISH, Phase 3c Part 8ac)

**What changed**
- New `site/scripts/attr-values-lib.mjs` with one plain function, `checkAttrValues(html)`. It reads every tag of one built page (text inside script, style, template and comments is ignored; the opening tag of a script is still read).
- Errors, which stop the build, a value that is not one of the real choices, on these tags only: `loading` (`img`, `iframe`: lazy, eager); `decoding` (`img`: async, sync, auto); `fetchpriority` (`img`, `link`, `script`, `iframe`: high, low, auto); `referrerpolicy` (`a`, `area`, `img`, `iframe`, `link`, `script`: the eight policies); `crossorigin` (`img`, `script`, `link`, `audio`, `video`: anonymous, use-credentials, or empty); `method` (`form`: get, post, dialog); `enctype` (`form`: the three encodings); `type` (`ol`: 1, a, A, i, I).
- Warnings, printed only: `referrerpolicy="unsafe-url"`, which sends the full address of the page to every other site.
- Left out on purpose, so there is no false alarm: the case of a value (`LAZY` is read as `lazy`; the type of an `ol` is the one place where case counts); an empty `referrerpolicy` or `crossorigin` (both mean the default); the same attribute names on other tags (`type` on an input, `method` on a div); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/attr-values.test.ts` (30 cases, with a fake dist folder run of the real gate and a read of the home page, story page, header and post card templates).
- Found and fixed while testing: the first version dropped the whole `<script>` element before reading, so the attributes of a script tag were never read. Now only the text inside is dropped and the opening tag is kept.
- Nothing changes on the site by itself: the real values are `fetchpriority="high"`, `decoding="async"` and `loading` lazy or eager, so today's build ends with `Validation passed.` and prints no new message. A hand written picture or form was not read on a real built story page (no real post exists); that pattern is proved by the tests.
- Test run on the whole project: 217 files and 4950 tests passed (before: 216 and 4920). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<img loading="laz">` made the gate fail with exit code 1; `<form method="put">` also failed; `<a referrerpolicy="unsafe-url">` passed with exit code 0 and printed a warning.
- Added: `site/scripts/attr-values-lib.mjs`, `site/tests/unit/attr-values.test.ts`, `tasks/open/T-0127.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.129), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.128 (2026-11-19): The language code and text direction of every page are real, kept by the build (POLISH, Phase 3c Part 8ab)

**What changed**
- New `site/scripts/lang-check-lib.mjs` with two plain functions, `checkLang(html)` and `isValidLang(value)`. It reads every tag of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `lang` or `xml:lang` that is not a language code (`english`, `en_US`, `e`); real codes are a 2 or 3 letter language with an optional script of 4 letters, a region of 2 letters or 3 digits and variants (`en`, `en-US`, `zh-Hant-TW`, `es-419`), and a private use code such as `x-news`; a `dir` that is not `ltr`, `rtl` or `auto`, which a browser ignores.
- Warnings, printed only: a tag that has both `lang` and `xml:lang` and they name different languages.
- Left out on purpose, so there is no false alarm: an empty `lang` on a tag other than `html` (it means language unknown); the empty `lang` of the `html` tag (`page-basics-lib.mjs` already reports it); `hreflang` and other names that only end with `lang`; the case of a value (`EN-us` is read as `en-US`); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/lang-check.test.ts` (31 cases, with a fake dist folder run of the real gate and a read of the real base layout).
- Nothing changes on the site by itself: the only language value of the built pages is `<html lang="en">`, so today's build ends with `Validation passed.` and prints no new message. A hand written quotation with its own `lang` was not read on a real built story page (no real post exists); that pattern is proved by the tests.
- Test run on the whole project: 216 files and 4920 tests passed (before: 215 and 4889). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<html lang="english">` made the gate fail with exit code 1; `<q lang="en_US">` also failed; `<p dir="left">` also failed; `<p lang="en" xml:lang="fr">` passed with exit code 0 and printed a warning.
- Added: `site/scripts/lang-check-lib.mjs`, `site/tests/unit/lang-check.test.ts`, `tasks/open/T-0126.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.128), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.127 (2026-11-19): The type of every input and button is real, kept by the build (POLISH, Phase 3c Part 8aa)

**What changed**
- New `site/scripts/form-controls-lib.mjs` with one plain function, `checkFormControls(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an `<input>` whose `type` is empty or is not a real input type (a typo such as `emial`); a `<button>` whose `type` is empty or is not `submit`, `reset` or `button` (a typo such as `sumbit`); a `maxlength` or `minlength` on an `<input>` or `<textarea>` that is not a whole number (`abc`, `1.5`, `-1`, empty), which a browser ignores without a word.
- Warnings, printed only: a `<button>` inside a `<form>` with no `type`, because it submits the form.
- Left out on purpose, so there is no false alarm: an `<input>` with no `type` (it is a text box by the HTML rule); a `<button>` with no `type` outside a form; the case of a value (`Submit` and `submit` are the same); text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed except its first comment line.
- New test: `site/tests/unit/form-controls.test.ts` (32 cases, with a fake dist folder run of the real gate and a read of the contact form, the notifications page, the header and the push prompt).
- Nothing changes on the site by itself: every real `<input>` and `<button>` of the templates already has a real type, so today's build ends with `Validation passed.` and prints no new message. Today's real build has no form on a built page (the contact form is hidden, and no real post exists), so the pattern is proved by the test and by the template source, not by a real built form.
- Test run on the whole project: 215 files and 4889 tests passed (before: 214 and 4857). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<input type="emial">` in `dist/index.html` made the gate fail with exit code 1; `<button type="sumbit">` also failed; `<form><button>Send</button></form>` passed with exit code 0 and printed a warning.
- Added: `site/scripts/form-controls-lib.mjs`, `site/tests/unit/form-controls.test.ts`, `tasks/open/T-0125.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.127), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.126 (2026-11-19): Every date and time of a page is one a machine can read, kept by the build (POLISH, Phase 3c Part 8z)

**What changed**
- New `site/scripts/time-check-lib.mjs` with two plain functions, `checkTimes(html)` and `isValidDatetime(value)`. It reads the `<time>` tags of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `datetime` that is empty or is not a real value. Real values are a year with 4 digits, a month, a date, a yearless date (`11-19`), a week (`2026-W47`), a time, a local date and time, a date and time with an offset (`Z` or `+05:30`), an offset alone and a duration (`PT1H30M`). A date that does not exist (`2026-02-30`, `2026-13-01`), a time that does not exist (`24:00`) and a typed order such as `19/11/2026` are errors. The week 53 and the leap day are checked against the real calendar.
- Warnings, printed only: a `<time>` with no `datetime` whose own text is not a real value (for example `November 19, 2026`), so a machine cannot read it.
- Left out on purpose, so there is no false alarm: a `<time>` with no `datetime` and no text of its own (it holds other tags); the text of a `<time>` that has a `datetime`; text inside script, style, template and comments.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/time-check.test.ts` (31 cases, with a fake dist folder run of the real gate and a read of the real story template).
- Nothing changes on the site by itself: the story template writes `datetime` with `toISOString()`, which is a real value. Today's real build has no `<time>` at all, because its only post is a draft and no story page is built, so today's build ends with `Validation passed.` and prints no new message. The story page pattern is proved by the test, not by a real built story page.
- Test run on the whole project: 214 files and 4857 tests passed (before: 213 and 4826). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<time datetime="2026-02-30">` in `dist/index.html` made the gate fail with exit code 1; `<time datetime="19/11/2026">` also failed; `<time>November 19, 2026</time>` passed with exit code 0 and printed a warning.
- Added: `site/scripts/time-check-lib.mjs`, `site/tests/unit/time-check.test.ts`, `tasks/open/T-0124.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.126), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.125 (2026-11-19): The Tab key order of a page stays natural, kept by the build (POLISH, Phase 3c Part 8y)

**What changed**
- New `site/scripts/tabindex-check-lib.mjs` with one plain function, `checkTabindex(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `tabindex` that is not a whole number (empty, `abc`, `1.5`); a `tabindex` above 0, which jumps ahead of everything else and breaks the order of the Tab key.
- Warnings, printed only: an `accesskey` (it clashes with the shortcuts of browsers and screen readers); an `onclick` on a plain tag (`div`, `span`, `p`, `li`, `img`, `section` and the like) that has no role, because a keyboard cannot use it.
- Left out on purpose, so there is no false alarm: `tabindex="0"` and `tabindex="-1"` on any tag (a skip link target, a scrollable box and the contact form honeypot use them); an `onclick` on a link, button or field or on a tag with a role; an empty `accesskey`; a click handler set inside a script (the theme buttons in `Base.astro`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/tabindex-check.test.ts` (25 cases, with a fake dist folder run of the real gate and a read of every `.astro` template). No other test changed.
- Nothing changes on the site by itself: today's only tabindex is the honeypot field with `-1`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 213 files and 4826 tests passed (before: 212 and 4801). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<a href="/x/" tabindex="3">` in `dist/index.html` made the gate fail with exit code 1; `<div tabindex="abc">` also failed; `<a accesskey="s">` passed with exit code 0 and printed a warning.
- Added: `site/scripts/tabindex-check-lib.mjs`, `site/tests/unit/tabindex-check.test.ts`, `tasks/open/T-0123.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.125), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.124 (2026-11-19): The ARIA words of a page are real and do not trap the keyboard, kept by the build (POLISH, Phase 3c Part 8x)

**What changed**
- New `site/scripts/aria-check-lib.mjs` with one plain function, `checkAria(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `role` that is not a real role (a typo such as `buton`, or an abstract role such as `widget`); an `aria-` attribute that does not exist (`aria-lable`); a wrong value where the list is fixed (`aria-hidden="yes"`, `aria-live="loud"`, `aria-pressed="on"`, `aria-level="0"` and the like); `aria-hidden="true"` on `body` or `html`; `aria-hidden="true"` on a link, button, field, summary, `tabindex` of 0 or more or editable box that the Tab key reaches.
- Warnings, printed only: `aria-hidden="true"` around a link, button or field that the Tab key reaches inside; an empty `aria-label`; `role="presentation"` or `none` on something the Tab key reaches; a role the tag already has (`nav` with `role="navigation"`, `button` with `role="button"`, `main`, `article`, `aside`, `h1` to `h6`).
- Left out on purpose, so there is no false alarm: a disabled control, an input of type hidden and anything with `tabindex="-1"` (nobody tabs to it, so the contact form honeypot box stays fine); `aria-hidden="false"`; roles that start with `doc-` or `graphics-`; a role with several words (one real word is enough, like the browser); an aria word inside another attribute value; the ids of `aria-labelledby`, `aria-controls` and `aria-describedby` (`ids-lib.mjs`, `link-names-lib.mjs`).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/aria-check.test.ts` (44 cases, with a fake dist folder run of the real gate and a read of the real templates). No other test changed.
- Nothing changes on the site by itself: today's built pages use only real names, real values and the honeypot with `tabindex="-1"`, so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 212 files and 4801 tests passed (before: 211 and 4757). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<a href="/x/" aria-hidden="true">` in `dist/index.html` made the gate fail with exit code 1; `<div role="buton">` also failed; `<div aria-label="">` passed with exit code 0 and printed a warning.
- Added: `site/scripts/aria-check-lib.mjs`, `site/tests/unit/aria-check.test.ts`, `tasks/open/T-0122.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.124), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.123 (2026-11-19): Every link address of a page is real and safe, kept by the build (POLISH, Phase 3c Part 8w)

**What changed**
- New `site/scripts/href-check-lib.mjs` with one plain function, `checkHrefs(html, ownHosts)`. It reads the `a` and `area` links of one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an empty `href`; an address that starts with `javascript:`, `vbscript:` or `file:`; a `mailto:` with no e-mail address; a `tel:` with fewer than 3 digits.
- Warnings, printed only: `href="#"`; a link on `http://` (the message says when it is our own site); a bare web address with no scheme such as `www.example.org`, which the browser reads as a page of this site; a link to `localhost`, `127.0.0.1` or `0.0.0.0`.
- Left out on purpose, so there is no false alarm: a link with no `href`; `link`, `base` and `script` tags; `#name` links (`ids-lib.mjs` reads them); relative links; `mailto:` with only a subject when it has `to=`.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page, with the same own-host list the picture check uses. Nothing else in it changed.
- New test: `site/tests/unit/href-check.test.ts` (32 cases, with a fake dist folder run of the real gate and a read of the real layout). No other test changed.
- Nothing changes on the site by itself: today's built pages have no empty, `#`, `javascript:` or `http://` link (the only mailto links carry a full address), so today's build ends with `Validation passed.` and prints no new message.
- Test run on the whole project: 211 files and 4757 tests passed (before: 210 and 4725). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `<a href="javascript:alert(1)">` in `dist/index.html` made the gate fail with exit code 1; `<a href="">` also failed; `<a href="#">` and `<a href="www.example.org">` passed with exit code 0 and printed warnings.
- Added: `site/scripts/href-check-lib.mjs`, `site/tests/unit/href-check.test.ts`, `tasks/open/T-0121.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.123), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.122 (2026-11-19): Every video and audio of a page can be controlled and does not start with sound, kept by the build (POLISH, Phase 3c Part 8v)

**What changed**
- New `site/scripts/media-check-lib.mjs` with one plain function, `checkMedia(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a video that plays by itself with sound (`autoplay` without `muted`); an audio with `autoplay` at all; a video or audio with no `controls` (except a silent, looping, autoplay video, which is a moving picture); a `src` or `source` on `http://`.
- Warnings, printed only: a video with no `track` of kind `captions` or `subtitles`; a video or audio with no `preload="metadata"` or `none`; a video with no `poster`; a video with no `width` and `height` (and no `aspect-ratio` in its style).
- Left out on purpose, so there is no false alarm: a hidden element; `amp-video` and `amp-audio` (other tags); media made by a script; a silent looping video needs no captions.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/media-check.test.ts` (38 cases, with a fake dist folder run of the real gate and a read of the real layout). No other test changed.
- Nothing changes on the site by itself: no built page has a video or an audio today, so today's build ends with `Validation passed.` and prints no new message. The check starts to matter when a post brings audio or video from its own files (PLAN 37).
- Test run on the whole project: 210 files and 4725 tests passed (before: 209 and 4687). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a video with `autoplay controls` in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: the video /a.mp4 plays by itself with sound; remove autoplay (or, for a silent video, add muted)`; a video with no controls also failed; a video with controls but no captions, poster, size or preload passed with exit code 0 and printed four warnings.
- Added: `site/scripts/media-check-lib.mjs`, `site/tests/unit/media-check.test.ts`, `tasks/open/T-0120.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.122), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.121 (2026-11-19): Every table of a page can be read by a screen reader, kept by the build (POLISH, Phase 3c Part 8u)

**What changed**
- New `site/scripts/table-check-lib.mjs` with one plain function, `checkTables(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a `th` or `td` with a `scope` that is not `col`, `row`, `colgroup` or `rowgroup`; a table marked `role="presentation"` or `role="none"` that still holds a `th` (the two say opposite things).
- Warnings, printed only: a table with no `th`; a table with no caption and no `aria-label`, `aria-labelledby` or `title`; a `th` with no text, no `aria-label` and no picture alt.
- Left out on purpose, so there is no false alarm: a layout table (`role="presentation"` or `none`) needs no header and no caption; a hidden table; a `th` that holds only a picture with alt text or an svg title; tables made by a script. A table inside a table is read as part of the outer one.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/table-check.test.ts` (35 cases, with a fake dist folder run of the real gate and a read of the real layout). No other test changed.
- Nothing changes on the site by itself: no public page has a table today (the only two tables of the build are in the dashboard tool `admin/blog-xml-tool.html`, which the gate does not read), so today's build ends with `Validation passed.` and prints no new message. The check starts to matter when a post brings a table (PLAN 37).
- Test run on the whole project: 209 files and 4687 tests passed (before: 208 and 4652). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): `scope="column"` in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: a <th> has scope="column"; scope is col, row, colgroup or rowgroup`; a `th` inside a `role="presentation"` table also failed; a table with no th and no caption passed with exit code 0 and printed two warnings.
- Added: `site/scripts/table-check-lib.mjs`, `site/tests/unit/table-check.test.ts`, `tasks/open/T-0119.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.121), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.120 (2026-11-19): Every frame (iframe) of a page has a name and a safe address, kept by the build (POLISH, Phase 3c Part 8t)

**What changed**
- New `site/scripts/iframe-check-lib.mjs` with one plain function, `checkIframes(html, ownHosts)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an `iframe` with no name (no `title`, no `aria-label` and no `aria-labelledby` with text); an `iframe` address on `http://`; an address that starts with `javascript:`, `data:` or `vbscript:`.
- Warnings, printed only: a vague name such as "iframe", "video" or "embed"; no `loading="lazy"`; no `width` and `height` (and no `aspect-ratio` in its style); an address with no scheme (`//host/...`); a frame from another website with no `sandbox`; no `src` and no `srcdoc`.
- Left out on purpose, so there is no false alarm: a hidden frame (`hidden`, `aria-hidden="true"`, role `presentation` or `none`); `about:blank` and `about:srcdoc`; `amp-iframe` (another tag); frames made by a script; frames from our own site (the `SITE_URL` host) need no `sandbox`.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page, with the same own-host list the picture check uses. Nothing else in it changed.
- New test: `site/tests/unit/iframe-check.test.ts` (44 cases, with a fake dist folder run of the real gate and a read of the real layout). No other test changed.
- Nothing changes on the site by itself: today's built pages have no iframe, so today's build ends with `Validation passed.` and prints no new message. The check starts to matter when a post brings an HTML block with an embed (PLAN 37).
- Proved on the real build, in throw away copies of `dist` (not in the ZIP): a frame with no title in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: an iframe (https://www.youtube-nocookie.com/embed/abc) has no name; add a title that says what is inside`; a frame on `http://` also failed; a named frame with no lazy loading, no size and no sandbox passed with exit code 0 and printed three warnings.
- Test run on the whole project: 208 files and 4652 tests passed (before: 207 and 4608). `npm run build` ended with `Validation passed.` (with `SITE_URL` set).
- Added: `site/scripts/iframe-check-lib.mjs`, `site/tests/unit/iframe-check.test.ts`, `tasks/open/T-0118.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.120), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.119 (2026-11-19): The ids of every page are clean, kept by the build (POLISH, Phase 3c Part 8s)

**What changed**
- New `site/scripts/ids-lib.mjs` with one plain function, `checkIds(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: an `id` that is empty or has a space in it; the same `id` on two or more elements of one page.
- Warnings, printed only: an in-page link (`href="#name"`) whose name is no `id` and no `a name` on the page; an `aria-controls` or `aria-describedby` that points to an id that is not on the page.
- Left out on purpose, so there is no false alarm: `href="#"` and `href="#top"`; links to other pages that end in a `#name`; `aria-labelledby` (`form-labels-lib.mjs` and `link-names-lib.mjs` read it); ids made by a script; percent-written names are matched to the id they stand for.
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/ids.test.ts` (30 cases, with a fake dist folder run of the real gate and a read of the real template). No other test changed.
- Nothing changes on the site by itself: today's 17 built pages (113 ids, 17 in-page links) give no message, and today's build ends with `Validation passed.`.
- Proved on the real build, in throw away copies: a second `id="main"` in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: the id "main" is used 2 times on one page; an id must be used once`; `<a href="#nowhere">` in `dist/404.html` passed and printed the warning.
- Added: `site/scripts/ids-lib.mjs`, `site/tests/unit/ids.test.ts`, `tasks/open/T-0117.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.119), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.118 (2026-11-19): Links that open a new tab are safe and say so, kept by the build (POLISH, Phase 3c Part 8r)

**What changed**
- New `site/scripts/new-tab-lib.mjs` with one plain function, `checkNewTabLinks(html)`. It reads one built page (text inside script, style, template and comments is ignored).
- Errors, which stop the build: a link (`a` or `area` with `href`) with a target that opens another tab or window (`_blank`, or any name that is not `_self`, `_parent` or `_top`) and a `rel` with neither `noopener` nor `noreferrer`; a `base` tag with such a target.
- Warnings, printed only: such a link whose text, `aria-label` and `title` never say "new tab" or "new window".
- Left out on purpose, so there is no false alarm: a link with no `href`; links that open in the same tab; links made by a script; other languages (the site is English).
- `site/scripts/validate-html.mjs` (the build gate) runs it on every built page. Nothing else in it changed.
- New test: `site/tests/unit/new-tab.test.ts` (35 cases, with a fake dist folder run of the real gate and a read of the real footer). No other test changed.
- Nothing changes on the site by itself: the three footer links that open a new tab already have `rel` with `noopener` and say "opens in a new tab"; today's build ends with `Validation passed.` and prints no new message.
- Proved on the real build, in throw away copies: `rel="noopener"` taken off the footer links of `dist/index.html` made the gate fail with the line `dist/index.html: the link to https://www.shivam-das-2.online/ opens a new tab but its rel has no noopener ...`; a safe link with no "new tab" words in `dist/404.html` passed and printed the warning.
- Added: `site/scripts/new-tab-lib.mjs`, `site/tests/unit/new-tab.test.ts`, `tasks/open/T-0116.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.118), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.117 (2026-11-19): A reader can always zoom, kept by the build (POLISH, Phase 3c Part 8q)

**What changed**
- New `site/scripts/zoom-check-lib.mjs` with two plain functions. `checkZoomHtml(html)` reads the viewport tag of one built page (text inside script, style, template and comments is ignored). `checkZoomCss(css)` reads the whole built style.
- Errors, which stop the build: the viewport has `user-scalable=no` (or `0` or `false`); the viewport has `maximum-scale` under 2; a rule on `html`, `body`, `:root`, `main` or `*` sets `touch-action` to `none`, or to `pan-x` and/or `pan-y` without `pinch-zoom`.
- Warnings, printed only: `maximum-scale` from 2 up to 5 (Lighthouse asks for 5 or no limit); `text-size-adjust: none` on `html`, `body`, `:root` or `*`.
- Left out on purpose, so there is no false alarm: a page with no viewport tag (`page-basics-lib.mjs` reports that); `minimum-scale`; `touch-action` on a small part such as a slider or a map; `touch-action: manipulation`, `auto` and `pinch-zoom` (they keep pinch zoom).
- `site/scripts/validate-html.mjs` (the build gate) runs both checks. Nothing else in it changed.
- New test: `site/tests/unit/zoom-check.test.ts` (41 cases, with a fake dist folder run of the real gate and a read of the real template and style). No other test changed.
- Nothing changes on the site by itself: today's viewport is `width=device-width, initial-scale=1, viewport-fit=cover`, the style has no `touch-action` and no `text-size-adjust`, and today's build ends with `Validation passed.` and prints no new message.
- Proved on the real build, in throw away copies: `user-scalable=no` in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: the viewport has user-scalable=no, ...`; `body{touch-action:none}` in `dist/404.html` made it fail with `dist: the rule "body" sets touch-action to none, ...`.
- Added: `site/scripts/zoom-check-lib.mjs`, `site/tests/unit/zoom-check.test.ts`, `tasks/open/T-0115.md`. Changed: `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json` (version 0.101.117), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.116 (2026-11-19): Nothing wider than a 320px phone screen, kept by the build (POLISH, Phase 3c Part 8p)

**What changed**
- New `site/scripts/side-scroll-lib.mjs` with two plain functions. `checkSideScrollCss(css, flags)` reads the whole built style; `checkSideScrollHtml(html)` reads one built page (text inside script, style, template and comments is ignored).
- Only rules that apply on a 320px screen are read: rules inside `@media print`, inside `@media (min-width: ...)` over 320px, and inside `@keyframes`, `@font-face` or `@page` are left out.
- Errors, which stop the build: a rule or an inline `style` sets `width`, `min-width`, `inline-size` or `min-inline-size` to a fixed length over 320px (px, rem or em, 1rem = 16px) with no cap (`max-width` of 100% or 320px or less, or `overflow` auto, scroll, hidden or clip on the same rule); a `width` attribute over 320 on a table, td, th, div, section, aside, pre or code.
- Warnings, printed only: width or min-width of `100vw`; `white-space: nowrap` or `pre` with no overflow, no ellipsis and no wrapping on the same rule; the pages have pictures, video or frames but no rule gives them `max-width: 100%`; the pages have `pre` blocks but no rule lets them scroll or wrap.
- Left out on purpose, so there is no false alarm: lengths made with `calc()`, `var()`, `clamp()`, `min()` or `max()`; percent and `vw` widths other than `100vw`; `max-width`; the `width` attribute of a picture or a frame (the picture rule covers them).
- `site/scripts/validate-html.mjs` (the build gate) runs both checks. Nothing else in it changed.
- `site/src/styles/global.css`: the first run on the real build gave one warning, for `.brand` (the site name had `white-space: nowrap` and nothing to cut a long name). The rule is split: `.brand` keeps its look and gets `max-width: 100%`; `.brand span:last-child` has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Today's name looks the same; a very long name is cut with an ellipsis instead of pushing the header wider. (A first try with `min-width: 0` on `.brand` was refused by the tap target check, which read it as a button drawn 0px wide, so `max-width` is used.)
- New test: `site/tests/unit/side-scroll.test.ts` (55 cases, with a fake dist folder run of the real gate and a read of the real style). No other test changed.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message.
- Proved on the real build, in throw away copies: `.x{width:640px}` in the style of `dist/index.html` made the gate fail with exit code 1 and the line `dist: the rule ".x" sets width to 640px, wider than a 320px phone screen, ...`; `<div style="width:700px">` in `dist/404.html` made it fail with `dist/404.html: a <div> has an inline width of 700px, ...`.
- Added: `site/scripts/side-scroll-lib.mjs`, `site/tests/unit/side-scroll.test.ts`, `tasks/open/T-0114.md`. Changed: `site/scripts/validate-html.mjs`, `site/src/styles/global.css`, `site/package.json`, `site/package-lock.json` (version 0.101.116), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.115 (2026-11-19): Page landmarks kept by the build, and the owner's new logo (POLISH, Phase 3c Part 8o)

**What changed**
- New `site/scripts/landmarks-lib.mjs` with one plain function, `checkLandmarks(html, type)`. It reads one built page (text inside script, style, template and comments is ignored) and takes the value of `data-page-type` as `type`.
- Errors, which stop the build: the h1 is outside `main`; a `main` sits inside a header, footer, nav, aside or article; on a story page (`data-page-type="article"`): no `article` element, more than one, the `article` outside `main`, or the h1 outside the `article`.
- Warnings, printed only: an `aside` with no `aria-label` or `aria-labelledby`.
- Left out on purpose, so there is no false alarm: a page with no `main` or no h1 (`page-basics-lib.mjs` and the h1 count report those already); pages that are not story pages are never asked for an `article`; post cards are links, not `article` tags, so they do not count.
- `site/scripts/validate-html.mjs` (the build gate) runs `checkLandmarks` on every built page. Nothing else in it changed.
- `site/tests/unit/img-priority.test.ts`: the fake story page has one `<article>` pair around its h1 and body (a story page with no article is now an error). No expectation changed.
- New test: `site/tests/unit/landmarks.test.ts` (32 cases, with a fake dist folder run of the real gate and a read of the two real templates).
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. Today's site has no published story page, so the article rule has run only on the fake pages and on the template text; it runs on the real build when the first story is published.
- Proved on the real build, in a throw away copy: an extra `<h1>` before `<main>` in `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: the h1 is outside the main landmark, so the skip link would jump past the title`.
- The owner's new logo (card T-0113): `site/brand/source-icon.png` is the new square logo (1254 by 1254, was 1024 by 1024); `npm run icons` made `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `badge-96.png` again; `og-default.png` (1200 by 630) was made again with the logo in the middle. The ZIP grows by about 1.3 MB because the new pictures are bigger.
- Added: `site/scripts/landmarks-lib.mjs`, `site/tests/unit/landmarks.test.ts`, `tasks/open/T-0112.md`, `tasks/open/T-0113.md`. Changed: `site/scripts/validate-html.mjs`, `site/tests/unit/img-priority.test.ts`, the ten logo pictures, `site/package.json`, `site/package-lock.json` (version 0.101.115), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. Removed: nothing.

## 0.101.114 (2026-11-19): Every page has a sound head, kept by the build (POLISH, Phase 3c Part 8n)

**What changed**
- New `site/scripts/head-check-lib.mjs` with two plain functions. `checkHead(html)` reads the head of one built page (text inside script, style, template and comments is ignored). `checkDuplicateTitles(list)` looks at all pages together.
- Errors, which stop the build: no title tag, more than one, or an empty title; more than one canonical link, or a canonical that is not a full http or https address; more than one meta description; more than one robots tag, or a robots tag that says both `index` and `noindex`; no `og:title` (or an empty one); an `og:url` or `og:image` that is not a full http or https address.
- Warnings, printed only: a title over 70 characters; a description that is empty or over 160 characters; a canonical on http (not localhost); `og:url` that is not the canonical; no `og:image`; no `twitter:card`; no `theme-color`; two or more indexable pages (not noindex) that share one title.
- Left out on purpose, so there is no false alarm: a missing canonical and a missing description (`validate-html.mjs` reports those already, as before); a page with no head is one error; a canonical on localhost is a full address and passes (the SITE_URL warning covers the real host); an `og:image` address is not opened.
- `site/scripts/validate-html.mjs` (the build gate) runs `checkHead` on every built page and `checkDuplicateTitles` once at the end. Nothing else in it changed.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message (17 pages, every title different, every page has a title, one canonical, a robots tag and the share tags).
- Proved on the real build: in a throw away copy the title taken out of `dist/index.html` made the gate fail with exit code 1 and the line `dist/index.html: no title tag`; a page with robots `index,noindex` and canonical `/search/` failed with `the canonical link is not a full http or https address: "/search/"` and `the robots tag says both index and noindex`.
- Tests: new `site/tests/unit/head-check.test.ts` (43 cases, and the real build gate on a fake `dist` folder). Deliberate mistakes were put into the library one at a time: 22 of 23 were caught at once; the one not caught was dead code (a comment branch that could never run, because comments are removed first), and it was deleted. The fake pages of eleven older gate tests (`contrast-check`, `css-polish`, `font-check`, `form-labels`, `heading-order`, `img-check`, `img-priority`, `img-ratio`, `link-names`, `page-basics`, `tap-targets`) got one inserted run of head tags (a title, og:title, og:image, twitter:card and theme-color), because a page with no title is now an error and the share tags would otherwise warn. No expectation of those tests changed.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/`, `site/config/` or `site/src/` changed.
- Card `T-0111` (new).

**Files added:** `site/scripts/head-check-lib.mjs`, `site/tests/unit/head-check.test.ts`, `tasks/open/T-0111.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/tests/unit/contrast-check.test.ts`, `site/tests/unit/css-polish.test.ts`, `site/tests/unit/font-check.test.ts`, `site/tests/unit/form-labels.test.ts`, `site/tests/unit/heading-order.test.ts`, `site/tests/unit/img-check.test.ts`, `site/tests/unit/img-priority.test.ts`, `site/tests/unit/img-ratio.test.ts`, `site/tests/unit/link-names.test.ts`, `site/tests/unit/page-basics.test.ts`, `site/tests/unit/tap-targets.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.113 (2026-11-19): A page starts with its h1; no heading warning left (POLISH, Phase 3c Part 8m)

**What changed**
- `site/src/components/Header.astro`: the two titles of the menu drawer ("Categories", "Colour style") are `<p class="menu-h">` and no longer `h3`, so no heading comes before the `h1` on any page. The row of colour buttons is now a named group (`role="group"` with `aria-labelledby` to its title).
- `site/src/components/PostCard.astro`: new prop `level` (default `3`). With `level={2}` the card title is an `h2`.
- `site/src/components/Listing.astro` (category, tag and author pages): the cards are `level={2}`, directly under the `h1`, so no level is skipped. The home page, the 404 page and Related stories keep the default `h3`, because an `h2` section sits above their cards.
- `site/src/styles/global.css`: `.menu h3` is now `.menu .menu-h` with the same look (13px, bold, uppercase, same spacing, colour and margin); `.post h3` is now `.post h3,.post h2` (same size and margin).
- Today's build: the 17 heading warnings of v0.101.109 are gone. `npm run build` ends with `Validation passed.` and only the SITE_URL note for a local computer is left.
- Proved on a throw away copy with one published post: category page headings `h1, h2`, home page `h1, h2, h2, h2, h3`, 404 page `h1, h2, h3`; no heading warning.
- New test `site/tests/unit/heading-templates.test.ts` (7 cases): no heading tag in the drawer, the group name, the CSS of the drawer titles, the card level, the listing level, the same card look, and the default level on the other pages. No older test needed a change.
- No setting added, no Worker changed, no dashboard screen changed, nothing in `site/content/` or `site/config/` changed.
- Card `T-0110` (new).

**Files added:** `site/tests/unit/heading-templates.test.ts`, `tasks/open/T-0110.md`.
**Files changed:** `site/src/components/Header.astro`, `site/src/components/PostCard.astro`, `site/src/components/Listing.astro`, `site/src/styles/global.css`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.112 (2026-11-19): The colour style buttons are 44px for a finger (POLISH, Phase 3c Part 8l)

**What changed**
- `site/src/styles/global.css`: the `.dot` rule (the round colour style buttons in the menu drawer) is now 44px wide and 44px tall, was 38px by 38px. Nothing else in the rule changed.
- The tap target check of v0.101.110 warned about exactly this one thing; today's build no longer prints that warning. The only warnings left are the 17 heading warnings of v0.101.109 (two `h3` of the drawer before the `h1`) and the SITE_URL note on a local computer.
- Look: each of the five buttons is 6px bigger; the row (flex, 12px gap) needs 256px, so it fits a 320px phone.
- `site/tests/unit/tap-targets.test.ts`: the test "the real rules of this site" now has the 44px rule and expects no error and no warning (before: one warning). The other tests of that file are not changed.
- No setting added, no Worker changed, no dashboard screen changed, nothing in `site/content/` or `site/config/` changed.
- Card `T-0109` (new).

**Files added:** `tasks/open/T-0109.md`.
**Files changed:** `site/src/styles/global.css`, `site/tests/unit/tap-targets.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.111 (2026-11-19): Text colours keep 4.5:1 contrast, kept by the build (POLISH, Phase 3c Part 8k)

**What changed**
- New `site/scripts/contrast-lib.mjs` with three plain functions. `parseColor(text)` reads `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` (commas or spaces) and the names white and black; a colour that is not solid (alpha under 1), `transparent`, `currentColor`, `inherit`, `hsl()` and a gradient give nothing. `contrastRatio(a, b)` is the WCAG ratio of two colours. `checkContrast(css)` has two parts.
- Part A, the colour tokens: the custom properties of the built style are read for every look: light, dark, and each colour style (`data-style`) in light and dark, with the layers applied in the order the style intends (base, colour style, dark base, dark colour style). In every look these pairs must keep 4.5:1 or the build stops: `--text` and `--muted` on `--bg` and on `--card`, `--acc-t` on `--bg` and on `--card`, and white on `--acc`. One message per pair and ratio, listing every look where it fails.
- Part B, rules: a rule that sets both a text colour (`color`) and a solid background (`background` or `background-color`) is judged on its own, with `var()` resolved for each look (a rule inside the dark media query or with `[data-theme=dark]` only in the dark looks; with `[data-theme=light]` only in the light looks). Under 3:1 is an error; under 4.5:1 is a warning (the size of the text is not known here, and large text needs only 3:1).
- Left out on purpose, so there is no false alarm: a rule that sets only one of the two colours; a colour that is not solid or cannot be read; a `var()` with no value and no fallback; a background that is a gradient, a picture or several layers; `display:none`; a rule inside `@media print`, `@keyframes`, `@font-face`, `@page` or `@property`; a rule on another switch (for example a future `data-look`). Known limit: a text colour with no background in the same rule is judged only through the tokens.
- `site/scripts/validate-html.mjs` (the build gate) runs `checkContrast` once on the whole built style (every style block and css file), with the font, print and tap target checks (messages start with `dist:`). Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints no new message. The existing `site/tests/unit/contrast.test.ts` is not changed; it still reads the source, and the new gate reads what is shipped.
- Proved on the real build: `--muted` made `#b0b8c8` in one built page made the gate fail with exit code 1 and the line `--muted on --bg is 1.99:1 in the looks light, light (grape), light (mint), light (sky), light (sunset); text must keep 4.5:1 (WCAG 1.4.3)`.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/`, `site/config/` or `site/src/` changed. No older test needed a change.
- Tests: new `site/tests/unit/contrast-check.test.ts` (77 cases, and the real build gate on a fake `dist` folder). Deliberate mistakes were put into the library one at a time; the ones the tests missed first (the 3:1 line, a root rule with a text colour and a background, `:not([data-theme=dark])`, a rule inside a url) were closed with new test lines. While writing the test one real fault was found and fixed before this version: a rule on the root with a text colour and a background was skipped as if it were a token rule.
- Card `T-0108` (new).

**Files added:** `site/scripts/contrast-lib.mjs`, `site/tests/unit/contrast-check.test.ts`, `tasks/open/T-0108.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.

## 0.101.110 (2026-11-19): Buttons, links and fields are not too small for a finger, kept by the build (POLISH, Phase 3c Part 8j)

**What changed**
- New `site/scripts/tap-targets-lib.mjs` with two plain functions. `controlClassesOf(html)` lists the class names that sit on a control of one built page (button, summary, select, textarea, an input that is not hidden, an `a` with `href`, anything with `role="button"`; an element with `aria-hidden="true"` is not counted; comments and the text inside script, style and template are ignored). `checkTapTargets(css, classes)` reads the style rule by rule. A rule is about a control when the last part of one of its selectors is a control tag, a `[role=button]`, or has one of the given classes. The size is the declared width, min-width, height and min-height in px, rem or em (1rem is 16px); the bigger of width and min-width counts, and the bigger of height and min-height counts. A size under 24px is an error (WCAG 2.2, 2.5.8); a size under 44px is a warning (the size this site uses for touch, WCAG 2.5.5).
- Left out on purpose, so there is no false alarm: a size in %, vw, calc(), var(), clamp() or auto; a rule with `display:none`; a rule that makes a thing 1px by 1px (the hidden trap field of the contact form); a rule with `box-sizing:content-box`; a checkbox and a radio (their label is the tap area; a square `input` of 32px or less with no type is read as such a box); a hidden input; a rule about `::before` or `::after`; a rule inside `@media print`, `@keyframes`, `@font-face`, `@page`, or a media query for a mouse only (`pointer: fine`, `hover: hover`). A phone or touch media query is judged. Known limit: every rule is judged alone; a bigger size in a later rule does not cancel a small one.
- `site/scripts/validate-html.mjs` (the build gate) collects the control classes of every built page and checks the style once, with the font and print checks (messages start with `dist:`). Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints one new warning: the colour style buttons (`.dot`, in the menu drawer) are 38px by 38px. Every other control is 44px or more. The 38px is not changed in this version, because it changes the look (`site/src/styles/global.css`); the owner decides.
- Proved on the real build: `.dot` made 20px by 20px in one built page made the gate fail with exit code 1 and the line `".dot" is drawn 20px wide and 20px tall; a tap target must be at least 24px each way (WCAG 2.5.8)`.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/`, `site/config/` or `site/src/` changed. No older test needed a change.
- Tests: new `site/tests/unit/tap-targets.test.ts` (72 cases, and the real build gate on a fake `dist` folder). Fifty-one deliberate mistakes were put into the library one at a time; forty-six were caught at once, five were not (the `@keyframes` skip, a `~` with no spaces, a brace inside a string, a brace inside a url, spaces inside an attribute selector), test lines were added for them and all fifty-one are now caught. The first test run also found one real fault, fixed before this version: a quoted `[type="checkbox"]` was read as an empty type, so a checkbox was judged.
- Card `T-0107` (new).

**Files added:** `site/scripts/tap-targets-lib.mjs`, `site/tests/unit/tap-targets.test.ts`, `tasks/open/T-0107.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.109 (2026-11-19): Headings are not empty and are in order, kept by the build (POLISH, Phase 3c Part 8i)

**What changed**
- New `site/scripts/heading-order-lib.mjs`: the plain function `checkHeadingOrder(html)`. It reads every `h1` to `h6`. A heading has a name when it holds text, the alt text of a picture, or an `aria-label` (on the heading or on a part inside it). An empty heading is an error. Two things are warnings only: headings that come before the first `h1` (one message for the page, the first three named) and a level that is skipped after the `h1` (an `h3` straight after the `h1`, an `h4` straight after an `h2`; one message for each jump, going back up is fine, a second `h3` in a row is not a new jump). A heading with `aria-hidden="true"` or the `hidden` attribute is not checked. A page with no `h1` is only checked for empty headings (`validate-html.mjs` already checks the number of `h1`). Comments and the text inside script, style and template are ignored; tags are read without regard to upper or lower case, single or double quotes, and a `>` inside an attribute does not break the reading.
- `site/scripts/validate-html.mjs` (the build gate) now calls `checkHeadingOrder` for every built page. Errors stop the build; warnings are printed only.
- Why the order is a warning and not an error: all 17 built pages of today start with two `h3` headings of the menu drawer ("Categories", "Colour style", in `site/src/components/Header.astro`) before the `h1`, and, as a build in a throw away copy with one published post showed, the pages of a category, a tag and an author put the post cards (`h3`, in `site/src/components/PostCard.astro`) straight after the `h1`. An error would stop every build and the first real publish. The two templates are not changed in this version.
- Nothing changes on the site by itself: today's build ends with `Validation passed.` and prints 17 warnings (headings before the `h1`, the menu drawer).
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed. No older test needed a change.
- Tests: new `site/tests/unit/heading-order.test.ts` (27 cases, and the real build gate on a fake `dist` folder). Twenty-four deliberate mistakes were put into the library one at a time; twenty-two were caught at once, two (a tag such as `h3x` read as a heading, and the `hidden` attribute without a value) were not, fixes and test lines were added and all twenty-four are now caught.
- Card `T-0106` (new).

**Files added:** `site/scripts/heading-order-lib.mjs`, `site/tests/unit/heading-order.test.ts`, `tasks/open/T-0106.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.108 (2026-11-19): Every link and button has a name, kept by the build (POLISH, Phase 3c Part 8h)

**What changed**
- New `site/scripts/link-names-lib.mjs`: the plain function `checkLinkNames(html)`. It checks every `a` with an `href`, every `button`, and every `input` of type `submit`, `button`, `reset` or `image`. A link or a button has a name when it has a non-empty `aria-label`, when its `aria-labelledby` names an id that exists on the page, or when it holds visible text (the alt text of a picture, the title of a `svg` and a part with its own `aria-label` also count). Text and parts inside an element with `aria-hidden="true"` do not count (the depth of the same tag name is counted, so a nested tag does not cut the hidden part short). A `title` alone is not a name. A link or a button that is itself `aria-hidden="true"` is not checked, and an `a` without `href` is not a link. An input of type `submit` or `reset` always has a name; type `button` needs a `value` or an `aria-label`; type `image` needs an `alt` or an `aria-label`. A link with no name is an error. A link whose only text is a vague phrase (`click here`, `here`, `link`, `this link`, `this`, `more`, `read more`, `learn more`) gives a warning. Comments and the text inside script, style and template are ignored; tags are read without regard to upper or lower case, single or double quotes, and a `>` inside an attribute does not break the reading.
- `site/scripts/validate-html.mjs` (the build gate) now calls `checkLinkNames` for every built page. Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: today's build has 382 links and 90 buttons on 17 pages, all named, no warning, and still ends with `Validation passed.` Proved on the real build: taking the text out of one real link made the gate fail with the address of the link.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed. No older test needed a change.
- Tests: new `site/tests/unit/link-names.test.ts` (35 cases, and the real build gate on a fake `dist` folder). Nineteen deliberate mistakes were put into the library one at a time; eighteen were caught at once, one (upper case `INPUT` and `IMG` tags) was not, test lines were added for it and all nineteen are now caught.
- Card `T-0105` (new).

**Files added:** `site/scripts/link-names-lib.mjs`, `site/tests/unit/link-names.test.ts`, `tasks/open/T-0105.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.107 (2026-11-19): Every form field has a label, kept by the build (POLISH, Phase 3c Part 8g)

**What changed**
- New `site/scripts/form-labels-lib.mjs`: the plain function `checkFormLabels(html)`. A field is an `input`, a `select` or a `textarea`. It has a name when a label with text points to it (`label for`), when it sits inside a label with text (the options of a select and the text of a textarea do not count as label text; the alt text of a picture does), when it has a non-empty `aria-label`, or when its `aria-labelledby` names an id that exists on the page. A field with none of these is an error; a `placeholder` or a `title` alone is not a name. Inputs of type `hidden`, `submit`, `button`, `reset` and `image` are not checked. A `label for="x"` when no element has the id `x` gives a warning. Comments and the text inside script, style and template are ignored; tags are read without regard to upper or lower case, single or double quotes, and a `>` inside an attribute does not break the reading.
- `site/scripts/validate-html.mjs` (the build gate) now calls `checkFormLabels` for every built page. Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: the contact form (label for id, with a hidden trap field that also has a label) and the notification page (labels that wrap the field) already pass, and the build of today's content still ends with `Validation passed.` Proved on the real build: taking one label out of the real contact page made the gate fail with the name of the field.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed. No older test needed a change.
- Tests: new `site/tests/unit/form-labels.test.ts` (28 cases, and the real build gate on a fake `dist` folder). Twenty deliberate mistakes were put into the library one at a time; nineteen were caught at once, one (a `>` inside an attribute cutting the tag short) was not, a test line was added for it and all twenty are now caught.
- Card `T-0104` (new).

**Files added:** `site/scripts/form-labels-lib.mjs`, `site/tests/unit/form-labels.test.ts`, `tasks/open/T-0104.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.106 (2026-11-19): Fonts stay on our own site and never hide the text (POLISH, Phase 3c Part 8f)

**What changed**
- New `site/scripts/font-check-lib.mjs`: the plain functions `checkFontCss(css)` and `checkFontLinks(html)`. `checkFontCss` reports as errors: an `@font-face` with no `font-display` of `swap`, `fallback` or `optional`; an `@font-face` file that comes from another website (`http://`, `https://` or `//`); an `@import` from a known font website. It warns when the style has more than four different font faces (family, weight and style; the same face repeated counts once; no weight counts as 400). `checkFontLinks` reports a `link` or `script` of the page whose address is a known font host (Google Fonts, Bunny Fonts, Typekit, Font Awesome kits). Comments, and the text inside script, style and template, are ignored.
- `site/scripts/validate-html.mjs` (the build gate) now calls `checkFontLinks` for every built page and `checkFontCss` on the collected style text when at least one page was built. Errors stop the build; the warning is printed only.
- Nothing changes on the site by itself: the real build has four faces (Lexend 600 and 800, Inter 400 and 600), all `font-display:swap` and all from `/_astro/`, and still ends with `Validation passed.`
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed. No older test needed a change.
- Tests: new `site/tests/unit/font-check.test.ts` (26 cases, and the real build gate on a fake `dist` folder).
- Card `T-0103` (new).

**Files added:** `site/scripts/font-check-lib.mjs`, `site/tests/unit/font-check.test.ts`, `tasks/open/T-0103.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.105 (2026-11-19): Print rule, focus ring and reduced motion kept by the build (POLISH, Phase 3c Part 8e)

**What changed**
- New `site/scripts/css-polish-lib.mjs`: the plain function `checkCssPolish(css)`. It reports as errors: no `@media print` rule; no visible focus ring (a `:focus-visible` rule with an `outline` that is not `none` or `0`); motion (`transition`, `animation` or `scroll-behavior` with a real value) but no `@media (prefers-reduced-motion)` rule; and no style at all. Comments are ignored; upper case, spaces, lists of selectors and rules inside a media query are read; `transition:none`, `0s` and `scroll-behavior:auto` are not motion.
- `site/scripts/validate-html.mjs` (the build gate) now checks the collected style text (every style block of the built pages and every css file in `dist`) when at least one page was built. Errors stop the build.
- Nothing changes on the site by itself: the real style already has all three, and the build of today's content still ends with `Validation passed.`
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed.
- Tests: new `site/tests/unit/css-polish.test.ts` (21 cases and the real build gate on a fake `dist` folder). The fake pages of `img-check.test.ts`, `img-priority.test.ts`, `img-ratio.test.ts` and `page-basics.test.ts` now carry a small base style, because the gate now asks for it.
- Card `T-0102` (new).

**Files added:** `site/scripts/css-polish-lib.mjs`, `site/tests/unit/css-polish.test.ts`, `tasks/open/T-0102.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/tests/unit/img-check.test.ts`, `site/tests/unit/img-priority.test.ts`, `site/tests/unit/img-ratio.test.ts`, `site/tests/unit/page-basics.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.104 (2026-11-19): Page basics for every built page (POLISH, Phase 3c Part 8d)

**What changed**
- New `site/scripts/page-basics-lib.mjs`: the plain function `checkPageBasics(html)`. For one built page it reports as errors: no `lang` on the html tag (or an empty one), no viewport meta with `width=device-width`, no skip link (`class` skip, `href` `#main`), no element with id `main`, not exactly one `main`, no `header`, no `footer`. It warns when a page has more than one `nav` and one has no `aria-label` or `aria-labelledby`. Pictures, scripts, styles and templates are skipped; tags are read without regard to upper or lower case, single or double quotes, and a `>` inside an attribute does not break the reading.
- `site/scripts/validate-html.mjs` (the build gate) now calls it for every built page. Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: `Base.astro` already has all of it, and the build of today's content still ends with `Validation passed.`
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed.
- Tests: new `site/tests/unit/page-basics.test.ts` (20 cases: every rule, every way to break it, skipped places, quotes, upper case, a `>` in an attribute, all problems at once; and the real build gate on a fake `dist` folder). The fake pages of `img-check.test.ts`, `img-priority.test.ts` and `img-ratio.test.ts` now carry a proper page shell, because the gate now asks for it.
- Card `T-0101` (new).

**Files added:** `site/scripts/page-basics-lib.mjs`, `site/tests/unit/page-basics.test.ts`, `tasks/open/T-0101.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/tests/unit/img-check.test.ts`, `site/tests/unit/img-priority.test.ts`, `site/tests/unit/img-ratio.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.103 (2026-11-19): Thumbnails are 16:9 and never stretched (POLISH, Phase 3c Part 8c)

**What changed**
- New `site/scripts/img-ratio-lib.mjs`: the plain functions `checkThumbRatio(html)` and `thumbCssProblem(css)`. `checkThumbRatio` reads every picture with the class `thumb` (as a whole word) in a built page: its `width` and `height` must be whole numbers above 0 and must make 16:9 (a difference up to 0.02 is allowed, so 1200 x 676 passes); anything else is an error with the size and the address in the sentence. A thumbnail with no width or height is left to `img-check-lib.mjs`, which warns there. `thumbCssProblem` reads the style text and says in one plain sentence when the rule of `.thumb` is missing, has lost `aspect-ratio: 16/9` or has lost `object-fit: cover`; it reads spaces, upper case, `!important`, a rule in a list of selectors, a rule inside a media query and a rule split in two. `.thumbnail` and `.card .thumb` are not taken for `.thumb`. Pictures inside `script`, `style` and `template` are skipped.
- `site/scripts/validate-html.mjs` (the build gate at the end of `npm run build`) now calls `checkThumbRatio` for every built page (errors stop the build). It also collects the text of every `style` block of the built pages and of every `.css` file in `dist`, and, only when some page holds a thumbnail, stops the build when `thumbCssProblem` finds a problem.
- Nothing changes on the site by itself: the cards and the article page already use `width="1200" height="675"` and the rule `.thumb{aspect-ratio:16/9;object-fit:cover}` in `global.css`; the build of today's content still ends with `Validation passed.` The gate keeps it that way.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed.
- Tests: new `site/tests/unit/img-ratio.test.ts` (21 cases: exact and rounded 16:9, square, 4:3 and wide pictures, bad numbers, missing sizes, the class as a whole word, skipped places, every thumbnail of a page, the style in every form listed above, values that only start like the right one, what was lost; and the real build gate on a fake `dist` folder: style in a block and in a css file, a wrong ratio, a lost style, and no check when no page has a thumbnail).
- Card `tasks/open/T-0100.md` (new).

**Files added:** `site/scripts/img-ratio-lib.mjs`, `site/tests/unit/img-ratio.test.ts`, `tasks/open/T-0100.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/tests/unit/img-priority.test.ts` (the fake article page of its gate tests now carries the `.thumb` style, because its top picture is a thumbnail and the gate now asks for the style), `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.102 (2026-11-19): Loading rules for the top picture and the article pictures (POLISH, Phase 3c Part 8b)

**What changed**
- New `site/scripts/img-priority-lib.mjs`: the plain function `checkImgLoading(html, pageType)`. For one built page it reports: a picture that is both `fetchpriority="high"` and `loading="lazy"` (error: it would load late); on an article page, a top picture (the one inside `figure class="hero"`) that has no `fetchpriority="high"` or is lazy-loaded (error); two or more pictures with `fetchpriority="high"` (warning: only the top picture should); on an article page, a picture that is not the top picture and is not lazy-loaded (warning). A top picture that lacks the priority is reported once as an error, not again as a warning. Pictures inside `script`, `style` and `template` are skipped; the values are read without regard to upper or lower case.
- `site/scripts/validate-html.mjs` (the build gate at the end of `npm run build`) now calls `checkImgLoading` for every built page, with the page type it already reads. Errors stop the build; warnings are printed only.
- Nothing changes on the site by itself: the article page already gives its top picture `fetchpriority="high"` and the cards are lazy (checked in `[slug].astro` and `PostCard.astro`), and today's build still ends with `Validation passed.` The gate now keeps it that way. A picture written by hand in the text of a post without `loading="lazy"` gives a warning on its article page.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed.
- Tests: new `site/tests/unit/img-priority.test.ts` (20 cases: each rule, page types, hero class among other classes and single quotes, upper case values, skipped places, long addresses, a value that is not text; and the real build gate on a fake article page: a good page passes, a top picture without the priority fails the build, a picture that is not lazy only warns).
- Card `tasks/open/T-0099.md` (new).

**Files added:** `site/scripts/img-priority-lib.mjs`, `site/tests/unit/img-priority.test.ts`, `tasks/open/T-0099.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.101 (2026-11-19): Picture rules for every built page (POLISH, Phase 3c Part 8a)

**What changed**
- New `site/scripts/img-check-lib.mjs`: plain functions `checkImgTags`, `attrOf`, `hostOf`, `ownHostsOf`. For one built page they report: a picture with no `alt` attribute (error; an empty `alt=""` is allowed because it marks a decoration), a picture address that starts with `http://` (error), a picture loaded from another website than our own `SITE_URL` (warning), and a picture with no `width` or no `height` (warning, the page would jump while loading). Pictures inside `script`, `style` and `template` are skipped; `data:` addresses are skipped; a `>` sign inside an alt text does not break the reading.
- `site/scripts/validate-html.mjs` (the build gate at the end of `npm run build`) now calls `checkImgTags` for every built page. Errors stop the build like the other checks; warnings are printed only.
- Nothing changes on the site by itself. The build of today's content (one post, no extra picture) still ends with `Validation passed.` A future post whose picture has no alt attribute, or an `http://` picture, will now stop the build, which is the point (POLISH: alt text on all content images, no picture from another website).
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed.
- Tests: new `site/tests/unit/img-check.test.ts` (21 cases: reading attributes, hosts and own hosts, every rule, skipped places, a `>` in alt text, long addresses, upper case tags; and the real build gate on a fake `dist` folder: a good page passes, a missing alt and an `http` picture fail the build, other website and missing size only warn, our own full address does not warn).
- Card `tasks/open/T-0098.md` (new).

**Files added:** `site/scripts/img-check-lib.mjs`, `site/tests/unit/img-check.test.ts`, `tasks/open/T-0098.md`.
**Files changed:** `site/scripts/validate-html.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.100 (2026-11-19): A warning when the pictures folder is near 1 GB (BUGS U12, Phase 3c Part 7ae)

**What changed**
- `site/scripts/validate-content-lib.mjs`: new `MEDIA_WARN_MB` (900, fixed, no setting) and `mediaSizeWarning(totalBytes, limitMb)`. It returns one plain sentence when the pictures use more than 900 MB, and `null` when the size is fine, exactly at the limit, or not a good number.
- `site/scripts/validate-content.mjs` (`npm run check:content`): adds up the size of every file in `public/media/` and prints `WARN  public/media: the pictures in public/media use N MB; a repository should stay under about 1 GB, so plan the move to Cloudflare R2 (decision 15)` when it is above 900 MB. It is a warning only: the check still passes. It is skipped when only some content files are named on the command line.
- No setting added, no Worker changed, no dashboard screen changed, no file of `site/content/` or `site/config/` changed. Nothing changes on the site.
- Tests: new `site/tests/unit/media-size-warning.test.ts` (13 cases: the limit, empty, below, exactly at, one byte above, bad values, another limit, no emoji; and the real script on a folder with sparse files: small folder no warning, 901 MB warns and still passes, sizes of several files and sub folders are added, skipped when files are named).
- Card `tasks/open/T-0097.md` (new).

**Files added:** `site/tests/unit/media-size-warning.test.ts`, `tasks/open/T-0097.md`.
**Files changed:** `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
**Files removed:** none.

## 0.101.99 (2026-11-19): The Save button on the Picture settings screen (PLAN 34.10, Phase 3c Part 7ad)

**What changed**
- `site/public/admin/js/app.js`, `imagesView`: under the form there is now a button `Save picture settings`. It is disabled while any value is wrong. On click it calls `saveImagesSettings` (Part 7ac) with the checked values and `{ loadedText }`, the text the file held when the page was opened (`null` when there was no file; a broken file counts as its own text, so it can be repaired from the form). After a save the person sees `Saved. The site updates in about 2 minutes.`; when the file already says the same, `Nothing to save: the file already has these values.` and nothing is written; on any failure a red fixed sentence (a wrong value is shown by the form itself; a file changed by someone else, a GitHub refusal, a conflict) and nothing is written. After a save the screen is drawn again, so it shows the new file and the form starts from it. Only admins see the screen, so only admins see the button.
- `site/public/admin/js/images-form-screen.js`: the first sentence of the form no longer says that saving is not built; it tells the person to press Save picture settings. The form itself still has no button, link or form tag (the button is outside it). Header comments of this file and of `images-save.js` say so.
- A file that lacks some keys is completed with the shipped values when Save is pressed, even with no typing. A file that already says the same (only the spaces, line breaks or key order differ) is not written again.
- The save writes straight to the branch of `admin/config.json`, like the ads, ad loader, links, redirects and robots settings. Decision 24 (pull request or straight to `main`) is still the owner's to answer; nothing else was decided here.
- Tests: `site/tests/unit/admin-images-form.test.ts` (18 new cases with the real dashboard in jsdom and a fake GitHub that records every PUT: the button is on the screen once, enabled and disabled with the values, a wrong value writes nothing, one PUT with the sha, the message and the new text, the screen drawn again, a second click and a no-change click write nothing, a file changed by someone else, a missing file written with no sha, a broken file repaired, unknown keys kept, lists and naming order, GitHub answers 403, 409 and 500 with nothing leaking, an editor sees no button, no second button and no late drawing over another screen; two old cases changed to the new truth); changed `site/tests/unit/images-form-screen.test.ts` (the first sentence) and `site/tests/unit/images-save.test.ts` (only `app.js` calls the save). Fourteen deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0096.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.99) are updated.

**Files**
- Added: `tasks/open/T-0096.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/images-form-screen.js`, `site/public/admin/js/images-save.js`, `site/tests/unit/admin-images-form.test.ts`, `site/tests/unit/images-form-screen.test.ts`, `site/tests/unit/images-save.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the button has not been tried in the real dashboard with the real GitHub.

## 0.101.98 (2026-11-19): The save of the picture settings form, as a function with no button (PLAN 34.10, Phase 3c Part 7ac)

**What changed**
- New `site/public/admin/js/images-save.js`: `saveImagesSettings(gh, cfg, raw, opts)`. It reads `config/images.json` and its sha, checks the form values with the strict `imagesFromForm`, builds the new text with `imagesFileText` (keys it does not know are kept), and writes it with ONE `gh.put` and the sha it just read, the same way the dashboard saves its other settings. It gives `{ ok: true, changed, settings, text, changes, sha }` or `{ ok: false, reason, message, errors? }`.
- A file that already says the same (even with other spaces, line breaks or key order) is not written again: `changed: false`, no commit. A file that does not exist (404) is written new, with no sha.
- `opts.loadedText` (the text the form was filled from, or `null` when there was no file) makes the save stop with `changed-meanwhile` when the file is different now, so a save never overwrites a change made by someone else after the page was opened.
- One wrong value stops the whole save (`invalid`, with the plain sentence of each wrong key); nothing is written. A failed read gives `read-failed`; a write that GitHub refuses gives `conflict` (409, 422), `no-permission` (401, 403) or `failed`. Every message is a fixed plain sentence and never repeats a text of GitHub, so no token or address can leak. The function never throws and never changes its input.
- Nothing calls the function yet: no button, no change on the Picture settings screen, no change in the dashboard or on the live site. A test keeps it that way.
- Tests: new `site/tests/unit/images-save.test.ts` (46 cases with a fake GitHub: a good save, nothing to save, wrong values, a missing, broken or changed file, GitHub failures, never throws, and the file itself). Nineteen deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0095.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.98) are updated.

**Files**
- Added: `site/public/admin/js/images-save.js`, `site/tests/unit/images-save.test.ts`, `tasks/open/T-0095.md`.
- Changed: `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the function has not been tried with the real GitHub (nothing calls it).

## 0.101.97 (2026-11-19): The Save of the editor counts the websites of allowHosts as ours (PLAN 34.10, Phase 3c Part 7ab)

**What changed**
- `site/public/admin/js/images-setting.js`: new `customAllowHosts(value)`. It gives the valid website names of the list (lower case, no repeat, at most 200; bad entries are dropped) or `undefined` when there is no valid name. `hostingSettingsFromText` (and so `readImagesForSave`) adds the key `allowHosts` to its answer only in that case; in every other case the answer is exactly as before.
- `site/public/admin/js/hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`: the list goes from the one read of the file to the setup (a list given by the caller wins over the file). Still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`. In `hostingSetup` the websites are ADDED to our own websites (`deps.ownHosts`, after the site itself and the dashboard setting `ownHosts`; no repeat). A picture from such a website is then not an outside picture: the Save does not fetch or host it and goes on as before.
- Safety rule: a name that is the same as, a sub name of, or a parent name of a website on the agency list (the dashboard list, the starting list of `hosted-meta.js`, or `askHosts`) or on the block list is IGNORED in the Save. So `allowHosts` can never let an agency picture or a blocked picture past the confirm step or the refusal.
- The match is the exact website name ("www." ignored), the same rule as every own website in the Save (`isOwnHost`). A sub name of an allowed website is still checked and hosted by the Save. This is stricter than the build check, which also counts sub names as allowed; the screen text says so.
- The shipped `allowHosts` is an empty list, so today nothing changes on the site or in the editor until the owner adds a website to `allowHosts` in `site/config/images.json`. A switch `"enabled": false` still stops everything first. The build check already read this list (Part 7d); it is unchanged.
- `site/public/admin/js/images-screen.js`: the row "Websites counted as ours" now says "Used today by the build check and by the Save of the editor: pictures from these websites are counted as ours and are not hosted." (new `use` word `buildSaveOwn`) and its help adds the exact-name and safety rules.
- Tests: new `site/tests/unit/hosting-allow-hosts-save.test.ts` (39 cases: the name check, the reader, the setup with the safety rule, and the real Save with a fake GitHub and a fake picture Worker); changed `site/tests/unit/images-screen.test.ts` (the `allowHosts` row now has the `buildSaveOwn` word, the build rows test accepts it, and the test checks that the Save reads it). Fourteen deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0094.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.97) are updated.

**Files**
- Added: `site/tests/unit/hosting-allow-hosts-save.test.ts`, `tasks/open/T-0094.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `site/public/admin/js/hosting-setup.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the list has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.96 (2026-11-19): The Save of the editor refuses pictures from the websites of blockHosts (PLAN 34.10, Phase 3c Part 7aa)

**What changed**
- `site/public/admin/js/images-setting.js`: new `customBlockHosts(value)`. It gives the valid website names of the list (lower case, no repeat, at most 200; bad entries are dropped) or `undefined` when there is no valid name. `hostingSettingsFromText` (and so `readImagesForSave`) adds the key `blockHosts` to its answer only in that case; in every other case the answer is exactly as before.
- `site/public/admin/js/hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`: the list goes from the one read of the file to the setup (a list given by the caller wins over the file). Still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`. In `hostingSetup` the websites are ADDED to the block list (the list of the dashboard setting `blockHosts`, or an empty list when there is none). They never remove a host, and a website name also matches its sub names and its `www.` name (the rule of `checkAddress`). A picture from such a website is then refused by the plan: it is not fetched and not hosted, and the writer reads the existing sentence "The owner blocked this host." with the Replace action.
- A blocked picture is refused before ask first and before reuse, as for the dashboard list today.
- The shipped `blockHosts` is an empty list, so today nothing changes on the site or in the editor until the owner adds a website to `blockHosts` in `site/config/images.json`. A switch `"enabled": false` still stops everything first. The build check already read this list (Part 7b); it is unchanged.
- `site/public/admin/js/images-screen.js`: the row "Websites never allowed" now says "Used today by the build check and by the Save of the editor: pictures from these websites are refused." (new `use` word `buildSave`) and its help adds "The Save of the editor does not host them."
- Tests: new `site/tests/unit/hosting-block-hosts-save.test.ts` (38 cases: the name check, the reader, the setup, and the real Save with a fake GitHub and a fake picture Worker); changed `site/tests/unit/images-screen.test.ts` (the `blockHosts` row now has the `buildSave` word, the build rows test accepts it, and the test checks that the Save reads it). Twelve deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0093.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.96) are updated.

**Files**
- Added: `site/tests/unit/hosting-block-hosts-save.test.ts`, `tasks/open/T-0093.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `site/public/admin/js/hosting-setup.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the list has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.95 (2026-11-19): The Save of the editor makes every picture wait for the writer when config/images.json says askFirst (PLAN 34.10, Phase 3c Part 7z)

**What changed**
- `site/public/admin/js/images-setting.js`: `hostingSettingsFromText` (and so `readImagesForSave`) now adds the key `askFirst: true` to its answer ONLY when the file holds the real value `true`; for `false`, text, a number, `null`, a missing key, a bad file or no file the key is left out and the answer is exactly as before.
- `site/public/admin/js/hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`: the value goes from the one read of the file to the setup (a value given by the caller wins over the file). Still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`. In `hostingSetup` only the value `true` sets `deps.askAll = true`; any other value sets nothing.
- `site/public/admin/js/hosting-pipeline.js`, `hosting-run.js`, `hosting-plan.js`, `hosted-meta.js`: `askAll` is passed from the pipeline to the run step and to the plan. With `askAll`, a picture that would be downloaded waits for the writer to confirm (status `needs_confirm`, marked `askFirst: true`); a picture that is already hosted is reused as before; a refused address stays refused; a picture the writer already confirmed (the address or its website) is hosted; own pictures are not outside pictures, so nothing waits. `needsConfirm` takes the optional `askAll` (only the value `true` counts; without it every call is exactly as before).
- `site/public/admin/js/hosting-run.js`: new constant `ASK_FIRST_TEXT` ("Picture hosting is set to ask first. Confirm before this picture is hosted."). A picture that waits only because of ask first shows this sentence; a picture from an agency website still shows the agency sentence.
- The shipped `askFirst` is `false`, so today nothing changes on the site or in the editor until the owner sets `askFirst` to `true` in `site/config/images.json`. A switch `"enabled": false` still stops everything first.
- `site/public/admin/js/images-screen.js`: the row "How it starts" now says "Used today by the Save of the editor: with Ask first, every picture that is not hosted yet waits for the writer to confirm." (new `use` word `askFirst`).
- Tests: new `site/tests/unit/hosting-ask-first-save.test.ts` (51 cases: `needsConfirm`, the plan, the reader, the setup, the real Save with a fake GitHub and a fake picture Worker, and the confirm step); changed `site/tests/unit/images-screen.test.ts` (the `askFirst` row now has the `askFirst` word and the test checks that the Save reads it). Seventeen deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0092.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.95) are updated.

**Files**
- Added: `site/tests/unit/hosting-ask-first-save.test.ts`, `tasks/open/T-0092.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `site/public/admin/js/hosting-setup.js`, `site/public/admin/js/hosting-pipeline.js`, `site/public/admin/js/hosting-run.js`, `site/public/admin/js/hosting-plan.js`, `site/public/admin/js/hosted-meta.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the setting has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.94 (2026-11-19): The Save of the editor makes pictures from the websites of askHosts wait for the writer (PLAN 34.5 and 34.10, Phase 3c Part 7y)

**What changed**
- `site/public/admin/js/images-setting.js`: new `customAskHosts(value)`. It gives the valid website names of the list (lower case, no repeat, at most 200; bad entries are dropped) or `undefined` when there is no valid name. `hostingSettingsFromText` (and so `readImagesForSave`) adds the key `askHosts` to its answer only in that case; in every other case the answer is exactly as before.
- `site/public/admin/js/hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`: the list goes from the one read of the file to the setup (a list given by the caller wins over the file). Still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`. In `hostingSetup` the websites are ADDED to the agency list (the list of the dashboard setting `agencyHosts`, or the starting list of `hosted-meta.js` when there is none). They never remove a host, and a website name also matches its sub names. A picture from such a website is then not fetched and not hosted: it waits for the writer to confirm (the existing "needs confirm" step).
- The shipped `askHosts` is an empty list, so today nothing changes on the site or in the editor until the owner adds a website to `askHosts` in `site/config/images.json`. A switch `"enabled": false` still stops everything first.
- `site/public/admin/js/images-screen.js`: the row "Websites that ask first" now says "Used today by the Save of the editor: pictures from these websites wait for the writer to confirm." (new `use` word `ask`).
- Tests: new `site/tests/unit/hosting-ask-hosts-save.test.ts` (34 cases: the name check, the reader, the setup, and the real Save with a fake GitHub and a fake picture Worker); changed `site/tests/unit/images-screen.test.ts` (the `askHosts` row now has the `ask` word and the test checks that the Save reads it). Ten deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0091.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.94) are updated.

**Files**
- Added: `site/tests/unit/hosting-ask-hosts-save.test.ts`, `tasks/open/T-0091.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `site/public/admin/js/hosting-setup.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the list has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.93 (2026-11-19): The Save of the editor names new pictures by the naming order of config/images.json (PLAN 34.4 and 34.10, Phase 3c Part 7x)

**What changed**
- `site/public/admin/js/images-setting.js`: new `customNameOrder(value)`. It gives the naming order only when it is a valid order (the six words `alt`, `caption`, `heading`, `keyword`, `oldName`, `handle`, each once, ending with `handle`) that is NOT the shipped one; for everything else it gives `undefined`. `hostingSettingsFromText` (and so `readImagesForSave`) now adds the key `nameOrder` to its answer only in that case; in every other case the answer is exactly as before (`{ on, quality }`).
- `site/public/admin/js/hotlink.js`: `seoName(img, post, n, order)` takes an optional fourth value. With a custom order the ways are tried in that order and a way that is not in the list is skipped; `handle` is still the last fallback (`<handle>-image-<n>`). With no order, a wrong order or the shipped order the name is exactly as before.
- `site/public/admin/js/hosting-hook.js`, `hosting-save.js`, `hosting-setup.js`, `hosting-pipeline.js`, `hosting-run.js`: the order goes from the one read of the file to the picture names (`nameOrder` of the caller wins over the file). Still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`. A switch `"enabled": false` still stops everything first.
- The shipped order is the old behaviour, so today nothing changes on the site or in the editor until the owner changes `nameOrder` in `site/config/images.json`. Only NEW pictures use the order; a name is final once saved (PLAN 34.4).
- `site/public/admin/js/images-screen.js`: the row "Order of picture names" now says "Used today by the Save of the editor, when it names new pictures." (new `use` word `name`).
- Tests: new `site/tests/unit/hosting-name-order-save.test.ts` (42 cases: the order check, `seoName` with orders, the reader, the setup, and the real Save with a fake GitHub and a fake picture Worker); changed `site/tests/unit/images-screen.test.ts` (the `nameOrder` row now has the `name` word and the test checks that the Save reads it). Ten deliberate mistakes were made one at a time and every one was caught.
- Card `tasks/open/T-0090.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.93) are updated.

**Files**
- Added: `site/tests/unit/hosting-name-order-save.test.ts`, `tasks/open/T-0090.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hotlink.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `site/public/admin/js/hosting-setup.js`, `site/public/admin/js/hosting-pipeline.js`, `site/public/admin/js/hosting-run.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the order has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.92 (2026-11-18): The Save of the editor obeys the switch "enabled" of config/images.json (PLAN 34.10, Phase 3c Part 7w)

**What changed**
- `site/public/admin/js/images-setting.js`: new `hostingSettingsFromText(text)` and `readImagesForSave(gh, cfg)`. One read of `config/images.json` gives `{ on, quality }`. `on` is false ONLY when the file says `"enabled": false` (a real boolean). A missing file, an empty file, bad JSON, `[]`, `"false"` in quotes, `0`, `null` and a GitHub error all keep `on` true, so a broken file never switches picture hosting off by accident.
- `site/public/admin/js/hosting-hook.js`: `runHostingSave` uses that one read instead of `readImagesQuality` (still one `getText` call, and still only when picture hosting is set up and the caller gave no `quality`). With `on: false` it returns `{ action: 'normal', reason: 'off', message: '' }` before anything is fetched, converted or committed: the Save goes on as before and the post keeps its outside pictures. With `on: true` it works exactly as before, and the quality of Part 7k still reaches the picture step.
- The shipped value of `enabled` is `true`, so today nothing changes on the site or in the editor until the owner sets `"enabled": false` in `site/config/images.json`.
- `site/public/admin/js/images-screen.js`: the row "Picture hosting" now says "Used today by the Save of the editor: Off stops it from hosting pictures." (new `use` word `save`), and its help sentence says that Off keeps the pictures where they are.
- Tests: new `site/tests/unit/hosting-switch-save.test.ts` (31 cases, the real Save helper with a fake GitHub and a fake picture Worker); changed `site/tests/unit/hosting-quality-save.test.ts` (the source check now names the new call) and `site/tests/unit/images-screen.test.ts` (the `enabled` row now has the `save` word and the test checks the new read in the source).
- Card `tasks/open/T-0089.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.92) are updated.

**Files**
- Added: `site/tests/unit/hosting-switch-save.test.ts`, `tasks/open/T-0089.md`.
- Changed: `site/public/admin/js/images-setting.js`, `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/hosting-quality-save.test.ts`, `site/tests/unit/images-screen.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the switch has not been tried in the real dashboard with the real GitHub and the real picture Worker (hosting itself still waits for the images Worker and `imagesUrl`).

## 0.101.91 (2026-11-18): The picture settings form is on the Picture settings screen, without a save (PLAN 34.10, Phase 3c Part 7v)

**What changed**
- `site/public/admin/js/app.js`: `imagesView` now keeps the text of `config/images.json` and shows the form of Part 7u (`imagesFormScreen`) under the read only list, with the heading "Try a change". The form is filled with the values of the file. If the file is missing, is not valid JSON or is not an object, the form starts from the shipped values and the note above the list says why. The keys of the file that the code does not know are kept in the new text.
- While the admin types, the form shows a sentence under each wrong value, what would change, and the text that would be written. It has no button and no save: nothing is written to GitHub (the save waits for decision 24, the write mode). The list above the form keeps the values of the file, so it does not change while the person types.
- Only admins see it (the menu item and the route were already for admins only). The guard against a late answer is kept: if the person goes to another screen while the file loads, nothing is drawn.
- `AI_OPERATIONS.md` Section 13: the coverage row of the Picture settings screen now says that it has a form without a save.
- Tests: new `site/tests/unit/admin-images-form.test.ts` (11 cases, the real dashboard in jsdom with a fake GitHub); changed `site/tests/unit/images-form-screen.test.ts` (the case "nobody calls it" now says "only app.js calls it") and `site/tests/unit/images-form.test.ts` (the case "nobody calls it" now looks for the exact import and says that only the form page may use the file).
- Card `tasks/open/T-0088.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.91) are updated.

**Files**
- Added: `site/tests/unit/admin-images-form.test.ts`, `tasks/open/T-0088.md`.
- Changed: `site/public/admin/js/app.js`, `site/tests/unit/images-form-screen.test.ts`, `site/tests/unit/images-form.test.ts`, `AI_OPERATIONS.md`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the form has not been looked at in a real browser.

## 0.101.90 (2026-11-18): The picture settings form page, without a save (PLAN 34.10, Phase 3c Part 7u)

**What changed**
- New file `site/public/admin/js/images-form-screen.js`: `imagesFormScreen({ settings, currentText?, onChange? })` draws a form for the eleven settings of `config/images.json` and gives `{ el, read(), text(), update(settings, currentText?) }`. There is one control for each setting (switches, number boxes, a storage list, three website text areas with one name on each line, and the naming order as words with commas).
- While the person types, it shows: one plain sentence for each wrong value (the sentences of Part 7t), with `aria-invalid="true"` on the wrong box; the list of what would change ("Picture quality: 85 of 100 -> 60 of 100"); and the text that would be written to `config/images.json` (empty while a value is wrong; unknown keys of the current file are kept). `read()` and `text()` give the same result in code. `onChange` is called after each edit and after `update()`, not at the start.
- No button, no form tag, no link, no fetch, no storage, no GitHub. A line on the page says that saving from this screen is not built yet and that the file can be edited by hand. The save waits for decision 24 (the write mode). Every text is a text node, so a website name typed into a box is never built as HTML. Only classes that `admin.css` already has are used.
- Nothing calls the new file yet (it is not on the Picture settings screen), so the dashboard and the live site do not change.
- Tests: new `site/tests/unit/images-form-screen.test.ts` (27 cases, jsdom).
- Card `tasks/open/T-0087.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.90) are updated.

**Files**
- Added: `site/public/admin/js/images-form-screen.js`, `site/tests/unit/images-form-screen.test.ts`, `tasks/open/T-0087.md`.
- Changed: `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the dashboard does not call the new code, and the form has not been looked at in a real browser.

## 0.101.89 (2026-11-18): The logic of the picture settings form (PLAN 34.10, Phase 3c Part 7t)

**What changed**
- New file `site/public/admin/js/images-form.js` with four plain functions: `imagesFormValues(settings)` (the settings as a form holds them: numbers as text, one website per line), `imagesFromForm(raw, current?)` (the form values to a checked settings object, or a list of plain errors), `imagesFileText(settings, currentText?)` (the new text of `config/images.json`) and `imagesChanges(before, after)` (what would change, in the words of the Picture settings screen).
- `imagesFromForm` is strict on purpose: a wrong value is an error with a plain sentence and is never repaired (the reader of Part 7q is gentle; a form must not be). It refuses text such as `1.5`, `1.0`, `85.` or `1e3` for a number, a website name that is not a clean name (and names it in the sentence), more than 200 names, a website in two lists (allow and block, ask and block), and a naming order with a wrong word, a repeat, or without `handle` at the end. It lower-cases website names and drops repeats. A key that is not in the form keeps its value from the current settings.
- `imagesFileText` writes two-space indent, one newline at the end, the keys in the order of the shipped file, and keeps every key of the current file that it does not know (after the known ones), as AI_OPERATIONS 13 asks. A bad current file writes only the known keys. A key named `__proto__` is never copied.
- The rules are those of `checkImagesConfig` of the build script. Tests run the form and the build check on the same values (numbers, website names, lists, naming order) and require the same answer, and require that every file text the form makes passes the build check.
- Nothing calls the new file yet: no page, no save, no GitHub. The dashboard and the live site do not change. The save of the form waits for decision 24 (write mode).
- Tests: new `site/tests/unit/images-form.test.ts` (64 cases).
- Card `tasks/open/T-0086.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.89) are updated.

**Files**
- Added: `site/public/admin/js/images-form.js`, `site/tests/unit/images-form.test.ts`, `tasks/open/T-0086.md`.
- Changed: `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the dashboard does not call the new code.

## 0.101.88 (2026-11-18): The picture settings screen is in the dashboard menu, read only (PLAN 34.10, Phase 3c Part 7s)

**What changed**
- `site/public/admin/js/app.js`: a new menu item **Picture settings** (address `#/images`, role `settings`, so admins only), placed before Settings. The route and the function `imagesView` read `config/images.json` with `getText` (nothing else) and draw the screen of Part 7r (`imagesScreen`).
- If the file is missing, is not valid JSON, or is not an object, the screen shows the shipped values and one plain sentence that says so (it never shows the shipped values silently). A wrong value inside a good file shows its shipped value and does not spoil the other rows (the reader of Part 7q). If the person goes to another screen while the file is still loading, the late answer is not drawn.
- An editor does not see the menu item; typing the address shows one plain sentence ("Only admins can see the picture settings.").
- The screen writes nothing and has no button, input or link; to change a setting the owner edits `config/images.json`.
- `site/public/admin/js/images-screen.js`: only the header comment changed (it says that app.js now shows the screen). `AI_OPERATIONS.md` Section 13: the menu list and the coverage table now name the new menu item.
- Tests: new `site/tests/unit/admin-images-screen.test.ts` (9 cases, the real dashboard in jsdom with a fake GitHub); changed `site/tests/unit/images-screen.test.ts` (the case "nobody calls it" now says "only app.js calls it").
- Card `tasks/open/T-0085.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.88) are updated.

**Files**
- Added: `site/tests/unit/admin-images-screen.test.ts`, `tasks/open/T-0085.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `AI_OPERATIONS.md`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the new menu item has not been opened on the real dashboard.

## 0.101.87 (2026-11-18): The picture settings screen, read only (PLAN 34.10, Phase 3c Part 7r)

**What changed**
- New file `site/public/admin/js/images-screen.js`: `imagesRows(settings)` gives the eleven rows of the screen (label, value in plain words, a help sentence, and where the setting works today), in the order of PLAN 34.10; `imagesScreen({ settings, note? })` draws them as a list and gives `{ el, update(settings, note?) }`. The settings go through `imagesSettingsOf` (Part 7q) first, so a missing or wrong value shows its shipped value and nothing throws.
- Plain words: a limit of 0 shows as "No limit"; quality as "85 of 100"; storage as "In the repository"; hard block as "Warning only" or "Error"; a website list as its names (the first ten and "and N more" for a longer one, "None" for an empty one); the naming order with the plain words of PLAN 34.4.
- Each row also says where the setting works today. The five settings that the build check reads (`maxWidth`, `sizeWarnKb`, `allowHosts`, `blockHosts`, `hardBlock`) say "Used today by the build check"; `quality` says it is used by the Save of the editor when picture hosting is on; `enabled`, `askFirst`, `storage`, `askHosts` and `nameOrder` say "Not used yet". A test compares these claims with the real code, so the screen cannot promise more than the code does.
- The screen is read only: no button, input, select, textarea, form or link, and a short line tells the owner to edit `config/images.json` to change a setting. Every text is a text node, so a website name is never built as HTML. The look reuses the classes of the hosting list screen; `admin.css` is not changed.
- Nothing calls the new file yet (it is not in the dashboard menu), so nothing changes in the dashboard or on the site.
- Tests: new `site/tests/unit/images-screen.test.ts` (26 cases).
- Card `tasks/open/T-0084.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.87) are updated.

**Files**
- Added: `site/public/admin/js/images-screen.js`, `site/tests/unit/images-screen.test.ts`, `tasks/open/T-0084.md`.
- Changed: `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the dashboard does not call the new code.

## 0.101.86 (2026-11-18): The dashboard reader of all the picture settings (PLAN 34.10, Phase 3c Part 7q)

**What changed**
- `site/public/admin/js/images-setting.js` (Part 7j read only `quality`) now also has: `imagesDefaults()` (the shipped value of every one of the eleven settings, a fresh object each time), `imagesSettingsOf(settings)` (every setting checked alone; a missing or wrong one gets its shipped value), `imagesSettingsFromText(text)`, `readImagesSettings(gh, cfg)` (reads `config/images.json` from the repository; never throws), and the exported `NAME_SOURCES` and `HOST_NAME`. The old functions are not changed.
- Rules of the reader: true or false settings must be real booleans; `sizeWarnKb` and `maxWidth` whole numbers from 0 to 20000; `quality` as before (1 to 100); `storage` only `repo` or `r2`; the three website lists drop bad names, lower-case the rest, drop repeats and keep at most 200; `nameOrder` is taken whole or not at all (only the six words, each once, ending with `handle`, else the shipped order). The reader is gentler than the build check on purpose: a bad list name is dropped here, while `npm run check:content` still refuses the file.
- Nothing calls the new functions yet, so nothing changes in the dashboard or on the site.
- Tests: new `site/tests/unit/images-settings-all.test.ts` (13 cases): defaults equal the shipped file, the naming words and the website name rule equal the build script, the shipped file reads back unchanged, bad input gives shipped values, each setting alone, the lists, the naming order, the input is not changed, and the file reader with a missing file, a failing client and bad text.
- Card `tasks/open/T-0083.md` (red because of `public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.86) are updated.

**Files**
- Added: `site/tests/unit/images-settings-all.test.ts`, `tasks/open/T-0083.md`.
- Changed: `site/public/admin/js/images-setting.js`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet; the dashboard does not call the new code.

## 0.101.85 (2026-11-18): The picture hosting on or off setting, shipped as true (PLAN 34.10, Phase 3c Part 7p)

**What changed**
- `site/config/images.json` now has an eleventh key: `"enabled": true`. `true` means picture hosting is allowed (the plan makes it automatic); `false` means off (PLAN 34.10 "on or off"). It is the last of the settings of PLAN 34.10.
- `site/scripts/validate-content-lib.mjs`: `checkImagesConfig` checks `enabled` (only `true` or `false` without quotes; `"on"`, `"true"`, `1`, `null`, a list or an object give the sentence `"enabled" must be true or false (without quotes)`). A missing key is fine.
- Nothing reads the value yet. Picture hosting still runs only when `imagesUrl` is set in `site/public/admin/config.json`, and that is still empty, so nothing changes today. The only effect now is that a wrong value fails `npm run check:content`.
- The shipped value `true` is my choice (PLAN 34 makes hosting automatic). The owner may want `false` until the images Worker is deployed.
- Tests: new `site/tests/unit/image-enabled-config.test.ts` (5 cases). `validate-content.test.ts`: the shipped-file test now expects `enabled: true`.
- Card `tasks/open/T-0082.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.85) are updated.

**Files**
- Added: `site/tests/unit/image-enabled-config.test.ts`, `tasks/open/T-0082.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet.

## 0.101.84 (2026-11-18): The picture naming order, shipped as in PLAN 34.4 (PLAN 34.10, Phase 3c Part 7o)

**What changed**
- `site/config/images.json` now has a tenth key: `"nameOrder": ["alt", "caption", "heading", "keyword", "oldName", "handle"]`. These are the six ways of PLAN 34.4 to make a picture file name (the picture's alt text, its caption, the nearest heading, the focus keyword plus title words, the old file name, the post handle plus a number), in the order PLAN 34.4 gives. The owner can change the order.
- `site/scripts/validate-content-lib.mjs`: new `NAME_SOURCES` (the six words) and a `nameOrder` rule in `checkImagesConfig`: it must be a list; every entry one of the six words (exact, small letters as written above); no word twice; and the list must end with `handle`. Sentences: `"nameOrder" must be a list of the words ...`, `"nameOrder" entry N must be one of ...`, `"nameOrder" lists "x" twice`, `"nameOrder" must end with "handle" (the last way to make a name)`. A missing key is fine. A shorter list is fine (for example `["handle"]`).
- The rule "must end with handle" is a choice made in this part so that a name can always be made (PLAN 34.4 step 6 is the last way). It is not written in PLAN 34.10; the owner may change it.
- Nothing reads the list yet. The only effect now is that a bad value fails `npm run check:content`.
- Tests: new `site/tests/unit/image-name-order-config.test.ts` (8 cases). `validate-content.test.ts`: the shipped-file test now expects the `nameOrder` list.
- Card `tasks/open/T-0081.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.84) are updated.

**Files**
- Added: `site/tests/unit/image-name-order-config.test.ts`, `tasks/open/T-0081.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet.

## 0.101.83 (2026-11-18): The agency host list, shipped empty (PLAN 34.10, Phase 3c Part 7n)

**What changed**
- `site/config/images.json` now has a ninth key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo", "askFirst": false, "askHosts": [] }`. `askHosts` is a list of website names (news agencies) whose pictures would ask first (decision 16).
- `site/scripts/validate-content-lib.mjs`: `checkImagesConfig` checks `askHosts` with the same rules as `blockHosts` and `allowHosts` (a list, each entry a website name only such as `photos.example.com`, at most 200 names). New rule: a name in both `askHosts` and `blockHosts` is refused (`"x" is in both "askHosts" and "blockHosts"; keep it in one list`). A name in `askHosts` and `allowHosts` is allowed. A missing key is fine.
- Nothing reads the list yet. The only effect now is that a bad value fails `npm run check:content`.
- Tests: new `site/tests/unit/image-ask-hosts-config.test.ts` (6 cases). `validate-content.test.ts`: the shipped-file test now expects `askHosts: []`.
- Card `tasks/open/T-0080.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.83) are updated.

**Files**
- Added: `site/tests/unit/image-ask-hosts-config.test.ts`, `tasks/open/T-0080.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet.

## 0.101.82 (2026-11-18): The ask first setting, shipped as false (PLAN 34.10, Phase 3c Part 7m)

**What changed**
- `site/config/images.json` now has an eighth key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo", "askFirst": false }`. `askFirst` is `false` (pictures are hosted automatically, as planned) or `true` (ask first, PLAN 34.10 "automatic or ask first").
- `site/scripts/validate-content-lib.mjs`: `checkImagesConfig` checks `askFirst` (only `true` or `false` without quotes; `"true"`, `1`, `null`, a list or an object give the error sentence `"askFirst" must be true or false (without quotes)`). A missing key is fine.
- Nothing reads the value yet. The only effect now is that a wrong value fails `npm run check:content`.
- Tests: new `site/tests/unit/image-ask-first-config.test.ts` (5 cases): the shipped file, good values, bad values with the exact sentence, the other settings still checked, and the real script with `true`, `false`, a missing key and three bad values. `validate-content.test.ts`: the shipped-file test now expects `askFirst: false`.
- Card `tasks/open/T-0079.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.82) are updated.

**Files**
- Added: `site/tests/unit/image-ask-first-config.test.ts`, `tasks/open/T-0079.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** no GitHub run of the validate workflow with this change yet.

## 0.101.81 (2026-11-18): The publisher country is India (content fix, no code)

**What changed**
- The owner said: the audience is in the USA, and the owner and the office are in India. `site/config/publisher.json` had `"country": "US"` ("where the publisher is based"), so two pages said the publisher is based in the US while the address says West Bengal, India. Now `"country": "India"`.
- `site/content/pages/about-us.md` and `site/content/pages/ownership-and-funding.md`: "based in US" is now "based in India". (The pages are not made again by `npm run pages`, which never touches an existing page, so they were edited by hand to match.)
- NOT changed: `site/content/pages/terms-and-conditions.md` still says "These terms follow the laws of US." That is a legal choice (which country's law), so it waits for the owner (see `INCOMPLETE.md`, Open Items After v0.101.81). If the pages are ever made again from `publisher.json`, that sentence would say India, because the generator uses `country` for it.
- No code changed, no test changed. Card `tasks/open/T-0078.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.81) are updated.

**Files**
- Added: `tasks/open/T-0078.md`.
- Changed: `site/config/publisher.json`, `site/content/pages/about-us.md`, `site/content/pages/ownership-and-funding.md`, `CHANGELOG.md`, `INCOMPLETE.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** the live pages were read before the change (they said "based in US"); the new text is not live until the files are pushed.

## 0.101.80 (2026-11-18): The picture storage setting, shipped as "repo" (PLAN 34.10, Phase 3c Part 7l)

**What changed**
- `site/config/images.json` now has a seventh key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85, "storage": "repo" }`. `storage` is the text `"repo"` (pictures live in the repository, as today) or `"r2"` (a Cloudflare R2 bucket, decision 15; not built).
- `site/scripts/validate-content-lib.mjs`: `checkImagesConfig` checks `storage` (only the exact text `repo` or `r2`; `"REPO"`, `"s3"`, `""`, a number, `true`, `null`, a list or an object give the error sentence `"storage" must be the text "repo" or "r2" (with quotes), for example "repo"`). A missing key is fine.
- Nothing reads the value yet. Pictures always go to the repository. `"r2"` passes the check but does NOT switch R2 on. The only effect now is that a wrong value fails `npm run check:content`.
- Tests: new `site/tests/unit/image-storage-config.test.ts` (5 cases): the shipped file, good values, bad values with the exact sentence, the other settings still checked, and the real script with `repo`, `r2`, a missing key and three bad values. `validate-content.test.ts`: the shipped-file test now expects `storage: 'repo'`. Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0077.md` (red because of `config/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.80) are updated.

**Files**
- Added: `site/tests/unit/image-storage-config.test.ts`, `tasks/open/T-0077.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.79 (2026-11-18): The Save of the editor reads the picture quality (PLAN 34.10, Phase 3c Part 7k)

**What changed**
- `site/public/admin/js/hosting-hook.js`: `runHostingSave` now reads `quality` from `config/images.json` (with `readImagesQuality` of Part 7j) before it starts, but only when picture hosting is on (`hostingEnabled`) and the caller gave no `quality`. A missing file, a GitHub error, bad JSON or a bad number gives `undefined`, so the Save works exactly as before. It never stops the Save and shows no token.
- `site/public/admin/js/hosting-save.js`: `startHostingSave` accepts `quality` and passes it to `hostingSetup` (Part 7j), which gives it to the picture step and the smaller-copies step. A quality already inside `optimizeDeps` wins over the file.
- Effect: the number in `config/images.json` now changes the quality of NEW hosted pictures. Pictures already hosted are not changed. Picture hosting is still off in the shipped `admin/config.json` (no `imagesUrl`), so the live site does not change until the owner switches it on.
- Tests: new `site/tests/unit/hosting-quality-save.test.ts` (13 cases): a file quality (70) reaches the picture step, the shipped file gives 85, a missing file or a bad number or bad JSON leaves the step as before, a GitHub error does not stop the Save and shows no token, hosting off does not read the file, a caller quality wins, a quality in `optimizeDeps` wins, one commit still holds the post and the picture, `startHostingSave` passes the number, and two source checks. The older hook, save, setup and editor tests still pass. Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0076.md` (red because of `site/public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.79) are updated.

**Files**
- Added: `site/tests/unit/hosting-quality-save.test.ts`, `tasks/open/T-0076.md`.
- Changed: `site/public/admin/js/hosting-hook.js`, `site/public/admin/js/hosting-save.js`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with a fake GitHub client, a fake picture service and fake browser steps on this computer; no GitHub run and no real browser run yet.

## 0.101.78 (2026-11-18): The dashboard code that reads the picture quality (PLAN 34.10, Phase 3c Part 7j)

**What changed**
- New file `site/public/admin/js/images-setting.js`: `imagesPathOf(cfg)` (the path `<contentRoot>/config/images.json`), `qualityOf(settings)` and `qualityFromText(text)` (a whole number from 1 to 100, else `undefined`), `readImagesQuality(gh, cfg)` (reads the file with the GitHub client; a missing file, bad JSON, a bad number or no client gives `undefined`; it never throws) and `qualityDeps(deps, quality)` (a copy of a deps object with `quality` added when valid; a quality already in deps wins; the given object is never changed).
- `site/public/admin/js/hosting-setup.js`: `hostingSetup` accepts an optional `quality` and gives it to the picture step (`optimizeDeps`) and to the smaller-copies step (`copyDeps`) through `qualityDeps`. With no `quality`, or a wrong one, every call is exactly as before (the picture step is still called with one argument).
- Nothing calls `readImagesQuality` in the Save yet, so the live site and the dashboard do not change, and changing `quality` in `config/images.json` still has no effect on pictures. The next part connects the Save.
- Tests: new `site/tests/unit/images-setting.test.ts` (13 cases): the path, good and bad numbers, the text of the file, the shipped file (85, equal to `QUALITY`), reading with a fake GitHub client (404, bad JSON, bad number, no client), `qualityDeps`, and `hostingSetup` passing the number to both steps, doing nothing for a wrong number, and keeping a number already in `optimizeDeps`. Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0075.md` (red because of `site/public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.78) are updated.

**Files**
- Added: `site/public/admin/js/images-setting.js`, `site/tests/unit/images-setting.test.ts`, `tasks/open/T-0075.md`.
- Changed: `site/public/admin/js/hosting-setup.js`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with a fake GitHub client and fake browser steps on this computer; no GitHub run yet.

## 0.101.77 (2026-11-18): The picture quality setting, shipped as 85 (PLAN 34.10, Phase 3c Part 7i)

**What changed**
- `site/config/images.json` now has a sixth key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0, "quality": 85 }`. `quality` is a whole percent from 1 to 100. It ships as 85, the same number the browser steps have always used (`QUALITY` of `image.js`).
- `site/scripts/validate-content-lib.mjs`: `checkImagesConfig` checks `quality` (a whole number from 1 to 100; 0, 101, a decimal, text, true, null, a list or an object give the error sentence `"quality" must be a whole number from 1 to 100 (a percent), for example 85`). A missing key is fine.
- Nothing reads the value yet: the dashboard does not read `config/images.json`, so changing the number has no effect on pictures today. The next part makes the dashboard read it. The only effect now is that a wrong value fails `npm run check:content`.
- Tests: new `site/tests/unit/image-quality-config.test.ts` (5 cases): the shipped file (85, equal to `QUALITY`), good values, bad values with the exact sentence, the other settings still checked, and the real script with 85, 1, a missing key and three bad values. `validate-content.test.ts`: the shipped-file test now expects `quality: 85`. Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0074.md` (red because of `config/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.77) are updated.

**Files**
- Added: `site/tests/unit/image-quality-config.test.ts`, `tasks/open/T-0074.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.76 (2026-11-18): The picture quality can be given to the browser steps (PLAN 34.10, Phase 3c Part 7h)

**What changed**
- `site/public/admin/js/image.js`: new `QUALITY` (85) and `qualityFraction(percent)` (a whole number from 1 to 100 gives 0.01 to 1; anything else gives 0.85). `prepareImage(file, maxWidth, quality)` has a third argument, default 85, used for both the WebP and the JPEG step. Before this the number 0.85 was written in two places; now it comes from one.
- `site/public/admin/js/hosting-optimize.js`: `optimizePicture` takes `deps.quality` and passes it on (with the default width when no `maxWidth` is given); `resizeWebp(bytes, width, height, quality)` has a fourth argument, default 85; `makeVariants` gives `deps.quality` to every smaller copy. With no quality given, every call is exactly as in v0.101.75 (same arguments, same 0.85).
- No setting was added: `site/config/images.json` is not changed and nothing reads a quality from a file yet, so the dashboard and the live site behave exactly as before. A later part will add the `quality` setting and the dashboard will read it.
- Tests: new `site/tests/unit/image-quality.test.ts` (10 cases, with a fake browser that records the number given to `toBlob`): `qualityFraction`, `prepareImage` with no quality, a quality, the JPEG fallback and a bad quality, `optimizePicture` call shapes, `makeVariants` and `resizeWebp`. The older tests of `hosting-optimize` and `hosting-variants` pass unchanged. Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0073.md` (red because of `site/public/admin/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.76) are updated.

**Files**
- Added: `site/tests/unit/image-quality.test.ts`, `tasks/open/T-0073.md`.
- Changed: `site/public/admin/js/image.js`, `site/public/admin/js/hosting-optimize.js`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with a fake browser on this computer; no GitHub run and no real browser run yet.

## 0.101.75 (2026-11-18): The picture width warning, shipped off (PLAN 34.10, Phase 3c Part 7g)

**What changed**
- `site/config/images.json` now has a fifth key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0, "maxWidth": 0 }`. `maxWidth` is a whole number of pixels (for example 1600). It ships as 0, which means off, so nothing changes today.
- `site/scripts/validate-content-lib.mjs`: `checkPost` takes `maxWidth` and `imageHead(path)`. With a number above 0, a PUBLISHED post whose top picture (`image`), share picture (`ogImage`) or a picture of our own site inside the text is wider than that gets one WARNING per file (the file, its width and the limit). The width is read with `imageSize` of v0.101.74. A picture exactly at the limit is fine. A file used twice is reported once. A file that is not a known picture (an SVG, text) or cannot be read is ignored. `checkImagesConfig` checks `maxWidth` (a whole number from 0 to 20000).
- `site/scripts/validate-content.mjs`: reads `maxWidth` and gives `checkPost` a function that reads the first 256 KB of a picture file. It is never an error and it never changes a file.
- Tests: new `site/tests/unit/max-width.test.ts` (8 cases, real pictures made by `sharp`): the config check, the top picture, the share picture, pictures in the text, a file used twice, size and width together, the quiet cases (off, draft, scheduled, code, unknown file, not a picture, exactly at the limit) and the real script with 800, 1200, 0, a missing key and a bad value. `validate-content.test.ts`: the shipped-file test now expects `maxWidth: 0`. Six deliberate mistakes were made one at a time and all six were caught.
- Card `tasks/open/T-0072.md` (red because of `config/` and the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.75) are updated.

**Files**
- Added: `site/tests/unit/max-width.test.ts`, `tasks/open/T-0072.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.74 (2026-11-18): A reader for the pixel size of a picture (PLAN 34.10, Phase 3c Part 7f)

**What changed**
- New file `site/scripts/image-size-lib.mjs`: `imageSize(bytes)` gives `{ type, width, height }` for a PNG, JPEG, GIF or WebP (lossy, lossless and extended) from its first bytes, and `null` for anything else (text, an SVG, an empty or cut file, a zero size). Pure function, no file access, no package.
- Nothing calls it yet. No setting was added, `site/config/images.json` is not changed and no check changes, so the live site, `npm run check:content` and the dashboard behave exactly as in v0.101.73. A later part will use it for the width limit (`maxWidth`).
- New test `site/tests/unit/image-size.test.ts` (11 cases): real pictures made by `sharp` in every supported format, a JPEG with extra segments before the frame, a Uint8Array and a list of numbers, and the `null` cases (text, empty, missing, cut, zero size, SVG). Five deliberate mistakes were made one at a time and all five were caught.
- Card `tasks/open/T-0071.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.74) are updated.

**Files**
- Added: `site/scripts/image-size-lib.mjs`, `site/tests/unit/image-size.test.ts`, `tasks/open/T-0071.md`.
- Changed: `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested on this computer only; no GitHub run yet.

## 0.101.73 (2026-11-18): The size warning also measures pictures inside the text (PLAN 34.10, Phase 3c Part 7e)

**What changed**
- `site/scripts/validate-content-lib.mjs`: new `localPictures(body)` finds the pictures of our own site that the TEXT of a post shows: Markdown `![alt](/media/x.webp)` and `<img src="/media/x.webp">`. Code blocks and inline code are skipped (`maskCode`), a `?query` or `#part` is cut off, a path with `..` is ignored, each file is listed once. `checkPost` measures each of them with the same `sizeWarnKb` of v0.101.71: for a PUBLISHED post, a file bigger than the limit gives one WARNING (the text starts with "the picture in the text", then the file, its size in KB and the limit). A file used both as the top picture and in the text is reported once.
- No new setting and no change to `site/config/images.json` or `site/scripts/validate-content.mjs` (the script already passed `sizeWarnKb` and `imageBytes`). With `sizeWarnKb` at 0 (as shipped) nothing changes. It is never an error. A draft is not checked; an unknown size is ignored.
- Tests: 6 new cases in `validate-content.test.ts` (64 in all): what `localPictures` finds and skips, the exact warning text, an img tag and two big pictures, a file used twice, off and draft and scheduled and code and unknown size, and the real script with 2, 5 and 0. Five deliberate mistakes were made one at a time and all five were caught.
- This closes the known gap named in v0.101.71 (pictures inside the text were not measured). Still not measured: a picture with its own `srcset`, and the pixel width (`maxWidth` needs a way to read the picture size and is a later part with its own decision).
- Card `tasks/open/T-0070.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.73) are updated.

**Files**
- Added: `tasks/open/T-0070.md`.
- Changed: `site/scripts/validate-content-lib.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.72 (2026-11-18): The allow list for picture websites, shipped empty (PLAN 34.10, Phase 3c Part 7d)

**What changed**
- `site/config/images.json` now has a fourth key: `{ "hardBlock": false, "blockHosts": [], "allowHosts": [], "sizeWarnKb": 0 }`. `allowHosts` is a list of website names whose pictures count as our own (for example a picture address such as `media.yourdomain.com` after the R2 option of decision 15). It ships empty, so nothing changes today.
- `site/scripts/validate-content-lib.mjs`: `checkPost` takes `allowHosts`. A picture in the text of a published or scheduled post from an allowed website (or a sub-site of it) gets no outside-picture warning and is not an error even when `hardBlock` is true. The block list of v0.101.70 wins when a name is in both. `hostBlocked` is now the same function as the new `hostListed`. `checkImagesConfig` checks `allowHosts` like `blockHosts` (a list, each entry a website name, at most 200) and gives an error when a name is in both lists.
- `site/scripts/validate-content.mjs`: reads `allowHosts` and passes it on.
- Tests: 7 new cases in `validate-content.test.ts` (58 in all): an allowed picture is quiet while another one still warns, hardBlock with an allowed picture, the block list wins, empty and similar-name and bad-entry cases, a draft, the config check (including the name in both lists) and the real script. The shipped-file test now expects the empty allow list. Five deliberate mistakes were made one at a time and all five were caught.
- This is the plain allow list. The "ask first" agency list of decision 16 is still a separate, later part. The images Worker is not changed.
- Card `tasks/open/T-0069.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.72) are updated.

**Files**
- Added: `tasks/open/T-0069.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.71 (2026-11-18): The picture size warning, shipped off (PLAN 34.10, Phase 3c Part 7c)

**What changed**
- `site/config/images.json` now has a third key: `{ "hardBlock": false, "blockHosts": [], "sizeWarnKb": 0 }`. `sizeWarnKb` is a whole number of KB (for example 300). It ships as 0, which means off, so nothing changes today.
- `site/scripts/validate-content-lib.mjs`: `checkPost` takes `sizeWarnKb` and `imageBytes(path)`. For a PUBLISHED post, the front matter `image` and `ogImage` files (a path starting with `/`) that are bigger than the limit give one WARNING each: the file, its size in KB and the limit. It is never an error. A draft is not checked; an unknown size is ignored. `checkImagesConfig` now also checks `sizeWarnKb` (a whole number from 0 to 20000).
- `site/scripts/validate-content.mjs`: reads `sizeWarnKb` (only a whole number above 0 turns it on) and measures the files in `public/`.
- Tests: 6 new cases in `validate-content.test.ts` (51 in all): the exact warning text, the share picture, a picture under the limit, off for 0 and seven wrong values, a draft and an unknown size, the config check, and the real script with 2, 5, 0 and a text value. Five deliberate mistakes were made one at a time and all five were caught.
- Only the front matter pictures are measured; pictures inside the post text are not (a known gap, safe). The number 300 is the proposal of decision 47; it is not switched on.
- Card `tasks/open/T-0068.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.71) are updated.

**Files**
- Added: `tasks/open/T-0068.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.70 (2026-11-18): The block list for picture websites, shipped empty (PLAN 34.10, Phase 3c Part 7b)

**What changed**
- `site/config/images.json` now has a second key: `{ "hardBlock": false, "blockHosts": [] }`. `blockHosts` is a list of website names (for example `"photos.example.com"`). It ships empty, so nothing changes today.
- `site/scripts/validate-content-lib.mjs`: new `hostBlocked(url, list)` (the same name and its sub-sites match: `example.com` also blocks `cdn.example.com`, but not `notexample.com`) and `HOST_NAME` (a name only: no `https://`, no slash, no space). `checkPost` takes `blockHosts`: for a published or scheduled post, a picture in the text from a listed website is ALWAYS an error (with or without `hardBlock`); the other outside pictures keep the warning or the `hardBlock` error of v0.101.69. `checkImagesConfig` now also checks `blockHosts` (must be a list, each entry a website name, at most 200) and names the bad entry by its place.
- `site/scripts/validate-content.mjs`: reads `blockHosts` and passes it on. A draft and an archived post are never blocked. A picture of our own site (`SITE_URL`) is never counted.
- Tests: 7 new cases in `validate-content.test.ts` (45 in all) and the shipped-file test now expects the empty list. Five deliberate mistakes were made one at a time: four were caught; the fifth (not lowercasing the host) is not visible, because the address parser already writes the host in lowercase.
- Only the TEXT of a post is checked (the same known gap as Part 6a). The images Worker has its own `BLOCK_HOSTS` secret list; it is not connected to this file yet.
- Card `tasks/open/T-0067.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.70) are updated.

**Files**
- Added: `tasks/open/T-0067.md`.
- Changed: `site/config/images.json`, `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.69 (2026-11-18): The hard block setting for outside pictures, shipped off (PLAN 34.9, 34.10, Phase 3c Part 7a)

**What changed**
- New `site/config/images.json` with `{ "hardBlock": false }`. Only the key that is used is in it.
- `site/scripts/validate-content-lib.mjs`: `checkPost` takes `hardBlock`; only the value true makes the outside-picture message an error (the text is the same as the warning of v0.101.68). New `checkImagesConfig(cfg)`: the file must be an object and `hardBlock` must be true or false.
- `site/scripts/validate-content.mjs`: reads `config/images.json` (a missing file means a warning only), reports a wrong file as an error and passes `hardBlock` on. A draft and an archived post are never blocked.
- The shipped value is false, so the live site, the build and `preflight` behave as before. The owner can turn the stricter rule on by changing `false` to `true` in `site/config/images.json`.
- Tests: 5 new cases in `validate-content.test.ts` (38 in all): true makes an error with the same text, only the value true blocks (five wrong values), a draft is never blocked, the config check, the shipped file, and the real script with false, true and `"true"`. Five deliberate mistakes were made one at a time: four were caught; the fifth (the script reading `hardBlock` loosely) is not visible, because `checkPost` also checks for the value true, so the result is the same.
- Card `tasks/open/T-0066.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.69) are updated.

**Files**
- Added: `site/config/images.json`, `tasks/open/T-0066.md`.
- Changed: `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.68 (2026-11-18): The build gate warns about outside pictures in the text (PLAN 34.9, Phase 3c Part 6a)

**What changed**
- `site/scripts/validate-content-lib.mjs`: `checkPost` takes an optional `ownHosts`. For a post with status `published` or `scheduled` it runs `findExternal` (the rule of `hotlink.js`, code blocks skipped) on the text and adds ONE warning: how many pictures are on another website and the first address, with the hint to host them (AI_OPERATIONS 8). A draft and an archived post are not checked. It is a warning only, so nothing fails; a hard block is the later setting of Part 7. The front matter `image` and `ogImage` already had their own warnings and are not counted twice.
- `site/scripts/validate-content.mjs`: passes the host of `SITE_URL` (when it is set) as `ownHosts`, so a full address of our own picture is not counted.
- Because `npm run check:content` is part of `npm run preflight` and the validate workflow, both now show the warning. The shipped site has one draft post, so it shows no new warning.
- Tests: 6 new cases in `validate-content.test.ts` (33 in all): the text of the warning for two pictures and for one, scheduled yes and draft and archived no, our own host and relative, data and code pictures are skipped, it is not an error, and the real script prints `WARN` and ends with `CONTENT PASS` (with and without `SITE_URL`). Five deliberate mistakes were made one at a time (checks every status, only published, an error instead of a warning, `ownHosts` not passed by the script, `ownHosts` ignored). All five were caught.
- Card `tasks/open/T-0065.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.68) are updated.

**Files**
- Added: `tasks/open/T-0065.md`.
- Changed: `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/validate-content.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with temporary sites and the real script on this computer; no GitHub run yet.

## 0.101.67 (2026-11-18): Pictures inside the article text use the smaller copies too (PLAN 34.5, Phase 3c Part 4c-6)

**What changed**
- `site/src/lib/picture-set.ts`: new `withPictureSets(html, map, sizes, exists?)` and `SIZES.body` (660 pixels on a tablet and a desktop, the page width minus 60 on a phone). Every `<img>` of the article text whose `src` is a hosted picture with copies gets `srcset` and `sizes` right after `src`. A tag that already has `srcset` or `sizes`, a picture with no copy, an outside picture, a tag with no `src` and text that only shows a tag (escaped) are left exactly as they are.
- `site/src/lib/picture.ts`: new `bodySets(html)`, the rule bound to `config/media.json`; a copy is named only when its file is in `public/`.
- The article page: `bodyHtml = plan.html ? bodySets(plan.html) : plan.html`. The fallback `<Content />` is kept.
- Nothing is switched on: `config/media.json` is empty and copies are off, so the live site does not change yet.
- Tests: 7 new cases in `picture-set.test.ts` (19 in all): attributes kept and order, a self-closing tag, single quotes, upper case and two pictures, tags left alone, escaped text, an empty map, the file check, odd input, and a source guard on the page. A real build with a temporary picture in the text wrote the expected tag; an unknown picture in the same text was left as it was (temporary files removed).
- Card `tasks/open/T-0064.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.67) are updated.

**Files**
- Added: `tasks/open/T-0064.md`.
- Changed: `site/src/lib/picture-set.ts`, `site/src/lib/picture.ts`, `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`, `site/tests/unit/picture-set.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** built and tested with a temporary picture only; no real browser, Worker or GitHub token, and no real hosted picture exists yet.

## 0.101.66 (2026-11-18): The page uses the smaller picture copies: srcset and sizes (PLAN 34.5, Phase 3c Part 4c-5)

**What changed**
- New `site/src/lib/picture-set.ts` (pure): `pictureSet(map, src, sizes, exists?)` gives `{ srcset, sizes }` or null. It needs the `variants` note and the stored `width` of the picture in `config/media.json` (PLAN 34.6). The srcset lists the copies narrowest first and then the main file with its true width. Only a main `.webp` under `/media/` with no query or hash counts; a copy name, an outside address and a picture with no note or no width give null, so nothing is invented. Also `copyPath`, `COPY_WIDTHS` (480, 800, 1200, 1600; a test keeps them equal to the dashboard `SRCSET_WIDTHS`) and `SIZES` for the three places.
- `site/src/lib/picture.ts`: new `setOf(src, sizes)`: the rule bound to `config/media.json`, and each copy is named only when its file is in `public/`, so a srcset never names a missing copy.
- `site/src/components/PostCard.astro`, `site/src/pages/index.astro` and the article page: the picture gets `srcset` and `sizes` (`SIZES.card`, `SIZES.lead`, `SIZES.article`, from the widths in `global.css`). `src`, `width`, `height`, `loading` and `fetchpriority` are as before. A picture with no copy has an `img` tag exactly as before.
- Nothing is switched on: `config/media.json` is empty and copies are still off (`imageCopies: false`), so the live site does not change until the owner turns copies on and hosts new pictures.
- Tests: new `picture-set.test.ts` (12 tests): the text, the same text as the dashboard rule for five widths, the widths kept equal, no note, bad widths, a note width that is not a copy width, a missing file, not-a-main-picture addresses, odd maps, and source guards on the three templates and on the file check. A real build with a temporary picture and three copies wrote the expected `srcset` and `sizes` on the home page, the category page and the article (the temporary files were removed).
- Card `tasks/open/T-0063.md` (red because of the version files, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.66) are updated.

**Files**
- Added: `site/src/lib/picture-set.ts`, `site/tests/unit/picture-set.test.ts`, `tasks/open/T-0063.md`.
- Changed: `site/src/lib/picture.ts`, `site/src/components/PostCard.astro`, `site/src/pages/index.astro`, `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** built and tested on a computer with a temporary picture only; no real browser, Worker or GitHub token, and no real hosted picture exists yet.

## 0.101.65 (2026-11-18): The switch for the smaller picture copies, off by default (PLAN 34.5, Phase 3c Part 4c-4e)

**What changed**
- `site/public/admin/js/hosting-setup.js`: new `copiesEnabled(cfg)`, true only when `admin/config.json` has `imageCopies` set to the value true (`"true"` as text, 1, `"on"` and a missing key all mean off). When it is true, `hostingSetup` adds `deps.makeVariants = makeVariantMaker(copyDeps)`; the pipeline already puts the copies of each new picture in the same ONE commit as the picture and the post (v0.101.60). When it is not true, the deps are exactly what they were. The whole feature still needs `imagesUrl`; without it the setup answers "off" as before. A new optional input `copyDeps` is for tests (the fake canvas).
- `site/public/admin/config.json`: new key `"imageCopies": false`, so the owner can see and flip the switch. Nothing is switched on by this version.
- Why now: delete (4c-4b), rename (4c-4c) and replace (4c-4d) all handle a picture with copies, so no action can leave a copy behind or show an old picture.
- What it does not do: the page does not use the copies yet (`srcset` and `sizes` are Part 4c-5), so readers see no change either way. Copies are made only for NEW pictures of a hosted post; a picture that was reused gets none.
- Tests: 11 new cases in `hosting-setup.test.ts`: off when missing or false; only the value true switches it on (ten wrong values); no throw on garbage; needs `imagesUrl`; the deps with the switch on; joined to the real pipeline with the switch OFF (picture only) and ON (1600 pixels wide gives the 480, 800 and 1200 copies in one commit); 480 pixels or less gives none; a preview makes none; the shipped config says false; the source names the maker once, behind the switch. Three older guards (`hosting-copies.test.ts`, `hosting-variants.test.ts`, `admin-files-copies.test.ts`) said no dashboard file names `makeVariants`; they now say only `hosting-setup.js` does, behind the switch. All 3,390 tests pass (3,379 before).
- Five deliberate mistakes were made one at a time (any truthy value switches on, always on, `copyDeps` ignored, the shipped config set to true, no `imagesUrl` check). All five were caught.
- Card `tasks/open/T-0062.md` (red, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.65) are updated.

**Files**
- Added: `tasks/open/T-0062.md`.
- Changed: `site/public/admin/js/hosting-setup.js`, `site/public/admin/config.json`, `site/tests/unit/hosting-setup.test.ts`, `site/tests/unit/hosting-copies.test.ts`, `site/tests/unit/hosting-variants.test.ts`, `site/tests/unit/admin-files-copies.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with fakes and jsdom only; the browser canvas that draws the copies is faked; no real Worker or GitHub token. The switch is off, so the live dashboard works as before.

## 0.101.64 (2026-11-18): Replace removes the old smaller copies, in ONE commit (PLAN 33.3, 34.5, Phase 3c Part 4c-4d)

**What changed**
- New `site/public/admin/js/file-replace.js` (pure): `planReplace(path, bytes, { sitePaths, pub })` returns `{ copies, entries }`: the new bytes at the same repository path first, then each copy that exists now (`variantsOnList`) as `{ path, delete: true }`. It throws a plain sentence for a path that is not a picture under `/media/` or is already gone. `mapWithoutVariants(map, path)` returns the stored `config/media.json` object without the `variants` note of that picture (an entry that held only the note goes too) and says whether anything changed. Nothing here makes a copy.
- `site/public/admin/js/app.js` (`onReplace`): the commit list comes from `planReplace`; when copies exist, `config/media.json` is read again and written without the `variants` note in the same commit. The role check, `replaceCheck` (same kind of picture, size limit) and the fresh tree read are as before. The message ends with `and remove N old smaller copies` when there are copies. The handler now returns `{ map, removed }` so the screen can follow.
- `site/public/admin/js/files-screen.js`: the Replace box of a picture with copies is no longer locked. The question adds "Its 2 smaller copies are removed in the same commit, because they would still show the old picture." and the answer says "Replaced name.webp and removed its 2 old smaller copies." The screen's own list of paths and the hidden count follow. The helper `copiesNote` and the `copies-locked` sentence are gone: no action is locked any more.
- Why remove and not remake: the dashboard has no `makeVariants` yet (copies are still off), and a copy that stays would show the OLD picture at the same address. The copies come back when copies are switched on. Do not switch them on before that part.
- Tests: new `file-replace.test.ts` (14 tests), new `admin-file-replace-copies.test.ts` (3 tests on the real dashboard with a fake GitHub: two copies in one commit with the note dropped, a picture without copies as before, a copy of another picture never deleted); `admin-files-copies.test.ts` has nine new cases about replace with copies (the two old "locked for replace" tests are replaced); one source guard in `admin-file-replace.test.ts` now names `planReplace` and `[...plan.entries]`; the import guard in `hosting-srcset.test.ts` also allows `file-replace.js`. All 3,379 tests pass (3,355 before).
- Eight deliberate mistakes were made one at a time (copies not deleted, an empty entry kept, the note not dropped, the hidden count not going down, the screen keeping the removed copies, `onReplace` dropping the deletes, `config/media.json` not written, the message without the count). All eight were caught. One run first hit a second, similar line in `onDelete` and was repeated on the right line.
- Card `tasks/open/T-0061.md` (red, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.64) are updated.

**Files**
- Added: `site/public/admin/js/file-replace.js`, `site/tests/unit/file-replace.test.ts`, `site/tests/unit/admin-file-replace-copies.test.ts`, `tasks/open/T-0061.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/files-screen.js`, `site/tests/unit/admin-files-copies.test.ts`, `site/tests/unit/admin-file-replace.test.ts`, `site/tests/unit/hosting-srcset.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with fakes and jsdom only; no real browser, Worker or GitHub token. No copy exists today, so the live dashboard looks and works as before.

## 0.101.63 (2026-11-18): Rename takes the smaller copies along, in ONE commit (PLAN 33.3, 34.5, Phase 3c Part 4c-4c)

**What changed**
- `site/public/admin/js/file-rename.js`: `planFileRename` now finds the smaller copies of the picture that exist in `taken` (`variantsOnList`) and moves each one to the new name (`variantPath(newPath, width)`). `moves` lists the picture first and then each copy; the new field `copies` lists `{ from, to }`; `counts.copies` says how many. Each copy gets its own 301, with the same rules as the picture: a redirect that starts at a new name is removed (loop guard), a redirect that ends at an old name now ends at the new one (no chain), and the Cloudflare limit counts every new redirect. A post or page that names a copy gets the new copy name, and a file counts once in `places`. The media entry (alt text, caption, credit and the `variants` note) moves to the new name, and a stray entry of a copy moves too. The rename is refused with a plain sentence when a copy of the new name already exists. A copy that is not in the list of existing files is never moved or invented. A picture without copies gives the same plan as before.
- `site/public/admin/js/app.js` (`onRename`): the bytes of each copy are read and put in the same commit (the new file, then the old path deleted). The role check, the fresh read, the plan and the single commit are as before; the message ends with `and N smaller copies` when there are copies.
- `site/public/admin/js/files-screen.js`: the Rename box of a picture with copies is no longer locked. The question says "Its 2 smaller copies are renamed with it." and the answer ends "... and its 2 smaller copies." The screen's own list of paths follows the new names, so a later Delete or Rename of the same picture still takes the copies along. Replace of a picture with copies still shows the plain sentence of 4c-4a (it comes in 4c-4d).
- Tests: 13 new cases in `file-rename.test.ts`; `admin-files-copies.test.ts` has nine new cases about rename with copies (the old "rename is locked" test is replaced); one full dashboard case in `admin-file-rename.test.ts` (two copies, one commit, three 301s, the media entry moved, the message); the import guard in `hosting-srcset.test.ts` also allows `file-rename.js`. All 3,355 tests pass (3,333 before).
- Seven deliberate mistakes were made one at a time (copies not moved, loop guard removed, new redirects not counted, stale media entry kept, the screen forgetting the new copy names, `onRename` skipping the copies, the message without the count). The first run caught five; the two in `app.js` were not seen, so one full dashboard test was added and then both were caught.
- Card `tasks/open/T-0060.md` (red, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.63) are updated.

**Files**
- Added: `tasks/open/T-0060.md`.
- Changed: `site/public/admin/js/file-rename.js`, `site/public/admin/js/files-screen.js`, `site/public/admin/js/app.js`, `site/tests/unit/file-rename.test.ts`, `site/tests/unit/admin-files-copies.test.ts`, `site/tests/unit/admin-file-rename.test.ts`, `site/tests/unit/hosting-srcset.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with fakes and jsdom only; no real browser, Worker or GitHub token. No copy exists today, so the live dashboard looks and works as before.

## 0.101.62 (2026-11-18): Delete takes the smaller copies along, in ONE commit (PLAN 33.3, 34.5, Phase 3c Part 4c-4b)

**What changed**
- New `site/public/admin/js/file-delete.js` (pure): `planDelete(path, { sitePaths, pub })` returns `{ copies, deletes }`: the picture first, then each copy that exists now (`variantsOnList`), as commit entries `{ path, delete: true }` with the repository prefix. It throws a plain sentence for a path that is not a picture under `/media/` or is already gone. `mapWithout(map, paths)` returns the stored `config/media.json` object without the entries of those paths, and says whether anything changed.
- `site/public/admin/js/app.js` (`onDelete`): the commit list comes from `planDelete` and the `config/media.json` entry (and a stray entry of a copy) from `mapWithout`. The role check, the fresh read of the content, the use check and the single commit are as before; the message now ends with `and N smaller copies` when there are copies. The unused import `removeMedia` is gone from `app.js`.
- `site/public/admin/js/files-screen.js`: the Delete box of a picture with copies is no longer locked. The question says "The file, its 2 smaller copies and its alt text, caption and credit are removed in one commit." and the answer says "Deleted name.webp and its 2 smaller copies." The hidden count goes down by the copies that left. Rename and Replace of a picture with copies still show the plain sentence of 4c-4a (they come in 4c-4c and 4c-4d).
- Tests: new `site/tests/unit/file-delete.test.ts` (22 tests); `admin-files-copies.test.ts` has 29 tests (was 20: the old "delete is locked" test is replaced by ten about the new behaviour); one source guard in `admin-file-delete.test.ts` now names `planDelete`, `...plan.deletes` and `mapWithout`; the import guard in `hosting-srcset.test.ts` also allows `file-delete.js`.
- Nine deliberate mistakes were made one at a time. Eight were caught. The ninth (keeping the list of paths after a delete) showed a line that nothing could observe, so the line was removed.
- Card `tasks/open/T-0059.md` (red, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.62) are updated.

**Files**
- Added: `site/public/admin/js/file-delete.js`, `site/tests/unit/file-delete.test.ts`, `tasks/open/T-0059.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/files-screen.js`, `site/tests/unit/admin-files-copies.test.ts`, `site/tests/unit/admin-file-delete.test.ts`, `site/tests/unit/hosting-srcset.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with fakes and jsdom only; no real browser, Worker or GitHub token. No copy exists today, so the live dashboard looks and works as before.

## 0.101.61 (2026-11-18): The Files screen hides the smaller copies and locks a picture that has copies (PLAN 34.5, Phase 3c Part 4c-4a)

**What changed**
- `site/public/admin/js/files-screen.js`: the screen builds its list without the copies (`name.480w.webp`) whose main picture is in the list (`isVariantOf`). A copy whose main picture is missing stays visible. The count line counts pictures only and, only when copies exist, ends with `, N smaller copies hidden` (`1 smaller copy hidden` for one). Without copies the screen is exactly as before.
- A picture that has copies (`variantsOnList`) shows one plain sentence in the Delete, Rename and Replace boxes instead of the buttons: "This picture has N smaller copies, so it cannot be deleted here yet. This is added in the next version." Nothing is sent. Details (alt text, caption, credit) can still be saved. A picture without copies, and every JPEG, PNG and GIF, works as before.
- New `site/tests/unit/admin-files-copies.test.ts` (20 tests): hiding, the count line, one copy, no copies, a copy without its main picture, search, the lock for each of the three actions, a picture without copies, a JPEG, a stray copy of another picture, the role sentence, saving details, and the source (no `innerHTML`, `makeVariants` named in no dashboard file that switches copies on).
- `site/tests/unit/hosting-srcset.test.ts`: the import guard ("imported only by ...") now also allows `files-screen.js`; nothing else in that file changed.
- Six deliberate mistakes were made one at a time (no hiding, delete unlocked, rename unlocked, replace unlocked, no count, wrong plural); the tests caught each one.
- Card `tasks/open/T-0058.md` (red, in `review`; only the owner closes it). `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json` and `site/package-lock.json` (0.101.61) are updated.

**Files**
- Added: `site/tests/unit/admin-files-copies.test.ts`, `tasks/open/T-0058.md`.
- Changed: `site/public/admin/js/files-screen.js`, `site/tests/unit/hosting-srcset.test.ts`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`, `site/package.json`, `site/package-lock.json`.
- Removed: none.

**Not verified live:** tested with jsdom only; no real browser, Worker or GitHub token. No copy exists today, so the live dashboard looks as before.

## 0.101.60 (2026-11-18): Auto image hosting, the smaller copies go in the ONE commit and are noted in config/media.json (PLAN 34.5, 34.6, Phase 3c Part 4c-3)

**What changed**
- New `site/public/admin/js/hosting-copies.js`: `addCopiesToRun(run, makeVariants)`. It takes the answer of `hostPost` and a maker (`makeVariantMaker` of 4c-2) and returns a NEW run: after each new picture its copies as files `{ src, path, bytes, variant: width }`, and the media row of the picture gets `variants: [480, 800, ...]` (the other keys of the row stay). It never throws.
  - Each copy is checked against the plan of `variantsFor` (same widths, same heights, same paths, WebP bytes). One wrong copy, or a maker that throws, means NO copy and NO `variants` for that picture; the picture itself is still saved and the next picture is still done.
  - One line for each new picture in `copies`: `made` with the widths, `none` with the reason `cannot` (a GIF, a path outside `/media/`, a copy name) or `small` (480 pixels or less), or `failed` with one plain sentence of at most 200 characters.
  - A picture that was reused (not new) gets no copy here, because its bytes are not in the run. A picture whose size is not in the media row gets a plain sentence, never a guess.
- `site/public/admin/js/hosting-commit.js`: a file with `variant` is a copy. It goes in the same commit right after its picture, it is not counted as a picture (`counts.copies` is added only when there are copies, so a run without copies gives exactly the old `counts`), and its bytes are part of `bytes`. The commit is refused with a plain sentence when a copy is not noted in the media row, when a noted width has no copy in the commit, when a copy has no picture in the commit, has no valid width or is not named after its picture, or when the note is not a list of whole widths. All or nothing, both ways.
- `site/public/admin/js/hosting-pipeline.js`: the optional dep `makeVariants`. Empty means off; a preview (`dryRun`) never makes copies and never calls the maker. The answer has a new key `copies` (an empty list when off). When a copy failed, one sentence is added to the message ("1 picture has no smaller copies."). The dashboard does not give `makeVariants` yet (`hosting-setup.js` is not changed), so the live dashboard works as before.
- `NEWS_WEBSITE_PLAN.md` 34.6: one sentence about the `variants` key.
- New `site/tests/unit/hosting-copies.test.ts` (34 tests): the run with copies, the input not changed, several pictures, a GIF, a small picture, a `.webp` outside `/media/` and a copy name, a failed maker, seven ways a copy can differ from the plan, an empty or non-WebP copy, an unknown size, the message cut at 200 characters, nothing to do, odd files, a wrong map, the link to `srcsetValue`; the commit with copies (order, counts, message, bytes, both refusals, bad notes, strays, bad width, bad name, the old checks, one `commitFiles` call); the pipeline (off, on, a failed copy, a preview, a failed commit, nothing to host, the real `makeVariantMaker` with a fake canvas); the source rules (imports, no network or storage, imported only by the pipeline, `hosting-setup.js` and the other dashboard files do not name the maker).
- `site/tests/unit/hosting-srcset.test.ts` and `site/tests/unit/hosting-variants.test.ts`: one import guard each is relaxed (`hosting-copies.js` imports `hosting-srcset.js`; `hosting-copies.js` and `hosting-pipeline.js` name the new functions). The count of tests there did not change.
- Deliberate mistakes: twenty-four in `hosting-copies.js`, `hosting-commit.js` and `hosting-pipeline.js` (plan not checked, width, height or path not compared, answer not WebP, note not written, copies not added, copies before the picture, input changed, maker error thrown, no check of `canHaveVariants`, the small picture sent to the maker, the run used when nothing changed, the message not cut, note not required, missing copy not required, a copy counted as a picture, name not checked, a stray copy allowed, a bad width allowed, a bad note allowed, a preview that makes copies, no sentence for a failed copy, `copies` not returned); all twenty-four are caught. Two more were tried and were not real mistakes: a check of empty bytes that `isWebpBytes` already covers (removed from the code) and a second guard for a GIF that `canHaveVariants` already covers.
- Nothing else changed: no Worker, no config, no content, no CSS, no other JavaScript. `hosting-setup.js` does not give `makeVariants`, so no copy is made in the dashboard. Do not switch copies on before 4c-4.
- Changed: `site/public/admin/js/hosting-commit.js`, `site/public/admin/js/hosting-pipeline.js`, `site/tests/unit/hosting-srcset.test.ts`, `site/tests/unit/hosting-variants.test.ts`, `site/package.json`, `site/package-lock.json` (version 0.101.60), `NEWS_WEBSITE_PLAN.md`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/public/admin/js/hosting-copies.js`, `site/tests/unit/hosting-copies.test.ts`, `tasks/open/T-0057.md`. Removed: none.
- Tests: 159 files, 3282 tests (before: 158 files, 3248).

## 0.101.59 (2026-11-18): Auto image hosting, the browser step that makes the smaller copies for srcset (PLAN 34.5, Phase 3c Part 4c-2)

**What changed**
- `site/public/admin/js/hosting-optimize.js` has four new functions. Nothing calls them yet, so no file is made, no page changes and the dashboard works as before.
  - `makeVariants(main, deps)`: `main` is `{ path, bytes, width, height }` of the optimized WebP. The sizes come only from `variantsFor` (`hosting-srcset.js`), so a copy is only for a width STRICTLY narrower than the picture. It returns `[{ width, height, path, bytes }]`, narrowest first. A GIF, JPEG, PNG, a path outside `/media/` or a picture of 480 pixels or less gives `[]` and the browser step is not called.
  - All or nothing: the main bytes must be WebP, every answer must be WebP, and one failed copy fails the whole call with a plain sentence that names the width ("The 800 pixel copy could not be made: ..."). A `srcset` can therefore never name a copy that does not exist. An unknown width or height is refused with the sentence of `variantsFor`; a size is never guessed.
  - `resizeWebp(bytes, width, height)`: the default browser step (decode, draw at the planned size with high smoothing, encode WebP at 0.85, close the bitmap). A browser that cannot make WebP throws "This browser cannot make WebP copies." There is no JPEG copy, because the name of a copy ends in `.webp`.
  - `makeVariantMaker(deps)` (the function the commit part will call) and `isWebpBytes(bytes)` (`RIFF`, four size bytes, `WEBP`).
  - The copies are made from the already optimized main WebP (at most 2400 wide), not from the original file. The main bytes are never changed.
- New `site/tests/unit/hosting-variants.test.ts` (33 tests): which copies for 2400, 1000, 1600, 481 and 480 pixels; the heights (rounded, at least 1); agreement with `variantsFor` and `srcsetValue`; the order and the arguments of the browser step; every refusal and the all-or-nothing rule; the real default step with a fake canvas; the picture step before it; the source imports only `image.js` and `hosting-srcset.js`, no network, no storage, no page access, no other file calls the new functions, no emoji.
- `site/tests/unit/hosting-srcset.test.ts`: one test changed. It said "imported by no other file"; now `hosting-optimize.js` imports it and no other file does. The count of tests there did not change.
- Deliberate mistakes in `hosting-optimize.js`: thirteen (main bytes not checked, answer not checked, error swallowed, width and height swapped, order reversed, quality 0.5, a JPEG answer accepted, the WebP check only on `RIFF`, bitmap not closed, smoothing off, only two widths made, a GIF given copies, main bytes changed); all thirteen are caught.
- Nothing else changed: no Worker, no config, no content, no CSS, no other JavaScript.
- Changed: `site/public/admin/js/hosting-optimize.js`, `site/tests/unit/hosting-srcset.test.ts`, `site/package.json`, `site/package-lock.json` (version 0.101.59), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/tests/unit/hosting-variants.test.ts`, `tasks/open/T-0056.md`. Removed: none.
- Tests: 158 files, 3248 tests (before: 157 files, 3215).

## 0.101.58 (2026-11-17): Auto image hosting, the rules of the smaller copies for srcset (PLAN 34.5, Phase 3c Part 4c-1)

**What changed**
- New `site/public/admin/js/hosting-srcset.js`: plain functions, no network, no screen, no storage. Nothing calls it yet, so no file is made and no page changes.
  - `parseVariant`, `canHaveVariants`, `variantPath`: a copy is named with a DOT and the width, `name.480w.webp`. A main name never holds a dot (`seoName` makes only a-z, 0-9 and hyphens; the rename check refuses a dot), so a main picture is never taken for a copy. Only a `.webp` under `/media/` that is not a copy can have copies; a GIF, JPEG or PNG gets none. `a.0480w.webp` and a width outside `SRCSET_WIDTHS` are not copies.
  - `variantWidths`, `variantsFor`: a copy only for a width STRICTLY narrower than the picture (the main file is its own largest size); the height is scaled, rounded and at least 1; narrowest first. A picture of unknown size gets a plain message, never a guess.
  - `srcsetValue`: the copies and then the main file with its true width; empty when there is no copy.
  - `variantsOnList`, `isVariantOf`, `withoutVariants`: for the Files screen and for a later delete or rename. A copy whose main picture is missing is NOT hidden, so nothing disappears by mistake.
- New `site/tests/unit/hosting-srcset.test.ts` (30 tests): every function with its edges; the link to `imgAttributes` (same widths except a width equal to the picture); `seoName` and the rename check can never make a copy name; the source has no network, storage or page access, imports only `hosted-meta.js` and `media-meta.js`, is imported by no other file, no emoji.
- Deliberate mistakes in `hosting-srcset.js`: thirteen (a copy as wide as the picture, the width list not checked, a leading zero accepted, a copy of a copy, any width, the main file missing in `srcset`, height rounded down, a height of 0, an orphan hidden, the list ignored, a GIF with copies, all widths listed as existing, an unknown height accepted); all thirteen are caught.
- The first test run found one real bug: `a.0480w.webp` was read as a copy of width 480. Fixed: the written width must be exactly the number.
- Nothing else changed: no Worker, no config, no content, no CSS, no other JavaScript.
- Changed: `site/package.json`, `site/package-lock.json` (version 0.101.58), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/public/admin/js/hosting-srcset.js`, `site/tests/unit/hosting-srcset.test.ts`, `tasks/open/T-0055.md`. Removed: none.
- Tests: 157 files, 3215 tests (before: 156 files, 3185).

## 0.101.57 (2026-11-17): Auto image hosting, the review marker on the Files screen (PLAN 34.5, Phase 3c Part 4b)

**What changed**
- `site/public/admin/js/files-screen.js`: a picture whose alt text was written automatically (`autoAlt: true` in `config/media.json`, set by `recordHosted`) is now marked.
  - The tile shows "alt text to review"; the count line gets ", N to review" only when N is above 0 (with no marked file the line is the old text).
  - The editor shows a note ("written for you ... press Save details") for a role that can edit; the mark in the grid shows for every role.
  - Save details sends `autoAlt: null` to `onSave` only for a marked file, so `mergeMedia` drops the mark. The alt text and the other stored keys (source, hash, size) stay. A file with no mark sends exactly `alt`, `caption`, `credit` as before. A failed Save or a red error keeps the mark.
  - `app.js` is not changed: its `onSave` already passes the fields to `mergeMedia`. A test checks that this line stays.
  - A file with the flag but no alt text is not marked for review (it shows as "no alt text"); a flag that is not exactly `true` is ignored (`autoAltFiles`).
- `site/public/admin/admin.css`: two small rules at the end (`.tile .review-badge`, `.review-note`), colour variables only, the text in the ink colour (the warn colour is only the edge, because the warn text colour is 4.46:1 on the tile colour).
- New `site/tests/unit/admin-files-review.test.ts` (16 tests, jsdom, the real screen with a fake `onSave` that merges like `app.js`): no mark, the mark and the count, flag without alt text, odd flag values, plain text (no HTML), the note and the read-only role, Save clears the mark, a corrected alt text, a file without mark sends three fields, a failed Save, a red error, the `app.js` line, `mergeMedia` and a null key, the CSS block, 4.5:1 contrast in light and dark.
- Deliberate mistakes in `files-screen.js`: eight (badge removed, mark never cleared, null sent for every file, note shown to a read-only role, count always shown, every file marked, note removed, editor flag not read from the map); all eight are caught.
- Nothing changed in `app.js`, the Workers, the config or the content. No file has `autoAlt` today, so the live dashboard looks as before.
- Changed: `site/public/admin/js/files-screen.js`, `site/public/admin/admin.css`, `site/package.json`, `site/package-lock.json` (version 0.101.57), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/tests/unit/admin-files-review.test.ts`, `tasks/open/T-0054.md`. Removed: none.
- Tests: 156 files, 3185 tests (before: 155 files, 3169).

## 0.101.56 (2026-11-17): Auto image hosting, the style of the pictures list (PLAN 34.3, Phase 3c Part 3c-8d)

**What changed**
- `site/public/admin/admin.css`: one new marked block at the end (comment "Pictures list of auto image hosting"). It styles what `hosting-screen.js` draws: the box `.hosting-result`, the list `.hosting-list`, each row `.hosting-row` with a coloured left edge for the tones `good`, `info`, `warn` and `bad`, the button row, the status line, a narrow screen rule (buttons full width under 480 px) and, last, `.hosting-result [hidden]{display:none}` so a hidden part stays hidden.
  - Only the colour variables of `:root` are used, so dark mode follows the page. No fixed colour, no emoji, no JavaScript.
  - The box sits on the page colour and each row on the white card colour. The contrast test found that the yellow label was 4.46:1 on the page colour (needs 4.5:1); on the card colour it passes, and the global `--warn` is not changed.
- New `site/tests/unit/admin-hosting-style.test.ts` (8 tests): the block exists once; every class of the screen is styled; every tone of `TONES` has a rule (a new tone fails the test); no fixed colour; the `hidden` rule is last; the narrow screen rule; 4.5:1 for the label and status colours in light and dark; no emoji.
- Deliberate mistakes in `admin.css`: six (a tone rule removed, a fixed colour, the `hidden` rule removed, the row back on the page colour, the narrow rule removed, the list rule removed); all six are caught.
- No JavaScript, Worker, config or content file changed. The live site and the dashboard work as before.
- Changed: `site/public/admin/admin.css`, `site/package.json`, `site/package-lock.json` (version 0.101.56), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/tests/unit/admin-hosting-style.test.ts`, `tasks/open/T-0053.md`. Removed: none.
- Tests: 155 files, 3169 tests (before: 154 files, 3161).

## 0.101.55 (2026-11-17): Auto image hosting, the hook in Save (PLAN 34.3, Phase 3c Part 3c-8c-2)

**What changed**
- `site/public/admin/js/app.js`: `save()` of the post editor now calls `runHostingSave` (from `hosting-hook.js`) after the checks and before the normal write. A few lines, no new logic: every decision is made in `hosting-hook.js`.
  - Import `runHostingSave` and `freshOrig`; `orig` is now `let` (it must be refreshed after a hosted save); a new place `hostBox` (`data-hosting="box"`) in the form, above the Save buttons, shows the list of pictures.
  - `stop`: Save stops, nothing is written, the list stays, a plain sentence is shown. `saved`: the flow already wrote the post in ONE commit, so the normal write is skipped; the editor shows the new addresses (`body`, `image`, `imageAlt`, `ogImage`); when some pictures still need the writer the editor stays open and `orig` gets the new file sha, otherwise it goes to the post as before. `normal`: Save goes on as before; if every picture failed, the post is saved as it was, `orig` gets the new sha and the list stays for Retry.
  - A later Retry or Confirm that makes a commit updates the editor the same way (`onSaved`).
  - Empty `imagesUrl` (today in `admin/config.json`) means OFF: no Worker call, no change for the writer.
- New `site/tests/unit/admin-app-hosting.test.ts` (8 tests, jsdom, the real app behind a fake GitHub and a fake picture service): off, on with no outside picture, one hosted picture (one commit, no second write, editor shows `/media/`), a failed commit (stop, no token), every picture failed (one normal write, list stays), Retry after a failure, one picture good and one failed (editor keeps the second, next Save uses the fresh file sha), and source checks.
- `site/tests/unit/hosting-hook.test.ts`: one line changed on purpose. It said that `app.js` must not import `hosting-hook`; it now says that `app.js` imports it and `main.js` still does not.
- Deliberate mistakes in `app.js`: eight (post written twice, stop ignored, editor not updated, Retry not handled, list not mounted, stale `orig`, `canEdit` forced on, wrong stay rule); all eight are caught.
- Changed: `site/public/admin/js/app.js`, `site/tests/unit/hosting-hook.test.ts`, `site/package.json`, `site/package-lock.json` (version 0.101.55), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New: `site/tests/unit/admin-app-hosting.test.ts`, `tasks/open/T-0052.md`. No file was removed.

**Checks**
- Before: 153 test files and 3153 tests. After: 154 test files and 3161 tests, all passing.

**Not done**
- The key `imagesUrl` in `admin/config.json` and the deploy of the images Worker (owner steps), the style rules for `.hosting-row` in `admin.css` (the list shows without its own style until then), the srcset files, the review marker on the Files screens, Parts 5 to 8. Not verified live: tested in jsdom and with fakes, not in a real browser.

## 0.101.54 (2026-11-17): Auto image hosting, the Save hook helper (PLAN 34.3, Phase 3c Part 3c-8c-1)

**What changed**
- New `site/public/admin/js/hosting-hook.js`. It makes every decision that the hook in `save()` of `app.js` needs, as plain functions, so the hook (Part 3c-8c-2) stays a few lines. Nothing calls it yet, so the live site and the dashboard are unchanged.
  - `runHostingSave({ cfg, gh, next, body, orig, newPath, tree?, canEdit?, dryRun?, fetch?, optimizeDeps?, mount?, onSaved? })` answers `{ action, message, reason?, open?, flow? }` and never throws. `normal`: Save goes on as before (hosting is off, not needed, not possible, or nothing could be changed; `message` is a plain sentence for a setup problem, a moved post or a run that changed nothing). `saved`: the flow made ONE commit that already holds the post file, so Save must not write the post again (its old file sha would be stale); `open` is how many pictures still need the writer. `stop`: nothing was written and Save stops; the list stays so the writer can read it.
  - `mount(el)` gets the list before the run starts. `onSaved({ fields, open, message })` is called after every run that made a commit, also after a later Retry or Confirm, with only the text fields `body`, `image`, `imageAlt`, `ogImage` that the editor must show. A `mount` or an `onSaved` that throws is ignored.
  - `hostingOutcome(started, answer)` is the decision table as one pure function. `editorFieldsFrom(post)` and `openCount(list)` are its two small helpers. `origFrom(next, path, sha)` builds the `orig` of the editor in the same shape as `app.js` (category, permalink, date, status, robots, canonical, path, sha). `freshOrig(gh, next, path)` is `origFrom` with the sha that GitHub holds now, or `null` when the file cannot be read (the caller then reloads the post instead of guessing).
  - It never changes the editor's `next` or `orig`, and puts no token or Worker address in a message. The file has no network call, no storage, no page access and no emoji, and `app.js` and `main.js` do not import it (tests read the files).
- New test file `site/tests/unit/hosting-hook.test.ts` (30 tests, jsdom): every row of the decision table, every case where hosting does not apply (no Worker call, no commit), one hosted picture (one commit, all editor fields kept, new addresses given to `onSaved`), a failed picture followed by a working Retry, a failed commit (stop, no token anywhere), bad input, `origFrom` and `freshOrig`, and the source checks.
- Deliberate mistakes: fourteen; twelve were caught at once. Two change nothing on purpose: the flow already guards an `onSaved` that throws, and `onResult` is always replaced by the hook's own.
- Changed: `site/package.json`, `site/package-lock.json` (version 0.101.54), `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`. New card `tasks/open/T-0051.md`. No file was removed.

**Checks**
- Before: 152 test files and 3123 tests. After: 153 test files and 3153 tests, all passing.

**Not done**
- The wiring in `save()` of `app.js` (Part 3c-8c-2: call `runHostingSave`, skip the normal write on `saved`, stop on `stop`, put `onSaved` fields into the editor, refresh `orig` with `freshOrig`), the key `imagesUrl` in `admin/config.json`, the style rules for `.hosting-row` in `admin.css`, the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still NOT deployed. Not verified live: tested in jsdom and with fakes, not in a real browser.

## 0.101.53 (2026-11-17): Auto image hosting, the Save adapter (PLAN 34.3, Phase 3c Part 3c-8b)

**What changed**
- New `site/public/admin/js/hosting-save.js`. It is everything the Save of the editor needs before it can call `hostingFlow`, so the hook in `app.js` (Part 3c-8c) stays short. Nothing calls it yet, so the live site and the dashboard are unchanged.
  - `startHostingSave({ cfg, gh, next, body, orig, newPath, tree?, canEdit?, onResult?, dryRun?, fetch?, optimizeDeps? })` answers `{ use: false, reason, message }` or `{ use: true, flow, deps }`. Reasons: `off` (no `imagesUrl`: Save works as before), `setup` (a plain sentence says why), `archived`, `no_pictures` (the Worker is not called), `moved`.
  - A post that moves to a new address (the new path is not the old path) is NOT hosted in that Save: the normal Save must remove the old file, and a commit of the pipeline would collide with it. The sentence says to save again after the move. An edit in place is hosted.
  - `hostingPostOf(next, body)` gives the post as the pipeline reads it (the permalink becomes `handle`). `makePostSerializer(next)` writes the file text with every field of the editor and takes only `body`, `image`, `imageAlt` and `ogImage` from the pipeline; a field the pipeline did not give as text keeps the editor's value. `existingFromTree(tree, pub)` lists the `/media/...` addresses already in the repository, so a taken name gets `-2`.
  - It never throws, never changes the editor's `next` or `orig`, and puts no token or Worker address in a message. The file has no network call, no storage, no page access and no emoji, and `app.js` and `main.js` do not import it (tests read the files).
- New test file `site/tests/unit/hosting-save.test.ts` (26 tests, jsdom): the three small functions, every reason, and the real flow (the real `hostingSetup`, pipeline, commit and screen behind a fake Worker call and a fake GitHub): one commit holding the pictures, `config/media.json` and the post file with all editor fields; the token only in the Bearer header to `/fetch`; a preview writes nothing; a failed picture stays in the saved post and Retry hosts it later; `canEdit: false` hides the buttons; a taken name gets a number.
- Changed `site/tests/unit/hosting-setup.test.ts` (now 22 tests, the same count): the preview test was too loose (it accepted a failed run); it now needs status `preview` and one hosted row. The loose test had hidden a mistake of the test itself (a fake hash that was not hexadecimal), not of the code.
- Deliberate mistakes: thirteen; eleven were caught at once, two gaps closed (`canEdit` and the repository name list now have tests).

**Checks**
- Before: 151 test files and 3097 tests. After: 152 test files and 3123 tests, all passing.

**Not done**
- The hook in `app.js` (Part 3c-8c: call `startHostingSave` in `save()`, show `flow.el`, put `onResult` into the editor, keep the page until the list is closed), the key `imagesUrl` in `admin/config.json`, the style rules for `.hosting-row` in `admin.css`, the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still NOT deployed. Not verified live: tested in jsdom and with fakes, not in a real browser.

## 0.101.52 (2026-11-17): Auto image hosting, the setup (PLAN 34.3, Phase 3c Part 3c-8a)

**What changed**
- New `site/public/admin/js/hosting-setup.js`. It joins what the dashboard knows (`admin/config.json` and the signed-in GitHub client) to what `hostingFlow` needs (`deps`). Nothing calls it yet, so the live site and the dashboard are unchanged. `hostingSetup({ cfg, gh, postPath, serializePost, existing?, fetch?, optimizeDeps? })` answers `{ ok: true, deps }` or `{ ok: false, off, message }`; `hostingEnabled(cfg)` and `mediaPathOf(cfg)` are small helpers.
  - The address of the picture service is the optional key `imagesUrl` in `admin/config.json`, next to `authUrl` (new decision 52; the owner may move it). Empty or missing means OFF (`off: true`): the Save of the editor then works as before.
  - Other optional keys: `ownHosts`, `agencyHosts`, `blockHosts` (lists of website names; cleaned, lower case, no repeat, at most 200). The own website name is taken from `siteUrl`.
  - The media file is `<contentRoot>/config/media.json` (`site/config/media.json` here).
  - `deps` holds only what `savePostWithHosting` reads: `gh`, `postPath`, `mediaPath`, `serializePost`, `fetchPictures` (from `makeFetchPictures`, with the token of `gh`), `optimize` (from `makeOptimizer`), `ownHosts`, `existing`, and the two lists only when the config has them. There is no `token`, `dryRun` or `confirmed` key.
  - It never fetches, never writes and never throws. A bad address, a missing GitHub client or a missing post path is one plain sentence with no token and no address in it.
  - The file has no network call, no storage, no page access and no emoji (a test reads the file), and no other file imports it yet (a test checks that too).
- New test file `site/tests/unit/hosting-setup.test.ts` (22 tests): off, bad address, bad client, deps shape, own hosts, lists, token only in the Bearer header, and two tests with the real `savePostWithHosting` in preview mode (the Worker is called at `/fetch`, nothing is committed; a post with no outside picture asks the Worker nothing).
- Deliberate mistakes: nine; seven were caught at once, one gap closed (the cut at 200 names now has a test), one harmless (an extra key that `makeFetchPictures` ignores).

**Checks**
- Before: 150 test files and 3075 tests. After: 151 test files and 3097 tests, all passing.

**Not done**
- The hook into Save and Paste (Part 3c-8b), the style rules for `.hosting-row` in `admin.css`, the srcset files, the review marker on the Files screens, Parts 5 to 8. The images Worker is still NOT deployed. Not verified live: nothing here runs on the live site; tested in jsdom and with fakes, not in a real browser.

## 0.101.51 (2026-11-17): Auto image hosting, the flow (PLAN 34.3 steps 8 and 9, Phase 3c Part 3c-7)

**What changed**
- New `site/public/admin/js/hosting-flow.js`. It joins the pipeline (`savePostWithHosting`) and the screen (`hostingScreen`) in one object, so the hook into Save only has to call it. Nothing calls it yet, so the live site and the dashboard are unchanged. `hostingFlow({ post, deps, dryRun?, onResult?, onReplace?, canEdit? })` answers `{ el, start(), state() }`:
  - `start()` runs the first Save (or a preview), draws the list and answers the last result. A second `start()` while one runs gives the same promise and makes no second run.
  - Retry runs the pipeline again from the post of the run before; the pipeline finds the pictures that are still outside, so a picture that is already hosted is not downloaded again. After a failed commit the next run starts from the post AS IT WAS.
  - Confirm remembers the confirmed addresses (or the host name for Confirm all from the host; only pictures that really wait, by `confirmFor`) and runs again. A Confirm that confirms nothing starts no run and says so. The confirmation is kept when the run after it fails.
  - `onResult(result)` is called after every run that did not fail, so the editor can put `result.next.post` in its text field. A callback that throws is ignored: it can not undo a save.
  - Only the value `true` of `dryRun` makes a preview; every run of a preview is a preview.
  - One run at a time: the screen disables its buttons and the flow refuses a second run itself. A failed run shows one plain sentence with no token and keeps the list.
  - The post of the editor is copied and never changed. `state()` gives copies. Bad input never throws.
  - The file has no `innerHTML`, no network, no storage, no token and no emoji (a test reads the file).
- Changed `site/public/admin/js/hosting-screen.js`: the answer has a new `say(message, bad?)` (one plain sentence, tokens hidden, shown as text) that the flow uses.
- New test file `site/tests/unit/hosting-flow.test.ts` (34 tests, jsdom, a fake GitHub that remembers the media file and a fake picture service) and three new tests for `say` in `site/tests/unit/hosting-screen.test.ts` (now 58). While writing them one wrong idea of mine was found: a button that was switched off with its job can not be clicked later, so the test of a stale Confirm now switches it on by hand to reach the flow itself.
- Version 0.101.51.

**Not done**
- The hook into Save and Paste of the editor (it must build `makeFetchPictures` with the token and give `hostingFlow` its `deps`), the setting for the Worker address, the style rules for `.hosting-row` in `admin.css`. The images Worker is still not deployed.
- Retry on one row runs the pipeline for every picture that is still outside, not only that row (the pipeline has no way to name one address). Nothing is lost by it; it may fetch more than the writer pressed.
- Not verified live: no real browser, no real Worker, no real GitHub token.

**Checked**
- Tests: 149 files and 3038 tests before, 150 files and 3075 tests after (37 new). Twenty-three deliberate mistakes on the flow: nineteen caught at once; one of mine was written wrongly (it hit the declaration, so the file did not even load) and was written again and caught; one is harmless (the second hiding of a token in `start()` gives the same answer because the screen hides tokens too); two gaps (a post that is not an object, `onReplace` not passed on) were closed with three new tests and then caught.

**Files**
- Added: `site/public/admin/js/hosting-flow.js`, `site/tests/unit/hosting-flow.test.ts`, `tasks/open/T-0048.md`.
- Changed: `site/public/admin/js/hosting-screen.js`, `site/tests/unit/hosting-screen.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.50 (2026-11-17): Auto image hosting, the result list screen (PLAN 34.3 steps 8 and 9, Phase 3c Part 3c-6)

**What changed**
- New `site/public/admin/js/hosting-screen.js`. It only DRAWS the data of `hosting-result.js` and calls the functions it is given. Nothing calls it yet, so the live site and the dashboard are unchanged. `hostingScreen({ list | run, onRetry, onConfirm, onReplace?, canEdit? })` answers `{ el, update(listOrRun), setBusy(bool) }`:
  - The headline, the rights notice and the note about alt text that was written for the writer.
  - One row for each picture with its label, short address (the full address is in the tooltip), sentence and hint, and a tone word that is checked against the known words.
  - The buttons: Retry (only where trying again can help), Confirm and Confirm all from the host (only for a picture that waits), Show in post (only for a picture to replace, and only when `onReplace` is given). A refused picture, a hosted picture and a reused picture have no button. `canEdit: false` draws no button at all.
  - The bar above the list: Retry N pictures and Confirm N pictures, each address counted once.
  - One job at a time: every button is disabled while a job runs, and the job also refuses to start a second one even if a button is switched on by hand. A job that throws shows one plain sentence (tokens are hidden) and the list stays as it was. A job may answer `{ list | run, message }` to redraw the list and show a sentence.
  - Every text goes in as a text node: an address or a sentence with tags is shown as text, never as HTML. The file has no `innerHTML`, no network, no storage, no token and no emoji (a test reads the file).
- New test file `site/tests/unit/hosting-screen.test.ts` (55 tests, jsdom). While writing them two real mistakes were found and fixed at once: a text message from a job was replaced by the default sentence, and `hostingScreen(null)` threw.
- Version 0.101.50.

**Not done**
- The hook into Save and Paste (it must pass `makeFetchPictures`, the token and `savePostWithHosting`), the setting for the Worker address, the style rules for `.hosting-row` in `admin.css`. The images Worker is still not deployed.
- Not verified live: no real browser, no real Worker, no real GitHub token.

**Checked**
- Tests: 148 files and 2983 tests before, 149 files and 3038 tests after (55 new). Twenty deliberate mistakes: seventeen caught at once; three gaps (the host button without a host name, the second job guard, the Show in post guard) were closed with three new tests and then caught.

**Files**
- Added: `site/public/admin/js/hosting-screen.js`, `site/tests/unit/hosting-screen.test.ts`, `tasks/open/T-0047.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.49 (2026-11-17): Auto image hosting, the pipeline (PLAN 34.3, Phase 3c Part 3c-5)

**What changed**
- New `site/public/admin/js/hosting-pipeline.js`. It has no screen and nothing calls it yet, so the live site and the dashboard are unchanged. It joins the parts that already exist (`hostPost`, the result list, the one commit) in one function:
  - `savePostWithHosting(post, deps)` reads `config/media.json`, runs `hostPost`, builds the result list and makes ONE commit (the pictures, the post, `config/media.json`). It never throws: it answers `{ ok, status, message, run, list, commit, next }` with `status` `saved`, `nothing`, `preview` or `error`, and one plain sentence in `message` (the headline of the list is part of it).
  - The setup (GitHub connection, the paths, the way to write the post) is checked BEFORE any picture is fetched, so no download is wasted on a save that could not be written. A post with outside pictures and no valid date stops with its plain sentence before any download.
  - `config/media.json` is read fresh before the run AND again just before the commit; only the NEW rows of this run are added to the fresh file, so a save made by someone else in between is never lost. If the same picture name was taken in between, nothing is written and the message says so. A missing file is an empty map; a file that is not valid JSON or not an object stops the save before any download.
  - `dryRun` makes the same run and writes nothing (for a Paste preview). Any value that is not empty means preview, so a stray value can never turn a preview into a real save.
  - A failed picture stays as it was in the post, and the post is still saved with the rest. A failed commit changes nothing; `next` then carries the post AS IT WAS (not the new addresses, whose pictures were never saved). After `saved`, `next` carries the saved post and the saved map, so Retry and Confirm fetch only the pictures that are still outside.
  - `plainMessage(e)` makes one line of at most 200 characters and hides tokens (`ghp_...`, `github_pat_...`, any run of 32 or more letters and digits). No token is ever put into a message.
  - The pictures must stay inside `site/public/media/` (`MEDIA_DIR`), an extra check of the commit.
- New test file `site/tests/unit/hosting-pipeline.test.ts` (48 tests): the save with a fake GitHub object and with the REAL GitHub client behind a fake network (one commit, one branch move, no PUT or DELETE, the 422 sentence), preview, the setup checks, every state of the media file, a save made by someone else in between (merge and name clash), a failed commit, Retry and Confirm end to end through two saves, and bad input.
- Version 0.101.49.

**Not done**
- The screen that draws the list and its buttons, the hook into Save and Paste, the setting for the Worker address. The images Worker is still not deployed.
- Not verified live: no real Worker, no real GitHub token, no real browser. Tested with the real GitHub client code behind a fake network.

**Checked**
- Tests: 147 files and 2935 tests before, 148 files and 2983 tests after (48 new). Twenty-eight deliberate mistakes: twenty-five caught at once; two gaps (the folder of the pictures, a stray value of `dryRun`) were closed with new tests and then caught; one mistake (removing the early return for a run that changed nothing) gives the same answer by another route, so it cannot be caught and is harmless.

**Files**
- Added: `site/public/admin/js/hosting-pipeline.js`, `site/tests/unit/hosting-pipeline.test.ts`, `tasks/open/T-0046.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.48 (2026-11-17): Auto image hosting, the result list data (PLAN 34.3 steps 8 and 9, Phase 3c Part 3c-4)

**What changed**
- New `site/public/admin/js/hosting-result.js`. It is pure (no network, no screen, no storage) and nothing calls it yet, so the live site and the dashboard are unchanged. It turns the answer of `hostPost` into the DATA of the result list that the dashboard will draw:
  - `buildResultList(run)` gives one row for each picture (number, address, short address, host, place in the post, status, label, colour word, plain sentence, hint, one action) and the totals: counts, one headline sentence, the addresses for Retry, the addresses that wait for Confirm, the addresses the writer must replace, `canSave`, the rights notice and how many automatic alt texts still wait for a review.
  - The action of a row is `retry` only for a failed picture where trying again can help (the other website was slow or not reachable, the service was busy, switched off or not answering, the sign in ran out, the data arrived damaged). A picture that is gone, too big, not a picture, an SVG, a GIF over 5 MB or not convertible gets `replace` with the sentence "Waiting will not fix this". A refused picture is never offered Retry or Confirm. A status the file does not know is shown as failed with `replace`.
  - `confirmFor(list, confirmed, { urls?, wholeHost? })` gives the new `confirmed` list for the next `hostPost`: the address without its `#fragment`, or the whole host name. Only a picture that really waits for confirmation can be confirmed; a refused picture, a failed picture or a made up address is ignored. Nothing is added twice and the input is not changed.
  - `carryOver(run)` gives `{ post, map }` for the next run (Retry or Confirm): the post with the hosted addresses already written in and the new media map, copied. The next `hostPost` then asks the service only for the pictures that are still outside.
  - `shortUrl(url)` cuts an address to 70 characters for a narrow row; the full address stays in the row. The screen must show every text of a row as TEXT, never as HTML, because the address of a picture is written by someone else (a test keeps this visible).
- New test file `site/tests/unit/hosting-result.test.ts` (49 tests; nine of them run the real `hostPost` with a fake picture service: the first run with one hosted, one slow, one agency and one refused picture, Retry (the hosted picture is not downloaded again), Confirm, a service that is switched off, a picture that is gone, everything hosted, and a post with no outside pictures).
- Version 0.101.48.

**Not done**
- The screen itself (the drawing of the list with the Retry, Confirm and Replace buttons), the hook into Save and Paste, reading `config/media.json` again just before the commit, the setting for the Worker address. The images Worker is still not deployed.
- Not verified live: no real Worker, no real GitHub token, no real browser.

**Checked**
- Tests: 146 files and 2886 tests before, 147 files and 2935 tests after (49 new). Twenty-four deliberate mistakes (a wrong retry word, a list that forgets a group, a copy that is not a copy, a cut that is one character too long, a status that is not turned into failed, and more): all twenty-four caught at once.

**Files**
- Added: `site/public/admin/js/hosting-result.js`, `site/tests/unit/hosting-result.test.ts`, `tasks/open/T-0045.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.47 (2026-11-17): Auto image hosting, the call to the images Worker (PLAN 34.8, Phase 3c Part 3c-3)

**What changed**
- New `site/public/admin/js/hosting-client.js`. Nothing calls it yet, so the live site and the dashboard are unchanged. It makes the `fetchPictures(urls)` function that `hostPost` asks for:
  - `makeFetchPictures({ endpoint, token, fetch?, timeoutMs? })` sends `POST <endpoint>/fetch` with `{ "urls": [...] }` and `Authorization: Bearer <GitHub token of the signed-in user>` (the Worker asks GitHub who the token belongs to). No cookies, no referrer, no cache; a time limit of 120 seconds (changeable); at most 30 addresses.
  - `imagesUrl(endpoint)` gives the exact address that is called: https only, no user name, query or hash, no other path (a trailing slash or `/fetch` is fine).
  - A bad address list, a bad Worker address or a token of a shape the Worker would refuse is stopped BEFORE any request.
  - Every way of failing becomes a reason word with a plain sentence: 401 `sign_in`, 403 `not_allowed`, 413 `call_too_big`, 429 `rate_limited` (the wait of `Retry-After` is read, 1 to 600 seconds), 503 `worker_off`, anything else, a broken answer, no network or a timeout `worker_failed`. The text of a network error is never passed on, and the token is in no answer.
- `site/public/admin/js/hosting-run.js`: four new reason words with plain sentences (`sign_in`, `not_allowed`, `rate_limited`, `worker_off`), so the result list can say what happened instead of one general sentence. Nothing else changed; its 25 tests pass unchanged.
- New test file `site/tests/unit/hosting-client.test.ts` (23 tests; six of them run the REAL images Worker code behind a fake network together with `hostPost`: a good run, a login that is not allowed, a token GitHub does not know, the kill switch, the rate limit with 31 pictures in two groups, and a picture that is gone).
- Version 0.101.47.

**Not done**
- The result list screen with Retry and Confirm, the hook into Save and Paste, reading `config/media.json` again just before the commit. The images Worker is still not deployed, and no screen knows its address yet (it will be a setting).
- Not verified live: no real Worker, no real GitHub token, no real browser.

**Checked**
- Tests: 145 files and 2863 tests before, 146 files and 2886 tests after (23 new). Twenty-five deliberate mistakes: twenty-four caught at once; the default time limit was not tested, a test was added and it is caught.

**Files**
- Added: `site/public/admin/js/hosting-client.js`, `site/tests/unit/hosting-client.test.ts`, `tasks/open/T-0044.md`.
- Changed: `site/public/admin/js/hosting-run.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.46 (2026-11-17): Auto image hosting, the one commit (PLAN 34.3, Phase 3c Part 3c-2)

**What changed**
- New `site/public/admin/js/hosting-commit.js`. Nothing calls it yet, so the live site and the dashboard are unchanged. It turns the answer of `hostPost` into ONE commit, all or nothing:
  - `buildHostingCommit(run, o)` (pure): the new pictures, then the post file, then `config/media.json`, in one list, with one short commit message (`admin: host 2 pictures for phone-launch`, or `admin: use 1 hosted picture in ...` when only reused pictures were put in). A run that changed nothing (for example every picture failed) gives `null`: no empty commit. A run that only reuses pictures saves the post alone, without a new media file.
  - It refuses with a plain sentence, before any request: a bad or unsafe path (empty, absolute, `..`, `//`, backslash, control character, 400 characters or more), the post file and the media file being the same file, a picture outside the media folder, the same path twice, an empty picture, a picture without its media row, an empty post text, a media map that is not an object.
  - `commitHosting(gh, run, o)`: builds, then calls `gh.commitFiles` (one tree, one commit, the branch moves only if nobody else saved). If an upload fails the branch is not moved; if somebody else saved at the same moment the plain sentence of `github.js` is shown and nothing is forced.
  - `o` is `{ postPath, serializePost, mediaPath, mediaDir }`: the caller says where the post and `config/media.json` live and how a post is written, so this file knows nothing about the dashboard screens.
- New test file `site/tests/unit/hosting-commit.test.ts` (22 tests; the commit runs through the real `GitHub` client behind a fake network, and one test runs `hostPost` first and checks the post text and the media row inside the commit).
- Version 0.101.46.

**Not done**
- The call to the Worker with the GitHub token, the result list screen with Retry and Confirm, the hook into Save and Paste. The images Worker is still not deployed.
- A known limit: `commitFiles` writes the whole `config/media.json` text it is given, so if another editor changed that file after this run read it, their rows would be replaced. The next part must read `config/media.json` again just before the commit (the same care as the other screens).

**Checked**
- Tests: 144 files and 2841 tests before, 145 files and 2863 tests after (22 new). Eighteen deliberate mistakes: seventeen caught at once; the path-length rule was not tested, a test was added and it is caught.

**Files**
- Added: `site/public/admin/js/hosting-commit.js`, `site/tests/unit/hosting-commit.test.ts`, `tasks/open/T-0043.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.45 (2026-11-17): Auto image hosting, the browser picture step (PLAN 34.3, Phase 3c Part 3c-1)

**What changed**
- New `site/public/admin/js/hosting-optimize.js`. Nothing calls it yet, so the live site and the dashboard are unchanged. It turns `prepareImage` (which wants a File) into the `optimize(bytes, kind)` function that `hostPost` asks for:
  - `optimizePicture(bytes, kind, deps)`: makes a Blob of the right type for the kind word of the images Worker (`jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`; SVG is refused on purpose), calls `prepareImage`, and returns `{ bytes, ext, width, height }`. An unknown kind or empty bytes is refused with a plain sentence before the browser is asked.
  - `makeOptimizer(deps)`: the function for `hostPost(post, { optimize: makeOptimizer(), ... })`.
  - `gifSize(bytes)`: reads the width and height from the first 10 bytes of a GIF. This closes a real gap: `prepareImage` says `null` for the size of a GIF, and `recordHosted` refuses a media row without a whole width and height, so every GIF would have failed. Now a GIF keeps its bytes and gets its true size.
  - Width and height are always whole numbers above 0, or the picture fails with a plain sentence. A browser that cannot make WebP answers `jpg`; `hostPost` then fails that picture alone (unchanged rule).
- New test file `site/tests/unit/hosting-optimize.test.ts` (24 tests: the GIF header, every kind word, refusals, the real `prepareImage` behind a fake canvas, and three runs inside `hostPost`).
- Version 0.101.45.

**Not done**
- The one commit through the existing commit helper, the call to the Worker with the GitHub token, the result list screen with Retry and Confirm, the hook into Save and Paste. The images Worker is still not deployed.

**Checked**
- Tests: 143 files and 2817 tests before, 144 files and 2841 tests after (24 new). Twelve deliberate mistakes: eleven caught; the twelfth (a shorter length check for the GIF header) cannot change any answer, so it is not a gap.

**Files**
- Added: `site/public/admin/js/hosting-optimize.js`, `site/tests/unit/hosting-optimize.test.ts`, `tasks/open/T-0042.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.44 (2026-11-17): Auto image hosting, the hosting run (PLAN 34.3, Phase 3c Part 3b)

**What changed**
- New `site/public/admin/js/hosting-run.js` with `hostPost(post, deps)`. Nothing calls it yet, so the live site and the dashboard are unchanged. For one post it:
  1. plans (`planHosting`): refused, needs_confirm, reuse or fetch for each outside picture;
  2. asks the images Worker for the addresses in groups of at most 30 (an address met twice is asked once);
  3. decodes the answer, checks the size, hashes the downloaded file and reuses an existing file when the address or the hash is already in `config/media.json` (also inside the same run);
  4. optimizes (WebP, or GIF up to 5 MB; anything else fails that picture), makes the SEO name and the `/media/YYYY/MM/` path from the post date (`-2`, `-3` for a taken name), writes the media row with `recordHosted` (alt filled and marked auto only when it was made);
  5. rewrites the post (`rewritePost`) for the pictures that were hosted or reused.
  It returns `{ post, map, files, items, summary, changed }` and writes nothing: the caller commits the files, the post and `config/media.json` in one commit. A failed, refused or agency picture stays in the post as it was and is listed with a plain sentence (`explain`) and in the Retry list; a service that throws, refuses or sends damaged data fails only the pictures of its group; no valid post date stops the run before any download.
  Everything that touches the world is passed in: `fetchPictures` (the Worker), `optimize` (the browser step), `sha256`, `now`, `existing`.
- Also exported: `sha256Hex`, `fromBase64`, `explain`, `REASON_WORDS`, `WORKER_BATCH` (equal to the Worker's limit of 30; a test keeps them equal), `GIF_MAX_BYTES`.
- New test file `site/tests/unit/hosting-run.test.ts` (25 tests; one test runs the real Worker code behind a fake network).
- Version 0.101.44.

**Not done**
- The one commit through the existing commit helper, the wrapper that lets `prepareImage` serve as `optimize`, the call to the Worker with the GitHub token, the result list screen with Retry and Confirm, the hook into Save and Paste. The images Worker is still not deployed.
- Choices to check: the hash in the media row is the hash of the downloaded file (so a picture met again is found), not of the optimized file; only WebP and GIF are hosted.

**Checked**
- Tests: 142 files and 2792 tests before, 143 files and 2817 tests after (25 new). Twenty deliberate mistakes caught after three gaps were closed.

**Files**
- Added: `site/public/admin/js/hosting-run.js`, `site/tests/unit/hosting-run.test.ts`, `tasks/open/T-0041.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.43 (2026-11-17): Auto image hosting, the plan and the post rewrite (PLAN 34.3, Phase 3c Part 3a)

**What changed**
- New `site/public/admin/js/hosting-plan.js`. Nothing calls it yet, so the live site and the dashboard are unchanged.
  - `planHosting(post, { ownHosts, map, agencyHosts, confirmed, blockHosts })`: before any download, one item for each outside picture, in the order of LOGICS 22: `refused` (the address may not be fetched, with a reason word and a sentence), `needs_confirm` (an agency or stock host the writer has not confirmed), `reuse` (`config/media.json` already has this address; the item carries the existing `path`), or `fetch` (with the address to fetch). Counts are returned too.
  - `rewritePost(post, replacements)` and `rewriteUrls(text, replacements)`: after hosting, the addresses in the body (Markdown pictures, `<img src>`, `srcset`, bare addresses), `image` and `ogImage` become the new `/media/...` addresses. Only the exact address changes: not a longer address that starts the same way (`a.jpg?w=400`), not an address that only contains the name, not text inside code; the `&amp;` and `//host` forms are found; an address that contains another address (a proxy address) is replaced once, as the longer one. The input is not changed, and a picture that failed stays as it was.
  - `summarize(items)`: counts of every status and the list of failed addresses for Retry.
- `site/public/admin/js/hotlink.js`: `absoluteUrl` and `maskCode` are now exported (they were private); nothing else changed (its 74 tests pass unchanged).
- New test file `site/tests/unit/hosting-plan.test.ts` (24 tests).
- Version 0.101.43.

**Not done**
- The pipeline itself: calling the images Worker, optimizing with `image.js`, finding a same-hash picture after the download, writing the files, the post and `config/media.json` in one commit, the result list with Retry, the Confirm button for agency pictures. The Worker is also not deployed.
- Decision I took: an agency picture is held even when the same address is already hosted (the literal order of LOGICS 22). It can be relaxed.

**Checked**
- Tests: 141 files and 2768 tests before, 142 files and 2792 tests after (24 new). Sixteen deliberate mistakes caught; one gap found and closed.

**Files**
- Added: `site/public/admin/js/hosting-plan.js`, `site/tests/unit/hosting-plan.test.ts`, `tasks/open/T-0040.md`.
- Changed: `site/public/admin/js/hotlink.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.42 (2026-11-17): Auto image hosting, the rules about the picture itself (PLAN 34.5 and 34.6, Phase 3c Part 4a)

**What changed**
- New `site/public/admin/js/hosted-meta.js`. Nothing calls it yet, so the live site and the dashboard are unchanged.
  - `autoAlt(img, post)`: the writer's alt text is kept; an empty one is taken from the caption, then the nearest heading, then the post title, cleaned (no tags, Markdown marks, links or emoji), cut at a word end to 125 characters and marked `auto`. With no text the alt stays empty and is not marked: nothing is invented, nothing goes to an AI service.
  - `imgAttributes({ width, height }, index)`: `width` and `height` always; the first picture gets `fetchpriority="high"`, the others `loading="lazy"`; `srcsetWidths` lists which of 480, 800, 1200 and 1600 the file is wide enough for. It throws a plain message when the size is not known.
  - `isAgencyHost`, `needsConfirm`, `DEFAULT_AGENCY_HOSTS`, `sourceHostOf`: a starting list of agency and stock hosts (Getty, iStock, Shutterstock, Alamy, Adobe Stock, Depositphotos, Dreamstime, 123RF, AP, Reuters, AFP, Imago, Zuma); a host also matches its sub names, never a name that only ends the same way; the writer confirms one address or a whole host.
  - `RIGHTS_NOTICE`: the sentence of PLAN 34.5.
  - `recordHosted(map, path, info)`: the row of PLAN 34.6 (alt, caption, credit, `sourceUrl`, `sourceHost`, `sha256`, `width`, `height`, `bytes`, `hostedAt`, `autoAlt` while the alt waits for review) written through `mergeMedia`; the input map is not changed; a bad address, hash, size, time or field is refused with a plain message.
  - `autoAltFiles(map)`: the files whose alt text still waits for review.
- New test file `site/tests/unit/hosted-meta.test.ts` (34 tests).
- Version 0.101.42.

**Not done**
- The srcset files and the `srcset` text on the page (only the widths are decided), the "auto, please review" marker on the Files screen and the bulk alt screen (they do not know `autoAlt` yet), the credit line and the rights notice on screen, the agency list in `config/images.json` (Part 7; the list in the code is a starting list, not legal advice).
- Part 3 (the Save pipeline, needs decisions 15 and 16), Parts 5 to 8.

**Checked**
- Tests: 140 files and 2734 tests before, 141 files and 2768 tests after (34 new). Thirteen deliberate mistakes caught; two gaps found and closed.

**Files**
- Added: `site/public/admin/js/hosted-meta.js`, `site/tests/unit/hosted-meta.test.ts`, `tasks/open/T-0039.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.41 (2026-11-17): Auto image hosting, the images Worker entry point (PLAN 34.8, Phase 3c Part 2b)

**What changed**
- New `workers/images/index.js`: `POST /fetch` with `{ "urls": [ ... ] }` (at most 30 addresses). Order of the checks: path (404), method (405), preflight, kill switch `IMAGES_OFF` (503), who calls, JSON only (415), size (413), exact field `urls` (400), the rate limit (429), then the download of `lib.js`. Who may call: a signed-in dashboard user (a GitHub token of a login in `ALLOWED_USERS`, from the site's own origin, the same rule as the contact Worker) or the GitHub Action (header `X-Images-Secret` equal to the secret `IMAGES_SECRET`, compared through SHA-256; no Origin and no login needed). With no allowed user and no secret the answer is 503. The answer is `{ results: [ { url, ok, kind, finalUrl, hops, size, data (base64) } or { url, ok: false, reason, status? } ] }`. The Worker stores nothing, reads no database and logs no address.
- Rate limit: 20 calls a minute for each person or for the Action (`CALLS_PER_MINUTE`); it lives in the memory of one Worker instance, a brake and not a wall.
- New `workers/images/wrangler.toml`: name `news-images`, `SITE_ORIGIN`, `ALLOWED_USERS`, `IMAGES_OFF = "false"`, `BLOCK_HOSTS`, `CALLS_PER_MINUTE`; no secret; a clear note that it is NOT DEPLOYED and must be deployed from inside the full repository.
- `workers/images/lib.js`: the pictures of one call together may not be larger than 25 MB (the one that does not fit answers `call_too_big`, its bytes dropped at once); new `toBase64`.
- New test file `site/tests/unit/images-worker.test.ts` (25 tests: fake GitHub, fake DNS, fake sites).
- Version 0.101.41.

**Not done**
- Not deployed, and nothing calls it. No Cloudflare access here; `cd workers/images` then `npx wrangler deploy` is the owner's step. Not tried: whether wrangler bundles the two files it reads from `site/public/admin/js/`.
- The dashboard side (Part 3), and Parts 4 to 8.

**Checked**
- Tests: 139 files and 2709 tests before, 140 files and 2734 tests after (25 new). Fourteen deliberate mistakes, all caught.

**Files**
- Added: `workers/images/index.js`, `workers/images/wrangler.toml`, `site/tests/unit/images-worker.test.ts`, `tasks/open/T-0038.md`.
- Changed: `workers/images/lib.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.40 (2026-11-17): Auto image hosting, the fetch rules of the Worker (PLAN 34, Phase 3c Part 2a)

**What changed**
- New `workers/images/lib.js`. It has no entry point (`index.js`), no `wrangler.toml`, no route and no sign-in yet, so nothing can call it and the live site is unchanged.
  - `fetchPicture(url, { fetch, resolveHost, referrer, blockHosts, maxBytes, idleMs, totalMs })`: every address and every redirect passes `checkAddress` and `checkRedirects` of `hotlink.js` (https, port 443, no user name, public host, at most 3 redirects); redirects are followed by hand (`redirect: 'manual'`); 10 MB, 5 seconds without data and 15 seconds in all; the real first bytes must be JPEG, PNG, WebP, AVIF or GIF (`pictureKind` of `media-meta.js`); an SVG, a text file named `.jpg` and an HTML page are refused. A 403 is tried once more without the referrer (our own origin is the only referrer ever sent; no fake referrer, cookie or agent). Every refusal has a reason word.
  - `resolveViaDoh(host)` and the `resolveHost` option: the host name is looked up (A and AAAA, DNS over HTTPS) at every hop, and a name with one non-public answer is refused.
  - `fetchPictures(urls)`: at most 30 addresses, 4 at a time, a repeated address fetched once, the answer in the order of the list, one failure never stops the others.
- New test file `site/tests/unit/images-lib.test.ts` (47 tests, fake sites, real `Response` and `ReadableStream`).
- Version 0.101.40.

**Not done**
- Part 2b: `workers/images/index.js` (`POST /fetch`), `wrangler.toml`, the sign-in, the rate limit and the deploy. Parts 3 to 8 of Phase 3c.
- A Worker cannot pin the address that `fetch` connects to, so the name lookup is a best-effort check and a DNS rebinding race is not excluded here (the Cloudflare network also refuses private addresses).
- `lib.js` imports `hotlink.js` and `media-meta.js` from `site/public/admin/js/`; check in Part 2b that `wrangler deploy` bundles them.

**Checked**
- Tests: 138 files and 2662 tests before, 139 files and 2709 tests after (47 new). Deliberate mistakes caught; two gaps found and closed (the 308 redirect, the content-length shortcut).

**Files**
- Added: `workers/images/lib.js`, `site/tests/unit/images-lib.test.ts`, `tasks/open/T-0037.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.39 (2026-11-17): Auto image hosting, the pure rules (PLAN 34, Phase 3c Part 1)

**What changed**
- New `site/public/admin/js/hotlink.js` with the pure rules of auto image hosting. Nothing calls it yet, so the live site and the dashboard are unchanged.
  - `findExternal(post, ownHosts)`: every picture on another website, once each, in order: front matter `image` and `ogImage`, Markdown pictures, `<img src>`, every `<img srcset>` address. It skips our own host (with or without `www.`), relative addresses, `data:` pictures and pictures shown inside code. Each result carries the alt text and the nearest heading above it.
  - `checkAddress(url, { blockHosts })`: https only, port 443 or none, no user name or password, no `localhost`, `*.local`, `*.internal`, short names without a dot, and no private, loopback, link-local, carrier-grade, multicast or reserved IP address (IPv4 and IPv6, including `::ffff:`, NAT64 and 6to4 forms; odd spellings such as `127.1`, `2130706433` and `0x7f.0.0.1` are caught because the URL parser normalizes them). It returns a reason word and a plain sentence.
  - `checkRedirects(chain)`: at most 3 redirects; every address in the chain passes `checkAddress` again.
  - `seoName(img, post, n)`: the file name of PLAN 34.4 (alt, caption, nearest heading, focus keyword with the title, a meaningful old file name, then `<handle>-image-<n>`; 3 to 6 words; 60 characters; no camera name, hash, long number or other site name).
  - `datePart` and `hostedPath`: `/media/YYYY/MM/<name>.webp` from the post date as written (no time zone shift); `-2`, `-3` for a taken name.
  - `findHosted(map, { url, sha256 })`: finds a picture that is already hosted by its outside address or its hash.
- New test file `site/tests/unit/hotlink.test.ts` (74 tests).
- Version 0.101.39.

**Not done**
- The Worker `workers/images` (Part 2), the Save pipeline (Part 3), auto alt text and `srcset` output (Part 4), the XML import on the same engine (Part 5), the Action `hotlink.yml` (Part 6), `config/images.json` and R2 (Part 7).
- The rules cannot resolve a host name to see that it points to a private address (a name can be judged only with a network). Part 2 must resolve the name and refuse a private answer.

**Checked**
- Tests: 137 files and 2588 tests before, 138 files and 2662 tests after (74 new). Seven deliberate mistakes, all caught.

**Files**
- Added: `site/public/admin/js/hotlink.js`, `site/tests/unit/hotlink.test.ts`, `tasks/open/T-0036.md`.
- Changed: `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.38 (2026-11-17): Fix the Cloudflare Pages build (contact address and ad-code check)

**Why the build failed (found by building the real repository, not this ZIP)**
- The v0.101.37 ZIP built green because its `site/content/pages/` folder is empty. The real repository holds the twelve required pages, and building it stopped on two separate errors:
  1. `site/config/contact.json`: the endpoint ended at `.workers.dev` but the build demands the path `/contact` (`site/src/lib/contact.ts`). The Contact Us page could not be built.
  2. `site/scripts/validate-html.mjs`: the check "no ad code outside an article page" searched for the plain word `adsterra`. The Ownership and Funding page now says, in plain text, "supported by advertising revenue through Adsterra" (the owner's own `fundingSummary`), so the check failed on a sentence, not on code.

**What changed**
- `site/config/contact.json`: `endpoint` is now `https://news-contact.shivamdas2nd700.workers.dev/contact`. Same Worker, same Turnstile site key. The Worker answers on `/contact` (checked in `workers/contact/index.js`).
- `site/scripts/validate-html.mjs`: the word `adsterra` now counts only inside a `<script>` tag or inside a `src`, `href` or `data-` attribute. A sentence is allowed. The other ad markers (`data-ad-slot`, `class="ad-slot"`, `data-ad-loader`, `adsClient`, `pagead2.googlesyndication`) are unchanged. Checked by hand: the word alone passes, a script from an Adsterra host fails, an ad slot fails.
- `workers/trap/wrangler.toml`: comment only. It said the two ids were empty; they hold the owner's ids since v0.101.37. No value changed.
- New test `site/tests/unit/live-config.test.ts`: reads the real `config/contact.json` with the same function the build uses, and checks that the trap ids are empty or exactly 32 letters or numbers. With the old contact address put back, the test fails with the same message the build gave.
- Version 0.101.38.

**Not done**
- Nothing was deployed (no Cloudflare access here). The trap Worker must still be deployed by the owner (`UPDATE_NOTE.md`).
- No new VAPID key pair: the public key in `config/push.json` and `workers/push/wrangler.toml` already match; a new pair would silently break existing subscribers and the private key already set on `news-push`.
- `country` in `site/config/publisher.json` is still "US" (card `T-0003`), so two pages still say "based in US" and "laws of US" next to a West Bengal address. It is a legal fact only the owner can give. No page was regenerated (a regenerated page gets a new date in its address).
- The trap still blocks nobody on pages.dev (no route and no WAF rule without a custom domain).
- Not verified live: the Cloudflare Pages build log was not visible from here; the cause above was reproduced by building the repository on a clean machine.

**Checked**
- Real repository, clean install, `SITE_URL=https://shivam-das-news.pages.dev`: before, `npm run build` failed twice as described; after, `Validation passed.`
- Tests: 136 files and 2586 tests before, 137 files and 2588 tests after (2 new).

**Files**
- Added: `site/tests/unit/live-config.test.ts`, `tasks/open/T-0035.md`.
- Changed: `site/config/contact.json`, `site/scripts/validate-html.mjs`, `workers/trap/wrangler.toml` (comment), `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `UPDATE_NOTE.md`.
- Removed: none.

## 0.101.37 (2026-11-17): The File tab in the post editor (PLAN 33.4, Phase 3b Part 9)

**What changed**
- The post editor has two tabs, Form and File. The form is unchanged and opens first.
- The File tab shows the whole Markdown file (front matter and body), exactly as a save would write it. Writers and editors see it read-only. Only admins can type in it and press "Save file". A new post shows the text but cannot save it (save it from the form first).
- Save file: reads the text, refuses a file with no front matter, no closing dashes, an empty front matter or a first-level heading in the body; checks the role again (`rawGuard`); refuses while the form has unsaved changes; runs the same `validatePost` as the form; then writes one commit on the same file with the old sha (`admin: edit file: <handle>`). The handle, category and date of a live post, and the handle and category of a draft, are changed in the form (which asks for the redirect), so the File tab refuses them.
- New role action `post:raw`, admin only, in `site/public/admin/js/roles.js`.
- New rules file `site/public/admin/js/file-tab.js` (`rawText`, `parseRaw`, `rawGuard`, `rawUnchanged`); three small style rules in `site/public/admin/admin.css`.

**Not done**
- Creating a post from the File tab; changing handle, category or date there (on purpose).
- Not opened on the real dashboard; tested in a simulated browser (jsdom) with a fake GitHub.

**Checked**
- Tests: 134 files and 2534 tests before, 136 files and 2586 tests (52 new) after. Six deliberate mistakes, all caught, every file restored.

**Files**
- Added: `site/public/admin/js/file-tab.js`, `site/tests/unit/file-tab.test.ts`, `site/tests/unit/admin-file-tab.test.ts`, `tasks/open/T-0034.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/roles.js`, `site/public/admin/admin.css`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.36 (2026-11-17): Completion pass: publisher facts, push key, trap switch (config only)

Config and notes only. No site code and no Worker code changed.

**What changed**
- `site/config/publisher.json`: `address` is "West Bengal, India", `foundedYear` is "2026", `fundingSummary` is "The site is supported by advertising revenue through Adsterra." (the three facts the owner gave in chat on 2026-11-17; nothing else in the file changed, `country` is still "US").
- `workers/push/wrangler.toml`: `VAPID_PUBLIC_KEY` now holds the same public key that `site/config/push.json` already had (it is a valid P-256 point of 65 bytes). Before, it was empty, and a deploy would have written an empty value over the one in the dashboard. No new key pair was made; no private key is in any file.
- `workers/trap/wrangler.toml`: `TRAP_ENABLED` is "true", as the owner already set it in the dashboard (a deploy writes this file over the dashboard). `CF_ACCOUNT_ID`, `CF_LIST_ID` and `OWN_IPS` stay empty: they are the owner's own values and are not in the repository. The comment now says plainly that a Worker route and a WAF rule cannot be attached to the free pages.dev address (it is not a zone of the owner's account), so the trap blocks nobody until there is a custom domain.
- `site/tests/unit/trap-worker.test.ts`: the test "ships with the kill switch OFF" is now "has the kill switch set to true or false"; it still demands no route, no token, and ids that are empty or exactly 32 letters or numbers. The owner decided to switch the trap on, so the old expectation no longer matched.
- `tasks/open/T-0033.md` (new), and one Log line each in `T-0001` and `T-0005`. No card was closed: nothing can be proved live yet (see below).

**Seen live on 2026-11-17 (read only)**
- `https://shivam-das-news.pages.dev/` shows "No stories yet" and a footer with only the Sitemap link; `/sitemap/` says "Nothing to list yet". So the twelve required pages and their footer links were not visible there when this was checked. Card T-0001 stays `ready` until the owner sees them.

**Not done (owner only, Cloudflare dashboard)**
- Secrets cannot be read or set from this repository: `TURNSTILE_SECRET`, `STAMP_SECRET` (contact, push, analytics), `CF_API_TOKEN`, the VAPID private key and subject, `ANNOUNCE_SECRET` and the GitHub secret `PUSH_ANNOUNCE_SECRET`. The UPDATE NOTE lists the exact checks.
- The IP list and its id (`CF_LIST_ID`); the WAF rule and the route need a custom domain.

**Checked**
- Tests: 134 files and 2534 tests before, 134 files and 2534 tests after (one test changed, none added).

**Files**
- Added: `tasks/open/T-0033.md`, `UPDATE_NOTE.md`.
- Changed: `site/config/publisher.json`, `workers/push/wrangler.toml`, `workers/trap/wrangler.toml`, `site/tests/unit/trap-worker.test.ts`, `tasks/open/T-0001.md`, `tasks/open/T-0005.md`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`.
- Removed: none.

## 0.101.35 (2026-11-17): The Rename screen and the one commit (PLAN 33.3, Phase 3b Part 8d-3)

Small part, the last of three steps for **Rename a file**. The dashboard now renames a picture.

**What the owner sees now**
- In the Files screen, open a file: a new **Rename file** part (between Replace and Delete).
- Type the new name (lowercase letters, numbers and hyphens; the folder and the ending stay; the ending may be typed or left out). A bad name is refused on the spot with a plain message and nothing is sent.
- One question: "Rename a.webp to b.webp? ... The old address is redirected (301), and the alt text, caption and credit move with the file." Yes sends it; Cancel brings the box back with the typed name.
- Yes makes ONE commit (`admin: rename file a.webp to b.webp`): the picture moves to the new name, the old path is removed, every post, page, author and config file that names the picture gets the new address, one 301 from the old address to the new one is added in `config/redirects.json`, and the `config/media.json` entry (alt text, caption, credit) moves to the new key.
- After Yes the screen shows the new name, the list and the "Used in" list use the new address, and the picture shows at once (a preview from the moved bytes; the new address is live after the next deploy, about 2 minutes). The old address sends readers to the new one after the same deploy.
- Only editors and admins can rename (`media:rename`). An author sees "Only an editor or an admin can rename a file." The role is checked again inside the save, then everything is read again (a post saved a minute ago counts) and the rules of 8d-2 build the plan before anything is written. If someone else saved at the same moment, the message is shown and nothing changes. If the file is already gone, nothing is created.

**What changed in the code**
- `site/public/admin/js/files-screen.js`: new `renameBox`, new options `canRename` and `onRename`; the screen keeps its own copies of the post texts and updates them after a rename (the caller's lists are not changed); the delete check uses those copies, so a renamed picture that a post still shows is still protected.
- `site/public/admin/js/app.js`: new `onRename` (role, re-read, `planFileRename`, one `commitFiles` with the bytes at the new path, the old path deleted and the changed text files), and `canRename` given to the screen.
- `site/public/admin/js/roles.js`: new right `media:rename` for admin and editor.

**Not built (next parts)**
- Part 9: the File tab. Renaming into another folder is not planned. The warning for unsaved text when you leave a screen.

**Checked**
- Tests: 133 files and 2506 tests before, 134 files and 2534 tests after (28 new, in `tests/unit/admin-file-rename.test.ts`: the screen, the roles, the order of the steps in `app.js`, and the real `app.js` against a fake GitHub that understands the Git Data API: one tree, one commit, one branch move, the bytes at the new path, the old path removed, the post, the redirect and the alt text all in that one commit).
- Ten deliberate mistakes, all caught (role check removed, old path not deleted, text files not written, no re-read of posts, name rules skipped, posts not updated on screen, alt text not moved on screen, wrong name sent, editor without the right, no question before sending). Every file was restored.

**Files**
- Added: `site/tests/unit/admin-file-rename.test.ts`, `tasks/open/T-0032.md`.
- Changed: `site/public/admin/js/files-screen.js`, `site/public/admin/js/app.js`, `site/public/admin/js/roles.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.34 (2026-11-17): The rename rules for a picture file (PLAN 33.3, Phase 3b Part 8d-2)

Small part, rules only: the second of three steps for **Rename a file**. The dashboard does not change yet; nothing calls the new code.

**What the owner sees now**
- Nothing new on screen. One old bug is fixed on the way (see below).

**What the new rules do** (`site/public/admin/js/file-rename.js`, plain functions, tested)
- `checkNewName(path, newName, taken)`: the new name may hold only lowercase letters, numbers and hyphens, at most 100 characters. The folder and the ending (.webp) stay; the ending may be typed or left out. Refused: an empty name, a folder in the name, another ending, the same name, a name that already exists (capitals do not make it new). A name like `img-5678` is allowed with a yellow warning.
- `planFileRename(path, newName, options)` builds the whole rename and changes nothing: the move of the picture, the text of every post, page, author and config file that names the old address (written with the new one), one 301 from the old address to the new one in `config/redirects.json`, and the move of the `config/media.json` entry (alt text, caption, credit) with the key kept in its place.
- Redirect safety: an older redirect that ended at the old address now ends at the new one (no chain, BUGS U3); a redirect that starts at the new address is removed (no loop, BUGS U4, so renaming back works); the 2000 redirect limit of Cloudflare Pages stops the plan with a plain message and nothing is changed.
- One commit can hold at most 1000 files that name the picture; more is refused with a plain message.

**A bug fixed on the way**
- The "Used in" list and the delete check did not count a picture that was written at the end of a sentence (`... /media/a.webp.`), because a full stop right after the name was treated as part of a longer name. A used picture could therefore be deleted. Now one shared pattern (`pathPattern` in `media-meta.js`) is used by "Used in", delete and rename: `a.webp.bak`, `a.webp-large` and `a.webp_x` still do not count, `a.webp.` and `a.webp,` do.

**Not built (next parts)**
- 8d-3: the Rename screen and the one commit (move the bytes, write the text files, one message). Part 9: the File tab. Renaming into another folder is not part of the rules.

**Checked**
- Tests: 132 files and 2471 tests before, 133 files and 2506 tests after (35 new, in `tests/unit/file-rename.test.ts`).
- Thirteen deliberate mistakes, all caught (two of them only after one more test was added: the redirect limit after a loop removal, and the capitals check). Every file was restored.
- The redirect builder (`buildRedirects`) keeps the old address and the older redirect that now ends at the new file, with no problem reported.

**Files**
- Added: `site/public/admin/js/file-rename.js`, `site/tests/unit/file-rename.test.ts`, `tasks/open/T-0031.md`.
- Changed: `site/public/admin/js/media-meta.js` (new `pathPattern`, used by `usedIn`), `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.33 (2026-11-17): Pictures can be redirect targets (PLAN 33.3, Phase 3b Part 8d-1)

Small part, site side only: the first of three steps for **Rename a file**. The dashboard does not change yet.

**Why this comes first**
- Renaming a picture must keep its old address working (PLAN 33.3). The redirect builder drops every redirect whose target is not a "live page", and a picture was never counted as one, so a redirect from an old picture address to a new one was silently thrown away at build time ("ends at ... which is not a live page"). Without this step the rename would have looked fine and broken old links.

**What the owner sees now**
- Nothing in the dashboard. On the live site, a redirect such as `/media/2026/11/old.webp` to `/media/2026/11/new.webp` (written by hand in the Redirects screen, or by the rename in the next part) is now a real 301 in `_redirects`.
- A picture that still exists is never redirected away (a live file wins, the same loop rule as for pages). A redirect to a picture that does not exist is still dropped and reported in the build log.

**What changed in the code**
- New `src/lib/media-live.ts`: `listMediaFiles(dir)` (every file under `public/media/`, sorted, dot files skipped, a missing folder gives an empty list) and `mediaUrls(files)` (served addresses, pictures only; nothing with `..`, a dot folder, a space, ":", "*", "?" or "#").
- `src/pages/redirects-map.json.ts`: the live set now also holds the picture addresses.

**Not built (next parts)**
- 8d-2: the rename rules (check the new name, update the posts, pages, authors and config that name the picture, move the `config/media.json` key, add the redirect entry). 8d-3: the Rename screen and the one commit. Part 9: the File tab.
- The 2000 redirect limit of Cloudflare Pages is shared with pages and posts; every renamed picture uses one.

**Checked**
- Tests: 131 files and 2458 tests before, 132 files and 2471 tests after (13 new, in `tests/unit/media-live.test.ts`).
- A real build with a temporary picture and a temporary redirect wrote `/media/2026/11/old.webp /media/2026/11/new.webp 301` into `dist/_redirects`; with the picture removed the build dropped it and said so. The temporary files were removed afterwards.
- Eight deliberate mistakes, all caught at once (non-pictures kept, `..` allowed, spaces allowed, wrong address prefix, dot files listed, no folder recursion, no sorting, the pictures not added in the build page). Every file was restored.

**Files**
- Added: `site/src/lib/media-live.ts`, `site/tests/unit/media-live.test.ts`, `tasks/open/T-0030.md`.
- Changed: `site/src/pages/redirects-map.json.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.32 (2026-11-17): Replace a file (PLAN 33.3, Phase 3b Part 8c)

Small part: the Files editor can put a new picture in the place of an old one. The address stays the same, so every post that shows it keeps working.

**What the owner sees now**
- In the Files screen, open a file: a new **Replace file** part (above Delete).
- **Choose a new .webp file** (the box accepts only the same ending as the address). After choosing, the screen shows the file name and size, and asks once: "Replace name.webp? The old picture is kept in Git history. The address stays /media/...". **Yes, replace the file** or **Cancel**. Nothing is sent before Yes.
- The new file must really be the same kind of picture. The screen looks at the first bytes of the file, not at its name, so a PNG renamed to .webp is refused with a red line. A file that is empty, not a picture, or over 5 MB (limit is a proposal) is refused. A file over 300 KB only gets a yellow warning.
- Yes writes the new picture at the same address in ONE commit (`admin: replace file name.webp`). The alt text, caption and credit stay. The screen says "Replaced name.webp. The address stays the same." and shows the new size; the preview shows the new picture at once, the live site after the next deploy.
- Only editors and admins can replace (`media:replace`). An author sees "Only an editor or an admin can replace a file." The role and the file are checked again inside the save, not only on the screen. If someone else saved at the same moment, the message is shown and nothing changes.

**What changed in the code**
- `public/admin/js/media-meta.js`: new `pictureKind(bytes)` (webp, png, jpg, gif, avif, svg from the first bytes), `replaceCheck(path, file)` (errors and warnings; jpeg and jpg count as the same kind) and `REPLACE_MAX_BYTES`.
- `public/admin/js/files-screen.js`: the Replace part (`replaceBox`) and the options `canReplace`, `onReplace`.
- `public/admin/js/roles.js`: new right `media:replace` for admin and editor.
- `public/admin/js/app.js`: `onReplace` (role check, file check, fresh tree, one commit with the new bytes at the same repository path, new preview).

**Two documents disagree (decision 50, open)**
- PLAN 33.3 says a replaced file keeps its address. BUGS U13 and PLAN section 34 say a name never changes and a replacement gets a new name, because `/media/*` is meant to get an immutable cache header. That header is not in `public/_headers` today, so replacing in place is safe now. The owner was asked and gave no preference; PLAN 33.3 was followed. If the immutable header is added later, a replaced picture would keep showing the old one to returning readers, and this part must change first (proposal: add a version stamp to the address).

**Not built (next parts)**
- 8d: rename with a redirect and the posts updated in the same commit. Part 9: the File tab. The picture is not converted or resized on replace (the owner chooses the file as it is). The width and height shown for the file are read again when the picture loads.

**Checked**
- Tests: 130 files and 2430 tests before, 131 files and 2458 tests after (28 new, in `tests/unit/admin-file-replace.test.ts`).
- Thirteen deliberate mistakes, all caught at once (kind check off, size limit off, jpeg not equal to jpg, role check removed, file check removed, wrong repository path, a second file deleted in the same commit, Yes shown on errors, locked role given the chooser, failed replace hidden, size not updated, wrong accept, author given the right). Every file was restored.
- A bug found while testing and fixed before delivery: `instanceof Uint8Array` fails for bytes made in another window, so the checks use `ArrayBuffer.isView`.

**Files**
- Added: `site/tests/unit/admin-file-replace.test.ts`, `tasks/open/T-0029.md`.
- Changed: `site/public/admin/js/media-meta.js`, `site/public/admin/js/files-screen.js`, `site/public/admin/js/roles.js`, `site/public/admin/js/app.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.31 (2026-11-17): Delete a file (PLAN 33.3, Phase 3b Part 8b)

Small part: the Files editor can delete a picture, but only when nothing uses it.

**What the owner sees now**
- In the Files screen, open a file: a new **Delete** part at the bottom.
- If any post, page, author file or config file names the picture, it says "This file is used in 2 places, so it cannot be deleted. Remove it there first." and lists the files. There is no delete button then.
- If nothing uses it, **Delete file** asks once more ("Delete name.webp for good? ...") with **Yes, delete the file** and **Cancel**. Yes removes the picture and its alt text, caption and credit in ONE commit (`admin: delete file name.webp`). The file leaves the grid and the screen says "Deleted name.webp."
- Before it deletes, the dashboard reads the posts, pages, authors and config again, so a post saved a minute ago still counts. If the check fails or someone else saved at the same moment, the message is shown and nothing changes.
- Only editors and admins can delete (PLAN 33.5). An author sees "Only an editor or an admin can delete a file." The role is checked again inside the delete, not only on the screen.

**What changed in the code**
- `public/admin/js/media-meta.js`: new `deleteCheck(path, items)` (ok, the list of files that use it, a plain reason; anything that is not a file under `/media/` is refused) and `removeMedia(map, path)` (a new map, the input is not changed).
- `public/admin/js/files-screen.js`: the Delete part (`deleteBox`) and the options `canDelete`, `deleteItems`, `onDelete`; a deleted file leaves the list and the map.
- `public/admin/js/roles.js`: new right `media:delete` for admin and editor.
- `public/admin/js/app.js`: `contentItems`, `otherItems` (author files and config files; `config/media.json` is left out on purpose, because it holds the picture as a key and would always block the delete) and `onDelete` (role check, fresh read, use check, one commit with `{ delete: true }` for the picture and the new `config/media.json`, new sha for the next Save).

**Not built (next parts)**
- 8c: replace a file (the address stays). 8d: rename with a redirect and the posts updated in the same commit. Part 9: the File tab. No redirect or 410 is made for a deleted picture (a picture that nothing names has no readers; decision 49). The check reads text only: a picture named in a way the text search cannot see (for example built by code) is not found.

**Checked**
- Tests: 129 files and 2407 tests before, 130 files and 2430 tests after (23 new, in `tests/unit/admin-file-delete.test.ts`).
- Ten deliberate mistakes: nine were caught at once (always allowed, role check removed, no confirm step, file stays in the grid, `config/media.json` blocking, delete button for a locked role, failed delete not shown, author given the right, two commits). One was not caught (the use check switched off inside `app.js`, because the test only looked for the call); the test was made stricter and the mistake was caught the second time. Every file was restored.

**Files**
- Added: `site/tests/unit/admin-file-delete.test.ts`, `tasks/open/T-0028.md`.
- Changed: `site/public/admin/js/media-meta.js`, `site/public/admin/js/files-screen.js`, `site/public/admin/js/roles.js`, `site/public/admin/js/app.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.30 (2026-11-17): The bulk alt text screen (PLAN 33.3, Phase 3b Part 8a)

Small part: one table for all pictures that have no alt text yet. It writes only `config/media.json`, in one commit.

**What the owner sees now**
- On the Files screen a link **Write alt text for many files at once** opens a new screen (`#/files/alt`, "Alt text for all files").
- The screen lists only the pictures without alt text: a small picture, the file name, one field with a live counter (up to 125 recommended) and a red line under a field when the text is too long (over 300) or has an emoji. The top line says "12 files without alt text" (or "1 file", or "All files have alt text.").
- **Save all** saves every filled field in one commit (`admin: alt text for 5 files`). Empty fields are left alone, so the screen can never remove an alt text. If one field has a red error, nothing is saved and the row is marked. If the save fails (for example someone else saved at the same moment), the message is shown, nothing changes and the typed text stays. After a good save the saved files leave the table and the screen says "Saved 5 files."
- A role without the media right sees locked fields, no Save button and the words "Your role cannot change file details."

**What changed in the code**
- New `public/admin/js/bulk-alt.js` (the drawing; every text is a text node, never HTML).
- `public/admin/js/media-meta.js`: new `mergeAltBulk(map, rows)` (all or nothing; skips empty rows and unchanged rows; the first row of a path wins; keeps the caption, the credit and every key the screen does not own; the input map is not changed).
- `public/admin/js/app.js`: the route `#/files/alt`, `bulkAltView` (checks the role and the limits again before it writes, writes with the file sha) and the link on the Files screen.
- A bug found while testing and fixed before delivery: the red line under a field used `CSS.escape`, which not every environment has; it now finds the row without it.

**Not built (next parts)**
- 8b: delete (refused while a post uses the file, with the list). 8c: replace (the address stays). 8d: rename with a redirect and the posts updated in the same commit. Part 9: the File tab. The screen does not warn when you leave with unsaved text.

**Checked**
- Tests: 128 files and 2386 tests before, 129 files and 2407 tests after (15 new in `tests/unit/admin-bulk-alt.test.ts`, 6 more in `media-meta.test.ts`).
- Ten deliberate mistakes: nine were caught at once (save despite a red error, empty rows sent, typed text lost after a failed save, not all or nothing, caption and credit overwritten, first row not winning, role check removed from `app.js`, route removed, files with alt text still listed). One was not caught (the read-only role could still save through a script, because the test left the field empty); the test was made stricter and the mistake was caught the second time.

**Files**
- Added: `site/public/admin/js/bulk-alt.js`, `site/tests/unit/admin-bulk-alt.test.ts`, `tasks/open/T-0027.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/media-meta.js`, `site/tests/unit/media-meta.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.29 (2026-11-17): The site reads the picture details (PLAN 33.3, Phase 3b Part 7c)

Small part: what the owner types on the Files screen now reaches the public pages. Nothing in the dashboard changes.

**What the reader sees now**
- Under the big picture of an article, the **caption** saved on the Files screen is shown, then the **credit**, with a middle dot between them (`Caption &middot; Credit`). With only a credit it looks exactly as before.
- The **credit** written inside the post (`imageCredit`) still wins over the stored credit. The **alt text** written inside the post (`imageAlt`) still wins over the stored alt text (PLAN 33.3). A stored alt text is used only when the post has none.
- The same alt text goes to the home page lead picture, the post cards and the share picture (`og:image:alt`).

**What changed in the code**
- New `src/lib/media-alt.ts` (pure rules: `mediaKey`, `mediaEntry`, `pictureAlt`, `pictureCaption`; a query or hash after the file path is ignored; outside addresses, other folders and `..` give nothing; a value that is not text is ignored) and `src/lib/picture.ts` (the two helpers `altOf` and `captionOf`, bound to `config/media.json`).
- Changed: the article page, `PostCard.astro` and the home page read the helpers instead of `imageAlt` and `imageCredit` directly.

**Not changed on purpose**
- The publish gate (`image` and `imageAlt` needed) and the content check are the same, so older tests pass unchanged. Because of that, a stored alt text rarely fills a gap today: every published post already has its own `imageAlt`. See the new decision 48.

**Not built (next parts)**
- Part 8: rename, replace, delete and the bulk alt text table. Part 9: the File tab. Pictures inside the body of a post still use the alt text written in the body.

**Checked**
- Tests: 127 files and 2373 tests before, 128 files and 2386 tests after (13 new, in `tests/unit/media-alt.test.ts`).
- A real build with two temporary posts and a temporary picture entry showed the right `alt`, `figcaption` and `og:image:alt` on both articles and on the home page; the temporary files were removed afterwards.
- Five deliberate mistakes: four were caught by the tests (post alt not winning, `..` allowed, post credit not winning, the query not removed). The fifth (removing the own-key check) cannot be seen from outside, because every key starts with `/media/`; the check stays as a safety net.

**Files**
- Added: `site/src/lib/media-alt.ts`, `site/src/lib/picture.ts`, `site/tests/unit/media-alt.test.ts`, `tasks/open/T-0026.md`.
- Changed: `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`, `site/src/components/PostCard.astro`, `site/src/pages/index.astro`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.28 (2026-11-17): The Files screen (PLAN 33.3, Phase 3b Part 7b)

Small part: the screen for the data and rules of 0.101.27. It writes only `config/media.json`; nothing on the public site changes yet.

**What the owner sees now**
- A new menu entry **Files** (next to Media) for every role that has the media right (admin, editor, author).
- A grid of all pictures in `/media/` with a search box (by file name, any case), a switch **Only files without alt text**, a count line ("12 of 12 files, 9 without alt text") and a "(no alt text)" note on each tile that lacks it.
- Click a file to open its editor: preview, path, type, size, and the size in pixels once the picture has loaded; **Alt text** (counter, up to 125 recommended), **Caption** and **Credit**; the **Image checks** (no alt text, alt too long, unreadable name such as `IMG_1234`, a featured image under 1200 px, not WebP, over 300 KB) and **Used in** (the posts and pages that show the file, with "(featured image)" where it is the featured picture).
- **Save details** writes `config/media.json` in one commit (`admin: file details <name>`). It checks the role and the limits again before it writes, keeps every other file's entry and every key the screen does not own, and uses the file's sha, so a second person's save at the same moment fails with a message instead of overwriting.
- A red error (alt or caption over 300, credit over 120, an emoji) stops the save and shows the reason under the fields. A failed save shows the message and changes nothing in the grid.
- A role that may not change details sees the fields locked and the words "Your role cannot change file details."

**What changed in the code**
- New `public/admin/js/files-screen.js` (the drawing; every text is a text node, never HTML) and `featuredIn` in `media-meta.js` (which files use a picture as the front matter `image`, quoted or not; a body picture, `ogImage` or a longer name does not count).
- `public/admin/js/app.js`: the route `#/files`, the menu entry, the path `config/media.json`, `filesView` (loads posts, pages and the file, and saves).
- A bug found while testing and fixed before delivery: the selected tile did not show as selected.

**Not built (next parts)**
- 7c: the page head and the article reading `config/media.json` (until then a saved alt text is stored but the site does not show it). Part 8: rename, replace, delete and the bulk alt text table. Part 9: the File tab. The screen does not warn when you open another file with unsaved edits. The size in pixels appears only after the picture has loaded.

**Files**
- Added: `site/public/admin/js/files-screen.js`, `site/tests/unit/admin-files.test.ts` (23 tests), `tasks/open/T-0025.md`.
- Changed: `site/public/admin/js/app.js`, `site/public/admin/js/media-meta.js`, `site/tests/unit/media-meta.test.ts` (3 more tests), `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.27 (2026-11-17): The file editor rules and the picture details file (PLAN 33.3, Phase 3b Part 7a)

Small part: the data and the rules for the Files screen, as Part 5a and Part 6a did for the other boxes. No new screen, and nothing on the public site changes.

**What changed**
- New file `config/media.json` (shipped as `{}`): alt text, caption and credit of a picture, one entry per file path such as `/media/2026/11/photo.webp`. The post still keeps its own `imageAlt` for the featured image, and the post value wins (PLAN 33.3).
- New dashboard rules in `public/admin/js/media-meta.js` (pure functions, no screen): `isMediaPath`, `mediaErrors` (red errors: alt over 300, caption over 300, credit over 120 characters, an emoji), `mergeMedia` (set one file's fields and return a new map; an empty value removes the key, an entry left empty is removed, keys the screen does not own are kept, the input is not changed), `altFor` (post alt first, then the stored one), `readableName` (refuses names such as `IMG_1234`, `DSC00012`, `PXL_...`, screenshots and bare numbers), `imageChecks` (warnings only: no alt, alt over 125, unreadable name, featured image under 1200 px, not WebP, over 300 KB), `usedIn` (which posts and pages show a picture, in front matter, Markdown and HTML; a longer name that only starts the same does not count) and `missingAlt` (for the bulk screen).
- The content check (`npm run check:content`) now checks `config/media.json` with the new `checkMedia`: an object by path under `/media/`, no `..`, the same three limits, no emoji. Other keys are allowed (the picture hosting of PLAN 34 will add its own).
- The numbers 300, 300 and 120 and the 300 KB budget are my proposal, because the plan gives only the 125 characters for alt text. They are decision 47 in `INCOMPLETE.md`; they are warnings or limits only in the dashboard and the content check, nothing is cut or refused on the live site.
- Two tests of 0.101.26 were made stricter: the content check script is now run for real on a bad `config/tags.json` (before, the test only looked for the word in the script, so it would not have noticed a call that was switched off). The new media test does the same for `config/media.json`.
- Mistakes made on purpose and caught (each file restored byte for byte afterwards): see T-0024.

**Not built (next parts)**
- The Files screen itself (grid, list, one editor, "Used in"), Part 7b. The page head and the article reading alt text from `config/media.json` (Part 7c). Part 8: rename, replace, delete, bulk alt text. Part 9: the File tab.

**Files**
- Added: `site/config/media.json`, `site/public/admin/js/media-meta.js`, `site/tests/unit/media-meta.test.ts` (27 tests), `tasks/open/T-0024.md`.
- Changed: `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/tests/unit/page-tag-listing.test.ts`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.26 (2026-11-17): Search title and description for static pages and tags (PLAN 33.2, Phase 3b Part 6d)

Small part: the data and the rules, as Part 6a did for categories and authors. No new screen.

**What changed**
- A static page can have `metaTitle` (up to 70 characters) and `metaDescription` (up to 320) in its front matter (`src/content.config.ts`). Empty means the page title and the page description, exactly as before. The page head uses `listingHead` (`src/pages/[year]/[month]/[day]/pages/[slug].astro`). The heading, the text and the JSON-LD description of the page do not change.
- A tag can have the same two fields in a new file `config/tags.json`, one entry per tag slug (`src/lib/tags.ts` reads it). The shipped file is `{}`, so every tag page is unchanged. The tag page passes the fields to the same `Listing` component as categories and authors. Thin tag pages still stay `noindex` (Bug S7).
- The content check (`npm run check:content`) now stops a page whose `metaTitle` is over 70 or `metaDescription` over 320 characters, and checks `config/tags.json` with the new `checkTags` (an object by tag slug; only the keys `metaTitle` and `metaDescription`; the same two limits; no emoji).
- Checked with a real build and temporary values (a published test post, a tag entry, two test pages): the tag page gave `<title>Tag search title test | Shivam Das News</title>` with its own description; the page with search fields used them; the page without them kept its plain title and description. All temporary files were removed and the three changed content files are byte for byte the same as in 0.101.25.

**Not built (next parts)**
- The box in a page screen (the dashboard has no page screen yet) and a tag screen. Parts 7 to 9 of Phase 3b (files screen, rename and replace, File tab).

**Files**
- Added: `site/config/tags.json`, `site/src/lib/tags.ts`, `site/tests/unit/page-tag-listing.test.ts` (17 tests), `tasks/open/T-0023.md`.
- Changed: `site/src/content.config.ts`, `site/src/pages/[year]/[month]/[day]/pages/[slug].astro`, `site/src/pages/tag/[tag]/[...rest].astro`, `site/scripts/validate-content-lib.mjs`, `site/scripts/validate-content.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.25 (2026-11-17): The listing box for the home page in Settings (PLAN 33.2, Phase 3b Part 6c)

Small part: the home page gets its own search title, and the Settings screen shows the box.

**What changed**
- New optional setting `homeTitle` in `config/site.json`. Empty (the default, and what the shipped file has) means "site name - tagline", exactly as before. When set, it is the whole title of the home page as typed (`homeHead` in `src/lib/seo.ts`, used by `src/pages/index.astro`). The home page description is the site `description`, as before.
- Settings, card **Site**: the Description field moved into a new **Search engine listing** box (preview, Mobile and Desktop, Search title = `homeTitle`, Search description = the site description, counters, Reset to auto). The Site card keeps site name, tagline, locale, default author and theme colour.
- Save stops with a plain message when the home title is over 70 characters, the description over 320, or either holds an emoji. An emptied home title is removed from the file.
- Two small additions to the box of 0.101.24 so it can serve the home page: `ctx.autoTitle` (the automatic title when it is not "name | site") and `hints` (own help texts). Categories and authors do not use them and are unchanged.
- Checked with a real build and a temporary `homeTitle`; `config/site.json` was restored and is byte for byte the same as in 0.101.24.

**Not built (next parts)**
- There is no page screen in the dashboard yet, so "the box in the page editor" waits for that screen. Static pages and tags have no stored search fields yet (Part 6d).

**Files**
- Added: `site/tests/unit/admin-home-box.test.ts` (16 tests), `tasks/open/T-0022.md`.
- Changed: `site/src/lib/seo.ts`, `site/src/pages/index.astro`, `site/public/admin/js/listing.js`, `site/public/admin/js/listing-box.js`, `site/public/admin/js/app.js`, `site/tests/unit/listing-entry.test.ts` (one count of mine, "exactly 2" became "at least 2" plus the two named calls, because Settings is a third user of the check), `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.24 (2026-11-17): The listing box on the Categories and Authors screens (PLAN 33.2, Phase 3b Part 6b)

Small part: the screen for the data and rules of 0.101.23. No new rule for the site; only the dashboard changes.

**What the owner sees now**
- Each category and each author has a **Search engine listing** box: a Google-style preview (Mobile and Desktop), **Edit** that opens **Search title** and **Search description**, a counter for each (60 and 160 warn, 70 and 320 stop), an `auto` tag when the page falls back, and **Reset to auto**.
- The automatic search title is the name with the site name; the automatic description is the text shown on the page. This is what the page head already did in 0.101.23.
- The preview follows every keystroke of the name, the description, the slug (authors) and the two search fields. Red errors (over the limit, emoji) and yellow warnings show in the list under the box.
- Save writes the two fields next to the name and the description and still keeps any other key of the entry (`mergeEntry`). A role that may not save sees the fields locked.
- Nothing is changed in the post box, its tests or its styles (the new box reuses the same classes).

**Not built (next parts)**
- 6c: the page editor and the home page settings. 6d: tags (they have no stored data yet). The Hide from search switch and the Advanced fold are not on these screens.

**Files**
- Added: `site/tests/unit/admin-entry-box.test.ts` (19 tests), `tasks/open/T-0021.md`.
- Changed: `site/public/admin/js/listing.js`, `site/public/admin/js/listing-box.js`, `site/public/admin/js/app.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.23 (2026-11-17): Search title and description for category and author pages (PLAN 33.2, Phase 3b Part 6a)

Small part: the data and the rules for the next screens, as Part 5a did for the post box. No new screen.

**What changed**
- A category can have `metaTitle` and `metaDescription` in `config/categories.json`; an author can have the same two keys in `content/authors/<slug>.json` (the author schema accepts them, title up to 70 and description up to 320 characters).
- The page head of a category or author page uses them: an empty search title falls back to the page title, an empty search description to the visible description (`listingHead` in `src/lib/seo.ts`). The page number is still added after page 1. The heading on the page (`h1`) and the text under it do not change.
- Dashboard rules in `listing.js`: `entryErrors` (red errors: title over 70, description over 320, emoji) and `mergeEntry` (save without losing fields the screen does not show).
- The Categories and Authors saves now keep the two fields. Before this part, saving either screen would have deleted them, because the save wrote only the fields shown. Both saves also stop on the red errors.
- Checked with a real build and temporary values: the category page gave `<title>Film and TV news | Shivam Das News</title>` and the author page its own description; the test post, picture and values were removed afterwards and the three files are byte for byte the same as in 0.101.22.

**Not built (next parts)**
- The box on the page, category, tag and author screens and the home page settings (the screens). Tags have no stored data yet, so a tag page has no search fields.

**Files**
- Added: `site/tests/unit/listing-entry.test.ts` (14 tests), `tasks/open/T-0020.md`.
- Changed: `site/src/lib/seo.ts`, `site/src/lib/categories.ts`, `site/src/components/Listing.astro`, `site/src/pages/category/[category]/[...rest].astro`, `site/src/pages/author/[author]/[...rest].astro`, `site/src/content.config.ts`, `site/public/admin/js/listing.js`, `site/public/admin/js/app.js`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

## 0.101.22 (2026-11-17): The Advanced fold screen: share card, canonical, schema type (PLAN 33.2, Phase 3b Part 5b)

Small part: the screen for the data and rules of 0.101.21. No new rule; the screen only shows them.

**What the editor shows now** (inside the Search engine listing box, a new **Advanced** button opens the fold)
- A **share card preview** (picture, site name, title, description) that follows every keystroke, with the same fallbacks as the page head: empty share title = the page title, empty share description = the meta description, empty share picture = the featured image.
- **Share title** and **Share description** with a counter (60 and 160 warn, 70 and 320 stop), an `auto` tag, and **Reset to auto**.
- **Share picture** with an `auto` tag and **Use the featured image** (empties the field). The preview picture comes from the dashboard's own preview for a picture not saved yet. An address such as `javascript:` or `//host` is never put in the picture tag (`safePreviewSrc`).
- **Canonical URL** and **Schema type** moved here from the Details card (the same input and select, so saving and autosave work as before). A canonical that points to another page, another website, the page itself, or uses http or a `#` is shown as a warning in the box.
- Roles: the canonical field is locked with the words "Only editors and admins can change this." for a writer, and **Save checks the role again** (a restored draft with a canonical is refused and nothing is written). A canonical that already exists and is left alone never blocks a writer's save.
- Warnings of the fold show in the box's note list even while the fold is closed; red errors were already there (Part 5a).
- A box built without the share inputs draws no Advanced button, so older screens and tests are unchanged.

**A bug found and fixed while testing** (it was in my own 0.101.21 code)
- `checkCanonical` threw an error when the page's own address was only a path (no site address known) and the editor screen stopped drawing. It now treats an unreadable own address as "unknown". Regression test added.

**Files**
- Added: `site/tests/unit/admin-advanced-fold.test.ts` (24 tests), `tasks/open/T-0019.md`.
- Changed: `site/public/admin/js/listing-box.js`, `site/public/admin/js/app.js`, `site/public/admin/js/listing.js`, `site/public/admin/admin.css`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

**Careful**: the preview shows the share description exactly as the page head will write it: the stored description, not the automatic first paragraph (the page head does not fall back to the first paragraph). Publishing is still not blocked by the hard errors of the box (a later part).
**Not verified live**: not opened on a phone or the real dashboard (zip delivery).
**Still open (owner)**: everything of 0.101.21 still stands.

## 0.101.21 (2026-11-16): The data and rules of the Advanced fold: share card, canonical, schema type (PLAN 33.2, Phase 3b Part 5a)

Small part: the data, the rules and the page head. The screen is Part 5b.

**What a post can now carry** (front matter, all optional, empty means automatic)
- `ogTitle` (up to 70 characters): the title on a share card. Empty = the page title (`metaTitle`, else the headline).
- `ogDescription` (up to 320 characters): empty = the meta description.
- `ogImage` (a path starting with `/` or a full address): empty = the featured image.

**What the page does**
- `src/layouts/Base.astro` writes `og:title`, `og:description`, `og:image` and the `twitter:` tags from the new `shareValues()` of `src/lib/seo.ts`. A post without the new fields gets exactly the head it had before (checked on a real build).
- The alt text of the share picture is the featured picture's alt text only when the share picture is that same picture; otherwise the share title.

**What the dashboard rules do** (`site/public/admin/js/listing.js`, pure, no screen)
- `shareCard(post, ctx)`: the title, description and picture with `auto` flags, the cut for the preview, counters and levels (60 / 61 / 70 / 71 for the title, 160 / 161 / 320 / 321 for the description).
- `checkCanonical(value, ctx)`: empty is fine; spaces, a bad address or a wrong scheme stop; the page's own address, http, a `#` part, another page of this site and another website are plain warnings.
- `checkSchemaType(value)`: only NewsArticle, Article or BlogPosting; empty means NewsArticle.
- `advancedErrors(post, ctx)` is now part of `hardErrors()`: a bad canonical, a wrong schema type, a share title over 70, a share description over 320, an emoji in the share text, a share picture that does not start with `/` or `http`.
- New role action `post:canonical` for admin and editor (`roles.js`). A writer has no right to set a canonical; the screen of Part 5b will lock the field and Save will check the role again.
- `frontmatter.js`: the three fields are written after `canonical` and are left out when empty.
- `npm run check:content` (`scripts/validate-content-lib.mjs`): a bad canonical, a share title over 70, a share description over 320, a missing share picture file (published posts) and a picture path that does not start with `/` are errors; an outside share picture is a warning.

**Files**
- Added: `site/tests/unit/share.test.ts` (23 tests), `tasks/open/T-0018.md`.
- Changed: `site/src/content.config.ts`, `site/src/lib/seo.ts`, `site/src/layouts/Base.astro`, `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`, `site/public/admin/js/listing.js`, `site/public/admin/js/frontmatter.js`, `site/public/admin/js/roles.js`, `site/scripts/validate-content-lib.mjs`, `site/package.json`, `site/package-lock.json`, `CHANGELOG.md`, `INCOMPLETE.md`, `CODING_PLAN.md`.
- Removed: none.

**Careful**: the share limits (70 and 320) and the rule that a canonical to another page is only a warning are my proposals; they are listed as owner decisions in `INCOMPLETE.md`.
**Still open (owner)**: the decisions of 0.101.18 to 0.101.20 (repeated handle; description limit 160 or 320; may a writer hide a draft).
**Not built**: the Advanced fold screen (Part 5b), the box in other editors (Part 6), the Files screen (Parts 7 and 8), the File tab (Part 9), blocking Publish on the hard errors.

## 0.101.20 (2026-11-16): The Hide this page from search engines switch (PLAN 33.2, Phase 3b Part 4)

The Search engine listing box in the post editor now has the switch of PLAN 33.2. One tick tells search engines not to list the page.

**What the owner sees** (post editor, in the listing box under the 301 question)
- A tick **Hide this page from search engines**. On writes `robots: noindex,follow`; off writes `index,follow` (LOGICS 21 `hideFromSearch`).
- When on, a line says what it does: the page is left out of the sitemaps, the news sitemap and push notifications. The build already did this for any `noindex` post; nothing in the site code changed.
- A **red note** when the post is hidden and also marked Breaking or Featured.
- The tick and the Robots list in Details always show the same state, in both directions.
- Only **editors and admins** can use it. A writer sees it locked with the reason. A live post that the role cannot edit is locked too.

**What changed in the code**
- `site/public/admin/js/roles.js`: new action `post:noindex` for admin and editor.
- `site/public/admin/js/listing-box.js`: the switch, the info line, the red note; new options `canHide` and `onHide`; new export `isHidden(robots)`; new result `isHidden()`.
- `site/public/admin/js/app.js`: writes `d.robots` through `hideFromSearch()`; locks the Robots list for roles without the right; the saved state now remembers `robots`; **Save is refused** when a role without the right has changed robots (this also stops a restored draft from carrying a noindex in).
- `site/public/admin/admin.css`: two rules.

**Careful**: switching the tick off always gives `index,follow`, as LOGICS 21 says, so a `nofollow` set by hand in the Robots list is lost when the tick is switched off. The Robots list stays in Details until Part 5 moves it into the Advanced fold.

**Still open (owner)**: the two disagreements of 0.101.18 (repeated handle; description limit 160 or 320). The validator still wins at Save.
**Not built**: the Advanced fold (Part 5), the box in other editors (Part 6), the Files screen (Parts 7 and 8), the File tab (Part 9), blocking Publish on the hard errors.

**Tested here**: 15 new tests (the pure rule and the role, 7 for the switch in the box, 6 in the real editor: save with the tick on and off, the Robots list moving the tick, the red note, a writer locked out, a restored draft refused for a writer and allowed for an editor). Four deliberate mistakes were made one by one and each made a test fail: the red note never shown, the Save check removed, the writer allowed, the lock ignored. The whole suite passes (2,207 tests).

**Files added**: `tasks/open/T-0017.md`.
**Files changed**: `site/public/admin/js/listing-box.js`, `site/public/admin/js/roles.js`, `site/public/admin/js/app.js`, `site/public/admin/admin.css`, `site/tests/unit/admin-listing-box.test.ts`, `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 4 ticked), `INCOMPLETE.md`, this file.
**Files removed**: none.

**Approval**: `site/public/admin/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by`; only the owner closes the card.

## 0.101.19 (2026-11-16): The 301 question when the handle of a live post changes (PLAN 33.2, Phase 3b Part 3)

When the owner changes the URL handle of a **published** post, the Search engine listing box now asks the question of PLAN 33.2 and the save obeys the answer.

**What the owner sees** (post editor, under the listing preview)
- Post live for **more than 24 hours**: "the old address will redirect (301) to the new one. This cannot be switched off." The tick is on and locked.
- Post live for **24 hours or less** (or scheduled): a tick "Create a 301 redirect from the old address to the new one?", on by default, with a warning that the old address stops working if it is switched off.
- A draft, a new post, or an unchanged handle: no question. Going back to the old handle hides the question and puts the choice back to on.
- A new handle that is empty, invalid or owned by another live post shows a red note and no question.

**What changed in the code**
- `site/public/admin/js/listing-box.js`: asks `changeHandle()` of `listing.js` on every refresh; new options `orig` and `now`; new result `keepRedirect()`.
- `site/public/admin/js/redirects.js`: `nextRedirects(prev, next, tz, opts)` takes `opts.keepOld`. Only `false` skips adding the old address; the default is unchanged, so every older caller behaves as before. The loop guard still runs.
- `site/public/admin/js/app.js`: passes the saved state (`orig`), the status of the other posts, and `listingUi.keepRedirect()` into the save.
- `site/public/admin/admin.css`: one rule for the question box.

**Careful**: the switch changes the old address of a young post for any change of its URL (handle, category or date), because the editor keeps one old-address list. The question is shown only for a handle change, as in the plan.

**Still open (owner)**: the two disagreements of 0.101.18 (repeated handle; description limit 160 or 320). The validator still wins at Save.
**Not built**: the hide-from-search switch (Part 4), the Advanced fold (Part 5), the box in other editors (Part 6), blocking Publish on the hard errors.

**Tested here**: 12 new tests (3 for `nextRedirects`, 7 for the question in the box including the 24 hour edge, 2 in the real editor: an old post keeps its redirect, a young post saves with no redirect when switched off and with one when left on). Two deliberate mistakes were made one by one and each made a test fail: the save ignoring the switch, and the lock on an old post removed. All older tests pass unchanged.

**Files added**: `tasks/open/T-0016.md`.
**Files changed**: `site/public/admin/js/listing-box.js`, `site/public/admin/js/redirects.js`, `site/public/admin/js/app.js`, `site/public/admin/admin.css`, `site/tests/unit/admin-listing-box.test.ts`, `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 3 ticked), `INCOMPLETE.md`, this file.
**Files removed**: none.

**Approval**: `site/public/admin/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by`; only the owner closes the card.

## 0.101.18 (2026-11-16): The "Search engine listing" box in the post editor (PLAN 33.2, Phase 3b Part 2)

The post editor now has the Shopify-style box: a preview of the page in Google, an Edit link, and the three fields with counters. It uses the rules of `listing.js` (0.101.17). Saving, autosave and the slug logic are unchanged: the box wraps the three inputs the editor already had (meta title, meta description, permalink), it does not replace them.

**What the owner sees** (post editor, card "Search engine listing")
- A preview card (title, description, address) with a **Mobile** and a **Desktop** switch. Both cut the text like the real page head (60 and 160 characters).
- **Edit** opens three fields: Page title, Meta description, URL handle. The editor of a **new** post shows them open; an existing post shows the box closed.
- A counter for each field (`12/60`, `130/160`, and the handle length) that turns amber above 60 and 160 and red above 70 and 320, and one plain note per problem.
- A grey **auto** label when the value is made by the system, and **Reset to auto** when the owner typed one. For the handle, auto means "still follows the headline"; Reset puts back the slug of the headline.
- The fixed part of the address is shown in front of the handle and cannot be edited.
- Red notes for the hard errors of LOGICS 21 (empty title, repeated handle in the same category on the same date, emoji in the title or description, featured image under 1200 px). **They are only shown in this version; they do not block Publish yet.** The existing validator still blocks what it blocked before.
- The old separate "Google" preview card is removed (the box is the same preview, now with the switch). The Discover and Social cards stay.

**Two documents disagree (owner to decide, before Part 3)**
1. A repeated handle: LOGICS 21 allows it in another category or on another date; `validate.js` says a permalink is unique site-wide (the box follows LOGICS 21, the validator is stricter and still wins at Save).
2. The description limit: LOGICS 21 says warn above 160 and stop above 320; `validate.js` refuses a description over 160 at Save. So the box may show an amber warning at 161 while Save still refuses. Nothing was changed in `validate.js`.

**Not built yet**: the 301 question when the handle of a live post changes (Part 3), the hide-from-search switch (Part 4), the Advanced fold (Part 5), the same box in other editors (Part 6), blocking Publish on the hard errors.

**Tested here**: 17 new tests in `tests/unit/admin-listing-box.test.ts` (the pure preview helper; the box in jsdom: auto values, live counters, every colour change, Edit and Close, Mobile and Desktop, Reset to auto, read-only, red errors, a title with HTML stays text; and the box inside the real editor for a new and an existing post). The four older editor tests pass unchanged.

**Files added**: `site/public/admin/js/listing-box.js`, `site/tests/unit/admin-listing-box.test.ts`, `tasks/open/T-0015.md`.
**Files changed**: `site/public/admin/js/app.js` (imports the box, builds it, removes the Google card and the old counter), `site/public/admin/admin.css` (box styles), `site/public/admin/js/listing.js` (one comment), `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 2 ticked), `INCOMPLETE.md`, this file.
**Files removed**: none.

**Approval**: `site/public/admin/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by`; only the owner closes the card.

## 0.101.17 (2026-11-16): Search listing rules, `listing.js` (PLAN 33, Phase 3b Part 1)

The pure rules of the "Search engine listing" box, with no screen yet. Nothing in the dashboard or on the site changes: no file imports `listing.js` until Part 2.

**What it does** (`site/public/admin/js/listing.js`, LOGICS 21)
- `listing(post, ctx)`: page title (metaTitle, or headline plus site name), meta description (description, or the first plain paragraph of the summary or body cut to 155 at a word end; headings and code blocks are skipped), handle (permalink, or the slug of the headline), the address in the site time zone, the shown values cut to 60 and 160, the character counts, and which of the three are `auto`.
- `cut()` is the same function as `truncate()` in `src/lib/seo.ts`; a test compares the two on many texts so they cannot drift.
- `checkLimits()`: title warn above 60 and stop above 70; description warn above 160 and stop above 320; handle `[a-z0-9-]`, 1 to 120 characters (a leading, trailing or double hyphen is a warning). One plain note per problem.
- `hardErrors()` (block Publish): empty title, handle already used in the same category on the same date (the date in the site time zone), emoji in the title, meta title or description, featured image under 1200 px (an unknown width is not an error).
- `changeHandle()`: a published post older than 24 hours needs the 301 redirect and cannot switch it off; a younger one has it on by default and may switch it off; a draft or an unchanged handle needs none; the new handle is never empty, invalid or the handle of another live post.
- `hideFromSearch()`: `noindex,follow`, out of the sitemaps, the news sitemap and push announce (reason `noindex`), and the red note for a breaking or featured post.

**Found while testing**: the text helper `plainText()` removes the `#` marks of a heading, so a heading could have been taken as the first paragraph. The rule now splits the raw text first and skips headings. A test covers it.

**Two documents disagree (owner to decide)**: LOGICS 21 says a handle may repeat in another category or on another date; `validate.js` (v0.3.0) says a permalink is unique site-wide. `listing.js` follows LOGICS 21 as written. The existing validator is not changed, so nothing behaves differently today. Say which rule you want before Part 2 is wired in.

**Tested here**: 31 new tests (every limit edge 60, 61, 70, 71, 160, 161, 320, 321, 120, 121; every fallback; the cut against `seo.ts`; the handle against `slug.ts`; hard errors; old and young handle change with the 24 hour edge; noindex; a check that the file uses no network, storage or emoji).

**Files added**: `site/public/admin/js/listing.js`, `site/tests/unit/listing.test.ts`, `tasks/open/T-0014.md`.
**Files changed**: `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 1 ticked), `INCOMPLETE.md`, this file.
**Files removed**: none.

**Approval**: `site/public/admin/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by`; only the owner closes the card.

## 0.101.16 (2026-11-16): Auto-merge for content-only pull requests, `automerge.yml` (PLAN 35.4, Phase 3d Part 4)

An optional GitHub Action that merges a green pull request by itself, only for content-only changes, only when the owner switches it on. It is OFF by default: nothing is merged until the repository variable `AUTO_MERGE` is set to `on`. It changes no page, Worker or setting.

**When it merges** (all must be true; the rules are in `site/scripts/automerge-lib.mjs`)
- The Validate run finished green and was a pull request run; the pull request is open, not a draft, targets `main`, and did not change after the check (the merge uses `--match-head-commit`).
- The branch is named `ai/T-0000` or `human/T-0000` and comes from this repository (no fork).
- Every changed file is content only: `site/content/` (only `.md` or `.json`), `site/public/media/` (only png, jpg, gif, webp, avif; no svg or html), `site/config/redirects.json`, `site/config/categories.json`, and the card's own file `tasks/open/T-0000.md`. Nothing is deleted or renamed, at most 50 files, no label `no-automerge` or `needs-review`.
- Every reason to skip is printed as one `AUTOMERGE SKIP: ...` line; a skip is normal, not an error.
- Safe design: it starts from `workflow_run`, runs the workflow of `main`, never checks out or runs code of the pull request, passes every changing value through `env`, and has only `contents: write` and `pull-requests: write`.

**Correction to 0.101.15**: that entry told the owner to require the check `validate` on `main`. The dashboard saves straight to `main` (`site/public/admin/js/github.js`), so such a rule can block the owner's own saves. Branch protection is now optional, with a bypass step and a test step in `site/README.md`. Corrected lines: `AI_OPERATIONS.md` (Section 12), `INCOMPLETE.md` (the 0.101.15 block), `CODING_PLAN.md` (Part 3 text).

**Tested here**: 34 new tests (24 for the rules, the GitHub reader with a fake GitHub and the script; 10 for the workflow text). Six deliberate mistakes were put into the files one by one and each made a test fail (checkout of pull request code, no `AUTO_MERGE` check, no `--match-head-commit`, an extra write right, code files allowed, forks allowed). **Not run on GitHub yet** (zip delivery).

**Files added**: `.github/workflows/automerge.yml`, `site/scripts/automerge-lib.mjs`, `site/scripts/automerge.mjs`, `site/tests/unit/automerge.test.ts`, `site/tests/unit/automerge-workflow.test.ts`, `tasks/open/T-0013.md`.
**Files changed**: `site/package.json` and `site/package-lock.json` (version), `site/README.md` (owner steps and warning), `CODING_PLAN.md` (Part 4 ticked, workflow list), `INCOMPLETE.md`, `AI_OPERATIONS.md`, `tasks/README.md`, `tasks/open/T-0007.md` (Log line), this file.
**Files removed**: none.

**Approval**: `.github/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by:`; correct it if that is not what you meant.

**Note**: a merge made with the workflow's own token does not start `push.yml` (GitHub's rule). Cloudflare Pages still deploys and the hourly run of `push.yml` announces new posts.

**Not built (still open)**: Part 5 (the real trial on a branch). Task T-0007 keeps it.

## 0.101.15 (2026-11-16): The Validate action, `validate.yml` (PLAN 35, Phase 3d Part 3)

A GitHub Action that runs the checks on every pull request and on every push to `main`, `ai/` and `human/` branches, and shows red or green. A bad post is refused before it can reach `main`. It changes no page, Worker or setting and deploys nothing.

**What it runs** (in this order, in `site/`)
- `npm ci`, then `npm run check:content` with `--base`: a pull request is compared with `origin/<target branch>`, a branch push with `origin/main`, a push to `main` with the commit before it (no base on the very first push). A base that cannot be found is only a warning.
- `npm run tasks:check`, `npm test`, `npm run build`.
- It reads the repository only (`permissions: contents: read`), uses no secret, never uses `pull_request_target`, passes every changing value through `env` (never inside a shell line), fetches the full history, uses Node 22 and the two official actions at a fixed major version, cancels an older run of the same branch and stops after 20 minutes.

**Tested here**: 12 new tests read the workflow as text and fail when it is made unsafe (a write permission, a secret, an expression inside a shell line, a wrong order, a missing script). The shell step was also run in a throw-away git copy: a good change passes; a published post without `imageAlt` fails with `a published post needs imageAlt` and exit code 1; a removed config key fails; a missing base ref is a warning. **Not run on GitHub yet** (zip delivery): the first real run is the live test.

**Files added**: `.github/workflows/validate.yml`, `site/tests/unit/validate-workflow.test.ts` (12 tests), `tasks/open/T-0012.md`.
**Files changed**: `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 3 ticked, workflow list), `INCOMPLETE.md`, `AI_OPERATIONS.md` (Section 11 and the branch protection line), `tasks/README.md` (a short section), `tasks/open/T-0007.md` (Log line), this file.
**Files removed**: none.

**Approval**: `.github/` and `site/package.json` are red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by:`; correct it if that is not what you meant.

**Not built (still open)**: Part 4 (auto-merge and the branch protection steps in the README) and Part 5 (the real trial). Task T-0007 keeps those. The secret scan is the one inside the content check: it covers content and config files, not `workers/`. Owner step: after one green run, require the check `validate` on `main` (GitHub, Settings, Branches).

## 0.101.14 (2026-11-16): The content check, `npm run check:content` (PLAN 35, Phase 3d Part 2)

A script that checks the posts, pages, redirects and config files in about a second, before the build, and says in plain words what is wrong. It changes no page, Worker or setting; nothing to deploy. `npm run preflight` now runs it (the `content` step was "skipped" before).

**What it checks** (LOGICS 23)
- Posts: front matter like the build schema; slugs; title at least 5 characters; status in the list (`scheduled` is a warning: use `published` with a future date); date with a time and a time zone offset (an error for published, a warning for a draft); a published post needs image, `imageAlt`, a 50 to 160 character description and an image file that exists in `public/` (an outside picture address is a warning); first heading H2 and no skipped level; no emoji; no token or key.
- All posts together: the `permalink` and the live address are unique.
- `config/redirects.json`: a list of `{ from, to }`, both normalized, `from` is not a live page, no duplicate `from`, at most 2000.
- Every JSON file in `config/` and `content/authors/`: valid JSON and no token, key or 64 character hex string.
- With `--base origin/main`: a published post whose address changed needs the old address in redirects, and a config file must not lose a key.
- Last line: `CONTENT PASS (...)` or `CONTENT FAIL (...)`; exit code 1 on any error.

**Files added**: `site/scripts/validate-content-lib.mjs` (pure rules), `site/scripts/validate-content.mjs` (reads the files), `site/tests/unit/validate-content.test.ts` (27 tests), `tasks/open/T-0011.md`.
**Files changed**: `site/package.json` (script `check:content`, version), `site/package-lock.json` (version), `CODING_PLAN.md` (Part 2 ticked), `INCOMPLETE.md`, `AI_OPERATIONS.md` and `tasks/README.md` (no longer say "planned"), `tasks/open/T-0007.md` (Log line), this file.
**Files removed**: none.

**Approval**: `site/package.json` is red. The owner's chat message "next code koro" (2026-11-16) is written in the card's `approved-by:`; correct it if that is not what you meant.

**Not built (still open)**: Part 3 (`validate.yml`, red, `.github/`), Part 4 (auto-merge) and Part 5 (real trial). Task T-0007 keeps those. The secret scan covers content and config files, not `workers/`.

## 0.101.13 (2026-11-16): The read-only Tasks screen in the dashboard (PLAN 43.13, Phase 3k Part 7)

A new **Tasks** menu item in the dashboard (admins and editors). It only reads; it never writes to GitHub. It reads the cards in `tasks/open/` and `tasks/done/` and `INCOMPLETE.md` at the repository root (not under `contentRoot`).

**What it shows**
- **Waiting for the owner**: every card with `owner: human` that is not done, shortest `time` first.
- **Decisions that block work**: each undecided decision (from the table in `INCOMPLETE.md`) that an open card needs, with the cards behind it.
- **Board**: columns Idea, Ready, In progress, Review, Verify, Blocked, Done (only columns that have cards). Each card shows its risk, owner, time, what it still waits for, and "Red: no owner approval yet" where that is true.
- **Copy AI prompt**: builds the start prompt for one card (points to `AI_START_HERE.md`, the allowed paths, the branch `ai/T-0000`, `npm run preflight`, the handoff note, and the card text marked as data). If the clipboard is blocked, a box opens to copy by hand.

**Files added**: `site/public/admin/js/tasks.js` (pure functions), `site/tests/unit/admin-tasks.test.ts` (15 tests), `tasks/open/T-0010.md` (the card for this work).
**Files changed**: `site/public/admin/js/app.js` (menu item, route, `tasksView`), `site/public/admin/js/roles.js` (action `tasks` for admin and editor), `site/public/admin/admin.css` (board styles), `site/package.json` and `site/package-lock.json` (version), `CODING_PLAN.md` (Part 7 ticked), `INCOMPLETE.md` (phase row and new Open Items block), `tasks/README.md` (one line about the screen), this file.
**Files removed**: none.

**Approval**: Part 7 touches `site/public/admin/` and `package.json`, which are red. The owner asked for "next code" in the chat on 2026-11-16, and that is written in the card's `approved-by:`. If you meant something else, say so and the card can be corrected.

**Not built (still open)**: Part 8 (create, claim, move, close from the dashboard, and the Owner checklist with Check it buttons) and Part 9 (weekly report Action). Nothing to deploy beyond the normal Pages build.

## 0.101.12 (2026-11-16): The paths gate and the second-key gate, `npm run tasks:gate` (PLAN 43, Phase 3k Part 5, scripts only)

Two checks from LOGICS 31.9 and 31.6, built as scripts. They change no site page, Worker or setting; nothing to deploy.

**A correction to v0.101.6 to v0.101.11**: I had moved task T-0006 to `tasks/done/`. It is a yellow card, so by the rules it needs a second key first. The new close gate showed this at once. T-0006 is back in `tasks/open/` with status `verify`, and its Log says what is missing. `tasks/done/` now holds an empty `.gitkeep`.

**What you must do**: nothing. If you want T-0006 closed, ask a different person or AI session to follow the reviewer checklist in `tasks/README.md` and write `Confirmed by <name>, <date>` in its Log.

**What it does**: `paths` compares the changed files of a branch named `ai/T-0000` or `human/T-0000` with the `paths` of its card. `close` checks the second key. The workflow that runs them on every pull request is **not built**: `.github/` is red and needs the owner's approval.

**Added**
- `site/scripts/task-gate-lib.mjs`, `site/scripts/task-gate.mjs`, `site/tests/unit/task-gate.test.ts` (20 tests).
- `tasks/done/.gitkeep`.
- `package.json` script `tasks:gate`.

**Changed**
- `tasks/open/T-0006.md` (status verify, a Log line), `tasks/README.md` (a section "The two gates"), `CODING_PLAN.md` (Part 5 marked partly done), `INCOMPLETE.md` ("Open Items After v0.101.12").
- `site/package.json`, `site/package-lock.json`: version 0.101.12.

**Removed**: nothing (`tasks/done/T-0006.md` went back to `tasks/open/T-0006.md`, where it was at the start).

## 0.101.11 (2026-11-16): The document archive tool and the budget test (PLAN 43, Phase 3k Part 6)

A tool to shrink `INCOMPLETE.md` and `CHANGELOG.md` without losing text, and a test for the document size budget. **The tool was not run on the real documents**: task T-0008 does that after decision 43. Nothing to deploy.

**What you must do**: answer decision 43 (the size budgets) in `INCOMPLETE.md`, then ask for T-0008.

**What it does**: `npm run docs:archive` (in `site/`) shows the plan only. Today it would keep the decisions, the newest two "Open Items After vX" blocks (about 3,700 words left in `INCOMPLETE.md`) and the newest changelog entry (about 260 words left in `CHANGELOG.md`), and move the rest, word for word, to `docs/archive/INCOMPLETE-<first>-<last>.md` and `docs/archive/CHANGELOG-<first>-<last>.md`. With `--apply` it writes the archive, checks that every moved section is inside it, every kept section is still in the main file and the words add up, then rewrites the main file. It never overwrites an existing archive. A pointer line after the first line of the main file names the archive.

**Added**
- `site/scripts/archive-docs-lib.mjs`, `site/scripts/archive-docs.mjs`, `site/tests/unit/archive-docs.test.ts` (17 tests, in a temporary folder), `site/tests/unit/docs-budget.test.ts` (3 tests: `AI_START_HERE.md` must stay within 900 words and no document except the two above may be over its budget).
- `package.json` script `docs:archive`.

**Changed**
- `tasks/open/T-0008.md`: a step that names the tool. `tasks/README.md`: a section "Archiving old documents". `CODING_PLAN.md`: Part 6 ticked. `INCOMPLETE.md`: "Open Items After v0.101.11".
- `site/package.json`, `site/package-lock.json`: version 0.101.11.

**Removed**: nothing.

## 0.101.10 (2026-11-16): `npm run verify:live`, the live check of a published address (PLAN 43, Phase 3k Part 4, script only)

A command now opens real addresses on the live site and checks them (LOGICS 31.11). It changes no site page, Worker or setting; nothing to deploy.

**What you must do**: nothing. After a post is live, run `npm run verify:live -- https://shivam-das-news.pages.dev /the/post/address/` on a computer with internet, and paste the lines in the task card.

**What it checks** for each address: the expected status (200, or a redirect written as `/old@301` with a Location header), exactly one canonical link equal to the address, no noindex (meta tag or header) unless `--allow-noindex`, JSON-LD blocks that parse, no `http://` picture, script or style on an https page, and an answer in under 3 seconds. Sitemaps and other non-HTML files only get the status, time and header checks. Last line: `VERIFY-LIVE PASS (N addresses)` or `VERIFY-LIVE FAIL (x of N)`.

**Not built (needs the owner)**: the GitHub Action `.github/workflows/live-check.yml` that runs it after each deploy and comments on the pull request. `.github/` is red (`tasks/README.md`), so an AI only prepares it after the owner writes `approved-by:` in a card.

**Added**
- `site/scripts/verify-live-lib.mjs`, `site/scripts/verify-live.mjs`, `site/tests/unit/verify-live.test.ts` (17 tests, including a small local server run).
- `package.json` script `verify:live`.

**Changed**
- `tasks/README.md`: a "The live check" section. `CODING_PLAN.md`: Part 4 marked partly done. `INCOMPLETE.md`: "Open Items After v0.101.10".
- `site/package.json`, `site/package-lock.json`: version 0.101.10.

**Removed**: nothing.

## 0.101.9 (2026-11-16): `npm run preflight`, one check with one summary line (PLAN 43, Phase 3k Part 3)

One command now runs every check we have and prints a single line to paste as evidence. It changes no site page, Worker or setting; nothing to deploy.

**What you must do**: nothing. Run `npm run preflight` in `site/` before you finish any task.

**What it does**: tests, build, content check (skipped and said so while `scripts/validate-content.mjs` does not exist, task T-0007), tasks check, document budgets. Last line: `PREFLIGHT PASS` or `PREFLIGHT FAIL: <steps>`. Skipped steps and warnings are named in the same line. `--fast` skips tests and build. Over-budget documents are a warning for now (`CHANGELOG.md` and `INCOMPLETE.md` are over), and fail only with `--strict-budgets`, because decision 43 is not answered and T-0008 has not shrunk them yet.

**Added**
- `site/scripts/preflight-lib.mjs`, `site/scripts/preflight.mjs`, `site/tests/unit/preflight.test.ts` (14 tests).
- `package.json` script `preflight`.

**Changed**
- `tasks/README.md`: a "The one check before you finish" section. `CODING_PLAN.md`: Part 3 ticked. `INCOMPLETE.md`: "Open Items After v0.101.9".
- `site/package.json`, `site/package-lock.json`: version 0.101.9.

**Removed**: nothing.

## 0.101.8 (2026-11-16): Task card check, `npm run tasks:check` (PLAN 43, Phase 3k Part 2)

A script now checks every task card against the rules of LOGICS 31, so a wrong card is found at once. It changes no site page, Worker or setting; nothing to deploy.

**What you must do**: nothing. Run `npm run tasks:check` in `site/` any time.

**Added**
- `site/scripts/task-lint-lib.mjs` (the rules) and `site/scripts/task-lint.mjs` (reads `tasks/open` and `tasks/done`, prints `TASKS PASS` or `TASKS FAIL: N problems`).
- `site/tests/unit/task-lint.test.ts` (34 tests, good and bad cards).
- `package.json` script `tasks:check`.

**Changed**
- `tasks/open/T-0009.md`: risk green to yellow, because it edits `INCOMPLETE.md`, a root document (LOGICS 31.3). The new check found this.
- `tasks/README.md`: a "Checking the cards" section. `CODING_PLAN.md`: Part 2 ticked. `INCOMPLETE.md`: "Open Items After v0.101.8".
- `site/package.json`, `site/package-lock.json`: version 0.101.8.

**Not yet in this check** (later parts): the exact Evidence shape (link, file list, check line), the stale-claim rule, the paths check against a pull request, the "second key" rule on closing.

**Removed**: nothing.

## 0.101.7 (2026-11-16): Tests no longer depend on the owner settings (task T-0006)

The 12 failing tests are fixed: they expected empty owner settings, and the owner had filled them in. Now they read fixture copies, so `npx vitest run` shows 0 failed (106 files, 1939 tests). No site code, config or Worker changed; nothing to deploy.

**What you must do**: nothing.

**Added**
- `site/tests/fixtures/shipped/config/` (`publisher.json`, `analytics.json`, `contact.json`, `push.json`, all empty) and `site/tests/fixtures/shipped/workers/` (`analytics`, `contact`, `push` `wrangler.toml` with placeholders).
- `site/tests/unit/shipped-files.test.ts`: the real Worker settings files keep the DB binding and no secret value.
- `tasks/done/T-0006.md` (moved from `tasks/open/`, evidence filled).

**Changed**
- 10 files in `site/tests/unit/` (analytics-worker, beacon, contact-form, contact-inbox, contact-worker, notifications-topic, push-client, push-endpoints, required-pages, trending): they read the fixtures.
- `site/package.json`, `site/package-lock.json`: version 0.101.7.
- `INCOMPLETE.md`: "Open Items After v0.101.7".

**Removed**: nothing from the project (`tasks/open/T-0006.md` moved to `tasks/done/`).

## 0.101.6 (2026-11-16): Task system so humans and AI finish work properly (PLAN 43, Phase 3k Part 1); starter files added

The owner asked for more professional ideas for AI and humans so that tasks are completed properly. This version adds the plan **and** the starter files that can be used today by hand. **No code changed**: no script, no test, no workflow; nothing to deploy.

Why: the documents are about 140,000 words, tasks and results lived only in chat, "done" had no proof (the 2026-11-16 ChatGPT test), twelve red tests were accepted, two documents disagree about the time zone, many decisions have no answer, and the owner's own steps have no checklist.

What it adds: one page for every AI (`AI_START_HERE.md`: ten rules, what to read per task, when to stop and ask, what counts as evidence, the handoff note); one file per task (`tasks/`: states, green, yellow and red risk, claims, a second key, evidence, an undo line); nine real cards written from this review (the owner's steps first); a GitHub Issue form and a pull request template; and the plan for the checks that will run by themselves (task check, preflight, paths check, live check after deploy, documents size budget, a Tasks screen with "Copy AI prompt" and a guided owner checklist).

**What you must do**: open the folder `tasks/open/`. Do T-0001 (three publisher facts), T-0002 (five real articles) and T-0003 (time zone and country) first; answer the decisions in T-0009. Nothing is required to keep the site working.

**Added**
- `AI_START_HERE.md`.
- `tasks/README.md`, `tasks/TEMPLATE.md`, `tasks/open/T-0001.md` to `T-0009.md`, `tasks/done/` (empty).
- `.github/ISSUE_TEMPLATE/task.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/pull_request_template.md`.
- `NEWS_WEBSITE_PLAN.md`: Section 43 and row 27 of the requirement map.
- `CODING_PLAN.md`: Phase 3k (9 parts, Part 1 done).
- `LOGICS.md`: Section 31 (card shape, transitions, risk from paths, ready rule, claims, who closes, evidence, needs, paths check, document budgets, live check, handoff).
- `BUGS.md`: group Q (Q1 to Q18).
- `AI_OPERATIONS.md`: a pointer to `AI_START_HERE.md` at the top and Section 19 (the task protocol, a start prompt and a reviewer prompt).
- `BETTER.md`: ideas N48 to N55 and a tenth line in the Suggested Order.

**Changed**
- `INCOMPLETE.md`: decisions 41 to 46, phase row 3k, "Open Items After v0.101.6".
- `POLISH.md`: one line (tasks).
- `site/package.json`, `site/package-lock.json`: version 0.101.6.

**Removed**: nothing.

## 0.101.5 (2026-11-16): Plan only: author pages that get indexed, a Newsroom theme and a better dark mode (PLAN 41 and 42, Phases 3i and 3j)

The owner asked for (1) the author to be indexed, (2) a more professional theme, (3) a better dark mode, all written into the `.md` files. **No code changed**: nothing to deploy.

What the code and the numbers showed: the author is not indexed because an author page is built only after the first published post, and there is none, so `sitemap-authors.xml` is empty; the article's author box has no link or photo; the author data has no `@id`. In dark mode a card is 1.08 : 1 against the page and the outline 1.16 : 1, so edges look muddy; the browser bar stays orange; the switch has two states; `color-scheme` is missing; the dark colours are written ten times. The footer has no About, Privacy or Contact links because the required pages are not generated (the publisher file lacks address, founding year and funding summary).

The plan: a live author profile (Show author page now, or the first post), an index-ready checklist, title and ProfilePage data with `@id`, a linked author box, an `/authors/` page with two or more authors; a Newsroom look (soft borders, calm cards, visible category bar) with today's look kept as Playful, new measured dark colours with three surfaces, a three-state System, Light, Dark switch, two `theme-color` tags, one tokens file that builds the CSS and feeds the contrast test, and a Theme screen in the dashboard.

**What you must do**: nothing is required. Fill `address`, `foundedYear` and `fundingSummary` in `config/publisher.json` and run `npm run pages` (the footer trust links come from this). Publish at least one real article. Please answer decisions 34 to 40 in `INCOMPLETE.md`.

**Added**
- `NEWS_WEBSITE_PLAN.md`: Sections 41 and 42, rows 25 and 26 of the requirement map.
- `CODING_PLAN.md`: Phase 3i (7 parts) and Phase 3j (9 parts).
- `LOGICS.md`: Sections 29 (author rules) and 30 (theme rules).
- `BUGS.md`: groups M (M1 to M14) and R (R1 to R17).
- `AI_OPERATIONS.md`: Section 18 (authors are real people; which theme fields an AI may change).
- `BETTER.md`: ideas N42 to N47 and a ninth line in the Suggested Order.
- `CSS.md`: a last section with the planned Newsroom and dark tokens.

**Changed**
- `INCOMPLETE.md`: decisions 34 to 40, phase rows 3i and 3j, "Open Items After v0.101.5".
- `POLISH.md`: two lines (author pages, theme and dark mode).
- `site/package.json`, `site/package-lock.json`: version 0.101.5.

**Removed**: nothing.

## 0.101.4 (2026-11-16): Plan only: automatic dashboard sign-in and a professional link editor (PLAN 39 and 40, Phases 3g and 3h)

The owner asked for two things: (1) after GitHub is connected, the dashboard at `/admin/` should sign in by itself; (2) the "Links" box of the Authors screen should be more professional. Both plans are now in the files. **No code changed**: nothing to deploy.

What the code showed (v0.101.3): the dashboard keeps the GitHub token in `sessionStorage`, so every new tab or robot starts at "Sign in"; and the auth Worker asks GitHub for the scope `repo`, which reaches all repositories of the account. The plan fixes both: a session cookie from the site's own address (HttpOnly, encrypted, 30 days), the token only in memory, one automatic redirect sign-in, Sign out that revokes the token at GitHub, and the smaller scope `public_repo`. The plan also says plainly that the GitHub connection inside ChatGPT is its own key and cannot log in to the dashboard; an AI uses the GitHub connector or a Connected app token instead.

The link editor replaces the text box with rows: type, label, address, Up and Down, Remove, Open, paste-and-fill, live checks (https only, no tracking parts, no duplicates, at most 10, no emoji), a preview, the same rules in the dashboard, the build and the API, and a weekly report-only link check.

**What you must do**: nothing is required. One quick safety step you can do today without new code: set `GITHUB_SCOPE = "public_repo"` in `workers/auth/wrangler.toml`, run `npx wrangler deploy` in `workers/auth`, then sign out and sign in again (only if the repository is public). Please also answer decisions 28 to 33 in `INCOMPLETE.md`.

**Added**
- `NEWS_WEBSITE_PLAN.md`: Sections 39 and 40, rows 23 and 24 in the requirement map.
- `CODING_PLAN.md`: Phase 3g (7 parts) and Phase 3h (6 parts).
- `LOGICS.md`: Sections 27 (session, same-origin check, redirect flow, logout, scope) and 28 (link rules).
- `BUGS.md`: groups Y (Y1 to Y12) and Z (Z1 to Z12).
- `AI_OPERATIONS.md`: Section 17.
- `BETTER.md`: ideas N36 to N41 and an eighth line in the Suggested Order.

**Changed**
- `INCOMPLETE.md`: decisions 28 to 33, phase rows 3g and 3h, "Open Items After v0.101.4".
- `POLISH.md`: two lines (sign-in, link editor).
- `site/package.json`, `site/package-lock.json`: version 0.101.4.

**Removed**: nothing.

## 0.101.3 (2026-11-16): Plan only: Connected apps, a Shopify-style API connection for AI tools (PLAN 38, Phase 3f)

The owner asked that ChatGPT (and other tools) connect the way Shopify custom apps do, with no browser robot and no dashboard login. The plan is now in the files. **No code changed**: no Worker, no screen, no test, nothing to deploy.

In short: a new Worker `workers/api` with a token that has only the rights the owner ticked (read, write, publish, archive, authors, redirects, pictures; delete forever off by default); a GitHub App so the assistant never sees a GitHub key; dry run, version check (412 instead of a blind 409), idempotency, one commit per task, an activity list, Pause and Revoke; a dashboard screen "Connected apps"; MCP tools and an OpenAPI file for assistants. The plan also says honestly that a Free ChatGPT account cannot add a custom connector (checked on the web on 2026-11-16; check again on the day), so the GitHub connector path of AI_OPERATIONS 15 stays as the fallback.

**What you must do**: nothing now. Please answer decisions 23 to 27 in `INCOMPLETE.md`, above all 27 (which assistant or plan first). The next code step is Phase 3d Parts 2 to 4, then Phase 3f Part 1.

**Added**
- `NEWS_WEBSITE_PLAN.md`: Section 38 and row 22 in the requirement map.
- `CODING_PLAN.md`: Phase 3f (10 parts) and `api` in the workers list.
- `LOGICS.md`: Section 26 (check order, path allow list, versions, idempotency, dry run, delete and archive, activity line, tokens, pause).
- `BUGS.md`: group X (X1 to X16).
- `AI_OPERATIONS.md`: Section 16 (rules for an assistant in Connected app mode); Section 15 row 5 now points to it.
- `BETTER.md`: ideas N32 to N35 and a seventh line in the Suggested Order.

**Changed**
- `INCOMPLETE.md`: decisions 23 to 27, the phase row 3f, "Open Items After v0.101.3".
- `POLISH.md`: one line for the Connected apps screen.
- `site/package.json`, `site/package-lock.json`: version 0.101.3.

**Removed**: nothing.

## 0.101.2 (2026-11-16): Docs only: faster AI work without a browser robot (ideas N25 to N31)

A ChatGPT test with a browser robot (TinyFish) needed about 6 minutes for a small job and hit a GitHub 409 in the dashboard; it finished only by writing straight to GitHub. The files now say that clearly and list the fast paths. **No code changed**: nothing to deploy.

**What you must do**: nothing now. When you want AI jobs to be fast and safe, build N27 first (Phase 3d Parts 2 to 4), then N25 and N26.

**Added**
- `AI_OPERATIONS.md`: Section 15 (five paths ranked by speed, token rules, paths an AI may write directly, what to do on a 409 or 422, how to report a finished task).
- `BETTER.md`: section E with ideas N25 to N31 and a sixth line in the Suggested Order.

**Changed**
- `INCOMPLETE.md`: "Open Items After v0.101.2" (also notes the time zone mismatch and the 12 old failing tests).
- `site/package.json`, `site/package-lock.json`: version 0.101.2.

**Removed**: nothing.

## 0.101.1 (2026-11-16): Plan only: direct code writing in the post editor (PLAN 37, Phase 3e)

The plan for writing code directly in the editor, like the HTML view of Blogger and "Show HTML" of Shopify, is now in the files. **No code changed**: no screen, no Worker, no test, nothing to deploy. It is split into 7 small parts (CODING_PLAN Phase 3e), so each can be built and tested on its own.

In short (full text in PLAN 37): tabs Write, HTML and Preview; a **Code** button for showing code to readers in about 23 languages (HTML, CSS, JavaScript, Java, Python, PHP, SQL and more) with colours made at build time and a Copy button; an **HTML block** and a **Page CSS** box for editors and admins; **Page JavaScript** for admins only; a safe preview in a sandboxed frame so the dashboard token can never be reached; one H1, no emoji, no ad addresses and size limits checked by the build.

**What you must do**: nothing now. Please answer the 4 open decisions in `INCOMPLETE.md` (items 19 to 22) before Part 4 and Part 5 are built; the proposed values are written there. The next code part is Phase 3e Part 1 (the rules and the sanitizer, no screen).

**Added**
- `NEWS_WEBSITE_PLAN.md`: Section 37 (and row 21 in the requirement map).
- `CODING_PLAN.md`: Phase 3e (7 parts).
- `LOGICS.md`: Section 25 (the sanitizer, the marker, the CSS scope, the script rules, the roles).
- `BUGS.md`: group K (K1 to K18).
- `AI_OPERATIONS.md`: Section 14.

**Changed**
- `NEWS_WEBSITE_PLAN.md`: Section 27 and Section 12 point to Section 37.
- `INCOMPLETE.md`: decisions 19 to 22, the phase row 3e, "Open Items After v0.101.1".
- `POLISH.md`: one line in "Admin Polish".
- `site/package.json`, `site/package-lock.json`: version 0.101.1.

**Tests run here**: `npm test` and `npm run build` (the numbers are in the answer to this task; the 12 old tests that expect empty owner settings still fail, nothing else).

**Removed**: nothing.

## 0.101.0 (2026-11-16): Push: the offer "Remove this topic?" and its one-tap button on /notifications/ (push Part 8c-2)

A reader who tapped "Less like this" 3 times in 30 days for a category they still follow now sees, on `/notifications/`, a box with one line and one button for each such category: "You tapped Less like this for Sports 3 times. Remove Sports?" and the button "Remove Sports" (PLAN 31.8). One tap saves only that one change (the saved categories without it). When a category is removed, in this way or by Save, its counted taps are deleted, so the offer does not come back. **The site never removes a choice by itself**: only the reader's tap does. The last choice cannot be removed this way (the page says why).

**What you must do**
1. Deploy the push Worker again: `cd workers/push ; npx wrangler deploy`. There is no database change and no migration (the table `push_less` of v0.100.0 is used as it is).
2. Publish the site as usual (the page and the script changed).
Until step 1 is done the page works but the counted taps are not cleared on removal (the offer for a removed topic cannot show anyway, because the offer lists only categories the reader still follows).

**Added**
- `site/tests/unit/notifications-offer.test.ts`: 21 tests (the words, the helpers, the box with one line and one button, no offer without taps or without a subscription, one tap saves only the one change, other typed edits stay and are not saved, the last choice is not removed, a keyword or breaking news lets the last category go, a failed save keeps the offer, turn on again, no double tap, Save clears the line, an unknown category gives no line, "unsubscribe" clears the box, text only and never HTML, the page file).
- `site/tests/unit/push-less-clear.test.ts`: 11 tests (the rule `removedCategories`, `cleanOffer`, the taps of a removed category are cleared and the offer is gone, only that category, other readers untouched, adding or saving the same clears nothing, a rejected save clears nothing, weight and other choices unchanged, an old database without the table still saves, the client reads the offer from the real Worker on real SQLite).
- `BUGS.md`: P100 to P105.

**Changed**
- `workers/push/feedback.js`: `CLEAR_LESS_SQL` and `removedCategories`.
- `workers/push/index.js`: `POST /preferences` with changes deletes the counted taps of the categories that are no longer followed (own error guard; a failure never hides the saved choices).
- `site/src/lib/push-client.js`: `getPrefs` also returns `suggestRemove` (a clean list, at most 10) when the Worker gave one; new `cleanOffer`. The field is left out otherwise, so older callers see the same answer as before.
- `site/src/lib/notifications-page.js`: `offerText`, `offerDone`, `OFFER_LAST`, `categoryName`, `offerItems`, `renderOffer`; the one-tap handler; the offer is refreshed after load, turn on, Save and unsubscribe. Lines are made with `textContent`, never HTML.
- `site/src/pages/notifications.astro`: the box `data-n-suggest` (starts hidden) and `data-name` on each category tick box.
- `site/src/styles/global.css`: `.notify-offer` rules.
- `site/package.json`, `site/package-lock.json`: version 0.101.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.8), `site/README.md` (section "Push feedback").

**Tests run here**: `npm test` gave 1924 passed and 12 failed (the same 12 old tests that expect empty owner settings; not about this change); `npm run build` passed and the built `/notifications/` page holds the new box. The 32 new tests all pass. While writing them the double-tap test found a real fault (the offer buttons were not in the busy list); it is fixed (BUGS P101). A first name for the new box, `data-n-offer`, started with the same letters as the older `data-n-off` and broke an old order test; the box is now `data-n-suggest` (BUGS P105).

**Honest limits**: a reader who removes a topic by turning notifications off and on again with fewer categories (`/subscribe`) keeps the old counted taps for up to 30 days; they give no offer while the topic is not followed. There is no "Keep it" button yet: the offer comes back on each visit while 3 or more taps are counted, until the reader removes the topic or 30 days pass. The real Cloudflare D1 database and a real browser were not tried; the tests use real SQLite and jsdom.

**Removed**: nothing.

## 0.100.0 (2026-11-16): Push: "Less like this" taps are counted, and the read answer can carry an offer (push Part 8c-1)

Every "Less like this" tap is now also counted in a new small table, `push_less` (the category and the time, nothing else, kept 30 days). When a reader's choices are read (`POST /preferences` without changes), the answer gets `suggestRemove: [{ category, count }]` for each category that the reader still follows and tapped "Less like this" for 3 or more times in 30 days (PLAN 31.8). The field is left out when there is none. **The page does not show the offer yet** (that is part 8c-2). The site never removes a choice by itself.

**What you must do**
1. Run the new table once on the push database: `cd workers/push ; npx wrangler d1 execute <database-name> --remote --file=migrate-0.100.0.sql` (safe to run again; a NEW database made from `schema.sql` already has it).
2. Deploy the push Worker again: `cd workers/push ; npx wrangler deploy`.
Until step 1 is done everything still works: taps move the weights, reading the choices works, removing a reader works; only the offer is missing.

**Added**
- `workers/push/migrate-0.100.0.sql` and the table `push_less` in `workers/push/schema.sql`.
- `workers/push/feedback.js`: `RECORD_LESS_SQL` (at most 20 rows for one reader and one category in 30 days), `LESS_COUNTS_SQL`, `suggestRemove`, `runLessCleanup`, `DELETE_LESS_SQL`, `categoryKey`.
- `site/tests/unit/push-less.test.ts`: 18 tests (the rules, the count, the 30 day window, a category not followed, another reader, the cap, an old database without the table, the migration twice, delete my data, the clean-up, the tick).
- `BUGS.md`: P96 to P99.

**Changed**
- `workers/push/index.js`: a `less` tap is counted after the weight is saved (its own error guard); the read answer carries `suggestRemove`; "delete my data" and a dead browser first remove the counted taps (guarded, so an old database still removes the reader).
- `workers/push/control.js`: the hourly tick also deletes old taps and taps of readers that no longer exist (`lessDeleted` in its answer).
- `site/tests/unit/push-lib.test.ts`: the expected table list now ends with `push_less`.
- `site/tests/unit/push-fade.test.ts`: the import check accepts the longer import line.
- `site/package.json`, `site/package-lock.json`: version 0.100.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.8), `site/README.md` (section "Push feedback").

**Tests run here**: the new file passes (18). The full `npm test` gave 1892 passed and 12 failed (the same 12 old tests that expect empty owner settings; not about this change); `npm run build` passed.

**Honest limits**: after a reader removes a topic and adds it back inside 30 days, the old taps still count (part 8c-2 will clear them when the page removes the topic). The real D1 database was not tried; the tests use real SQLite.

**Removed**: nothing.

## 0.99.0 (2026-11-16): Push: the learned weights fade by 5 percent a week (push Part 8b)

Every learned category weight now moves back toward 0 by 5 percent a week, so old habits fade (PLAN 31.8). It runs inside the hourly clean-up tick of the push Worker (minute 7), as one database statement for all readers: each hour every weight is multiplied by 0.95 to the power of 1/168. A weight whose size falls under 0.005 is removed. **The push Worker must be deployed again** (`cd workers/push ; npx wrangler deploy`). No database change: no migration. No page change.

What does not change: the reader's own choices (categories, keywords, authors), engagement, the counters. A reader marked gone and a row whose weights text is broken are not touched. The fade does not depend on the pause switch or on the sender keys, like the rest of the clean-up.

**Added**
- `workers/push/feedback.js`: `FADE_FACTOR`, `FADE_SQL`, `fadeWeights` (the same rule in plain code) and `runFade` (never throws). `cleanWeights` got an optional number of digits (6 for the fade, 4 as before).
- `site/tests/unit/push-fade.test.ts`: 16 tests (the rule, 168 runs give 95 percent, the SQL gives the same numbers as the plain code, gone readers and broken text untouched, the tick, the scheduled handler).
- `BUGS.md`: P93 to P95.

**Changed**
- `workers/push/control.js`: `runCleanupTick` also calls `runFade` and adds `faded` (readers changed) to its answer.
- `site/package.json`, `site/package-lock.json`: version 0.99.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.8), `site/README.md` (section "Push feedback").

**Tests run here**: the new file passes (16); the full `npm test` gave 1874 passed and 12 failed (the same 12 old tests that expect empty owner settings; not about this change); `npm run build` passed.

**Honest limits**: if the hourly tick is missed (a Cloudflare cron fault), that hour does not fade, which is a very small difference. The real cron was not run on Cloudflare yet.

**Removed**: nothing.

## 0.98.0 (2026-11-16): Push feedback: the taps of the reader move the learned weights (push Part 8a)

The push Worker has a new route, `POST /feedback`. The service worker (v0.54.0) already sends `{ sub, token, event, tag }` when a reader opens, closes or taps "Less like this"; until now nothing answered. Now the Worker finds the category of the story that was sent under that tag and moves **one learned weight** (PLAN 31.8). **The push Worker must be deployed again** (`cd workers/push ; npx wrangler deploy`). No database change: no migration. No page change.

The rules: open = the weight moves 10 percent of the way to +1 and engagement goes up by 1; close = minus 0.04; "Less like this" = minus 0.25. The weight stays between -1 and 1, at most 40 categories are kept, and the reader's own choices (categories, keywords, authors) are never removed.

**Added**
- `workers/push/feedback.js`: the rules (`applyFeedback`, `cleanWeights`, `cleanTag`) and the two SQL lines.
- `workers/push/index.js`: the route `/feedback` (reader checked with sub and token; exact fields; only the site may call; the test tag, an empty tag, an unknown event or a story never sent to this reader change nothing and still answer 200 `{ ok: true, applied: false }`). The answer never holds a category, a weight or story text.
- `site/tests/unit/push-feedback.test.ts`: 18 tests (the rules, the route on real SQLite, wrong token, wrong reader, wrong origin, extra field, newest story decides, file check against the service worker).
- `BUGS.md`: P89 to P92.

**Changed**
- `site/package.json`, `site/package-lock.json`: version 0.98.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.8), `site/README.md` (section "Push feedback").

**Not in this part**: the weekly fade of the weights (5 percent), the "Remove Sports?" offer after 3 "Less like this" taps, the adaptive limit and the pause after no opens. They are the next small parts of Part 8.

**Tests run here**: the new test file passes (18). The full `npm test` and `npm run build` were run: see the numbers in INCOMPLETE.md ("Open Items After v0.98.0").

**Removed**: nothing.

## 0.97.2 (2026-11-16): A default share picture (Open Graph and X card)

A link scan (opengraph.xyz) showed no `og:image` and no `twitter:image` on the home page, so shared links had no picture and X used the small card. Now every page without its own picture uses one default picture, and X uses the large card.

**Added**
- `site/public/og-default.png` (1200 x 630, brand colour, logo, site name and tagline).
- `site/config/site.json`: `defaultImage` (`/og-default.png`).

**Changed**
- `site/src/layouts/Base.astro`: uses `defaultImage` when a page has no image; adds `og:image:alt`, `og:image:width`, `og:image:height` (default picture only) and `twitter:image:alt`; `twitter:card` is `summary_large_image` on every page.
- `site/package.json`, `site/package-lock.json`: version 0.97.2.

**Tests run here**: `npm run build` passed. `npm test`: 1840 passed, 12 failed; all 12 are old tests that expect empty owner settings (publisher, contact, push, analytics) while this zip holds the real filled settings. None touches this change.

**Removed**: nothing.

## 0.97.0 (2026-11-16): The analytics source "Push notification" (push Part 7e-3)

A visit that comes from a push notification is now counted as its own source, **Push notification**, in the Traffic sources list of the Analytics screen (and in the per-source red note of the Security screen). The notification link already ended with `?pn=1` (v0.54.0 to v0.69.0); nothing read it until now. No database change: no migration. **The analytics Worker must be deployed again** (a small change in `workers/analytics/lib.js` and `index.js`); the site build carries the new beacon script. An old page script that does not send the new field still works.

How it works: the beacon script sends one more optional number, `pn: 1`, only when the page address has `?pn=1` (as the only parameter, first, middle or last). The Worker stores the reserved source value `(push)` for such a visit, in the same column as the referrer host, and `sourceName` shows it as "Push notification". Brackets can never be part of a real host name, so no real site can be mixed up with it. The page path in the data stays without the query part.

**Added**
- `workers/analytics/lib.js`: `PUSH_SOURCE`, the `pn` rule in `cleanBeacon` (only the number 1 counts) and the name in `sourceName`.
- `workers/analytics/index.js`: the optional number field `pn` in the message shape (any other extra field is still refused; text in `pn` is refused as a wrong shape).
- `site/src/lib/beacon-client.js`: reads `?pn=1` and adds `pn: 1`; every other visit sends exactly the same message as before.
- `site/tests/unit/analytics-push-source.test.ts`: 14 tests (the rules, the names, the unverified note, the real Worker with a fake database, and file checks).
- `site/tests/unit/beacon.test.ts`: 4 new tests (pn 1 on every message, in the middle of other parameters, never for look-alikes such as `?pn=10`, `?xpn=1`, `?PN=1`, and a broken location object does not stop the beacon). The test window got an optional `search` value.
- `BUGS.md`: P85 to P88.

**Changed**
- `site/package.json`, `site/package-lock.json`: version 0.97.0.
- `site/tests/unit/push-editor.test.ts` (the package version test now means "0.96.0 or newer", so it does not break at every release), `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.5), `site/README.md` (section "Analytics: the source Push notification").

**Tests run here**: the full `npm test` (100 files) and `npm run build` passed. The three rules were broken on purpose (the name line, the address pattern, the `=== 1` rule) and the new tests failed each time.

**Honest limits**: anyone can add `?pn=1` to a link by hand, so the count is a good measure, not a proof (the same as any `utm` mark). Old rows keep their old source. The real push click (service worker to page to beacon) was not tried on a phone yet. The count also depends on the 5-second rule and the stamp, like every other visit.

**Removed**: nothing.

## 0.96.0 (2026-11-16): The Notifications box in the post editor (push Part 7e-2), and two old test and build faults fixed

The dashboard editor now has a **Notifications** box (choice Auto, Off or Force; own notification title and text with counters; a live preview). The rules are in the new file `site/public/admin/js/push-fields.js`. No Worker, page, header, setting or database changed: no migration, no Worker deploy. This time the **full `npm test` and `npm run build` were run** (with `npm ci`): all 99 test files and 1834 tests pass, and the build passes ("Validation passed").

**Added**
- `site/public/admin/js/push-fields.js`: pure rules. `PUSH_CHOICES` (words and help for the three values), `pushValue` (unknown becomes `auto`), `cutWords` (the same cut as `cutText` in `workers/push/lib.js`, checked by a test), `pushPreview` (own text wins, else the headline and the description), `pushCount`, `cleanPush` (leaves out `auto` and empty texts, so a normal post file stays as before), `pushNote` (short warning lines).
- `site/public/admin/js/app.js`: the card "Notifications" under Details (select, two boxes with maxlength 70 and 120, counters, help text, note) and a "Notification preview" card in the side column; `cleanPush` runs before every save.
- `site/tests/unit/push-editor.test.ts`: 17 tests (9 on the rules, 6 jsdom tests on the real dashboard: empty start, typing, Off note, an old post opens with its values, save writes the fields and Auto with empty texts removes them from the file, an emoji stops the save, and 2 file checks).
- `BUGS.md`: P81 to P84.

**Fixed (both were already broken in v0.95.0)**
- `npm run build` stopped at "placeholder text found" on five pages: a comment in `site/src/lib/own-browser.js` held the word "example" with ".com", and the comment is sent inside the page script. The comment now says "your own site address". The code did not change.
- `site/tests/unit/admin-security.test.ts` failed one test: every test boots a new copy of the dashboard and each copy adds a `hashchange` listener to the same window, so old copies asked the Worker again and the calls doubled. The test now removes old listeners before each test. The dashboard code did not change (it boots once in real use).

**Changed**
- `site/package.json`, `site/package-lock.json`: version 0.96.0.
- `CODING_PLAN.md` (Part 7e-2 done), `INCOMPLETE.md` (phase status, "Open Items After v0.96.0"), `NEWS_WEBSITE_PLAN.md` (31.5), `site/README.md` (section "Notifications box in the editor"), `site/tests/unit/admin-security.test.ts`, `site/src/lib/own-browser.js`.

**Honest limits**: the box was tested in jsdom only, not yet by hand in a real browser on a phone. The Force note says "after the story is published" for a draft: it is a hint only, the Worker decides. 7e-3 (the analytics source "Push notification") is not built yet.

**Removed**: nothing.

## 0.95.0 (2026-11-17): The push fields in the post model (push Part 7e-1)

Changes in `site/src/content.config.ts` (the post schema), `site/public/admin/js/validate.js`, `site/public/admin/js/frontmatter.js`, `site/scripts/push-announce-lib.mjs` and a new test file. A post can now carry `push` (`auto`, `off` or `force`, default `auto`), `pushTitle` (up to 70 characters) and `pushBody` (up to 120 characters). Nothing is shown in the editor yet (that is 7e-2) and no page, Worker, header, setting or database changed: no migration, no Worker deploy. Posts without the fields build exactly as before. The 11 new tests (and the 23 of v0.94.0) were run here with a small stand-in for the test tool (no network and no `node_modules`); the schema file only passed a syntax check, because the build needs Astro. The full `npm test` and `npm run build` were NOT run. The owner must run both once before deploying. The older file `admin-lib.test.ts` could not be started by the stand-in (it imports a `.ts` file without the extension), so the dashboard check was tested through the new file only.

**Added**
- `site/src/content.config.ts`: `push`, `pushTitle`, `pushBody`, and one more rule: the notification text must not contain an emoji (the copyright, registered and trade mark signs are fine, the same as the site rule and the Worker). A wrong value stops the build with a clear message.
- `site/public/admin/js/validate.js`: the same limits and the same emoji rule as errors in the editor check (they hold for drafts too, because the build reads every post), and the exports `PUSH_VALUES`, `PUSH_TITLE_MAX`, `PUSH_BODY_MAX`.
- `site/tests/unit/push-fields.test.ts`: 11 tests (the schema text, the limits equal to the Worker's `TITLE_MAX` and `BODY_MAX`, the emoji pattern equal in the schema and the dashboard and checked against the site emoji finder on 10 samples, the dashboard errors, the front matter order, and a round trip: what the dashboard writes is read back by the announce job, quotes and backslashes included). The code was broken on purpose four times (the signs rule removed; the title limit changed; the fields removed from the order; the body limit changed in the schema) to check that tests fail.
- `BUGS.md`: P77 to P80.

**Changed**
- `site/public/admin/js/frontmatter.js`: the three fields are written after `trending` and before `autoLinks`; empty ones are not written.
- `site/scripts/push-announce-lib.mjs`: a double quoted value is read as the JSON text the dashboard writes (so a title with quotes or a backslash arrives clean), single quoted YAML values too, and inline lists are read as JSON first. Before this, a title with a quote would have reached the notification with a stray backslash.
- `NEWS_WEBSITE_PLAN.md` (31.5), `CODING_PLAN.md`, `INCOMPLETE.md` (table row, "Open Items After v0.95.0"), `site/README.md` (section "Push fields in the post model").
- `site/package.json`, `site/package-lock.json`: version 0.95.0.

**Honest limits**: the build was not run with the new schema lines. They use only plain Zod calls that the file already uses, plus one `refine`, so the risk is small, but run `npm run build` once. The emoji pattern is written in three places (schema, dashboard, Worker) because the dashboard files are served as they are and cannot import from `src`; the test keeps the first two equal and checks them against the site finder.

**Removed**: nothing.

## 0.94.0 (2026-11-17): The deploy job that announces new posts to the push Worker (push Part 7d)

New files `site/scripts/push-announce-lib.mjs`, `site/scripts/push-announce.mjs`, `.github/workflows/push.yml` and a new test file. The job is harmless until three GitHub secrets exist (`SITE_URL`, `PUSH_ENDPOINT`, `PUSH_ANNOUNCE_SECRET`): with one missing it prints what is missing and ends well. No Worker, page, header, setting or database change: no migration, no Worker deploy. The 23 new tests were run here with a small stand-in for the test tool (no network and no `node_modules` in this session); the runner was also run against a fake network for four cases (not live then accepted, wrong secret, Worker off, network down). The full `npm test` and `npm run build` were NOT run. The owner must run both once before deploying.

**Added**
- `site/scripts/push-announce-lib.mjs`: plain functions, no network and no clock of its own. `readFront` (plain values, true/false, inline and block lists), `postFromFile` (one `content/blogs` file to one announce post: key = permalink, address with the site time zone, tags, focus keyword, author, flags, image as an https address, word count, publish time; the editor fields `push`, `pushTitle`, `pushBody` are read when they exist, they come with 7e), `skipReason` and `selectRecent` (the same rules as the Worker that need no network: push off, noindex, not yet live, older than 120 minutes, emoji; newest first; at most 25; every post left out gets a reason word), `readSettings`, `retryKeys` (only `not_live` and `check_failed` are asked again), `describeResults`.
- `site/scripts/push-announce.mjs`: reads every `content/blogs` file, sends the new ones with `POST /announce` and the header `X-Announce-Secret`, and asks again (default 4 tries, 90 seconds apart) only for pages the Worker could not open yet. `--dry` lists the keys and sends nothing; `--wait` and `--tries` change the waiting. A 503 (Worker not switched on) ends well; a 401, 413 or 500 ends with an error and is not retried; a network failure is retried and then ends with an error. It prints only keys, statuses and reason words: never the secret and never a post text.
- `.github/workflows/push.yml`: after a push to `main` (waits 120 seconds first), every hour at minute 35 (posts that a scheduled date just made live), and by hand. Reads the repository only (`contents: read`), installs no package, one job at a time (`concurrency`).
- `site/tests/unit/push-announce-script.test.ts`: 23 tests (front matter, one file to one post, the skip rules, the same numbers as the Worker, settings, retry keys, the runner in a temporary folder, the workflow text, no emoji). The code was broken on purpose three times (a refusal asked again; the emoji rule removed; the age limit changed) to check that tests fail.
- `BUGS.md`: P72 to P76.

**Changed**
- `NEWS_WEBSITE_PLAN.md` (31.4 step 2), `CODING_PLAN.md`, `INCOMPLETE.md` (table row, "Open Items After v0.94.0"), `site/README.md` (section "Push announce job").
- `site/package.json`, `site/package-lock.json`: version 0.94.0.

**Honest limits**: the job has not run on GitHub yet. The three secrets must be added in the repository settings, and `ANNOUNCE_SECRET` (the same text, at least 32 characters) must be set on the push Worker, before anything happens. The job reads all post files each time (fine for thousands of posts); if the site grows far beyond that, it can look at the changed files only. The `push` fields in the post model and the editor are not built yet (7e): until then every post is "auto".

**Removed**: nothing.

## 0.93.0 (2026-11-16): The Security screen in the dashboard (bot protection Part 8b-2)

Change in `site/public/admin/js/app.js` (the dashboard) and a new jsdom test file. The dashboard now has a menu entry "Security" and the address `#/security`, for admins only (the same `analytics` permission as the Analytics screen). Nothing else changed: no Worker, header, setting or database change: no migration. The site needs no new deploy of any Worker; the dashboard files are deployed with the next site build.

**IMPORTANT, read this**: the new jsdom test file `admin-security.test.ts` (8 tests) was written but NOT run in this session: the test tool here has no browser (no jsdom) and no network. What WAS done: `app.js` passes a syntax check as an ES module, the 21 rules and drawing tests were run (with the stand-in tool), the new test file parses as TypeScript, and the new code only uses names that already exist in `app.js`. The owner must run `npm test` (the 8 new jsdom tests, and the 6 older admin screen tests that use the menu) and open `#/security` once in the dashboard before trusting this version. If a test fails, the fix is small and local: only the function `securityView` and the menu line were added.

**Added**
- `site/public/admin/js/app.js`: the import of `security.js`; the menu entry `['#/security', 'Security', 'analytics']` after Analytics; the route; the function `securityView`. It reads the analytics address from `config/analytics.json` (as the Analytics screen does), calls `GET /stats?range=24h` and `?range=7d` with the same sign-in token (two calls at the same time, only when the owner opens the screen or presses Refresh: no timer), and draws `renderSecurity`. Without an address it says so, asks nobody and still shows the two lists. A refusal or a network failure shows the plain reason (`statsError`) and no level card. An older Worker without `verifiedViews` shows "No verified count". "Mark done" saves the time with `markDone` and `writeLastDone` to `localStorage` (key `adm.security.lastDone`) inside try/catch, so a browser that refuses to save still shows the time on screen.
- `site/tests/unit/admin-security.test.ts`: 8 jsdom tests (menu and role, no address, two calls with the token and both levels and the alert, 403 and offline, older Worker, Mark done saved and still there after reopening, a browser that refuses to save and a broken saved text, the single Cloudflare link and no other address called).
- `BUGS.md`: W86 to W88.

**Changed**
- `site/tests/unit/security-rules.test.ts`: the old check "not connected" now checks that `app.js` imports the file once and only names that exist.
- `BOT_PROTECTION.md` (8b-2 done; Part 8 done except the checks said below), `CODING_PLAN.md`, `INCOMPLETE.md` (table row, "Open Items After v0.93.0"), `site/README.md` (section "Security screen rules" extended).
- `site/package.json`, `site/package-lock.json`: version 0.93.0.

**Honest limits**: the screen shows only the views numbers of the analytics Worker. Cloudflare challenges, blocks and the kill switches cannot be read from the dashboard (that would need a Cloudflare token in the browser); the screen says so and links to the Cloudflare start page. The "last done" times are per browser. The limits 30, 60 and 50 are still a first proposal.

**Removed**: nothing.

## 0.92.0 (2026-11-16): The drawing of the Security screen and the last done times (bot protection Part 8b-1)

Changes in `site/public/admin/js/security.js` (more functions), its test file, and `site/public/admin/admin.css` (3 lines of colour). It is STILL NOT connected: nothing in `app.js` imports the file, there is no `#/security` address and no menu entry, so the dashboard looks and works exactly as before. No Worker, header, setting or database change: no migration. The 21 tests (10 older, 11 new) and the 18 + 24 trap tests were run here with a small stand-in for the test tool; the stand-in has no browser, so the real `h` helper and the jsdom screen tests were NOT run, and the full `npm test` and `npm run build` were NOT run either (no network and no `node_modules`). The owner must run both once before deploying.

**Added** (all in `security.js`)
- `renderSecurity(h, view)`: draws the screen with the dashboard helper `h`, like `renderStats`: two level cards (24 hours and 7 days) with the real sentence, a red note when the level is `watch` or `high`, a plain notice instead of numbers when they could not be read, a note that Cloudflare challenges and blocks cannot be read here, ONE outside link (the start page of Cloudflare, `target="_blank"` with `rel="noopener noreferrer"`), and the daily and weekly lists, each item with its "last done" text and a "Mark done" button that calls `onDone(id)`.
- `readLastDone`, `markDone`, `writeLastDone`, `reviewLists`: the "last done" times as text in and text out (known ids and good times only; `markDone` never changes the old map; daily items are due after 1 day, weekly items after 7; never done counts as due). The file never touches storage itself. `LAST_DONE_KEY` (`adm.security.lastDone`) and `CLOUDFLARE_URL` are exported for the caller.
- `site/tests/unit/security-rules.test.ts`: 21 tests (was 10). The drawing is tested with a tiny stand-in for `h` that only records the tags, attributes and children. The code was broken on purpose three times (weekly days 7 to 6; the link `rel` shortened; the good-time check removed) to check that tests fail. New file checks: no emoji, no `innerHTML`, no `eval`.
- `BUGS.md`: W83 to W85.

**Changed**
- `site/public/admin/admin.css`: `.sec-watch`, `.sec-high`, `.sec-ok` (a border colour for the level cards).
- `BOT_PROTECTION.md` (8b split: 8b-1 done, 8b-2 the wiring), `CODING_PLAN.md`, `INCOMPLETE.md` (table row, "Open Items After v0.92.0"), `site/README.md` (section "Security screen rules" extended).
- `site/package.json`, `site/package-lock.json`: version 0.92.0.

**Decision taken (can be changed)**: the "last done" times will be kept in the browser only (`localStorage`, one key), not in a repo file. It is the simplest and needs no commit; the cost is that it is per browser (another computer or a cleared browser shows "never marked done").

**Honest limits**: the real `h` helper and the real dashboard were not run with this code in this session; 8b-2 must be tested with the jsdom tests (like `admin-analytics.test.ts`) before it is trusted. The limits 30, 60 and 50 are still a first proposal.

**Removed**: nothing.

## 0.91.0 (2026-11-16): The rules of the Security screen (bot protection Part 8a)

New file `site/public/admin/js/security.js` and its test. It is NOT connected: nothing in `app.js` imports it, so the dashboard looks and works exactly as before. No Worker, header, setting or database change: no migration, no deploy needed. The 10 new tests and the 18 + 24 trap tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/admin/js/security.js`: plain functions only (no page, no network, no clock, no storage). `shareLevel(views, verified)` turns the views numbers that the analytics Worker already gives into a level (`none`, `unknown`, `few`, `ok`, `watch`, `high`) and one plain sentence with the real numbers: under 50 views is `few` (too few to judge), 30 percent unverified or more is `watch`, 60 percent or more is `high`. `securitySummary(h24, d7)` and `worstLevel` combine the last 24 hours and the last 7 days. `DAILY_CHECKS` (2 items) and `WEEKLY_CHECKS` (4 items) hold the review lists of BOT_PROTECTION Section 13 as plain text. `isDue(lastDoneMs, nowMs, days)` says when a list is due again (never done, or a wrong clock, counts as due). It reuses `unverifiedShare` from `analytics.js`.
- `site/tests/unit/security-rules.test.ts`: 10 tests. The code was broken on purpose twice (the high limit moved; the few-views rule removed) to check that tests fail. A test fails if the file ever uses `fetch`, a clock or storage, or if `app.js` imports it before 8b.
- `BUGS.md`: W80 to W82.

**Changed**
- `BOT_PROTECTION.md` (Part 8 split in two: 8a done, 8b the screen), `CODING_PLAN.md` (Part 8 line), `INCOMPLETE.md` (table row and "Open Items After v0.91.0"), `site/README.md` (section "Security screen rules").
- `site/package.json`, `site/package-lock.json`: version 0.91.0.

**Honest limits**: the limits 30, 60 and 50 are a first proposal, not measured on real traffic; the owner can change them after a week of real numbers. The file cannot show Cloudflare challenges or blocks: the dashboard has no way to read them (they need a Cloudflare API token in the browser, which must not be done). 8b will show the verified against unverified numbers and the two lists, and will link the owner to the Cloudflare Security Events page. The "last done" times of the lists have no place to be kept yet (8b decides: in the browser only, or in a repo file).

**Removed**: nothing.

## 0.90.0 (2026-11-16): The trap Worker (bot protection Part 7b)

New file `workers/trap/index.js`, new `workers/trap/wrangler.toml` and a new test file. Nothing is connected: the kill switch ships OFF, there is no route, no secret, no link on any page and no `robots.txt` line, and the Worker is not deployed from this project. No page, header, setting or database changed: no migration. The 24 new tests and the 18 older trap tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `workers/trap/index.js`: answers only `/trap/`. When the kill switch `TRAP_ENABLED` is exactly `true` and an ordinary client opens it, the Worker reads the list, skips an address that is already there, checks our limit of 1000 items, and adds one item (24 hours by default, `BLOCK_HOURS` 1 to 168) with the secret `CF_API_TOKEN`. The calls go one after the other. Own spacing: one add call every 5 seconds and the same address at most once in 10 minutes per Worker instance. The client always gets the same plain 404 with `noindex`, so nobody can tell whether the trap is on or what happened. A scheduled job (hourly) deletes only our own expired items, up to 500 a run, in calls of 100, and it also runs when the switch is off. Logs hold a short reason word only: no address, no user agent, no token.
- `workers/trap/wrangler.toml`: `TRAP_ENABLED = "false"`, empty `CF_ACCOUNT_ID`, `CF_LIST_ID`, `OWN_IPS`, `BLOCK_HOURS = "24"`, the hourly cron, and the route as a comment only.
- `workers/trap/lib.js`: two more functions, `listRequest` (the text of the read call, up to 500 items, with a checked page cursor) and `parseListPage` (one page of the answer). The 7a functions are unchanged.
- `site/tests/unit/trap-worker.test.ts`: 24 tests with a fake Cloudflare. The code was broken on purpose twice (switch on for any text; the already-listed check removed) to check that tests fail.
- `BUGS.md`: W76 to W79.

**Changed**
- `BOT_PROTECTION.md` (7b done, with what is still needed), `CODING_PLAN.md` (Part 7 line), `INCOMPLETE.md` (table row and "Open Items After v0.90.0"), `site/README.md` (section "Trap Worker").
- `site/package.json`, `site/package-lock.json`: version 0.90.0.

**Honest limits**: the Cloudflare read call and the shape of its answer (`result` items with `id`, `ip`, `comment`, and `result_info.cursors.after`) are written from memory of Cloudflare's API and were NOT checked against their pages in this session and NOT tried on the owner's account; check them once before the first real use. The spacing and the "seen" memory live in one Worker instance, so two instances can both add (Cloudflare then refuses the second while one operation is pending, and the trap only misses that hit). IPv6 is listed address by address. The decision 6 (trap link yes or later) is still open, and 7c (the link) is not built.

**Removed**: nothing.

## 0.89.0 (2026-11-16): The trap link rules as plain functions (bot protection Part 7a)

New file `workers/trap/lib.js` and its test. It changes no page, no header, no Worker and no setting: nothing is connected, nothing is sent, nothing needs a deploy. No database change: no migration. No new variable or secret. The 18 new tests and the 32 header tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `workers/trap/lib.js`: `isTrapRequest` (GET or HEAD to exactly `/trap/`), `normalizeIp`, `isReservedIp`, `claimsGoodBot`, `decideTrapHit` (block, record or ignore), `blockItem` (the list item with the comment `sdn-trap until=... seen=...`, 24 hours by default), `untilOf`, `expiredItemIds` (only our own items whose time is over), `countOurs`, `hasRoom` (our limit: 1000 items), `addRequest` and `deleteRequest` (only the text of the two Cloudflare list calls; ids must be 32 letters or numbers; at most 100 per call). No network, no clock, no secret, no storage in the file (a test checks it).
- `site/tests/unit/trap-lib.test.ts`: 18 tests. The rules were broken on purpose once (a reserved address let through, the owner's entries no longer protected) to check that 3 tests fail.
- `BUGS.md`: W72 to W75.

**Changed**
- `BOT_PROTECTION.md` (Part 7 split in four: 7a done; 7b the Worker; 7c the link and `robots.txt` with the hidden-link risk written down; 7d the hotlink click list), `CODING_PLAN.md` (Part 7 line, folder list now has `trap`), `INCOMPLETE.md` (table row and "Open Items After v0.89.0"), `site/README.md` (title and the section "Trap link rules").
- `site/package.json`, `site/package-lock.json`: version 0.89.0.

**Honest limits**: nothing uses the file yet, so the trap does nothing; the Cloudflare call formats were read from Cloudflare's API pages and were not tried on the owner's account; IPv6 addresses are handled one by one (not as ranges); a client that names itself a good bot is only recorded, so a scraper can use such a name to avoid the block (the later Worker can add a check by the network number); the owner's decision 6 (trap link yes or later) is still open. Nothing is deployed from this project.

**Removed**: nothing.

## 0.88.0 (2026-11-16): Own content policy for article pages with the ad hosts (bot protection Part 6b-3a)

Change in `site/public/_headers` and in the header test. It only REPORTS in the browser console; it never blocks a script, a picture or a page. No database change: no migration. No new setting, variable or secret. The 32 header tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/_headers`: a block `/:year/:month/:day/blogs/:category/:slug/` with a `!` line and its own `Content-Security-Policy-Report-Only`: the all-paths policy, plus `https://afders.org`, `https://bicea.org`, `https://pagead2.googlesyndication.com` and `https://googleads.g.doubleclick.net` in `script-src`, and `https://googleads.g.doubleclick.net` and `https://tpc.googlesyndication.com` in `frame-src`. Only the article template holds the ad loader, so only article pages get it. A comment line explains it.
- `BUGS.md`: W69 to W71.

**Changed**
- `site/tests/unit/security-headers.test.ts`: now 32 tests (was 23). 9 new tests: the block has exactly the detach line and its own policy; the path matches an article address on any date and category and no other page type; the ad loader is used by the article template only; the policy differs from the all-paths one only in `script-src` and `frame-src`; every script host in `config/ad-loader.json` (popunder, social bar, native banner) is in `script-src`; the AdSense script host in `ads-client.js` is in `script-src`; the smartlink host is not a script or frame host; the safe basics hold (no eval, no wildcard, only exact `https://host` sources, never enforcing); the all-paths policy and the form page policy have no ad host. The rule was broken on purpose once (a host removed, a wildcard and `unsafe-eval` added) to check that 3 tests fail.
- `BOT_PROTECTION.md` (6b split in six: 6b-3a done, 6b-3b reads the console report with ads on, 6b-3c enforces), `CODING_PLAN.md`, `INCOMPLETE.md` (table row and "Open Items After v0.88.0"), `site/README.md` (section text, title).
- `site/package.json`, `site/package-lock.json`: version 0.88.0.

**Honest limits**: nothing is reported to the owner (there is no report address yet); the host list is a first list, because Adsterra and AdSense load more hosts after their first script, and ads are still off, so no real report exists yet (that is 6b-3b); the AdSense hosts follow Google's public help text and were not tried here; the `!` line and the placeholder path follow the Cloudflare Pages documentation but were not tried on a live site: after the deploy, check with `curl -I` on an article address that there is exactly one `content-security-policy-report-only`; a new script host typed in the Ad loader screen makes `npm test` fail until it is added to the block (on purpose). Nothing is deployed from this project.

**Removed**: nothing.

## 0.87.1 (2026-11-16): Own content policy for the dashboard (bot protection Part 6b-2b)

Change in `site/public/_headers` and in the header test. It only REPORTS in the browser console; it never blocks a script, a picture or a page. No database change: no migration. No new setting, variable or secret. The 23 header tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/_headers`: in the `/admin/*` block, after the `!` line, the dashboard's own `Content-Security-Policy-Report-Only`: the all-paths policy with two differences: `script-src 'self'` (no `unsafe-inline`; the dashboard page has one module script and no inline script, no inline handler, no `eval`) and `img-src` with `blob:` (the image previews). A new block `/admin/blog-xml-tool.html` with a `!` line and the all-paths policy, because the old Blogger tool has an inline script. A comment line explains it.
- `BUGS.md`: W66 to W68.

**Changed**
- `site/tests/unit/security-headers.test.ts`: now 23 tests (was 16). The "dashboard keeps what it had" test now sets its own policy line apart and checks the rest as before. 7 new tests: both blocks have the detach line (and the tool block exactly two lines); `script-src` is only `'self'`, no wildcard, no `eval`, no ad or Turnstile host; the dashboard policy is the all-paths one with only the `script-src` and `blob:` differences; the safe basics hold and nothing enforces; `index.html` has exactly one module script, no inline script, no inline handler, no outside address; no dashboard script builds a script, runs text as code or imports code; the Blogger tool still has an inline script and gets the all-paths policy. The rule was broken on purpose once (`unsafe-inline`, a foreign host and an `eval` added) to check that 2 tests fail.
- `BOT_PROTECTION.md` (6b-2b done), `CODING_PLAN.md`, `INCOMPLETE.md` (table row and "Open Items After v0.87.1"), `site/README.md` (section text, title).
- `site/package.json`, `site/package-lock.json`: version 0.87.1.

**Honest limits**: nothing is reported to the owner (there is no report address yet); the owner must open DevTools, Console, in the dashboard to read the messages; `style-src` still has `unsafe-inline` (the dashboard sets `style` attributes) and `connect-src` has `https:` (the Workers and the remote image import go to hosts not known in advance); the `!` line and the second block follow the Cloudflare Pages documentation but were not tried on a live site: after the deploy, check with `curl -I https://shivam-das-news.pages.dev/admin/` that there is exactly one `content-security-policy-report-only`; the dashboard was not opened in a browser in this session, so the console report after the deploy is the real check. Nothing is deployed from this project.

**Removed**: nothing.

## 0.87.0 (2026-11-16): Own content policy for the Contact Us page (bot protection Part 6b-2a)

Change in `site/public/_headers` and in the header test. It only REPORTS in the browser console; it never blocks a script, a picture or a page. No database change: no migration. No new setting, variable or secret. The 16 header tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/_headers`: a block `/:year/:month/:day/pages/contact-us/` with a `! Content-Security-Policy-Report-Only` line and its own `Content-Security-Policy-Report-Only`: the same as the all-paths policy, plus `https://challenges.cloudflare.com` in `script-src` and as the only entry of `frame-src` (Turnstile). The path uses placeholders because the publish date is part of the address. A comment line explains it.
- `BUGS.md`: W63 to W65.

**Changed**
- `site/tests/unit/security-headers.test.ts`: now 16 tests (was 10). The "no header is sent twice" test lets a block that takes a header off with a `!` line set its own in its place. The old Turnstile test text now says the all-paths policy names no Turnstile host. 6 new tests: the block has exactly the detach line and its own policy; the path matches the Contact Us address on any date and no other page; the page file and the required-pages list use the same slug `contact-us`; the policy is the all-paths one plus the one Turnstile host (script and frame only); the safe basics hold (no eval, no wildcard, no other host, no ad host, never enforcing); the Turnstile script in `ContactForm.astro` comes from the one host. The rule was broken on purpose once (`unsafe-eval` and an ad host added) to check that 2 tests fail.
- `BOT_PROTECTION.md` (6b split in four: 6b-2a done, 6b-2b is the dashboard), `CODING_PLAN.md`, `INCOMPLETE.md` (table row and "Open Items After v0.87.0"), `site/README.md` (section text, title).
- `site/package.json`, `site/package-lock.json`: version 0.87.0.

**Honest limits**: nothing is reported to the owner (there is no report address yet); the `!` line and the placeholder path follow the Cloudflare Pages documentation but were not tried on a live site: after the deploy, check with `curl -I` on the Contact Us address that there is exactly one `content-security-policy-report-only` and that it holds the Turnstile host; the form is still off (`config/contact.json` is empty), so the Turnstile box cannot be tested yet; the Turnstile box may ask for more than the script and the frame (the console report will say); `unsafe-inline` is still needed. Nothing is deployed from this project.

**Removed**: nothing.

## 0.86.0 (2026-11-16): Content policy in report-only mode (bot protection Part 6b-1)

Change in `site/public/_headers` and in the header test. It only REPORTS in the browser console; it never blocks a script, a picture or a page. No database change: no migration. No new setting, variable or secret. The tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/_headers`: `Content-Security-Policy-Report-Only` in the all-paths block: `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (the pages use inline scripts, so `unsafe-inline` is needed until they are moved); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: https:`; `font-src 'self' data:`; `connect-src 'self' https:`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. A line `! Content-Security-Policy-Report-Only` in the `/admin/*` block keeps the dashboard out of it.
- `BUGS.md`: W60 to W62.

**Changed**
- `site/tests/unit/security-headers.test.ts`: now 10 tests (was 8). The reader of the file knows the `!` line; the first test expects four headers; the dashboard test expects the `!` line; the old test "no Content-Security-Policy yet" is replaced by three: the policy is report-only and never an enforcing header, it has the safe basics (no `unsafe-eval`, `object-src 'none'`, `base-uri` and `form-action` self, `frame-ancestors 'none'`, no wildcard or `https:` script host), and it names no ad host and no Turnstile host. The rule was broken on purpose once (`unsafe-eval` and an ad host added) to check that 2 tests fail.
- `BOT_PROTECTION.md` (6b split in three), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.86.0"), `site/README.md` (section text, title).
- `site/package.json`, `site/package-lock.json`: version 0.86.0.

**Honest limits**: nothing is reported to the owner (there is no report address yet), the owner must open DevTools, Console, on a page to read the messages; ads (Adsterra, AdSense) and the Turnstile box will be listed there because their hosts are not in the policy on purpose (they come in 6b-3); browsers print that `frame-ancestors` is ignored in report-only mode, which is harmless and goes away when the policy is enforced; the `!` line follows the Cloudflare Pages documentation but was not tried on a live site: after the deploy, check with `curl -I https://shivam-das-news.pages.dev/admin/` that the dashboard has no `content-security-policy-report-only` header; `unsafe-inline` makes the policy weak against injected scripts until the inline scripts are moved. Nothing is deployed from this project.

**Removed**: the test "no Content-Security-Policy yet" (replaced by three tests).

## 0.85.2 (2026-11-16): The site address is the free pages.dev address (geo Worker setting)

One setting and documents. No code, no test changed. No database change: no migration. Ads are still off: `geoUrl` is empty and `complianceMode` is `true`.

**Changed**
- `workers/geo/wrangler.toml`: `SITE_ORIGIN` is now `https://shivam-das-news.pages.dev` (was the placeholder `https://YOUR-DOMAIN`). Only this site may call `/geo`. No test pinned the old value.
- `INCOMPLETE.md` ("Open Items After v0.85.2"): the owner's decision (no custom domain), the Cloudflare Pages build variable `SITE_URL`, the HSTS note, and the AdSense and Google News risk of a free address.
- `CHANGELOG.md`, `site/README.md` (title), `site/package.json`, `site/package-lock.json`: version 0.85.2.

**Honest limits**: the other three Workers still hold the placeholder (their tests pin it); the AdSense and Google News risk is from web reports, not from Google's own answer for `pages.dev`; nothing was deployed.

**Removed**: nothing.

## 0.85.1 (2026-11-16): Adsterra approval written down (documentation only)

Documentation only. No code, no config, no test changed. `config/ad-loader.json` was not changed on purpose: with `complianceMode` off and an empty `geoUrl` the build stops, and the real `geoUrl` exists only after the owner deploys `workers/geo`. Ads therefore stay off on the live site until that is done (the steps are in `INCOMPLETE.md`, "Open Items After v0.85.1").

**Changed**
- `INCOMPLETE.md`: decision row 6 (ad strategy order) is closed: Adsterra first; new section "Open Items After v0.85.1" with the owner's news, the four steps to start the ads, and the two open owner decisions (India is blocked by default; Adsterra with a pending AdSense and Google News application).
- `AI_OPERATIONS.md` (section 13.3): the owner's statement is recorded as the written word to turn `complianceMode` off, only together with a real `geoUrl`.
- `CHANGELOG.md`, `site/README.md` (title), `site/package.json`, `site/package-lock.json`: version 0.85.1.

**Honest limits**: nothing was deployed or tested on a live site; the approval itself was told by the owner in the chat and was not checked in the Adsterra account; no earnings are possible before the geo Worker is deployed and compliance mode is off.

**Removed**: nothing.

## 0.85.0 (2026-11-16): Page security headers (bot protection Part 6a)

Change in `site/public/_headers` and one line in `site/src/layouts/Base.astro`. No database change: no migration. No new setting, variable or secret. The 8 new tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/public/_headers`: a new block for all paths (`/*`) with `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` and `Strict-Transport-Security: max-age=31536000; includeSubDomains` (no `preload`).
- `site/src/layouts/Base.astro`: `<meta name="referrer" content="strict-origin-when-cross-origin">` in the head of every public page.
- `site/tests/unit/security-headers.test.ts` (8 tests): the three headers and their values; the permissions policy turns off only camera, microphone, location and payment (notifications for push are untouched); HSTS is at least one year and has no `preload`; no other block repeats a header of the all-paths block (no header is sent twice); `Referrer-Policy` is not in the all-paths block, the dashboard keeps `no-referrer`, the meta tag is before the head slot; every older block keeps exactly what it had; the file has no tab, no empty value and no header without a path; no Content-Security-Policy yet. The rule was broken on purpose once (nosniff back in the dashboard block) to check that 2 tests fail.
- `BUGS.md`: W56 to W59.

**Changed**
- `site/public/_headers`: the line `X-Content-Type-Options: nosniff` was taken out of the `/admin/*` block and the `/push-sw.js` block, because both now inherit it from `/*`. The dashboard and the service worker file still get it.
- `BOT_PROTECTION.md` (Part 6 split: 6a done, 6b open), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.85.0", phase row 8b), `site/README.md` (new section).
- `site/package.json`, `site/package-lock.json`: version 0.85.0.

**Honest limits**: HSTS tells browsers to use https only for one year on this host AND all its sub-domains (`includeSubDomains`); once a browser has stored it, it cannot be undone quickly, so every sub-domain of the final domain must serve https first; the `pages.dev` address is not affected by the owner's own domain rule; Cloudflare Pages was not asked here (no network): the owner checks the live headers once after the deploy (for example with the browser's network tab or `curl -I`). The Content-Security-Policy is NOT written yet (Part 6b): it needs a test with ads on and off. The dashboard got no new headers (its own stricter ones stay). Nothing is deployed from this project.

**Removed**: nothing from the project's files; two duplicate header lines were moved into the all-paths block (see Changed).

## 0.84.0 (2026-11-16): The "my own browser" switch (bot protection Part 5c)

New small file, a few lines in two browser files and one line in the page layout. Ads are still off on the live site (compliance mode) and the beacon is still off until `config/analytics.json` has an endpoint, so no live page changed in behaviour. No database change: no migration. No new setting, variable or secret. The 13 new tests were run here with a small stand-in for the test tool (the full `npm test` and `npm run build` were NOT run in this session: no network and no `node_modules`). The owner must run both once before deploying.

**Added**
- `site/src/lib/own-browser.js`: `ownBrowserSwitch(win)`. The owner opens any public address of the site once with `?own-browser=on` at the end; the browser keeps the mark `ownBrowser` = `1` in its own localStorage and the word is cut from the address bar (other words and the `#` part stay). `?own-browser=off` removes the mark. Any other value, a longer word (`own-browser-x`, `xown-browser`) or a blocked storage does nothing. No cookie, nothing is sent anywhere.
- `site/tests/unit/own-browser.test.ts` (13 tests): on, off, other words and hash kept, wrong values ignored, blocked and missing storage, no `history`, the ad loader loads nothing and adds no listener in a marked browser, the beacon asks for no stamp and starts no timer in a marked browser, both still work with another mark or a blocked storage, the switch has no cookie or network call, only `Base.astro` puts it into pages (before the head slot), and both clients read the same key the switch writes. The rule was broken on purpose twice (once in each client) to check that one test fails each time.
- `BUGS.md`: W52 to W55.

**Changed**
- `site/src/lib/ads-client.js`: a marked browser gets the empty runner at once (no geo request, no listener, nothing added).
- `site/src/lib/beacon-client.js`: a marked browser returns `null` at once (no stamp request, no timer, no listener, no message), so it is never counted as a visit.
- `site/src/layouts/Base.astro`: one inline script (the text of `own-browser.js` and one call) before the head slot, on every public page.
- `BOT_PROTECTION.md` (Part 5c ticked), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.84.0", phase row 8b), `site/README.md` (new section).
- `site/package.json`, `site/package-lock.json`: version 0.84.0.

**Honest limits**: the mark is per browser (a phone, a second browser and a private window each need the switch once; a private window forgets it when closed); clearing the browser data removes the mark; the push prompt, the Trending block and the Analytics numbers of OTHER readers are not touched; the geo Worker still sees no difference (the loader never asks it); a reader can switch their own browser off the same way, which only costs them the counting. Nothing is deployed from this project.

**Removed**: nothing.

## 0.83.1 (2026-11-16): Two Google verification codes, and a list of codes is allowed

Small change in the page head and in `config/site.json`. `npm test` (90 files, 1667 tests) and `npm run build` passed. No database change: no migration.

**Added**
- `site/src/lib/verification.ts`: `verificationCodes(value)` turns the `verification` value of `config/site.json` into a clean list. It accepts one text, a text with several codes (commas, spaces, semicolons or new lines: what the dashboard Settings screen saves), or a list. If the whole `<meta>` tag was pasted, the `content` part is taken. A code is kept only if it has 10 to 200 letters, digits, hyphens, underscores, dots or equals signs (nothing that could break out of the tag), repeats are removed, and at most 5 are kept.
- `site/tests/unit/verification.test.ts` (11 tests): one code, two codes, every separator, the dashboard round trip, a pasted meta tag, repeats, empty and wrong types, unsafe text, the limit of 5, and that `Base.astro` uses the helper and never the raw value.

**Changed**
- `site/src/layouts/Base.astro`: writes one `google-site-verification`, `msvalidate.01` or `yandex-verification` tag for each code (before, one tag at most for each). Public pages only; the dashboard pages stay `noindex` and have none.
- `site/config/site.json`: `verification.google` now holds the two codes given by the owner (a list). Bing and Yandex stay empty.
- `site/README.md`, `AI_OPERATIONS.md` (the `verification` line: a code, several codes or a list), `INCOMPLETE.md` ("Open Items After v0.83.1").
- `site/package.json`, `site/package-lock.json`: version 0.83.1.

**Honest limits**: Google only checks the page that is the home page of the property, so the codes work only after the site is deployed on the real address; a code for a property whose address differs (for example the `pages.dev` address and the `www` address) is checked on that address, so each address must serve the tag; the dashboard Settings box shows several codes joined by a comma and saves them back as one text, which the helper splits again (tested). Nothing is deployed from this project.

**Removed**: nothing.

## 0.83.0 (2026-11-16): Push clean-up of old rows (Phase 9 part 7c)

New file and small changes in the push Worker. Push is still off on the live site (`config/push.json` is empty) and the Worker is not deployed from this project, so no live page changed. No database change: no migration. No new variable or secret. `npm test` (89 files, 1656 tests) and `npm run build` passed.

**Added**
- `workers/push/cleanup.js`: `runCleanup(db, now)` deletes old rows by the retention rules of PLAN 31.3: a reader with no delivery and no visit for 90 days (a reader marked `gone` at once) together with every row of theirs in one batch (all or nothing for the chunk); `push_sent` and `push_audit` older than 30 days; `push_posts` older than 3 days; expired `push_held`; finished `push_queue` rows (sent, failed, expired) older than 1 day; `push_terms` of a reader who no longer exists. Each table is limited per run (2000 rows; 50 readers) so a run stays short. It never throws, never logs, and answers counts only. `cleanupDue(now)` is true only at minute 7 of each UTC hour.
- `site/tests/unit/push-cleanup.test.ts` (25 tests, the database ones on real SQLite): the time gate, bad input, each retention edge (89 and 91 days, 29 and 31 days, 2 and 4 days, expired and not expired, queued and sending rows never touched), a reader with an old visit but a recent delivery is kept, `gone` is deleted at once, the per-run limit and the next run continuing, all-or-nothing for one reader chunk (a failing last delete leaves every row), a failing database, no push address in the answer, and the scheduled handler (cleans while sending is paused, does nothing at another minute or without an event time, never throws). The rules were broken on purpose once to check that 7 of these tests fail.
- `BUGS.md`: P67 to P71.

**Changed**
- `workers/push/control.js`: new `runCleanupTick(env, now)` (needs only the database; does not depend on the kill switch or the sender keys). `runCron` is unchanged.
- `workers/push/index.js`: `scheduled` calls `runCleanupTick` after `runCron`, only when the event carries its own `scheduledTime` (a real cron tick always does; a call without one deletes nothing).
- `workers/push/wrangler.toml`: a comment line only. The existing every-minute cron also runs the clean-up once an hour.
- `NEWS_WEBSITE_PLAN.md` (section 31.13 file list), `CODING_PLAN.md` (Part 7c done), `INCOMPLETE.md` ("Open Items After v0.83.0", phase row 9), `site/README.md` (new section; page title now v0.83.0).
- `site/package.json`, `site/package-lock.json`: version 0.83.0.

**Honest limits**: at most 50 readers are removed per hour (1200 a day); if a run fails it is tried again the next hour; the 90 day rule uses `last_seen` and `last_sent`, so a reader whose browser never visits again and never gets a message is removed after 90 days as planned; a missed cron tick at minute 7 skips that hour; nothing is deployed from this project, so the push Worker must be deployed again to use it.

**Removed**: nothing.

## 0.82.0 (2026-11-16): No ads for datacenter networks (bot protection Part 5b)

Change in the geo Worker and a new shared file. Ads are still off on the live site (compliance mode is on in `config/ad-loader.json`), so no live page changed. The browser file of the ad loader did not change: it already loads nothing unless the Worker answers `ads: true`. No database change: no migration. `npm test` (88 files, 1631 tests) and `npm run build` passed.

**Added**
- `workers/shared/datacenter.js`: the ONE copy of the datacenter network list (`DATACENTER_ASNS`, `isDatacenterAsn`), moved here unchanged from `workers/analytics/lib.js`.
- `site/tests/unit/geo-datacenter.test.ts` (20 tests): the list and `isDatacenterAsn` (numbers, text, junk), the rule in `decide()` (datacenter, unknown country, blocked country, home line, no number), the `BLOCK_DATACENTERS` switch (on for a missing, empty or unknown text; off only for false, 0, no, off), the HTTP answer (the number is not in the answer, no-store and CORS unchanged, no `cf` still works), proof that there is one copy (same object, no second list of numbers), and the ad loader loading nothing for a `datacenter` answer. The rule was broken on purpose once to check that 5 of these tests fail.
- `BUGS.md`: W48 to W51.

**Changed**
- `workers/geo/index.js`: new `blockDatacenters()`; `decide(country, env, asn)` has an optional third value and answers `{ ads: false, consent: false, country, reason: "datacenter" }` for a network on the list (the datacenter rule comes before the blocked-country rule); the route passes `request.cf.asn`. Without a network number every answer is the same as before.
- `workers/geo/wrangler.toml`: new setting `BLOCK_DATACENTERS = "true"`.
- `workers/analytics/lib.js`: imports and re-exports the list from the shared file, so every older import still works and the stored `dc` value is unchanged.
- `BOT_PROTECTION.md` (5b done, section 8 rule 1), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.82.0", phase row 8b), `NEWS_WEBSITE_PLAN.md` (section 13.2 line), `site/README.md` (new section, Geo Worker section; the page title said v0.62.0 and now says v0.82.0).
- `site/package.json`, `site/package-lock.json`: version 0.82.0.

**Honest limits**: the list is short and by hand; a real person on a company VPN inside a cloud network sees no ads; Cloudflare WARP and Apple Private Relay readers are not on the list; the geo Worker keeps no count of refusals; a datacenter visitor from a blocked country now gets the reason `datacenter` instead of `blocked`; nothing is deployed from this project, so the geo Worker must be deployed again to use it.

**Removed**: nothing. (The list of numbers was moved out of `workers/analytics/lib.js` into the shared file; it is still exported from the old place.)

## 0.81.0 (2026-11-16): The ad loader waits for one real event (bot protection Part 5a)

Change in the browser file of the ad loader. Ads are still off on the live site (compliance mode is on in `config/ad-loader.json`), so no live page changed. No settings change and no database change. `npm test` (87 files, 1611 tests) and `npm run build` passed.

**Added**
- `site/tests/unit/ads-real-event.test.ts` (9 tests): the idle time alone loads nothing, the source has no timer that starts the loader, each of the four real events starts it once and the listeners are removed, a made-up event is ignored and the loader keeps waiting, a made-up event followed by a real one still works, a call with no event object counts, and a page that is not an article adds nothing.
- `BUGS.md`: W45 to W47.

**Changed**
- `site/src/lib/ads-client.js`: new `onAction()` is the listener of the four events and ignores an event with `isTrusted` false; the idle timer (`setTimeout(run, idleMs || 4000)`) is removed; `stop()` removes the same function that was added. Everything else (article pages only, geo and consent answers, popunder and smartlink limits) is unchanged.
- `site/tests/unit/ads-client.test.ts`: one test name changed ("until the first real event").
- `NEWS_WEBSITE_PLAN.md` (section 13.4 line), `POLISH.md`, `BOT_PROTECTION.md` (Part 5 split into 5a, 5b, 5c; 5a done; section 8 rule 1), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.81.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.81.0.

**Honest limits**: the browser's scroll restore after a reload counts as a scroll; a bot that drives a real browser and really scrolls still passes this step; `idleMs` is still in the settings plan but nothing reads it.

**Removed**: nothing (the idle timer line is removed from the code).

## 0.80.0 (2026-11-16): The red note per page, country and source (bot protection Part 4b-4)

New feature in the analytics Worker's `GET /stats` and in the Analytics screen. The beacon is still off on live pages (`config/analytics.json` is empty), so no live page changed. No database change: no migration to run. `npm test` (86 files, 1602 tests) and `npm run build` passed.

**Added**
- `site/tests/unit/analytics-items.test.ts` (19 tests): the plan (5m, 1h, 24h only; numbers only in the values; the one verified rule), `groupUnverified`, `itemAlert` and `itemAlerts`, the drawn note (role alert, text only, order on the screen, null and older Worker answers), and the numbers on real SQLite (now against before, verified views left out, a key seen only before is not listed, old views not read, empty country, direct visits, a flood from one source name).
- `BUGS.md`: W42 to W44.

**Changed**
- `workers/analytics/lib.js`: `statsPlan()` has a new item `itemUnverified` (null for 7d and life; else three lists: pages, countries, sources, each with the unverified views now and in the period before); new `groupUnverified()` (same-name keys added together, top 10, sorted).
- `workers/analytics/index.js`: `GET /stats` runs the three lists and adds `itemUnverified` (sources get their names through `sourceName`). Every other number is unchanged.
- `site/public/admin/js/analytics.js`: new `itemAlert()` and `itemAlerts()` (the rule: at least 10 views and at least 3 times the period before, normal at least 1); `renderStats()` shows a red note with the list of items, after the whole-site note and before the cards.
- `site/tests/unit/analytics-stats.test.ts`: checks `itemUnverified` for 5m and that 7d and lifetime give null.
- `BOT_PROTECTION.md` (4b-4 done), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.80.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.80.0.

**Honest limits**: no item note for 7 days and lifetime; a new item has a normal level of 1, so it needs 10 unverified views; only the top 10 items by unverified views now are checked.

**Removed**: nothing.

## 0.79.0 (2026-11-16): The Analytics screen shows verified views, the unverified share and the red note (bot protection Part 4b-3)

New feature in the Analytics screen and one new list in the analytics Worker's `GET /stats`. The beacon is still off on live pages (`config/analytics.json` is empty), so no live page changed. No database change: no migration to run. `npm test` (85 files, 1583 tests) and `npm run build` passed.

**Added**
- `site/tests/unit/analytics-unverified.test.ts` (28 tests): the one SQL rule for unverified, the plan for every range, `unverifiedShare`, the red note rule (3 times, 6 steps, 10 views, median, bad numbers), the drawn screen (verified card, unverified card, old Worker answer, note on top with role alert, empty period) and the new list on real SQLite (steps, zero step, empty range, lifetime, old days, totals agree with the rollups).
- `BUGS.md`: W39 to W41.

**Changed**
- `workers/analytics/lib.js`: new `UNVERIFIED_COUNT` (built from the same `VERIFIED_SQL`, so there is still one rule); `statsPlan()` has a new item `unverifiedTimeline` (unverified views per chart step; lifetime = finished days minus their verified views, plus the running day).
- `workers/analytics/index.js`: `GET /stats` runs it and adds `unverifiedTimeline`. Every other number is unchanged.
- `site/public/admin/js/analytics.js`: new `unverifiedShare()`, `unverifiedAlert()` and the three limits; `renderStats()` shows **Page views (verified human)** with the all-views total, a new **Unverified views** card with its share, and a red note (role alert, first on the screen) when the newest step has at least 3 times the normal level. An older Worker answer without the new numbers still draws the old card and no note.
- `site/public/admin/admin.css`: the red note style (`.an-alert`).
- `site/tests/unit/analytics-stats.test.ts`: two more checks that `unverifiedTimeline` is in the answer and adds up to views minus verified views.
- `BOT_PROTECTION.md` (4b-3 done; the per-item note is left as 4b-4), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.79.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.79.0.

**Honest limits**: days saved before v0.77.0 count as unverified in the Lifetime view; the 5 minute range has too few steps for the note; the chart, visitors and average read time still use all views; the note is for the whole site, not yet for one page, country or source (4b-4).

**Removed**: nothing.

## 0.78.0 (2026-11-16): One visit per reader per page per 30 minutes and the 5-second rule (bot protection Part 4b-2)

New feature in the beacon script and in the analytics Worker's one database statement. The beacon is still off on live pages (`config/analytics.json` is empty), so no live page changed. The dashboard screen is not changed yet (Part 4b-3). No database change: no migration to run. `npm test` (84 files, 1555 tests) and `npm run build` passed.

**Added**
- `site/tests/unit/analytics-visit.test.ts` (8 tests): the statement, and on real SQLite: a reload inside 30 minutes is not a second visit, 29 minutes 59 seconds is the same visit and 30 minutes is a new one, another page or another session is its own visit, the later messages of a counted page view still update its row, the messages of a skipped page view are skipped too, an old stored page view is still updated after 30 minutes, a repeat is not an error.
- `site/tests/unit/beacon.test.ts`: a new block of 6 tests for the 5-second rule (a page left under 5 seconds sends nothing, a background tab sends nothing, exactly 5 seconds is enough, a late stamp sends at once, a stamp that comes early waits).
- `BUGS.md`: W35 to W38.

**Changed**
- `site/src/lib/beacon-client.js`: the first message goes out after 5 counted reader seconds (a visible tab and a reader who did something in the last 30 seconds), not after 1. `send()` sends nothing while read time is under 5, also when the page is left (so a visit under 5 seconds is never sent). Every later message is as before.
- `workers/analytics/lib.js`: `UPSERT_SQL` is now `INSERT ... SELECT ... WHERE EXISTS (this page view already has its row) OR NOT EXISTS (the same session has another page view of the same address in the last 30 minutes) ON CONFLICT ... DO UPDATE`; new `VISIT_WINDOW_SECONDS` (1800). Still one statement, the same 14 values, so the Worker made no change except a comment.
- `workers/analytics/index.js`: comment only.
- Tests changed to the new timing: `beacon.test.ts` (first message at 5 seconds), `analytics-rollup.test.ts` (the second page view of the same reader is 31 minutes later).
- `BOT_PROTECTION.md` (4b-2 done), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.78.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.78.0.

**Removed**: nothing.

## 0.77.0 (2026-11-16): The datacenter list and the verified human counters (bot protection Part 4b-1)

New feature in the analytics Worker, its database and its tests. The beacon is still off on live pages (`config/analytics.json` is empty), so no live page changed. The dashboard screen is not changed yet: it still shows `views` as before (Part 4b-3). `npm test` (83 files, 1540 tests) and `npm run build` passed.

**Added**
- `workers/analytics/migrate-0.77.0.sql`: three `ALTER TABLE` lines (`events.dc`, `rollup_hourly.verified_views`, `rollup_daily.verified_views`). Run it once on a database made before this version, after `migrate-0.76.0.sql` if that one was not run either. Do not run it on a database made from the new `schema.sql` (SQLite answers "duplicate column name").
- `workers/analytics/lib.js`: `DATACENTER_ASNS` (a short list of big cloud and hosting networks: AWS, Google Cloud, Azure, DigitalOcean, OVH, Hetzner, Linode, Vultr, Alibaba, Tencent, Oracle, Contabo), `isDatacenterAsn()`, `VERIFIED_SQL` (`acted = 1 AND webdriver = 0 AND dc = 0`), `VERIFIED_COUNT` (one SQL rule used by every query) and `isVerified()`.
- `site/tests/unit/analytics-verified.test.ts` (26 tests): the list, the `dc` flag, the one rule, the database files, the counters on real SQLite (raw ranges, lifetime, old rollup rows, a second run of the rollup), the migration on an old database, the Worker with the edge number, and `GET /stats`.
- `BUGS.md`: W31 to W34.

**Changed**
- `workers/analytics/lib.js`: `cleanBeacon` takes `ctx.asn` (the edge's number, never the browser's) and returns `dc` (1 for a datacenter network). A datacenter visit is kept, not dropped, so the owner can see how much there is. `UPSERT_SQL` and `eventValues` have one more value (14); `dc` only goes up. `HOURLY_SQL` and `DAILY_SQL` also write `verified_views`. `statsPlan` totals have `verified_views` for every range (lifetime adds the daily totals and today's raw events).
- `workers/analytics/index.js`: passes `request.cf.asn` to `cleanBeacon`; `GET /stats` adds `verifiedViews` and `unverifiedViews` (verified never above all views). `views`, `visitors` and every other number are unchanged.
- `workers/analytics/schema.sql`: the new columns for a new database and a note about the migration.
- Tests changed to the new shape (14 values, key `dc`): `analytics-lib.test.ts`, `analytics-worker.test.ts`, `analytics-human.test.ts` (the old-database test also runs the new migration).
- `BOT_PROTECTION.md` (4b split into 4b-1, 4b-2, 4b-3), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.77.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.77.0.

**Removed**: nothing.

## 0.76.0 (2026-11-16): The beacon sends "acted" and "webdriver" and the Worker stores them (bot protection Part 4a)

New feature in the beacon script, the analytics Worker and the analytics database. The beacon is still off on live pages (`config/analytics.json` is empty), so no live page changed. Nothing counts the two flags yet: the two counters and the dashboard lines are Part 4b. `npm test` (82 files, 1514 tests) and `npm run build` passed.

**Added**
- `workers/analytics/migrate-0.76.0.sql`: two `ALTER TABLE` lines for a database made before this version. Run it once on such a database; do not run it on a database made from the new `schema.sql` (SQLite answers "duplicate column name").
- `site/src/lib/beacon-client.js`: the message now carries `acted` (1 after a real pointer press, key press or touch, or a scroll of at least 20 percent of the way down; an event made up by a script has `isTrusted` false and does not count; mouse movement alone does not count; it never goes back to 0) and `webdriver` (1 when `navigator.webdriver` is exactly true). A change of `acted` alone is sent when the page is left. No fingerprint, no cookie, nothing new in storage.
- Tests: 11 new in `beacon.test.ts`, 6 new in `analytics-worker.test.ts`, 3 new in `analytics-lib.test.ts`, and the new file `tests/unit/analytics-human.test.ts` (9 tests: the schema file, the migration on an old database made in the test, the flags on real SQLite, the flags only go up).
- `BUGS.md`: W27 to W30.

**Changed**
- `workers/analytics/lib.js`: `cleanBeacon` returns `acted` and `webdriver` (only the number 1 counts, anything else is 0); `UPSERT_SQL` has two more columns and raises them with `MAX` on the second message of a page view; `eventValues` adds the two values (an event without them gives 0 and 0).
- `workers/analytics/index.js`: the message rules accept `acted` and `webdriver` as optional numbers (an older page script still works; text, a list or `true` give 400).
- `workers/analytics/schema.sql`: the two columns on `events` (for a new database) and a note about the migration.
- Tests changed to the new shape: `analytics-lib.test.ts` (event keys, 13 values), `analytics-worker.test.ts` (row values), `beacon.test.ts` (message keys).
- `BOT_PROTECTION.md` (Part 4 split into 4a and 4b), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.76.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.76.0.

**Removed**: nothing.

## 0.75.0 (2026-11-16): The Privacy page tells readers about Turnstile and the stamp (bot protection Part 3d)

New feature in the page generator (`npm run pages`). Part 3 of the bot protection plan is now complete, except the chat, which has no Worker yet. No Worker and no live page changed. `npm test` (81 files, 1486 tests) and `npm run build` passed.

**Added**
- `site/scripts/required-pages-lib.mjs`: `featuresFrom({ contact, analytics, push })` (a feature is on only when its config is really filled: contact needs both `endpoint` and `turnstileSiteKey`, analytics and push need an `endpoint`) and the section "Checks that you are a person" in the Privacy Policy. It names Cloudflare Turnstile (only when the contact form is on) and says that the signed time stamp holds only a time and a signature, no name, no email and no identifying number, and is not stored (only when at least one of the form, the reader count or the notification sign-up is on).
- Tests: 9 new in `required-pages.test.ts` (nothing written while all is off, `featuresFrom` cases, Turnstile and stamp text, the list wording with one, two and three features, section order and heading rules, only the Privacy page changes, descriptions stay under 160 characters, the text matches the code) and 2 new for `npm run pages` (the section appears only when the config files are filled; a broken optional config file stops with a plain message).
- `BUGS.md`: W25 and W26.

**Changed**
- `site/scripts/required-pages-lib.mjs`: `buildPages` accepts `features` (default: all off, so the output is the same as before). `defs` passes it to the Privacy page.
- `site/scripts/make-pages.mjs`: reads `config/contact.json`, `config/analytics.json` and `config/push.json` when they exist (a missing file means "off"; a file that is not valid JSON stops with a plain message).
- `site/tests/unit/required-pages.test.ts`: import of `featuresFrom`.
- `BOT_PROTECTION.md` (3d done), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.75.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.75.0.

**Removed**: nothing.

## 0.74.0 (2026-11-16): The analytics Worker uses the shared guard (bot protection Part 3c)

New feature in the analytics Worker and the beacon script. The beacon is still off on live pages (`config/analytics.json` is empty). `npm test` (81 files, 1475 tests) and `npm run build` passed.

**Added**
- `workers/analytics/index.js`: `GET /stamp` (a signed stamp for `/collect`; only the site origin; 503 when off or without secret), the kill switch variable `COLLECT_OFF` (stops `/collect` and `/stamp` only) and the new secret `STAMP_SECRET`. A message without a good stamp (missing, wrong, other Worker, older than 12 hours) is not counted (400).
- `site/src/lib/beacon-client.js`: asks for a stamp with a plain GET when the page opens, sends it as `stamp` in every message, sends nothing until it has arrived (then the newest numbers at once), tries at most 3 times, cuts `ref` to 300 characters.
- `workers/shared/guard.js`: a `number` field rule (finite number, handed on unchanged), `plainTextOk` and the rule option `allowPlain` (also accept `text/plain`).
- Tests: 11 new in `analytics-worker.test.ts` (stamp route, stamp refusals, age window, missing secret, kill switch, content types, exact fields, optional fields, bot with a stamp, the longest message), 7 new in `beacon.test.ts` (stamp request, wait for the stamp, no empty first message, no stamp, retry, address, cut referrer) and 4 new in `guard.test.ts` (number fields, text/plain).
- `BUGS.md`: W20 to W24 (W14 now also names analytics).

**Changed**
- `workers/analytics/index.js`: `/collect` now comes through `guardRequest` (exact fields: an extra field or a number sent as text gives 400; types `text/plain` and `application/json` only, others 415; size limit MAX_BODY plus 128 for the stamp). The origin, database, bot, limiter and write steps are as before. A bot with a good stamp still gets the quiet 204.
- Tests changed to the new rules: `analytics-worker.test.ts` (a stamp is added to every message, a browser time field is now refused, the size test), `beacon.test.ts` (the stamp calls are kept apart, tests wait for the stamp answer), `guard.test.ts` (only auth and geo are left without the guard).
- `workers/analytics/wrangler.toml` (`COLLECT_OFF`, `STAMP_SECRET` notes), `site/README.md`, `BOT_PROTECTION.md` (Part 3c done; the chat part waits for a chat Worker), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.74.0").
- `site/package.json`, `site/package-lock.json`: version 0.74.0.

**Removed**: nothing.

## 0.73.0 (2026-11-16): The push Worker uses the shared guard (bot protection Part 3b)

New feature in the push Worker and its page script. Notifications are still off on live pages (`config/push.json` is empty). `npm test` (81 files, 1453 tests) and `npm run build` passed.

**Added**
- `workers/push/index.js`: `GET /stamp` (a signed stamp for `/subscribe`; only the site origin; 503 when off or without secret), the kill switch variable `PUSH_SUBSCRIBE_OFF` (stops `/subscribe` and `/stamp` only) and the new secret `STAMP_SECRET`. `POST /subscribe` needs the stamp; a missing, wrong, other-form or old stamp gets `reload: true`.
- `site/src/lib/push-client.js`: asks for a stamp with a plain GET right before every subscribe call (also the quiet fix of a lost token), sends it as `stamp`, repeats the call once when the Worker says `reload`. A failed stamp call gives the same reasons as before (network or a plain error) and removes a browser subscription made just now.
- Tests: 10 new in `push-endpoints.test.ts` (stamp route, stamp refusals, missing secret, JSON only, exact fields, extra stamp, trap field, object fields, kill switch on a real SQLite database, one row for one browser), 8 new in `push-client.test.ts` (stamp before subscribe, new stamp each time, quiet fix, one repeat on `reload`, no endless repeat, no stamp, empty stamp answer, 15 second limit with no cookies) and 5 new in `guard.test.ts` (object fields, optional fields, stamp window).
- `BUGS.md`: W15 to W19 (W14 now also names push).

**Changed**
- `workers/shared/guard.js`: a text field can be `optional` (left out when missing), a field can be an `object` (handed on unchanged), and a Worker can set `stampMinMs` and `stampMaxMs`. Contact is unchanged.
- `workers/push/index.js`: `/subscribe`, `/preferences`, `/unsubscribe` and `/test` now come through `guardRequest`: JSON only (415 otherwise), exact fields (400 for an extra field; `POST /test` used to ignore extra fields) and the hidden trap field (answered like a success, nothing stored). The origin, database, limiter and per route rules are as before.
- Tests changed to the new rules: `push-endpoints.test.ts` and `push-test-send.test.ts` (JSON content type, a stamp for `/subscribe`, extra fields on `/test` refused), `push-client.test.ts` (the stamp calls are counted apart, the 15 second test waits for the stamp first), `guard.test.ts` (the push Worker may use the guard now).
- `workers/push/wrangler.toml` (`PUSH_SUBSCRIBE_OFF`, `STAMP_SECRET` notes), `site/README.md`, `BOT_PROTECTION.md` (Part 3b done), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.73.0").
- `site/package.json`, `site/package-lock.json`: version 0.73.0.

**Removed**: nothing.

## 0.72.0 (2026-11-16): The contact Worker uses the shared guard (bot protection Part 3a)

New feature in the contact Worker and its form script. The form is still off on live pages (`config/contact.json` is empty). `npm test` and `npm run build` passed.

**Added**
- `workers/contact/index.js`: `GET /stamp` (a signed fill-time stamp for the contact form; only the site origin; 503 when off or without secret), the kill switch variable `CONTACT_OFF`, and the new secret `STAMP_SECRET`. A `reload: true` answer when the stamp is missing, wrong or old.
- Tests: 9 new in `contact-worker.test.ts` (stamp route, forged, old and too-fast stamps, plain text, extra field, long field, kill switch, Bengali message, file uses the guard) and 8 new in `contact-form.test.ts` (stamp at start, slow stamp, retry once, no stamp, new stamp after a sent message and on `reload`, no new stamp after an ordinary refusal).
- `BUGS.md`: W10 to W14.

**Changed**
- `workers/contact/index.js`: the front checks (switch, method, origin, JSON only, size, exact fields, the hidden trap, the stamp) now come from `workers/shared/guard.js`; the field by field messages, Turnstile, rate limits and the database part are unchanged. A message with an extra field is now refused (400).
- `workers/shared/guard.js`: the declared length may be up to 4 times the character limit (Bengali text was refused too early, BUGS W10); a refusal carries `field` or `reload` when it applies.
- `site/src/lib/contact-client.js`: fetches the stamp when the page starts, waits for it or asks once more at send, sends it as `stamp`, sends the message as `application/json` (was `text/plain`), asks for a new stamp after a sent message and on `reload`.
- `workers/contact/wrangler.toml` (`CONTACT_OFF`, `STAMP_SECRET` notes), `site/README.md`, `BOT_PROTECTION.md` (Part 3a done, the stamp is a speed bump), `CODING_PLAN.md`, `INCOMPLETE.md` ("Open Items After v0.72.0").
- Tests changed to the new rules: `contact-worker.test.ts` (JSON, stamp, secret), `contact-form.test.ts` (JSON type and the `stamp` field), `guard.test.ts` (4 bytes a character, `field`, `reload`).
- `site/package.json`, `site/package-lock.json`: version 0.72.0.

**Removed**: nothing.

## 0.71.0 (2026-11-16): Shared Worker guard (bot protection Part 2)

New code, not connected yet. The common checks of `BOT_PROTECTION.md` Section 6 are now one tested file. No Worker calls it, so no behaviour changed. `npm test` (81 files, 1413 tests) and `npm run build` passed.

**Added**
- `workers/shared/guard.js`: `isKilled`, `originOk` (exact; empty, `*` and non-http(s) never match), `methodCheck`, `contentTypeOk`, `sizeOk`, `parseJson`, `checkSchema` (exact fields, control characters removed), `honeypotFilled`, `issueStamp` and `checkStamp` (HMAC SHA-256, tied to one form, 3 seconds to 2 hours), `hashKey`, `windowId`, `rateCheck`, `dedupeKey`, `countLinks`, `spamLinks` and `guardRequest` (all checks in order; a trap or a too-fast form gives `drop: true`). No network, no address read, no console.
- `site/tests/unit/guard.test.ts`: 38 tests (every helper, every refusal and its status, the order of the checks, the edges of the stamp time, a missing secret, the file has no console, no fetch and no secret, and no Worker uses it yet).
- `BUGS.md` group W (W1 to W9).

**Changed**
- `BOT_PROTECTION.md` (Section 6 item 6: an old form gets a reload message instead of being dropped; Section 17 Part 2 done), `CODING_PLAN.md` (Phase 8b Part 2 done, file list), `INCOMPLETE.md` ("Open Items After v0.71.0" and the phase table).
- `site/package.json`, `site/package-lock.json`: version 0.71.0.

**Removed**: nothing.

## 0.70.4 (2026-11-16): Bot protection plan (documents only)

Documents only. No code, no test and no behaviour changed. The owner asked for a full plan so that real readers come and bots do not.

**Added**
- `BOT_PROTECTION.md`: 18 sections. Nine layers (Cloudflare front door, five WAF rules, rate limits, Turnstile, Worker checks, human score in analytics, ad safety, admin and secrets, watching), rules that always spare the good bots, a test table, an attack playbook, owner decisions and eight small build parts (Phase 8b). It also says plainly what no tool can stop.

**Changed**
- `CODING_PLAN.md`: new "Phase 8b: Bot Protection" with the eight parts, nothing built.
- `INCOMPLETE.md`: "Open Items After v0.70.4" and a line in the phase table.
- `NEWS_WEBSITE_PLAN.md`: one pointer line next to the one for `BETTER.md`.
- `site/package.json`, `site/package-lock.json`: version 0.70.4.

**Removed**: nothing.

## 0.70.3 (2026-11-16): AdSense publisher id added

Config only. No code changed. The owner gave the AdSense id, so `ads.txt` now carries the AdSense line.

**Changed**
- `site/config/ads.json`: `adsensePublisherId` is `ca-pub-5531060803031167`. The build writes `google.com, pub-5531060803031167, DIRECT, f08c47fec0942fa0` into `ads.txt` (the last value is Google's fixed id).
- `INCOMPLETE.md` ("Open Items After v0.70.3"), `site/package.json`, `site/package-lock.json`: version 0.70.3.

**Not changed on purpose**: the AdSense script tag is not pasted into every page head. By PLAN 29.1 an ad script enters a page only through the ad loader, after consent, and `adsense.slot` is still empty so no unit shows. Compliance mode stays ON.

**Removed**: nothing.

## 0.70.2 (2026-11-16): AI-assisted label idea removed (documents only)

Documents only. No code, no test and no behaviour changed. The owner will do this part with another tool, so the idea is out of the plan.

**Changed**
- `BETTER.md`: the idea "AI-assisted label and rule" is taken out of "First Picks", group C and "Suggested Order". The remaining ideas are renumbered N1 to N24.
- `NEWS_WEBSITE_PLAN.md` (the pointer under Section 19), `INCOMPLETE.md` ("Open Items After v0.70.1") and the 0.70.1 entry below: counts and names fixed to match.
- `site/package.json`, `site/package-lock.json`: version 0.70.2.

**Removed**: the idea text (no file removed).

## 0.70.1 (2026-11-16): New ideas written into BETTER.md (documents only)

Documents only. No code, no test and no behaviour changed. All ideas that were not in any file were collected into one place.

**Added**
- `BETTER.md`: section "New Ideas Added in v0.70.1": 24 ideas (N1 to N24) in five groups (follow-ups of the location schema, smarter schema, trust and safety, growth, operations and cost), each with value, effort and a status box, a "First Picks" list and a suggested order. Every idea was checked against all `.md` files first; Preferred sources had only a one-line hint before.

**Changed**
- `NEWS_WEBSITE_PLAN.md`: one line under Section 19 that points to the new section.
- `INCOMPLETE.md`: "Open Items After v0.70.1".
- `site/package.json`, `site/package-lock.json`: version 0.70.1.

**Removed**: nothing.

## 0.70.0 (2026-11-16): Auto language and location schema for every post

New feature. Every post now carries its language and its place in the JSON-LD automatically (PLAN 36, LOGICS 24). The editor types nothing. `npm test` passed (80 files, 1375 tests) and `npm run build` was run with a temporary post that showed `inLanguage`, `contentLocation` and `locationCreated`; the temporary post was removed.

**Added**
- `site/src/lib/geo-schema.ts`: `langTag` (locale to language tag), `countries` (all countries from the runtime's ICU data plus short names), `parseDateline`, `detectLocations` (manual list, dateline, then a scored scan of title, tags and the first 300 words) and `placeLd`.
- `site/config/locations.json`: the owner list of cities, states and places (ships empty, `[]`).
- `site/tests/unit/geo-schema.test.ts`: 19 tests (locales, countries, dateline, scoring, ambiguous names, whole words, owner list, manual and `["none"]`, limit of 3, broken entries, article output).
- `NEWS_WEBSITE_PLAN.md` Section 36, `LOGICS.md` Section 24, `BUGS.md` group L (L1 to L8).

**Changed**
- `site/src/lib/schema.ts`: `inLanguage` is now `SITE_LANG` (from `config/site.json` locale, `en_US` gives `en-US`) on WebSite, post, CollectionPage and simple pages, instead of a fixed `en`. The post schema writes `contentLocation` and `locationCreated` only when a place is found.
- `site/src/content.config.ts`: new optional post field `location` (list of up to 3 names).
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`: runs `detectLocations` and passes the places to the schema.
- `site/public/admin/js/frontmatter.js` and `app.js`: `location` is kept in its place in the saved front matter and a blank post starts with `location: []`. There is still no field for it on the editor screen.
- `NEWS_WEBSITE_PLAN.md` (3.1, Section 8 table, Section 20 front matter), `CODING_PLAN.md` (Phase 2 item, file list), `AI_OPERATIONS.md` (front matter and a rule), `INCOMPLETE.md` ("Open Items After v0.70.0"), `site/README.md`.
- `site/package.json`, `site/package-lock.json`: version 0.70.0.

**Removed**: nothing.

## 0.69.0 (2026-11-16): Push Part 7b, the cron, the kill switch and planning after /announce

Phase 9 part 7b. The three pieces that must be switched on together are now connected: the plan after `POST /announce`, the sender called by a cron every minute, and the kill switch. They work only when sending is READY (the D1 database, the sender keys and no pause). Until the owner deploys the Worker with the keys, nothing changes: no reader is notified.

**Added**
- `workers/push/control.js`: `isPaused` (the kill switch, the variable `PUSH_PAUSED`: "true", "1", "yes" or "on" pauses), `sendingState` (database, then pause, then keys), `planAccepted` (runs the plan for the posts that `/announce` just recorded, at most 5 in a call, one failing post is counted and does not stop the others) and `runCron` (one batch of the sender, never throws).
- `site/tests/unit/push-control.test.ts`: 29 tests, the database ones on real SQLite with a fake push service. They cover the pause words, every reason for "not ready", queueing for a reader of breaking news, a missing post, a database error while planning and while sending, the limit of 5 posts, the whole way announce, cron, sent and a second tick that sends nothing, the same post announced twice, the kill switch on a queue that already exists, the answer of `/announce` with and without keys, no secret or text in any answer, and the files (no `console`, the cron line, no secret in `wrangler.toml`).

**Changed**
- `workers/push/index.js`: `/announce` plans the accepted posts after recording them and adds `planning` (counts only) to its answer, but only when sending is ready (without keys the answer is exactly as before); a new `scheduled` handler calls `runCron`.
- `workers/push/wrangler.toml`: the variable `PUSH_PAUSED = "false"` and `[triggers] crons = [ "* * * * *" ]`. A comment only for the rest.
- `CODING_PLAN.md` (7b done), `INCOMPLETE.md` (phase 9 status and "Open Items After v0.69.0"), `NEWS_WEBSITE_PLAN.md` (file list of 31.13), `BUGS.md` (P63 to P66).
- `site/package.json`, `site/package-lock.json`: version 0.69.0.

**Removed**: nothing.

## 0.68.1 (2026-11-16): AI guide covers every dashboard menu (Phase 3d, documents only)

Documents only. No code, no test and no behaviour changed. The owner asked that an AI assistant with GitHub access can do everything the dashboard does. The guide had recipes for posts, pages, authors, redirects and settings in general, but not for Ads, Ad loader, Analytics, Links, Import, Export and Media. The rules were read from the real code (`ads-txt.ts`, `ad-loader-config.js`, `link-list.js`, `beacon.ts`, `contact.ts`, `footer.ts`, `import-save.js`, `roles.js`, `image.js`, `robots.txt.ts`, `categories.ts`).

**Answer written into the file**
- Every dashboard menu is a file change in Git, so the AI can do all of them except: reading the private analytics numbers, the Export file (a browser job), pictures through a text-only connector, and everything outside GitHub (Cloudflare, keys, ad and search accounts).

**Added**
- `AI_OPERATIONS.md` Section 13 (13.1 to 13.12): a coverage table for every menu, the exact rules of `ads.json`, `ad-loader.json`, `analytics.json`, `links.json`, `robots.json`, `footer.json`, `contact.json`, `push.json`, `publisher.json`, `site.json` and `categories.json`, the hand import rules, backup and restore, media rules, the Setup checks, roles, and the list of what the AI can never do.

**Changed**
- `AI_OPERATIONS.md` Section 1 note: a category has a display name and description in `config/categories.json` (the old line said categories have no file).
- `INCOMPLETE.md` ("Open Items After v0.68.1"), `site/package.json`, `site/package-lock.json`: version 0.68.1.

**Removed**: nothing.

## 0.68.0 (2026-11-16): Push Part 7a, the sender (one batch of messages from the queue)

Phase 9 part 7a, the first small part of part 7. A new module takes the next messages from the queue, builds the notification, sends it and writes the result. It does not run by itself: the cron that calls it, the kill switch and the call after `/announce` are part 7b, so no reader sees any change.

**Added**
- `workers/push/sender.js`: `runSender(db, opts, now)` (one batch of at most 36 messages: take back messages that were claimed and never finished, drop messages older than their time to live, claim the next ones, read the reader and the post, send, write the results in one database batch), `decideRow` (pure: expire, done, fail or send), `judgeResult` (pure: what each answer of the push service means), `topicOf` (short hash of the thread for the Topic header) and the SQL text.
- `site/tests/unit/push-sender.test.ts`: 54 tests. The database ones run on real SQLite with a fake push service and a browser made with Node's own crypto (the sent text is opened and read). They cover the headers and the opened text, the time to live that is left, breaking first then score then age, story updates (no daily slot, no gap), the duplicate guard, the reader's own local day, expired and paused readers, a missing post and an emoji in the text, 404 and 410 (the reader and everything of the reader is deleted, nobody else), keys that cannot be used, 429 with and without Retry-After (the batch stops, nothing is counted), server errors and network errors (2 retries with a growing wait, then one failure), 401 and 403 (our key problem: nothing counted against the reader), 400 and 413, two runs at the same time (every message sent once), a claim that ran out, a database error while reading and while writing, no push address or text in the result or in any console call, the index of the queue, and the number of outgoing calls (36 sends plus the database calls stay under 50).

**Changed**
- `workers/push/schema.sql`: `push_queue` has a new column `next_try` (the wait before a retry and the end of the claim of a message being sent). A database made before this version needs one line, written in the file: `ALTER TABLE push_queue ADD COLUMN next_try INTEGER NOT NULL DEFAULT 0`. Nothing was deployed yet.
- `workers/push/wrangler.toml` (comment only), `CODING_PLAN.md` (part 7 split into 7a to 7e, 7a done), `INCOMPLETE.md` ("Open Items After v0.68.0" and the phase 9 status), `NEWS_WEBSITE_PLAN.md` (file list of 31.13), `BUGS.md` (P57 to P62).
- `site/package.json`, `site/package-lock.json`: version 0.68.0.

**Removed**: nothing.

## 0.67.0 (2026-11-16): Push Part 6d, the delivery plan (score, rules and the queue)

Phase 9 part 6d. A new module turns the candidate readers of part 6c into queued, held or skipped messages. It sends nothing and nothing calls it yet, so no reader sees any change.

**Added**
- `workers/push/plan.js`: `postFromRow`, `subFromRows` (waiting messages are added to the day's count in the reader's own local day), `planAudience` (pure: already sent, then the score and level rules, then the delivery rules; returns queue, held and counts of every skip reason), the SQL text for reading choices, recent sends and waiting messages, the SQL for writing the queue (`INSERT OR IGNORE`) and the held stories (limit of 5 inside the statement), and `runPlan` (read, decide, write in batches of 40, one `push_audit` row last).
- `site/tests/unit/push-plan.test.ts`: 36 tests on real SQLite. They cover the row readers, the local day, every skip reason, quiet hours and the breaking exception, the gap and the digest, story updates, fatigue with the category of old sends, waiting messages and the daily limit, the held limit and its expiry, a second call, more than one chunk and one batch (150 readers), a missing or broken post, and a database error while reading and while writing.

**Changed**
- `CODING_PLAN.md` (6d done), `INCOMPLETE.md` ("Open Items After v0.67.0" and the phase 9 status), `NEWS_WEBSITE_PLAN.md` (file list of 31.13), `BUGS.md` (P53 to P56).
- `site/package.json`, `site/package-lock.json`: version 0.67.0.

**Removed**: nothing.

## 0.66.0 (2026-11-16): Push Part 6c, the audience search (candidate readers through the indexes)

Phase 9 part 6c. A new module finds the readers who may want one announced post. It finds only: nothing is scored, held, queued or sent, and nothing calls it yet, so no reader sees any change.

**Added**
- `workers/push/audience.js`: `audienceKeys` (category, author, stemmed words of the post, breaking flag), `candidateQueries` (one query for each door: category, author, keyword words in chunks of 60, breaking news), `findCandidates` (runs them, joins the doors, one entry for each reader with the doors that found him, `truncated` after 5000, counts for each door), `loadCandidates` and `loadSubsSql` (the subscriber rows without push address, keys or token).
- Every query keeps only readers who are active, have fewer than 5 failures in a row and are not paused (the pause is over when `paused_until` is not later than now).
- `site/tests/unit/push-audience.test.ts`: 24 tests, the database ones on real SQLite. They cover each door, two doors for one reader, stems and capitals, every excluded state, the value limit for a long post, the cut at 5000, a database error (no half list), the secret columns, and `EXPLAIN QUERY PLAN` (indexes used, no scan of all readers).

**Changed**
- `CODING_PLAN.md` (part 6c done), `INCOMPLETE.md` (phase 9 status and "Open Items After v0.66.0"), `NEWS_WEBSITE_PLAN.md` (file list of 31.13), `BUGS.md` (P49 to P52).
- `site/package.json`, `site/package-lock.json`: version 0.66.0.

**Removed**: nothing.

## 0.65.3 (2026-11-16): Plan and guide, an AI assistant with GitHub access can run the site

Documents only. No code, no test and no behaviour changed. The owner asked whether ChatGPT, connected to GitHub with write access, can do everything the dashboard does (create, update, publish, unpublish, delete, schedule, redirects) and wanted the md files to make it as complete as possible.

**Answer written into the files**
- Every content task is a file change in Git, so an AI with write access can do all of them if it writes the files exactly as the build expects. The new guide gives the exact recipes, taken from the real code.
- It cannot do what is outside GitHub (Cloudflare Workers, secrets, D1, R2, DNS, Search Console, ad accounts), cannot run the build itself, and may not be able to write picture files. These limits are stated.
- Found while reading the code: scheduling is `status: published` with a future date (the build reads only `published`); `status: scheduled` would never go live. The guide says so (BUGS V1).
- The repository is public, so drafts, scheduled and archived posts are readable by anyone. Recorded as decision 17.

**Added**
- `AI_OPERATIONS.md`: limits, the file map, the safe commit rule (branch, pull request, green check), post recipe with the full front matter, publish, schedule, unpublish (draft 404, archived 410), delete, redirects (post list and `config/redirects.json`), pages, authors, categories, settings, pictures, search fields, the report to give after each task, planned checks, security notes.

**Changed**
- `NEWS_WEBSITE_PLAN.md`: new Section 35.
- `LOGICS.md`: new Section 23 (the checks a content script must make).
- `BUGS.md`: new group V (V1 to V10).
- `CODING_PLAN.md`: new Phase 3d (part 1 done, parts 2 to 5 to do), `validate.yml` in the workflow list.
- `POLISH.md`: one line in the pre-launch sweep.
- `INCOMPLETE.md`: decisions 17 and 18, and "Open Items After v0.65.3".
- `site/package.json`, `site/package-lock.json`: version 0.65.3.

**Removed**: nothing.

## 0.65.2 (2026-11-16): Plan only, Auto Image Hosting (hotlinked pictures to our own CDN)

Documents only. No code, no test and no behaviour changed. The owner asked for a strong feature: a picture that is hotlinked from another website is downloaded automatically, renamed for SEO and hosted on our own CDN.

**What the plan says (PLAN 34)**
- Four doors, one engine: the editor on Save, the XML import, a safety-net GitHub Action (`hotlink.yml`) and a build gate.
- Each picture: find, check the address (https, public host only, redirects checked), download through a private Worker (`workers/images`), check the real bytes, find duplicates by SHA-256, optimize to WebP (2400 px cap, no EXIF), name, save, rewrite the post, record in `config/media.json`, all in one commit.
- SEO file name from alt text, caption, nearest heading, focus keyword and title words; no camera or random names; 3 to 6 words; path `/media/YYYY/MM/<name>.webp` from the post's publish date.
- Automatic image SEO: alt text (marked for review when made by the system), width and height, lazy loading, `srcset`, credit and source, image sitemap.
- Own CDN: Cloudflare Pages by default with a long immutable cache, and a Cloudflare R2 option for a big site.
- A failed download never loses the original reference. Agency and stock hosts ask first, and a rights notice is always shown.

**Changed**
- `NEWS_WEBSITE_PLAN.md`: new Section 34; one line in Section 12.
- `LOGICS.md`: new Section 22.
- `BUGS.md`: new group U (U1 to U14).
- `CODING_PLAN.md`: new Phase 3c with eight small parts, all not done; `hotlink.yml` in the workflow list.
- `POLISH.md`: two lines.
- `INCOMPLETE.md`: decisions 15 and 16, and "Open Items After v0.65.2".
- `site/package.json`, `site/package-lock.json`: version 0.65.2.

**Removed**: nothing.

## 0.65.1 (2026-11-16): Plan only, Search Engine Listing and File Editor (Shopify-style)

Documents only. No code, no test and no behaviour changed. The owner asked for a file editor with SEO options like the one in Shopify, so the plan now has a new section and a build order.

**What the plan says (PLAN 33)**
- A "Search engine listing" box in every editor (post, page, category, tag, author, home): a Google-style preview with a Mobile and Desktop switch, and an Edit link that opens page title, meta description and URL handle, with counters (warn at 60 and 160 characters, stop at 70 and 320) and "Reset to auto".
- Automatic fallbacks when a field is empty; a handle change on a published post asks for a 301 redirect (required after 24 hours); a "Hide this page from search engines" switch (noindex, out of the sitemaps and out of push); an Advanced fold (canonical, Open Graph, schema type).
- A Files editor for media: alt text, caption, credit, "Used in", image SEO checks, rename and replace with redirects, delete refused while used, bulk alt text.
- A "File" tab with the raw Markdown and front matter. Roles are checked again at save.

**Changed**
- `NEWS_WEBSITE_PLAN.md`: new Section 33; two small lines in Section 12 (editor field list, management screens).
- `LOGICS.md`: new Section 21 (the rules and the tests they need).
- `BUGS.md`: new group S (S1 to S10).
- `CODING_PLAN.md`: new Phase 3b with nine small parts, all not done.
- `POLISH.md`: two lines under Admin Polish.
- `INCOMPLETE.md`: decisions 13 and 14, and "Open Items After v0.65.1".
- `site/package.json`, `site/package-lock.json`: version 0.65.1.

**Removed**: nothing.

## 0.65.0 (2026-11-16): Phase 9 (part 6b), the live check in POST /announce

The second small piece of part 6. Before `POST /announce` records a post, the push Worker now opens the post's page and checks that it is really live and open to search (PLAN 31.5, first rule; BUGS P3). **It still finds no readers, scores nothing and sends nothing.** Nothing changes for readers or for the site. The Worker is not deployed.

**How the check works**
- Only posts that passed every check of 6a (and are not already announced) are opened. One GET with no redirect following, the agent name `ShivamDasNewsPushCheck/1.0`, a 5 second limit, at most 5 pages at the same time (a call has 25 posts at most). Only the head of the page is read (it stops at `</head>` or after 200000 bytes), and the download is stopped.
- Live means: status 200, an HTML page (`text/html` or `application/xhtml+xml`), no `noindex` or `none` in the `X-Robots-Tag` header, and none in a `robots` or `googlebot` meta tag of the head. A directive for another robot (`bingbot: noindex`) does not count. A `noindex` text in the body does not count.
- New reasons in the answer: `not_live` (a status other than 200, a redirect, or a page that is not HTML), `noindex` (the live page blocks search), `check_failed` (timeout, network error or a body that cannot be read: when unsure, do not send). The answer still holds the key and one reason word only.
- A post that fails is NOT written to `push_posts`. The deploy job of part 7 can ask again a few minutes later while the post is younger than 120 minutes (a new page can take a minute to spread after a deploy).
- The live check runs before the import guard, so a page that is not live cannot take the place of a live one in the "best 2" of a big import.
- `announce.js` now has two halves: `prepare()` (all the checks that need no network) and `finish()` (the live answers and the import guard). `decide()` stays as both in one step with no live check, so the 6a rules and tests are unchanged. A missing live answer or an unknown reason is treated as `check_failed`, never as a pass.

**Added**
- `workers/push/livecheck.js`: `robotsBlocks`, `metaRobots`, `judge`, `liveCheck`, `liveCheckAll`, and the limits. No clock, no printing; the only network call goes through the fetch function the caller gives.
- `site/tests/unit/push-livecheck.test.ts` (38 tests): the robots rules (header and meta, letter case, other robots), the head-only reading, the decision for every status and content type, the call itself (arguments, no redirect, timeout, broken body, huge page, no stream), the many-pages runner (one failure, the limit of 5 at a time), `prepare` and `finish`, and a check of the file (no clock, no printing, no emoji).
- Also in `site/tests/unit/push-announce.test.ts`: 10 new Worker tests on real SQLite (the address is opened once without redirects, 404 and 410 and 500 and 301, noindex in the header and in the page, a network error, posts refused earlier are never opened, the check comes before the import guard, one bad page does not stop the others, the answer holds no page text, no check when the secret is wrong).

**Changed**
- `workers/push/announce.js`: `prepare`, `finish`, `decide` as a wrapper, two new reasons in `REASONS`, header comment.
- `workers/push/index.js`: `/announce` uses `prepare`, `liveCheckAll` and `finish`; the fetch function is passed in like for `/test`; header comment.
- `workers/push/wrangler.toml`: comment only. No new variable or secret.
- `site/tests/unit/push-announce.test.ts`: the old Worker tests now hand the Worker a fake live page (no real network), the harness takes a fake fetch.
- `site/package.json`, `site/package-lock.json`: version 0.65.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.4 note), `BUGS.md` (P3 note), `site/README.md` (new section).

**Removed**: nothing.

## 0.64.0 (2026-11-16): Phase 9 (part 6a), POST /announce: the post checks and the import guard

The first small piece of part 6. The push Worker gets a new route, `POST /announce`, for the deploy job (GitHub Actions). It receives the posts that went live in one deploy, decides for each one whether it may be pushed at all (PLAN 31.5), and records the good ones in `push_posts`. **It finds no readers, scores nothing and sends nothing**: that is 6b and later. The route is off (503) until the secret `ANNOUNCE_SECRET` is set, so nothing changes for anyone today. The Worker is not deployed.

**How the call works**
- `POST /announce` with the header `X-Announce-Secret` and a body `{ "posts": [ ... ] }` (1 to 25 posts, up to 64000 bytes). Not a browser route: no CORS header is ever sent, and a browser origin does not replace the secret. The secret is compared through a hash, a secret shorter than 32 characters keeps the route off, and the secret opens `/announce` only.
- Answer: `{ ok, accepted, skipped, results: [{ key, status: "accepted" | "skipped", reason? , field? }] }`, one entry for each post in the same order. The answer holds the key and one reason word only, never a title, a description or an address.

**The checks, in this order (all of PLAN 31.5 that need no network)**
1. Shape: every field has a type and a length limit (key is the permalink form, title up to 200, description up to 400, up to 20 tags, `pushTitle` up to 70, `pushBody` up to 120, and so on). A wrong field gives `bad_post` and the answer names the field.
2. `duplicate`: the same key twice in one call.
3. `push_off` (editor set `push: off`), `sponsored`, `not_published` (a status other than published), `noindex`.
4. `not_yet` (dated more than 5 minutes ahead) and `too_old` (older than 120 minutes, so a re-save or an XML import cannot flood readers).
5. `bad_url` (not https, or not an address of this site) and `emoji` (title, description, `pushTitle` or `pushBody`; PLAN 29.3), also `too_big`.
6. `already_announced`: the key is already in `push_posts`. A second call at the same moment cannot record it twice (INSERT OR IGNORE, and the number of changed rows is checked).
7. Import guard: when more than 3 posts pass all of the above in one call, only the 2 with the highest importance (breaking 25, featured 12, trending 10) go on, plus every post with `push: force`. The rest are `import_guard`. Ties go to the newer post, then to the key.
- `force` never skips steps 3 to 5: a draft, sponsored, noindex, old or emoji post is refused even with `force` (PLAN 31.5: force only skips the importance part).

**Not in this part**: the live check (the Worker opening the URL and reading status and robots; part 6b), finding the readers, scoring, delivery rules, the queue, the sender (parts 6b to 7), the `push.yml` job (part 7), the `push`, `pushTitle` and `pushBody` fields in the post editor (part 7), and the clean-up of old `push_posts` rows (part 7).

**Added**
- `workers/push/announce.js`: `cleanPost`, `onSite`, `checkPost`, `importGuard`, `decide`, `secretMatches`, the SQL and `flagsOf`. Pure functions and SQL text; no network, no clock, no console.
- `site/tests/unit/push-announce.test.ts` (42 tests): the shape rules field by field, the address rule, every check and its order, `force`, the age edges (exactly 120 minutes passes), the import guard (3 pass, 4 or more keep 2, force kept, ties), the whole decision (order, duplicates, a known key does not count for the guard, every reason is in the list), the secret, the stored row (all columns, flags JSON), and the Worker on real SQLite: 503 without a secret or with a short one, 401, no CORS header, 405, 400, 413, 500 on a database failure with nothing written, the race of two calls, and the other routes unchanged.

**Changed**
- `workers/push/index.js`: the route `/announce` (`announce`) before the browser checks; header comment.
- `workers/push/wrangler.toml`: comment on the secret `ANNOUNCE_SECRET` (never written in the file).
- `workers/push/schema.sql`: comment only (the flags column also holds `pushTitle`, `pushBody`, `imageWidth`, `wordCount`). No table changes, so no migration.
- `site/package.json`, `site/package-lock.json`: version 0.64.0.
- `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.4 note), `site/README.md` (new section).

**Removed**: nothing.

## 0.63.0 (2026-11-16): Phase 9 (part 5c-6), the article bell button

The last small piece of part 5c, so part 5 (the reader side of push) is complete. At the end of every article a reader sees a button with a bell, "Get alerts for this topic". It opens `/notifications/` with the story's category and focus keyword already filled in. Nothing is saved or turned on until the reader presses the button on that page (PLAN 31.1). The button shows only when `config/push.json` is filled; it ships empty, so readers see no change.

**What it does and does not do**
- It is a plain link with the two values in the address: `/notifications/?cat=tech&kw=iPhone+17`. No script runs in the article and nothing is sent anywhere.
- On the page, the category box is ticked only if the site has that category. The keyword is added to the "Keywords to follow" box only if it is not already there (any letter case), is not in the mute box, and the list has room (10).
- A reader who already has notifications on keeps all saved choices; the topic is only added to the form and the page says it is not saved until Save. A new reader sees the topic filled in and the page says nothing is turned on until the button.
- A topic that is already followed changes nothing and the normal message stays.
- A bad or made-up address cannot do harm: a category must be a clean id (lower case letters, digits, hyphens), a keyword must pass the same limits as the Worker (English letters, digits, spaces, hyphens and apostrophes, 40 characters, 4 words). Anything else is ignored.
- Blocked, unsupported, iPhone-in-a-tab, off, or a failed load of the saved choices: nothing is filled in and the usual message stays.
- The link has `rel="nofollow"`, is left out of search (`data-pagefind-ignore`) and out of print.

**Added**
- `site/src/components/AlertsLink.astro`: the button (inline SVG bell, no emoji, no script, nothing while push is off).
- `site/tests/unit/notifications-topic.test.ts` (28 tests): the link builder, the address reader, the form filler (duplicate, mute, limit, unknown category, missing boxes), the page in every state (new reader, reader who is on, nothing saved before the button, Save sends the topic, bad links, blocked, failed load), the limits compared with the Worker's `cleanKeyword`, and the template checks.

**Changed**
- `site/src/lib/notifications-page.js`: `topicHref`, `readTopic`, `applyTopic`, `MAX_KEYWORD_LENGTH`, `MAX_KEYWORD_WORDS`, two new sentences in `MESSAGES` (`topicNew`, `topicOn`), and the call inside `initNotificationsPage`; header comment.
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`: the import and `<AlertsLink category focus />` after the tags.
- `site/src/pages/notifications.astro`: header comment only.
- `site/src/styles/global.css`: `.alerts-link` and its print rule.
- `site/package.json` and `site/package-lock.json`: version 0.63.0.
- `CSS.md` (icon list), `CODING_PLAN.md`, `INCOMPLETE.md`, `NEWS_WEBSITE_PLAN.md` (31.1 note), `site/README.md` (new section).

**Removed**: nothing.

**Checked**: a temporary build with one sample post and a filled `push.json` showed the button with the bell and the right link; with the file empty the article has no button. The sample post and config were not kept.

## 0.62.0 (2026-11-16): Phase 9 (part 5c-5), the test notification

The fifth small piece of part 5c. A reader who has notifications on can press "Send me a test notification" on `/notifications/`. The push Worker sends one fixed message to that reader's own browser, so the reader can see that everything works. The button shows only while notifications are on in this browser and only when `config/push.json` is filled; it ships empty, so readers see no change. The article bell button, planned with this part, is moved to 5c-6.

**What the test does and does not do**
- It sends one fixed message (title "Test notification", a fixed sentence, a link to `/notifications/`). Nothing from the request, the reader's keywords or the posts goes into it.
- One test a minute for each reader. The slot is taken with one SQL statement, so two taps at the same moment send one message.
- It never uses the daily limit: `sent_today`, `last_sent`, `failures` and the duplicate guard are not touched. A paused reader can still test.
- It needs the sender keys: the variable `VAPID_PUBLIC_KEY` and the secrets `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Without them the Worker answers 503 and sends nothing, and the reader's minute is not used up.
- The push service says the browser is gone (404 or 410) or the stored browser keys cannot be used: the reader is removed (as everywhere else) and the page asks the reader to turn notifications on again. A busy push service (429, 5xx, no connection) is a 502 and the reader stays. A key problem of ours (401, 403, 400, 413) shows one general sentence and no detail.
- The push address, the keys and the message text are never in an answer.

**Added**
- `site/tests/unit/push-test-send.test.ts` (24 tests, the real Worker on real SQLite with a fake push service): the fixed message and its limits, the encrypted request and its headers, no address in any answer, the one-minute rule with a mocked clock, two taps at once, one minute for each reader, the counters stay as they were, a paused reader, no keys (503 and the minute is kept), a wrong contact address or a key that does not match, who is asking (no id, wrong token, unknown reader), site origin and method, 404 and 410 and unusable keys remove the reader, 429 and 5xx and network errors give 502, 401 and 403 and 400 and 413 give a general 503, a database failure sends nothing, extra fields in the request are ignored, the old routes still work, the schema column.
- `site/tests/unit/notifications-test-button.test.ts` (26 tests, jsdom): `sendTest` of the client (the saved id and token, off, denied, not subscribed, busy, resubscribe for 401, 403, 404 and 410, unavailable, network, never throws) and the page (button and note shown only while on, one click one call, "sending" and locked buttons, a second tap while sending, the Worker sentence, back to "turn on" when the browser is unknown, denied, a throwing client, no save or turn on or off, an older template without the button, no emoji in the sentences, the template).

**Changed**
- `workers/push/index.js`: the route `POST /test` (`sendTest`), the imports of `sendPush`, `loadVapid`, `cleanSubject` and `buildPayload`; the header comment.
- `workers/push/prefs.js`: `TEST_GAP_MS`, `TEST_TTL_SEC`, `TEST_TITLE`, `TEST_BODY`, `CLAIM_TEST_SQL`, `testPost`.
- `workers/push/schema.sql`: the column `last_test` in `push_subs`. The Worker is not deployed yet, so nothing needs a change in a live database. A database made with an older file needs one line: `ALTER TABLE push_subs ADD COLUMN last_test INTEGER;`.
- `workers/push/wrangler.toml`: a comment that `POST /test` needs the sender keys.
- `site/src/lib/push-client.js`: `sendTest`.
- `site/src/lib/notifications-page.js`: the button, the two messages (`testSending`, `testSent`), the click handler; the button joins the locked buttons while a call runs.
- `site/src/pages/notifications.astro`: the button "Send me a test notification" and the note under the buttons.
- `site/package.json`, `site/package-lock.json` (version 0.62.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P45, P46, P47, P48), `INCOMPLETE.md`, `site/README.md` (heading and the push endpoints section), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

## 0.61.0 (2026-11-16): Phase 9 (part 5c-4), authors to follow

The fourth small piece of part 5c. The `/notifications/` page can now show an "Authors" block with one tick box per author. It appears only when the site has two or more authors with published stories, and only when `config/push.json` is filled. Today the site has one author, so readers see no change at all. The test notification, first planned for this part, is moved to 5c-5 because it needs a new Worker endpoint.

**Added**
- `site/tests/unit/notifications-authors.test.ts` (12 tests, jsdom, a fake push client): the page rule for author ids equals the Worker's (a test compares 12 sample ids and the limit), reading and filling the ticks, an empty list when the reader removes all, no `authors` field when the block is absent, turn on and save send the authors, an author alone is not a choice, the template shows the block only from two authors.

**Changed**
- `site/src/lib/notifications-page.js`: `MIN_AUTHORS`, `MAX_AUTHORS`, `isAuthorSlug`; `readForm` and `fillForm` handle `authors` (only when the block exists).
- `site/src/pages/notifications.astro`: the "Authors" fieldset, built from the published posts and the author names.
- `site/package.json`, `site/package-lock.json` (version 0.61.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P43, P44), `INCOMPLETE.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

## 0.60.0 (2026-11-16): Phase 9 (part 5c-3), digest and pause

The third small piece of part 5c. The `/notifications/` page now has a "Digest" block (no digest, morning, evening, or both, with a time for each) and a "Pause" block (not paused, 1 day, 1 week, until the reader turns notifications back on). The pause block shows only to a reader who already has notifications on. Both appear only when `config/push.json` is filled; it ships empty, so readers see no change. Do not fill `push.json` yet: nothing can send until parts 6 and 7, and digests are built in part 9.

**Added**
- `site/tests/unit/notifications-digest-pause.test.ts` (19 tests, jsdom, a fake push client): the page lists equal the Worker's (digest modes, hour ranges, defaults, pause words), the digest check, reading and filling the digest, the hour lists are greyed when unused, a page without the boxes sends nothing, the pause is read, shown ("until I turn it on", "Paused until ...") and kept, a second Save does not send the pause again, the pause block is hidden for a new reader, turn on sends no pause, a refusal keeps what the reader chose.

**Changed**
- `site/src/lib/notifications-page.js`: `DIGEST_MODES`, `MORNING_HOURS`, `EVENING_HOURS`, `DIGEST_DEFAULT`, `PAUSE_CHOICES`, `hourLabel`, `formatUntil`, `digestProblem`, `syncDigest`, `readPause`, `fillPause`; `readForm` and `fillForm` handle `digest` (only when the boxes exist); Save sends `pause` only when the reader picked one; two new messages.
- `site/src/pages/notifications.astro`: the "Digest" and "Pause" fieldsets.
- `site/src/styles/global.css`: one rule for a greyed list.
- `site/package.json`, `site/package-lock.json` (version 0.60.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P40, P41, P42), `INCOMPLETE.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

## 0.59.0 (2026-11-16): Phase 9 (part 5c-2), quiet hours

The second small piece of part 5c. The `/notifications/` page now has a "Quiet hours" block: a checkbox to switch quiet hours on or off, the two times (From, Until) and "Let breaking news through during quiet hours". It appears only when `config/push.json` is filled; it ships empty, so readers see no change. Do not fill `push.json` yet: nothing can send until parts 6 and 7.

**Added**
- `site/tests/unit/notifications-quiet.test.ts` (17 tests, jsdom, a fake push client): the checks (same time twice, empty or wrong time), the page default equals the Worker default, reading and filling the boxes, off is `null`, the times are greyed while off, a page without the boxes sends nothing, turn on and save send the quiet hours, a refusal by the Worker shows its sentence and keeps the times.
- Styles for the time boxes (`.notify-times`, `.notify input[type=time]`) in `site/src/styles/global.css`.

**Changed**
- `site/src/lib/notifications-page.js`: `quietProblem`, `syncQuiet`, `QUIET_DEFAULT`; `readForm` and `fillForm` handle `quiet` and `breakingInQuiet` (only when the boxes exist); two new messages; turn on and save check the quiet hours before sending.
- `site/src/pages/notifications.astro`: the "Quiet hours" fieldset.
- `site/package.json`, `site/package-lock.json` (version 0.59.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P38, P39), `INCOMPLETE.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

## 0.58.0 (2026-11-16): Phase 9 (part 5c-1), keywords to follow and mute

The first small piece of part 5c. The `/notifications/` page now has two boxes: "Keywords to follow" (stories that mention these words, even from other categories) and "Keywords to mute". Both appear only when `config/push.json` is filled; it ships empty, so readers see no change. Do not fill `push.json` yet: nothing can send until parts 6 and 7.

**Added**
- `site/tests/unit/notifications-keywords.test.ts` (18 tests, jsdom, a fake push client): the text of a box to a list and back, the limit (equal to `MAX_TERMS` of the Worker), the same word in both boxes in any letter case, a keyword alone counts as a choice, turn on and save send both lists, a Worker refusal shows its sentence and keeps what was typed, no boxes means no keyword fields are sent.
- Styles for the text boxes (`.notify textarea`) in `site/src/styles/global.css`.

**Changed**
- `site/src/lib/notifications-page.js`: `parseKeywordText`, `keywordText`, `keywordProblem`, `MAX_KEYWORDS`; `readForm` and `fillForm` handle the two boxes (only when they exist); `hasChoice` accepts a keyword; new messages; turn on and save check the two lists before sending.
- `site/src/pages/notifications.astro`: the two fieldsets.
- `site/package.json`, `site/package-lock.json` (version 0.58.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P36, P37), `INCOMPLETE.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

## 0.57.0 (2026-11-16): Phase 9 (part 5b), the notifications page and the header bell

The second small piece of part 5. The page the soft prompt opens now exists. Both the page's controls and the bell link in the header appear only when `config/push.json` is filled; it ships empty, so readers see one plain sentence on the page (which nothing links to) and no bell. Do not fill `push.json` yet: nothing can send until parts 6 and 7.

**Added**
- `site/src/pages/notifications.astro`: a utility page (noindex, no ads, no beacon, not in any sitemap). It lists every category of the site (a category with no new stories lately is marked), "Breaking news from any category", the four alert levels (Breaking news only, Important stories, Balanced, Everything I follow), the daily limit (automatic, 1, 2, 4, 8), and the buttons "Turn on notifications", "Save" and "Unsubscribe and delete my data". iPhone and iPad readers see the Home Screen steps. With the file empty it shows one sentence and loads no script.
- `site/src/lib/notifications-page.js`: the page logic. It reads the real status first (off, unsupported, iPhone tab, blocked, new, subscribed), shows only the buttons that can work, fills the form from the Worker's saved choices, asks for at least one category or breaking news, shows the Worker's own sentence when it refuses a choice, never leaves the buttons locked after an error, and makes the unsubscribe button need a second press within 6 seconds. All calls go through `push-client.js`; the permission box opens only from the "Turn on" button.
- `site/tests/unit/notifications-page.test.ts` (22 tests, jsdom, a fake push client).
- Styles for the page in `site/src/styles/global.css`.

**Changed**
- `site/src/components/Header.astro`: the bell link to `/notifications/` (only when push is on). `site/src/layouts/Base.astro`: the page type `notifications`. `site/package.json`, `site/package-lock.json` (version 0.57.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P34, P35), `INCOMPLETE.md`, `CSS.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

**Checked**: `npm test` and `npm run build` passed. Two temporary builds: with `push.json` empty the page shows one sentence and the home page has no bell; with a made-up key and one temporary post the page shows the form with that post's category, the header has the bell, and the page script is built. The temporary post and key were removed afterwards.

## 0.56.0 (2026-11-16): Phase 9 (part 5a), the soft prompt card

The first small piece of part 5 (PLAN 31.2): the card at the end of an article that invites a reader to choose topics. It is added only when `config/push.json` is filled; it ships empty, so no page changes and nothing is shown to any reader. The `/notifications/` page the button opens is part 5b, so do not fill `push.json` yet.

**Added**
- `site/src/lib/push-prompt-client.js`: the browser rules. The card is shown only when all hold: article page, the browser can do push, the answer is not "denied", the browser is not already subscribed, not the very first visit, at least 2 different articles read (or 45 active seconds and more than half scrolled on a return visit), not dismissed in the last 14 days, not dismissed 3 times, and its place is still below the visible screen. Any problem (blocked storage, an error) means no card. It never asks for the permission and never calls the network. The reading list (up to 20 article addresses) and the dismiss count stay in `localStorage` (`pushPrompt`).
- `site/src/lib/push-prompt.ts`: `pushPromptPlan` (null while the config is empty or wrong).
- `site/src/components/PushPrompt.astro`: the card (a bell, one sentence, the buttons "Choose topics" and "Not now"), hidden at first, kept out of the search index. Used by the article template only.
- `bell` icon in `site/src/lib/svg-icons.ts` (listed in `CSS.md`); card styles in `site/src/styles/global.css`.
- `site/tests/unit/push-prompt.test.ts` (18 tests). A temporary build with a filled `push.json` and one temporary post showed the card and the script in the article and nothing on the home page; the temporary files were removed and `push.json` is empty again.

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro` (one line and one import), `site/package.json`, `site/package-lock.json` (version 0.56.0), `NEWS_WEBSITE_PLAN.md`, `CODING_PLAN.md`, `BUGS.md` (P32, P33), `INCOMPLETE.md`, `site/README.md` (heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

**Checked**: `npm test` (65 files, 957 tests, all passed) and `npm run build` passed.

## 0.55.0 (2026-11-16): Adsterra codes added, smartlink now opens from a picture click

The real Adsterra addresses are now in `site/config/ad-loader.json`. Compliance mode stays ON and `geoUrl` is still empty, so no ad loads yet (the build refuses ad scripts without the country check, BUGS A1). The smartlink changed: it is no longer a text line under the article.

**Changed**
- `site/config/ad-loader.json`: popunder, social bar, native banner (script and container id, after paragraph 3) and smartlink filled in.
- `site/src/lib/ads-client.js`: `putSmartlink` adds no text link any more. It listens for a click on a picture inside the article (`.content` or `.hero`) and opens the smartlink in a new tab one time only (remembered in the session as `adSmartDone`, and one time per page). Other clicks do nothing. Same rules as before: article pages only, India off, not when the post hides ads.
- `site/public/admin/js/ad-loader-config.js`, `site/public/admin/js/app.js`: the help text for the smartlink.
- Tests: `ads-client.test.ts` (smartlink block rewritten, 7 tests), `consent.test.ts`, `ad-loader-config.test.ts`, `admin-ad-loader.test.ts` (text and order changes).
- `site/package.json`, `site/package-lock.json` (version 0.55.0), `INCOMPLETE.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

**Checked**: `npm test` (64 files, 939 tests, all passed) and `npm run build` passed.

**To switch ads on (owner)**: deploy `workers/geo`, put its address in `geoUrl`, then set `complianceMode` to false (Ad loader screen or the file).

## 0.54.0 (2026-11-15): Phase 9 (part 4), the service worker and the client script

The fourth small part of the smart push notifications (PLAN 31). The browser side now exists: the worker that shows a notification and reacts to a tap, and the script the page will call to subscribe, read and save choices and unsubscribe. Nothing loads either of them yet (the soft prompt and the `/notifications/` page are part 5) and `config/push.json` ships empty, so no reader sees any change and nothing is registered in any browser.

**Added**
- `site/public/push-sw.js`: the service worker (version marker `SW_VERSION`). It handles `push`, `notificationclick` and `notificationclose` and nothing else: no fetch handler, no cache, so it cannot change how the site loads (BUGS P16); `skipWaiting` on install and `claim` on activate so a new version takes over at once. It shows title, body, the 192 px icon, the badge, the optional image (https only), the tag (the same story replaces the earlier notification; `renotify` only together with a tag, because a browser throws an error for the other case) and the two buttons "Read now" and "Less like this". The text is cleaned and cut. A story address that is not on this site is never opened (the home page opens instead, BUGS P28). A push that is not a message of this Worker shows one plain notice, because a browser requires every push to show something (BUGS P29). A tap opens the story (or shows the tab that already has it), "Less like this" opens nothing. Open, close and less are reported to `POST <api>/feedback { sub, token, event, tag }` with an 8 second time out, and a failing report never stops the tap. That route is built in part 8; until then the Worker answers 404 and the answer is ignored on purpose.
- `site/src/lib/push-client.js`: `pushConfig` (off until both values are valid), `support`, `permission`, `enable` (the only place that opens the browser's permission box, called from the reader's tap), `getPrefs`, `savePrefs` (choices and the pause), `disable` ("Unsubscribe and delete my data": the Worker first, then this browser; nothing is cleared when the Worker cannot be reached), `status` and `idbStore`. The browser keeps only `{ api, sub, token, prefs, at }` in IndexedDB; the push endpoint address is sent once, in `/subscribe`, and is never stored, logged or shown (BUGS P13). A lost or old token (401, 403, 404) is fixed quietly: another tab's newer token is used if there is one, else the same browser subscription is sent again without a token and the last confirmed choices come back with the new token (BUGS P23); with no browser subscription the call returns `resubscribe` and never opens the permission box. A subscription made in a call that the Worker then refuses is removed again (BUGS P31). The time zone of the browser is added to the choices. Every function returns `{ ok, ... }` and never throws.
- `site/config/push.json`: `{ "endpoint": "", "vapidPublicKey": "" }` (ships empty = the feature is off).
- `site/public/badge-96.png` and `site/scripts/badge-lib.mjs`: the one-colour notification badge (white mark, the rest transparent, BUGS P30), made from `brand/source-icon.png` by comparing each pixel with the logo's own background colour. `npm run icons` now writes it too (`make-icons.mjs` calls the library). Only `badge-96.png` was made now; the other icons were not rewritten, so none of them changed.
- `site/tests/unit/push-sw.test.ts` (31 tests), `site/tests/unit/push-client.test.ts` (36 tests) and `site/tests/unit/helpers/fake-idb.ts` (a small in-memory IndexedDB for the tests). The client tests run against the real push Worker and a real SQLite database (Node 22.5 or newer; on Node 20 only the rules run), so the request and answer shapes are the real ones. The worker file is run in a made-up scope. I also broke the code on purpose in four places to be sure the tests fail when they should (keeping the pause in the saved choices, skipping the clean-up of a refused subscription, opening any address, `renotify` without a tag); each broke at least one test, then the code was restored.

**Changed**
- `site/public/_headers`: `/push-sw.js` is served with `Cache-Control: no-cache`, so a new version is seen at once.
- `site/scripts/make-icons.mjs` (writes `badge-96.png` too), `site/package.json` and `site/package-lock.json` (version 0.54.0), `NEWS_WEBSITE_PLAN.md` (31.8 and 31.13), `CODING_PLAN.md` (Phase 9 part 4 done), `BUGS.md` (P28 to P31), `INCOMPLETE.md` (phase 9 row, new "Open Items After v0.54.0"), `site/README.md` (new section, heading), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted.

**Checked**: `npm test` (64 files, 937 tests, 67 of them new, all passed on Node 22) and `npm run build` passed (the built site holds `push-sw.js` and `badge-96.png` and no page mentions either). The zip: 242 files before, 250 after (eight added, none removed); 284 entries before, 293 after (one new folder, `site/tests/unit/helpers`). **Not run**: a real browser, a real push service, a real Cloudflare Worker. The tests use a made-up browser, so the first real test of parts 1 to 5 together is on a phone after deploy.

## 0.53.0 (2026-11-15): Phase 9 (part 3), encryption, VAPID signing and the send function

The third small part of the smart push notifications (PLAN 31). The Worker can now seal one message for one browser (RFC 8291, `aes128gcm`), sign the request (VAPID, RFC 8292) and post it to a push service, and it tells the caller what happened (sent, gone, retry, rejected, bad subscription). Nothing calls the send function yet (the sender cron is part 7) and nothing is deployed, so no live page changed and no reader can receive anything.

**Added**
- `workers/push/webpush.js`: `encryptPayload` (ECDH P-256, two HKDF steps, AES-128-GCM, one record of 4096, a new one-time key and a new salt for every message, the stored browser key checked as a real point on the curve, plain text up to 3,993 bytes) and `sendPush` (headers `Authorization`, `Content-Encoding`, `Content-Type`, `TTL`, `Urgency` and an optional `Topic` that must be 1 to 32 URL-safe characters; `redirect: manual`; a 10 second time out; the answer body is cancelled and never read). The result is one of `sent` (2xx), `gone` (404, 410), `retry` (429 and 5xx with `retryAfter` capped at one hour, a network error, a time out), `rejected` (400, 401, 403 with `auth: true`, 413, a redirect, anything else) or `bad_sub` (keys or address that cannot be used). The result never holds the endpoint, a key or the text, and nothing is printed to the console (BUGS P13).
- `workers/push/vapid.js`: `generateVapidKeys`, `loadVapid` (checks the key pair by signing a test message and verifying it with the public key, so a private key that does not belong to the public key is found at once), `cleanSubject` (a `mailto:` address or an `https:` address only), `audienceOf`, `signToken` (ES256, claims in the order of the RFC example, 12 hour life, never more than 24) and `signedHeaders` (`vapid t=..., k=...`).
- `site/scripts/make-vapid.mjs` and the script `npm run vapid`: makes one key pair and prints it. Nothing is written to a file.
- `site/tests/unit/push-send.test.ts`: 43 tests. The encryption is checked against the real RFC 8291 example (the exact message bytes of section 5 and appendix A are produced, and that message opens with the receiver key of the RFC). Every other message is opened by a browser written with Node's own crypto, so the test does not use the code it checks. The VAPID token is verified with Node's crypto and the public key only. A fake push service checks the signature, opens the message and answers 201, 202, 404, 410, 429 (with and without `Retry-After`), 5xx, 400, 401, 403, 413, 3xx and odd statuses; network errors, a time out and a fetch that returns nothing are covered. A built payload goes all the way from `buildPayload` to an opened message.

**Changed**
- `workers/push/lib.js`: new constant `ENCRYPT_OVERHEAD` (103) and the size check of `buildPayload` now counts it. Before, the plain JSON was checked against 4,000 bytes, so a JSON between 3,897 and 3,999 bytes passed and became an encrypted body of up to 4,102 bytes, over the 4,096 octets a push service has to accept (BUGS P25). Real posts never come near this (title 70, body 120 characters), so no live result changes.
- `workers/push/wrangler.toml`: new variable `VAPID_PUBLIC_KEY` (empty = sending stays off) and comments for the two secrets `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. No secret is in the file.
- `site/public/admin/blog-xml-tool.html`: this file came in the zip `News_Website_Plan_v0_52_1_with_blog_xml_tool.zip` without a changelog entry and held an arrow character (U+2192) in 11 places and a check mark emoji (U+2705) in one, which the no-emoji test rejects (`npm test` failed on the 0.52.1 zip). The arrows are now the word "to" and the check mark is removed. Nothing else in the tool changed. The tool is a stand-alone page (`noindex`, not linked from the dashboard); its own code is not covered by a unit test yet.
- `NEWS_WEBSITE_PLAN.md` (31.13 file list), `CODING_PLAN.md` (Phase 9 part 3 done), `BUGS.md` (P25, P26, P27), `INCOMPLETE.md` (phase 9 row, new "Open Items After v0.53.0"), `site/README.md` (new section; the heading line now names the real version), `site/package.json` and `site/package-lock.json` (version 0.53.0), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Four files were added (`workers/push/webpush.js`, `workers/push/vapid.js`, `site/scripts/make-vapid.mjs`, `site/tests/unit/push-send.test.ts`); 280 entries in the zip before, 284 after (no new folder).

**Checked**: `npm test` (62 files, 870 tests, 43 of them new, all passed on Node 22) and `npm run build` passed. **Not run**: a real push service (Google, Mozilla, Apple), a real browser, a real Cloudflare Worker. The encryption is proven against the RFC example and against Node's crypto; the push services' own behaviour (for example how long they keep a message) is taken from the RFCs.

## 0.52.0 (2026-11-15): Phase 9 (part 2), push subscribe, preferences and unsubscribe endpoints

The first Worker of the smart push notifications (PLAN 31). A browser can now give its push subscription and its choices, read and change them, pause, and remove itself with all its data. Nothing calls these endpoints yet (the page and the service worker are parts 4 and 5) and nothing is sent (parts 3 to 7), so no live page changed and no reader can see anything. The Worker is not deployed.

**Added**
- `workers/push/prefs.js`: the rules of this part, all pure. `cleanSubscription` (https address of a push service only: no login part, no number address, no localhost, no odd port; the browser key must be 65 bytes starting with 0x04 and the auth secret 16 bytes), `endpointHash` (32 hex characters, the short `sub` id) and `tokenHash`, `newToken` (32 random bytes, 43 characters), `safeEqual`, `countryOf` and `needsConsent`, `defaultPrefs`, `cleanPrefs` (checks every choice of PLAN 31.1, keeps fields that are not sent, refuses a wrong value with a plain message and the field name, repairs nothing silently), `termRows`, `prefsFromRows`, `publicView`, `pauseState` (none, day, week, until_on), `insertTermStatements` (40 rows per statement, under the 100 value limit of D1), `parseBody` and every SQL text.
- `workers/push/index.js`: `POST /subscribe`, `POST /preferences` (read when only `sub` and `token` are sent, change when `prefs` or `pause` is sent), `POST /unsubscribe`. Only `SITE_ORIGIN` may call (others get 403 and no CORS header); no database gives 503; body limit 8,000 characters; optional `RATE_LIMITER`; at most 200 new subscribers an hour in total (429); every save is one `batch`, so it is all or nothing; no `console` call anywhere, so an endpoint address cannot reach a log (BUGS P13). The answer never contains the endpoint, the keys or the token hash.
- `workers/push/wrangler.toml`: name `news-push`, `SITE_ORIGIN`, `CONSENT_COUNTRIES` (same list as the geo Worker), the D1 binding, an optional rate limit block. Placeholders only, no secret.
- `site/tests/unit/push-endpoints.test.ts`: 57 tests. The rule tests run everywhere. The database tests run the real `schema.sql` and the real SQL of this part on an in-memory SQLite database (`node:sqlite`, Node 22.5 or newer; they are skipped by themselves on older Node): one row for one browser, token kept or replaced, counters and learned weights kept, the 200 an hour limit, all or nothing saves with a forced failure, read back as written, patch saves, pause modes, a choice never removed by a save, unsubscribe removing every table (queue, held, sent, terms, reader) and leaving other readers alone, nothing printed to the console.

**Changed**
- `workers/push/schema.sql`: only a comment. It now lists two more `push_terms` kinds, `kwtext` and `mutetext`: the keyword or muted phrase as the reader wrote it. The matching form (`kw`, `mute`) is stemmed (for example "iphon"), so the preference page could not show it back. No table or column changed; running the file again is still safe. Audience search (part 6) never reads these two kinds.
- `NEWS_WEBSITE_PLAN.md` (31.13 file list), `CODING_PLAN.md` (Phase 9 part 2 done), `BUGS.md` (P23, P24), `INCOMPLETE.md` (phase 9 row, new "Open Items After v0.52.0"), `site/README.md` (new section; the heading line said v0.45.0 and now names the real version), `site/package.json` and `site/package-lock.json` (version 0.52.0), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Four files were added; 275 entries in the zip before, 279 after (no new folder).

**Checked**: `npm test` (61 files, 827 tests, 57 of them new, all passed on Node 22) and `npm run build` passed. **Not run**: a real Cloudflare Worker or D1 database, a real browser subscription, a real push service. The SQL was run on SQLite, which D1 is built on, but not on D1 itself.

## 0.51.0 (2026-11-15): Phase 4 (part 14), same-title match and lifetime redirects from the old Blogger blog

Posts that have the exact same title on the old blog (`shivam-das-news-usa.blogspot.com`) and on this site are paired, and the pair is kept for life. The new site answers a real 301 for the old Blogger-style address; for the Blogger blog itself a theme script is generated (Blogger cannot send a 301, see PLAN 32.1). Nothing is switched on until `scripts/title-match.mjs` is run and its result committed: `config/title-redirects.json` ships as an empty list, so no live address changes.

**Added**
- `site/src/lib/title-match.js`: `decodeEntities` (one pass), `strictKey` (entities, Unicode NFC, invisible and non-breaking spaces, repeated spaces; case and punctuation are kept), `looseKey` (reports only, never makes a redirect), `oldPathOf` (the old blog's own addresses only, any country form of the host, query dropped), `matchTitles` (one old and one new post per title; ambiguous, near-match and one-sided lists), `mergeLifetime` (append only: never removes, follows the same post to its new address, reports a conflict instead of repointing), `checkEntries` (target must be a path on this site), `toRedirectEntries`, `bloggerSnippet` (fixed origin, `<` escaped).
- `site/scripts/title-match.mjs`: reads the whole Blogger feed (posts and pages; stops if the count differs from the feed total) and `https://<site>/title-index.json`, writes `config/title-redirects.json` and `blogger/redirect-snippet.html`. Stops and writes nothing when either list is empty, a fetch fails or an entry is unsafe. `--dry` prints only; `--old` and `--new` read local files.
- `site/src/pages/title-index.json.ts`: live posts and pages as title, address and earlier addresses. Real data only.
- `site/config/title-redirects.json`: the lifetime list, starts as `[]`.
- `site/tests/unit/title-match.test.ts`: 21 tests (keys, entities, Unicode, near matches, ambiguous titles, one-sided posts, host forms and lookalike hosts, lifetime merge, conflict, move with the post, unsafe targets, the snippet run in a fake page).
- `.github/workflows/title-match.yml`: daily run that commits a change (same concurrency group as other writers, BUGS B1).

**Changed**
- `site/src/pages/redirects-map.json.ts`: reads `config/title-redirects.json` after the post lists and the hand-made list, so chain collapse, loop guard, live-target check and the 2000 line limit apply to it too.
- `site/public/_headers`: `noindex` and a 5 minute cache for `/title-index.json`.
- `NEWS_WEBSITE_PLAN.md` (Section 32), `LOGICS.md` (section 20), `BUGS.md` (group T), `CODING_PLAN.md` (Phase 4 part 14), `INCOMPLETE.md` (phase 4 row, new "Open Items After v0.51.0"), `site/README.md`, `site/package.json` and `site/package-lock.json` (version 0.51.0), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Six files were added; 269 entries in the zip before, 275 after (no new folder).

**Checked**: `npm test` (60 files, 770 tests, 21 of them new) and `npm run build` passed. A build with one temporary post wrote the 301 line for its old Blogger address, dropped an entry whose target was not live and kept that entry in the list; the temporary post was removed. **Not run**: the real Blogger feed (the build machine cannot reach `blogspot.com`; the script was run on files shaped like the feed), a real Blogger theme, a real Cloudflare deploy.

## 0.50.0 (2026-11-15): Phase 9 (part 1), the push notification rules and database file

The first code of the smart push notifications (PLAN 31). Pure rules and a database file only: no Worker, no endpoint, no page. No live page changed and no reader can see or receive anything yet.

**Added**
- `workers/push/lib.js`: every constant of LOGICS 19 in one place and the functions that use them.
  - Keywords: `tokens`, `stem`, `cleanKeyword` (the page and the Worker use the same one: English letters, digits, space, hyphen and apostrophe only; at most 4 words and 40 characters; short words only as capital-letter forms such as UN and EU; a number only next to a word; common words such as "news" or "india" alone are refused), `keywordTokens`, `keywordIndexTerms`, `postIndexTokens`.
  - Matching and score: `postFields`, `phraseIn`, `keywordHit` (1, 0.9, 0.6, 0.5, 0.35), `muteHit`, `importance`, `scoreSubscriber` (mute block, the no-invented-interests gate, explicit choices up to 60, reading habit up to 8, learned weight plus or minus 10, importance, freshness up to 7, fatigue, level lines 65, 48 and 30, Breaking only).
  - Delivery: `normalizeLevel`, `normalizeLimit` (1, 2, 4, 8), `dailyCap` (2 extra for breaking, 1 extra for a score of 90 or more), `isEligible`, `isValidZone`, `localMinutes`, `localDay`, `inQuietHours` (across midnight and across a daylight saving change, by zone name), `threadKey`, `tagKey`, `deliveryDecision` (quiet hours, daily limit with a counter that belongs to one local day, 30 minute gap, digest hold, story update that replaces the old notification and uses no slot, time to live and urgency).
  - The notification: `hasEmoji`, `cutText`, `buildPayload` (title 70 and body 120 characters cut at a word boundary, link with `?pn=1`, story tag, image only when https and at least 1200 px wide, refuses emoji, a missing headline and a bad link, stays under 4,000 bytes even with 4-byte characters and very long links).
- `workers/push/schema.sql`: the tables `push_subs`, `push_terms`, `push_posts`, `push_queue`, `push_held`, `push_sent`, `push_audit` with their indexes. Safe to run twice. No IP address, name, email, user agent or location column. The same post key and the same browser address cannot be stored twice.
- `site/tests/unit/push-lib.test.ts`: 91 tests (stems, keyword rules, match strengths, the keyword index finding "launches" for "launch", every score part, mute blocking even breaking news, the gate, caps and extra slots, quiet hours around midnight and the clock changes of New York and London, thread keys, update replacing without a slot, emoji and size limits, the schema run on a real SQLite twice, the constants, no network or clock in the rules file). As a check of the tests, seven deliberate breaks of the code (mute off, gate off, update using a slot, a fixed time zone, emoji check off, size check off, stemming off) were each caught by at least one test.

**Changed**
- `LOGICS.md` (section 19, step 3d and the fatigue line, so the text matches the code, see below), `CODING_PLAN.md` (Phase 9 part 1 ticked; `sent_day` and the `kwtok` rows added to the table list), `INCOMPLETE.md` (phase 9 row, new "Open Items After v0.50.0"), `site/README.md`, `site/package.json` and `site/package-lock.json` (version 0.50.0), `CHANGELOG.md`.

**Decisions where the plan disagreed with itself (details in INCOMPLETE.md)**
- A breaking story for a reader who wants "breaking news from any category" passes the level line, because by the score formula alone it could never reach 48 or 65.
- Fatigue follows the LOGICS pseudocode (it can reach 30), not the summary line in PLAN 31.6 ("down to minus 20").

**Removed**: nothing. No file was deleted. Three files were added (`workers/push/lib.js`, `workers/push/schema.sql`, `site/tests/unit/push-lib.test.ts`); 265 entries in the zip before, 269 after (three files and the new folder `workers/push/`).

**Checked**: `npm test` and `npm run build` (numbers in the delivery message). **Not run**: a real Cloudflare D1, any Worker (none exists yet), any browser.

## 0.49.1 (2026-11-15): Plan only, smart push notifications (category, keyword and choice based)

Documents only. No code, no test and no live page changed. The push notification system is now designed in detail so it can be built in small parts later.

**Added (inside existing files)**
- `NEWS_WEBSITE_PLAN.md`: Section 31, Smart Push Notifications (what the reader chooses, when to ask, data kept and not kept, the pipeline, which posts may be pushed, matching and scoring summary, delivery rules, learning from the reader, the look of the notification, owner safety, free-plan capacity, the admin Push screen, files, done-when test). Roadmap row 9, launch checklist line, `push/` in the Worker list.
- `LOGICS.md`: Section 19, the full pseudocode: keyword cleaning and light stemming, keyword match strength, post checks and import guard, candidate search, scoring (explicit choices up to 60, reading habit, learned weight, importance, freshness, fatigue), thresholds by alert level, daily limits, quiet hours with zone names, story thread merge, digest, sending, feedback learning, clean-up, and the tests that must exist.
- `BUGS.md`: group P, push bugs P1 to P22 with cause, fix and test.
- `CODING_PLAN.md`: Phase 9 in 11 small parts, the planned push tables, `push.yml`.
- `INCOMPLETE.md`: four new decisions (own system or service, default levels, reading-habit default, free or paid plan), phase 9 status, open items after v0.49.1.
- `BETTER.md`: item 9 now points to the design.

**Changed**: `NEWS_WEBSITE_PLAN.md` point 1 of Section 19 (OneSignal idea replaced by the own system), `site/package.json` and `site/package-lock.json` (version 0.49.1), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted or added.

## 0.49.0 (2026-11-15): Phase 7 (part 7), the private inbox endpoints of the contact Worker

The back end of the admin inbox (PLAN 16: "Admin Chat Inbox: conversation list, unread count, mark"). Two private endpoints in `workers/contact/` let the dashboard read the messages and mark each one new, read or done. The inbox screen itself is the next part, so the dashboard and the live pages are unchanged.

**Added**
- `GET /messages?status=all|new|read|done&limit=1..100&before=<id>`: the newest messages first, 50 per page by default, with `next` (the id to send as `before` for the older page, or null) and `counts` (how many are new, read and done).
- `POST /messages/status` with `{ "id": number, "status": "new" | "read" | "done" }`: changes one message. A missing id answers 404.
- Both need a GitHub token of a user listed in `ALLOWED_USERS` (same rule as the analytics Worker). With the list empty nobody can read (503). A wrong or missing token gives 401, a user not on the list gives 403. The token is checked with GitHub and remembered for 60 seconds.
- Only the site in `SITE_ORIGIN` gets a CORS header, so a page of another site cannot read the answer.
- `workers/contact/lib.js`: `inboxPlan`, `LIST_SQL`, `COUNTS_SQL`, `UPDATE_SQL`, `listValues`, `inboxPage`, `inboxCounts`, `statusChange`, `allowedUsers`, `STATUSES`. The query is checked first and the SQL only uses question marks (no text is joined into SQL).
- `workers/contact/wrangler.toml`: `ALLOWED_USERS = ""` (empty on purpose).
- `site/tests/unit/contact-inbox.test.ts`: 29 tests (the query rules, the page cut, the counts, the status body, sign-in 401/403/503, CORS, the token memory, 404/405/413/500 answers, no delete, no IP).

**Changed**
- `workers/contact/index.js`: routes `/messages` and `/messages/status` to the new code. `/contact` (the public form endpoint) is untouched.
- `site/package.json` and `site/package-lock.json` (version 0.49.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (223 files before, 224 after).

**Checked**: see the numbers at the end of this entry in the delivery message: `npm test` and `npm run build`. **Not run**: a real Cloudflare Worker, a real GitHub token, a real D1 database.

## 0.48.0 (2026-11-15): Phase 7 (part 6), the contact form on the Contact page

The front end of the contact form (PLAN 16, BUGS N6). It talks to the Worker of v0.47.0. It is **off by default**: `config/contact.json` ships empty, so with it no page changes. When the owner sets the Worker address and the Turnstile Site Key, the Contact page shows the form.

**Added**
- `site/config/contact.json`: `endpoint` and `turnstileSiteKey`, both empty.
- `site/src/lib/contact.ts`: `contactPlan()`, the settings check. Both empty gives null (off). Only one set, an address that is not https, has a user name, has no dot in the host or does not end in `/contact`, or a Site Key of the wrong shape, stops the build with a plain message.
- `site/src/lib/contact-client.js`: the browser script (plain JavaScript, the build puts this very text into the page and the tests run it). It checks the obvious mistakes first, sends one JSON text, shows the Worker's message next to the right field, keeps the text on any failure, blocks a double send, asks Turnstile for a new check after every answer, uses no cookie and no browser storage.
- `site/src/components/ContactForm.astro`: the form (labels, 16 px inputs, hidden spam-trap field, Turnstile box, status line that is read aloud). Hidden until its script runs; a `noscript` line sends people to the email address. Loads the Turnstile script from Cloudflare on the Contact page only. No ad or analytics code.
- `site/tests/unit/contact-form.test.ts`: 26 tests (the settings check, the script run in jsdom against a real page, the message the script sends accepted by the Worker's rules, the template, the page wiring, no emoji).

**Changed**
- `site/src/pages/[year]/[month]/[day]/pages/[slug].astro`: shows the form on the page with the permalink `contact-us` only.
- `site/src/styles/global.css`: eight lines of rules for the form (`.cform`, `.cf-*`), tap targets 44 px, hidden when printing.
- `site/package.json` and `package-lock.json` (version 0.48.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Five files were added: 218 files before, 223 after.

**Checked**: `npm test` (57 test files, 629 tests, all passed; it was 56 files and 603 tests before) and `npm run build` ("Validation passed"). Also built in a throw-away copy with sample owner details: with the shipped config the Contact page has no form; with a sample address and key it has the form, the Turnstile script and the client call, and no other page has a form; a half-filled config stops the build with the message. The copy was not shipped. **Not run**: a real browser or phone, a real Turnstile widget, a real Cloudflare Worker.

## 0.47.0 (2026-11-15): Phase 7 (part 5), the contact Worker (back end of the contact form)

The back end for a contact form (PLAN 16, BUGS N6). It takes one message, checks it and stores it in a D1 table. The form on the Contact page, the admin inbox and the email notice are later parts, so nothing on the site calls it yet and the live pages are unchanged.

**Added**
- `workers/contact/lib.js`: the pure rules. Field checks with plain messages (name 1 to 100, email checked, subject up to 150, message 10 to 4000 characters, at most 2 links), a hidden spam-trap field, control characters removed, Turnstile check (`verifyTurnstile`, sends only the secret and the token), the SQL, and the limits (3 messages per email address and 40 in total per hour).
- `workers/contact/index.js`: the Worker, `POST /contact`. Only `SITE_ORIGIN` may send (CORS and a 403 for any other origin), size limit (413), Turnstile, optional rate limit binding, the two hour counts, one insert. A missing secret or database gives 503 and nothing is stored. A bot that fills the hidden field gets the same 200 answer and nothing is stored or checked. No IP address is stored.
- `workers/contact/schema.sql`: the table `contact_messages` (ts, name, email, subject, message, status) with two indexes. Safe to run again.
- `workers/contact/wrangler.toml`: the settings (`SITE_ORIGIN` placeholder, D1 binding, notes for the `TURNSTILE_SECRET` secret and the optional limiter). No secret value.
- `site/tests/unit/contact-worker.test.ts`: 36 tests (field rules, bot trap, link limit, Turnstile calls and failures, origin rules, 503 when not ready, size limits, rate limits by email and in total, the limiter, database errors, no IP in the code or the table, the config file).

**Changed**
- `site/package.json` and `package-lock.json` (version 0.47.0), `site/README.md` (new section "Contact Worker"), `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Five files were added: 213 files before, 218 after.

**Checked**: `npm test` (56 test files, 603 tests, all passed; it was 55 files and 567 tests before) and `npm run build` ("Validation passed"). The no-emoji test also scans the new Worker folder and passed. **Not run**: a real Cloudflare Worker, a real D1 database, a real Turnstile widget, a real browser.

## 0.46.0 (2026-11-15): Phase 7 (part 4), Advertise With Us and Affiliate Disclosure

`npm run pages` now makes twelve pages. New: Advertise With Us and Affiliate Disclosure. Same rules as before: made only from the owner's real details, drafts first, an existing page is never touched. Both pages say only what is true today: no price, no visitor number, no claim that the site already has affiliate links.

**Changed**
- `site/scripts/required-pages-lib.mjs`: two more page texts (`advertise-with-us`, `affiliate-disclosure`). The first gives the email, says ads appear in article pages only, that advertisers cannot see, choose or change an article, that sponsored articles are marked Sponsored and that we can refuse an advertisement. The second says that an affiliate link is marked near the link, that the reader pays no more, and that a fee does not decide what is written.
- `site/tests/unit/required-pages.test.ts`: from 29 to 33 tests (twelve slugs, counts changed from ten to twelve, four new tests: Advertise page facts, no invented price or visitor number, Affiliate page makes no false claim, both are drafts with a description of at most 160 characters).
- `site/package.json` and `package-lock.json` (version 0.46.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Added / Removed**: nothing. No file was added or deleted: 213 files before, 213 after.

**Checked**: `npm test` (55 test files, 567 tests, all passed; it was 563 before) and `npm run build` ("Validation passed"). Also run in a throw-away copy with sample owner details and `npm run pages -- --publish`: all twelve pages build, each has one H1, both new pages are in `sitemap-pages.xml`. The copy was not shipped. **Not run**: a real owner file, a real phone or browser.

## 0.45.0 (2026-11-15): Phase 7 (part 3), the HTML sitemap page

A page at `/sitemap/` for readers and for crawl depth (PLAN 16, "Sitemap (HTML)"). It lists the pages, the sections that are active today, the authors, the topics with enough posts and the newest stories grouped by month. It is built from real data only; an empty site shows an empty message.

**Added**
- `site/src/lib/html-sitemap.ts`: `buildHtmlSitemap()`, a pure function (sorting, thin topics left out, noindex stories left out, month groups in the site time zone, at most 500 stories with a count of what did not fit).
- `site/src/pages/sitemap.astro`: the page `/sitemap/`. `noindex,follow` (so it is not in the XML sitemaps, BUGS S6), page type `page`, one H1, `BreadcrumbList` and `WebPage` schema, no ad or analytics code.
- `site/tests/unit/html-sitemap.test.ts`: 12 tests (empty site, sorting, thin topic and empty section left out, month boundary at 00:30 IST, noindex story left out, the 500 cap, template is noindex with one H1 and no ad or analytics code, no emoji, not in the XML sitemaps, footer link).

**Changed**
- `site/src/components/Footer.astro`: the "Site pages" row is always shown and ends with a "Sitemap" link (it was hidden while there were no pages).
- `site/src/styles/global.css`: four small rules for the list (`.smap`, `.smap-box`), tap targets 44 px high.
- `site/package.json` and `package-lock.json` (version 0.45.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Three files were added: 210 files before, 213 after.

**Checked**: `npm test` and `npm run build` (see the counts in INCOMPLETE.md). Also built in a throw-away copy with three temporary posts and one page: the page lists them, November starts at 00:30 IST for a story posted at 19:00 UTC on 31 October, an inactive section is not listed, the footer links to it, `sitemap-pages.xml` does not list it, "Validation passed". The copy was not shipped. **Not run**: a real browser or phone.

## 0.44.0 (2026-11-15): Phase 7 (part 2), three more required pages

`npm run pages` now makes ten pages. New: Cookie Policy, Disclaimer, DMCA and Copyright Notices. Same rules as part 1: made only from the owner's real details, drafts first, an existing page is never touched.

**Changed**
- `site/scripts/required-pages-lib.mjs`: three more page texts (`cookie-policy`, `disclaimer`, `dmca`). The cookie text was written from the code: the site sets no cookie of its own; browser storage holds the colour and dark mode choice, the random session number (closed with the tab), the ad page count and the ad answer (the last two on article pages only). A test fails if any site script starts to use `document.cookie`.
- `site/tests/unit/required-pages.test.ts`: from 26 to 29 tests (ten slugs, cookie page facts, no `document.cookie` in the site scripts, DMCA and disclaimer content).
- `site/package.json` and `package-lock.json` (version 0.44.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Added / Removed**: nothing. No file was added or deleted: 210 files before, 210 after.

**Checked**: `npm test` and `npm run build` (see the counts in the answer). Also run in a throw-away copy with sample owner details and `npm run pages -- --publish`: all ten pages build, each has one H1, all are in `sitemap-pages.xml`, "Validation passed". The copy was not shipped. **Not run**: a real owner file, a real phone or browser.

## 0.43.1 (2026-11-15): X account address added

The owner gave the X address, so the "Follow us" row in the footer now shows.

**Changed**
- `site/config/site.json`: `sameAs` now holds `https://x.com/shivamdas_191a`. It feeds the footer row (with the X logo, `rel="me"`, opens in a new tab) and the `sameAs` line of the organization schema.
- `site/package.json` and `package-lock.json` (version 0.43.1), `INCOMPLETE.md` (the open item about the missing X address is closed), `CHANGELOG.md`.

**Added / Removed**: nothing. No file was added or deleted: 210 files before, 210 after.

**Checked**: `npm test` and `npm run build` (see the counts in the answer). The footer of the built home page was read: it holds the X link. **Not run**: a real phone or browser.

## 0.43.0 (2026-11-15): Phase 7 (part 1), the required pages generator

Makes the seven trust pages that Google News and AdSense look for (About Us, Contact Us, Editorial Policy, Corrections Policy, Ownership and Funding, Privacy Policy, Terms and Conditions) from the owner's real details. With any detail missing nothing is made (PLAN 25: no placeholder text). The pages are written as drafts first, so the owner reads them before they go live.

**Added**
- `site/config/publisher.json`: the owner details (`legalName`, `ownerName`, `email`, `address`, `country`, `foundedYear`, `fundingSummary`). Shipped empty on purpose.
- `site/scripts/required-pages-lib.mjs`: the checks (one line of plain text, no `<` or `>`, no emoji, a real email, a four digit year) and the text of the seven pages. Builds text only.
- `site/scripts/make-pages.mjs`: `npm run pages` writes `content/pages/<slug>.md` as drafts; `--publish` writes them as published; `--dry` shows the plan and writes nothing. A page whose permalink already exists is never touched (its date is part of its address).
- `site/tests/unit/required-pages.test.ts`: 26 tests (shipped file is empty and stops the build of pages, every wrong value, Bengali is accepted, the seven slugs, front matter fits the pages collection, drafts by default, owner details in the text, no placeholder or emoji or H1 in the text, About and Contact get their own schema types, the privacy page says only what the code does, existing pages are left alone, the script on a temporary folder).

**Changed**
- `site/package.json` (version 0.43.0, script `pages`) and `package-lock.json` (version 0.43.0), `site/README.md` (heading version fixed, new section), `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Four files were added: 206 files before, 210 after.

**Checked**: `npm test` and `npm run build` (see the counts in INCOMPLETE.md). Also run in a throw-away copy with sample owner details and `npm run pages -- --publish`: the seven pages are built under `/2026/11/15/pages/...`, each has exactly one H1, About has `AboutPage` and Contact has `ContactPage` schema, all seven are in `sitemap-pages.xml`, the footer links to all of them, no ad or analytics code is on them and "Validation passed". The copy was not shipped. **Not run**: a real owner file, a real phone or browser.

## 0.42.0 (2026-11-15): Footer with the owner's other projects and social accounts (SVG icons)

The footer now has two rows: "Our other projects" (two sites, each with its own SVG mark) and "Follow us" (social accounts, X with the X logo). Every icon is an inline SVG (PLAN 29.3).

**Added**
- `site/config/footer.json`: the project list. Now holds Physically Near Help Me (https://www.shivam-das-2.online/, mark H) and Shivam Das E-commerce (https://www.shivam-das-3.online/, mark S). Add or remove a project here.
- `site/src/lib/footer.ts`: `projectLinks` (checks name, https address, icon name, repeated address, at most 8) and `socialLinks` (reads `sameAs` from `config/site.json`; x.com and twitter.com get the X icon, any other site is shown by its host name). A bad value stops the build with a plain message.
- `site/tests/unit/footer.test.ts`: 9 tests (shipped projects, empty lists, bad entries, X in both host spellings, repeats, icons have no fixed colour, template uses `Icon` and `noopener`, no ad or analytics code in the footer).
- Three drawings in `site/src/lib/svg-icons.ts`: `x` (the X logo) and `mark-h`, `mark-s` (the owner's two logos, traced from the PNG files into vector paths; the colours are CSS classes `mk-*` in `global.css`, so the drawings hold no fixed colour).

**Changed**
- `site/src/components/Footer.astro` (two new rows; links open in a new tab with `rel="noopener"`, the X link also `rel="me"`; each link has a text or `aria-label` for screen readers; tap target at least 44 px).
- `site/src/styles/global.css` (`.foot-row` and the `mk-*` colours), `CSS.md` (icon list), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`, `site/package.json` and `package-lock.json` (version 0.42.0).

**Removed**: nothing. No file was deleted. Three files were added: 203 files before, 206 after.

**Checked**: `npm test` (53 files, 522 tests, all passed) and `npm run build` (passed, "Validation passed"). Also built in a throw-away copy with a temporary post and a test X address: both rows and all three SVGs appear in the footer of the home page, an article and the 404 page. The copy was not shipped. **Not run**: a real phone or browser (the traced marks were checked as a rendered picture against the two PNG logos).

**Open**: the X account address is not in the project yet, so the "Follow us" row is not shown. Put it in `site/config/site.json`, `sameAs` (for example `["https://x.com/yourname"]`). It also feeds the schema.

## 0.41.0 (2026-11-15): Phase 6 (part 9), the "Trending now" block on the site

The block that shows the best articles of the last 24 hours (LOGICS 6), on the home page and on article pages. It reads the numbers from the analytics Worker (`GET /trending`, v0.39.0). It stays hidden until the Worker returns real articles, and it is not built at all while `config/analytics.json` has an empty endpoint (the shipped default). Nothing changes for readers until the owner sets the endpoint.

**Added**
- `site/src/lib/trending.ts`: `trendingPlan` (the `/trending?limit=5` address made from the `/collect` address, with the same checks as the beacon; `null` when analytics is off) and `trendingTitles` (address to title for the newest 2000 articles).
- `site/src/lib/trending-client.js`: the browser script. Asks the Worker, reads the title list, writes up to 5 links as plain text (never HTML), leaves out the article being read, accepts only real article addresses, shows the block only when at least one real title exists, and fails silently (no cookie, nothing sent about the reader).
- `site/src/components/Trending.astro`: the hidden block (`<section data-trending hidden>`) and the script. Renders nothing with an empty endpoint.
- `site/src/pages/trending-titles.json.ts`: the public title list (`{}` while analytics is off). The Worker knows addresses only, so titles come from here; it is fetched only when the Worker returned something.
- `site/tests/unit/trending.test.ts`: 17 tests (settings, title list, the script in jsdom: other pages, empty answer, failed calls, missing titles, own article left out, HTML in a title stays text, bad addresses, the limit of 5, the real Worker answer; where the block is used; hidden by default; titles file noindex; shipped config is off).

**Changed**
- `site/src/pages/index.astro` (block after Latest news) and `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro` (block after Related stories).
- `site/src/styles/global.css` (`.trending`, `.trend-list`, hidden rule, hidden in print), `site/public/_headers` (`/trending-titles.json`: noindex, 5 minutes cache).
- `site/package.json` and `package-lock.json` (version 0.41.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Five files were added: 198 files before, 203 after.

**Checked**: `npm test` (52 files, 513 tests, all passed) and `npm run build` (passed, "Validation passed"). Also built in a throw-away copy with one temporary post and a test endpoint: the block and the script appear on the home page and the article page only (not on 404, category, search), the title list holds the post, and with the endpoint empty no block, no script and an empty list. The copy was not shipped. **Not run**: a real Worker with real visits (the answer was tested with the Worker's own `trendingList` output), a real browser or phone.

## 0.40.0 (2026-11-15): No emojis, SVG icons only (hard rule, PLAN 29.3)

New hard rule: the site never shows an emoji, and every icon is an inline SVG. Every place that used a letter or symbol as a picture now uses an SVG, and the build and the tests stop any new one.

**Found and replaced**
- Site header: search, dark mode and menu buttons used text symbols; now the SVG icons `search`, `contrast` and `menu-dots`.
- Pager (`Older` and `Newer`): text arrows; now the SVG icons `arrow-right` and `arrow-left`.
- Dashboard (`public/admin/js/app.js`): arrows in the Redirects and Links rows, and the warning mark in the import preview; now SVG (`icon()` in `ui.js`).
- Design preview (`theme/theme-preview.html`): the dark mode and menu buttons; now the same SVG icons.
- A check mark in the sample text of one unit test; replaced by Bengali sample text.

**Added**
- `site/src/lib/svg-icons.ts`: the one list of icons (`search`, `contrast`, `menu-dots`, `arrow-left`, `arrow-right`, `alert`), 24 x 24, `currentColor`.
- `site/src/components/Icon.astro`: the `Icon` component; an unknown name stops the build.
- `site/scripts/no-emoji-lib.mjs`: the emoji finder (also finds symbols written as HTML entities; plain signs such as the copyright sign, quotes, dashes, the rupee sign and every script, Bengali joiners included, are allowed).
- `site/tests/unit/no-emoji.test.ts`: 10 tests (the finder, no emoji or icon symbol in templates, scripts, dashboard, design preview, workers and workflows, no emoji in content, config and the plan files, every used `Icon` name exists, icons are plain drawings, dashboard copies equal the site drawings, the dashboard `icon()` in jsdom).

**Changed**
- `site/scripts/validate-html.mjs`: the build now fails on any emoji in a built page and names the file and the code point.
- `site/src/components/Header.astro`, `site/src/components/Pager.astro`, `site/src/styles/global.css` (`.icon`, `.btn.ico`), `site/public/admin/js/ui.js`, `site/public/admin/js/app.js`, `site/public/admin/admin.css`, `theme/theme-preview.html`, `site/tests/unit/admin-lib.test.ts`.
- The rule is written in `NEWS_WEBSITE_PLAN.md` (new section 29.3), `CSS.md` (new section 13), `HTML.md`, `POLISH.md`, `BUGS.md` (H7, H8), `LOGICS.md` (section 18), `CODING_PLAN.md`, `VERSIONING.md` (rule 8), `INCOMPLETE.md`, `site/README.md`.
- `site/package.json` and `package-lock.json` (version 0.40.0), `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Four files were added: 194 files before, 198 after.

**Checked**: `npm test` (51 files, 496 tests, all passed) and `npm run build` (passed, "Validation passed"). The gate was also tried on purpose: an emoji and a symbol code placed in a built page made the build fail with the file name, and an arrow placed in a template made the test fail; both were removed again. **Not run**: a real browser or phone (the icons were checked in the built HTML and in jsdom only), a built page with pagination (the site has too few posts for a second page).

## 0.39.0 (2026-11-15): Phase 6 (part 8), Trending numbers from the analytics Worker

`GET /trending` on the analytics Worker gives the best articles of the last 24 hours, ranked by the plan's Trending score (LOGICS 6). The block on the site that shows them is the next part. Nothing changes for readers.

**Added**
- `workers/analytics/lib.js`: `trendingScore` (LOGICS 6: `(views_24h + 3 * views_1h) * (0.5 + readTimeFactor) / (1 + ageHours / 24)`), `articleDay` (the date in an article address, null for non-articles and dates that do not exist), `trendingPlan` (one fixed SQL text, numbers only in the values), `trendingLimit` (1 to 10, default 5), `trendingList` (only articles with at least 3 views in 24 hours, best first, ties by address) and the constants `TRENDING_MIN_VIEWS`, `TRENDING_DEFAULT`, `TRENDING_MAX`.
- `workers/analytics/index.js`: `GET /trending?limit=5`. Public, but it answers only article addresses and scores. CORS only for `SITE_ORIGIN`. `Cache-Control: public, max-age=60`. No database: 503. Other method: 405. A database error is a plain 500 with no details.
- `site/tests/unit/analytics-trending.test.ts`: 13 tests (the formula with exact numbers, read factor cap, bad numbers, article dates, filters, order, limit, the fixed SQL, and the endpoint on a real SQLite database: 24 hour window, non-articles left out, CORS and cache headers, empty database, 503, 405, 204 preflight, 500 without details).

**Changed**
- `workers/analytics/index.js` (header note and route), `site/package.json` and `package-lock.json` (version 0.39.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`tests/unit/analytics-trending.test.ts`): 193 files before, 194 after.

**Checked**: `npm test` and `npm run build` passed (see the counts in INCOMPLETE.md, "After v0.39.0"). The SQL ran on Node's built-in SQLite. **Not run**: Cloudflare D1, a real browser, a real deploy.

**Not done yet (Phase 6)**: the Trending block on the site (home and article pages), the consent rule for analytics, a revenue widget, per-post analytics in the editor, Google Discover as its own source.

## 0.38.0 (2026-11-15): Phase 6 (part 7), source names in Analytics

The Traffic sources list now shows names (Google, Google News, Facebook, X, Direct ...) instead of raw hosts, and direct visits are counted. Nothing changes for readers.

**Added**
- `workers/analytics/lib.js`: `sourceName(host)` (one readable name; `''` is Direct, any Google country site is Google, `news.google.com` is Google News, Facebook, Instagram, X, WhatsApp, Telegram, YouTube, Reddit, LinkedIn, Pinterest, Bing, DuckDuckGo, Yahoo, Yandex, Baidu, Ecosia; look-alike hosts such as `notgoogle.com` or `google.com.evil.com` are not matched; any other host is kept as it is) and `groupSources(rows)` (adds hosts with the same name, sorts by views then name, keeps the top 10).
- `site/tests/unit/analytics-sources.test.ts`: 9 tests (Direct, Google in many countries, look-alikes, social and search sites, unknown hosts, grouping and order, top 10, bad input, the query keeps direct visits and has numbers only in the values).

**Changed**
- `workers/analytics/lib.js`: the sources query in `statsPlan` no longer drops direct visits (`''`) and reads up to 200 hosts, so grouping by name is not cut short.
- `workers/analytics/index.js`: `GET /stats` sends `sources` through `groupSources`.
- `site/tests/unit/analytics-stats.test.ts`: the sources check now expects `Google` and `Direct`.
- `site/package.json` and `package-lock.json` (version 0.38.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`tests/unit/analytics-sources.test.ts`): 192 files before, 193 after.

**Checked**: `npm test` (49 files, 473 tests, all passed) and `npm run build` (passed, "Validation passed"). The SQL ran on Node's built-in SQLite. **Not run**: Cloudflare D1, a real browser, a real visit from Google or Facebook.

**Not done yet (Phase 6)**: Google Discover as its own source (see INCOMPLETE.md), the consent rule for analytics, the "Trending" block, a revenue widget, per-post analytics in the editor.

## 0.37.0 (2026-11-14): Phase 6 (part 6), the Analytics screen in the dashboard

The screen that shows the numbers (PLAN 15 dashboard views). Nothing changes for readers; the screen stays empty until the Worker is deployed and `config/analytics.json` has an endpoint.

**Added**
- `site/public/admin/js/analytics.js`: helpers (`statsUrl`, `readEndpoint`, `fmtDuration`, `fmtCount`, `bucketLabel` with time zone, `fillTimeline`, `statsError`, `zoneList`) and `renderStats` (cards, bar chart, top lists).
- `site/tests/unit/admin-analytics.test.ts`: 12 tests (helpers, role, and the screen in jsdom: not switched on, numbers drawn with the sign-in token, period switch and lifetime visitors, empty message, refusal and network messages, time zone redraw without a new request).

**Changed**
- `site/public/admin/js/app.js`: the Analytics screen, nav entry, route, and the refresh timer that stops when you leave the screen.
- `site/public/admin/js/roles.js`: the `analytics` action, admin only.
- `site/public/admin/admin.css`: styles for the cards, chart and tables.
- `site/package.json` and `package-lock.json` (version 0.37.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Two files were added: 190 files before, 192 after.

**Checked**: `npm test` (48 files, 464 tests, all passed) and `npm run build` (passed). The screen was run in jsdom against a fake GitHub and a fake Worker. **Not run**: a real browser, a real phone, the deployed Worker.

**Not done yet (Phase 6)**: the source names (Google, Discover, Facebook, X, direct), the consent rule for analytics, the "Trending" block, a revenue widget, per-post analytics in the editor.

## 0.36.0 (2026-11-14): Phase 6 (part 5), the numbers endpoint for the dashboard

`GET /stats` on the analytics Worker (PLAN 15 dashboard views: live 5 minutes, 1 hour, 24 hours, 7 days, lifetime). The dashboard screen that shows them is the next part. Nothing changes for readers.

**Added**
- `workers/analytics/lib.js`: `RANGES` (5m, 1h, 24h, 7d, life) and `statsPlan(range, now)`, which builds the fixed SQL texts for totals, top pages, countries, sources, devices, browsers and the chart series. No text from the request goes into the SQL; only numbers are bound.
- `workers/analytics/index.js`: `GET /stats?range=...`. Needs `Authorization: Bearer <GitHub token>`; the Worker asks GitHub who the token belongs to (answer kept 60 seconds per token) and the login must be in `ALLOWED_USERS`. Empty list: 503 and nobody can read. No or bad token: 401. Other user: 403. Bad range: 400. Other method: 405. Preflight answers for the site. A database error is a plain 500 with no details. CORS only for `SITE_ORIGIN`. `/collect` is unchanged.
- `workers/analytics/wrangler.toml`: the `ALLOWED_USERS` variable (empty).
- `site/tests/unit/analytics-stats.test.ts`: 11 tests (the ranges, numbers only in the values, exact numbers on a real SQLite database for live ranges, lifetime from daily totals plus today, empty database gives zeros, the access rules, CORS, token cache, `/collect` unchanged).

**Changed**
- `site/package.json` and `package-lock.json` (version 0.36.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`tests/unit/analytics-stats.test.ts`): 189 files before, 190 after.

**Checked**: `npm test` (47 files, 452 tests, all passed) and `npm run build` (passed). The SQL ran on a real SQLite database. **Not run**: Cloudflare D1, the real GitHub token check, a real browser.

**Not done yet (Phase 6)**: the dashboard screen (cards, chart, time zone selector, auto refresh), the source names (Google, Discover, Facebook, X, direct), the consent rule for analytics, the "Trending" block.

## 0.35.0 (2026-11-14): Phase 6 (part 4), rollups and cleanup in the analytics Worker

The Worker now turns raw visits into hourly and daily totals and deletes old raw events (PLAN 15, LOGICS 10; BUGS N5). It runs by itself every hour once the Worker is redeployed. Nothing changes for readers.

**Added**
- `workers/analytics/lib.js`: `rollupWindow` (last 48 finished hours, last 3 finished UTC days, raw events kept 7 days), `HOURLY_SQL`, `DAILY_SQL` (they replace the rows, so running twice never counts twice; visitors are different session ids, counted once per day), `CLEANUP_SQL`, and the constants `RAW_DAYS`, `HOURS_BACK`, `DAYS_BACK`.
- `workers/analytics/index.js`: `runRollup(db, nowMs)` (hourly, then daily, then delete; a database error stops before the delete, so no data is lost) and the `scheduled` handler that calls it and logs a failure without crashing.
- `workers/analytics/wrangler.toml`: `[triggers] crons = ["5 * * * *"]`.
- `site/tests/unit/analytics-rollup.test.ts`: 8 tests (the window, totals and visitors, the running hour left out, a second run changes nothing, totals stay after raw events are deleted, only events older than 7 days go, a failed step deletes nothing, the scheduled handler). The database tests run on Node's built-in SQLite and are skipped on a Node without it (before 22.5).

**Changed**
- `workers/analytics/index.js` (header note), `site/package.json` and `package-lock.json` (version 0.35.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`tests/unit/analytics-rollup.test.ts`): 188 files before, 189 after.

**Checked**: `npm test` (46 files, 441 tests, all passed) and `npm run build` (passed, "Validation passed"). The SQL ran on a real SQLite database. **Not run**: Cloudflare D1 itself and a real Cron Trigger (the Worker is not deployed here).

**Not done yet (Phase 6)**: the dashboard (live 5 minutes, 1 hour, 24 hours, 7 days, lifetime, with the running hour and day read from raw events), the source names, the consent rule for analytics, the "Trending" block.

## 0.34.0 (2026-11-14): Phase 6 (part 3), the beacon script in the article page

The browser part of analytics (PLAN 15, LOGICS 9; BUGS N1, N4). It sends nothing until you put the Worker address in `site/config/analytics.json`, so nothing changes for readers with the shipped files.

**Added**
- `site/config/analytics.json`: one setting, `endpoint` (empty by default).
- `site/src/lib/beacon.ts`: `beaconPlan` checks the setting. Empty gives off. Otherwise it must be a clean `https://` address ending with `/collect`; a bad value stops the build with a plain message.
- `site/src/lib/beacon-client.js`: the browser script (plain JavaScript, same text is put in the page and run by the tests). Random tab-session id (`sessionStorage`, no cookie) and a new page view id per page. Read time counts one second only while the tab is visible and the reader did something in the last 30 seconds, stops at 3600 (BUGS N4). Deepest scroll point 0 to 100. First message after the first read second, then every 30 read seconds, and when the reader leaves or hides the tab; nothing is sent twice with the same numbers. `sendBeacon` with a plain text body (no preflight), fallback `fetch` with `keepalive`. Every failure is silent.
- `site/src/components/Beacon.astro`: puts the script into the article page when the setting is on.
- `site/tests/unit/beacon.test.ts`: 11 tests (off on every non-article page, message accepted by the Worker rules, active time, 3600 cap, ids, scroll, leave and fetch fallback, broken browser parts, the settings check).

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`: uses `<Beacon />` (article template only).
- `site/scripts/validate-html.mjs`: the build fails if the beacon is found in any page that is not an article.
- `site/tests/unit/consent.test.ts`: one test of v0.31.0 was wrong (it never made the end of the text "below the screen", so the Ad choices button was correctly absent). Added `below: true`. The ad loader code was not changed.
- `site/package.json` and `package-lock.json` (version 0.34.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Five files were added: 183 files before, 188 after.

**Checked**: `npm ci`, `npm test` (45 files, 434 tests, all passed; the 423 older tests passed too after the one test fix above) and `npm run build` (passed, "Validation passed"). **Not run**: a build with a real article and the endpoint set (the repository has no demo posts), a real browser, a real phone, the deployed Worker.

**Not done yet (Phase 6)**: the rollup jobs and deletion of old raw events, the dashboard (5 minutes, 1 hour, 24 hours, 7 days, lifetime), the source names (Google, Discover, Facebook, X, direct), the consent rule for analytics, the "Trending" block, the beacon on AMP pages (AMP is not built).

## 0.33.0 (2026-11-14): Phase 6 (part 2), the analytics Worker endpoint

The Worker that receives one visit message and stores it (PLAN 15; BUGS N1, N2, N3, N6). It is not deployed and no page sends anything to it yet, so nothing changes for readers.

**Added**
- `workers/analytics/index.js`: `POST /collect`. Only the site itself may send: the `Origin` header must equal `SITE_ORIGIN`, otherwise 403 and nothing is written (BUGS N6). Body at most 1024 characters (413 above). Not JSON or bad ids or bad path: 400. A bot gets the same quiet 204 and nothing is stored (BUGS N2). The time is the Worker's clock (BUGS N3). Optional rate limit per session id through a `RATE_LIMITER` binding (429); a failing limiter does not stop counting; no IP address is read. The row goes in with the upsert from `lib.js`, so a page view sent twice stays one row (BUGS N1). Database failure: 500; no database: 503. Answers are never cached and carry a CORS header for `SITE_ORIGIN` only. Other paths 404, other methods 405, the preflight answers 204 for the site.
- `workers/analytics/wrangler.toml`: name, `SITE_ORIGIN` (placeholder `https://YOUR-DOMAIN`), the D1 binding `DB` (placeholder `YOUR-D1-DATABASE-ID`), and the rate limit binding as a comment.
- `site/tests/unit/analytics-worker.test.ts`: 14 tests.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.33.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Three files were added (`workers/analytics/index.js`, `workers/analytics/wrangler.toml`, `tests/unit/analytics-worker.test.ts`): 180 files before, 183 after.

**Checked**: the 14 new tests and the 20 tests of v0.32.0 were run in plain Node through a small stand-in for the test tool: all passed. The Worker was also run end to end on a real SQLite database (Node's built-in one) behind a small D1-like wrapper: a good visit stored, the same page view sent again kept one row with the higher read time, a second page view added a row, a call from another origin got 403 and wrote nothing. **Not run**: `npm test` and `npm run build` (no network here to install packages), so the real test tool has run nothing, old or new. The Worker was not deployed and D1 itself (Cloudflare's SQLite) and the rate limit binding were not used. Run `npm test` and `npm run build` before you deploy.

**Not done yet (Phase 6)**: the beacon script in the article page (session id, page view id, active read time, scroll depth, `sendBeacon`), the rollup jobs and the deletion of old raw events, the dashboard, the source names, the consent rule for analytics, the "Trending" block.

## 0.32.0 (2026-11-14): Phase 6 (part 1), analytics database and beacon rules

Phase 6 starts with the two parts that do not need a deployed Worker: the D1 database layout and the pure rules that check one visit message (PLAN 15, LOGICS 9 and 10; BUGS N1 to N4). Nothing changes for readers: no page sends anything yet and no Worker exists yet.

**Added**
- `workers/analytics/schema.sql`: the D1 tables `events`, `rollup_hourly` and `rollup_daily` (every statement is `IF NOT EXISTS`, so it can run twice). `events` has one extra column against CODING_PLAN section 4, `pv_id` (one id per page view), with a unique index on `(session_id, pv_id)` so a page view that is sent twice stays one row (BUGS N1). All times are seconds in UTC (BUGS N3). There is no column for an IP address or a user agent text.
- `workers/analytics/lib.js`: pure functions, no network and no database. `isBot` (BUGS N2), `deviceOf`, `browserOf`, `cleanId`, `cleanCountry`, `cleanPath` (path only, no query, no hash), `referrerHost` (host only; the site itself and bad values give empty), `cleanTimeZone`, `cleanInt`, `parseBody` (at most 1024 characters of JSON), `cleanBeacon` (builds one checked event; the time is the Worker's clock, never the browser's; read time is capped at 3600 seconds, scroll depth at 0 to 100: BUGS N4), `UPSERT_SQL` and `eventValues` (a second send of the same page view only raises read time and scroll depth).
- `site/tests/unit/analytics-lib.test.ts`: 20 tests.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.32.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. Three files were added (`workers/analytics/schema.sql`, `workers/analytics/lib.js`, `tests/unit/analytics-lib.test.ts`): 177 files before, 180 after.

**Checked**: the 20 new tests were run in plain Node through a small stand-in for the test tool: 20 passed, 0 failed. The schema was run twice in a real SQLite database (Node's built-in one) and the upsert was run on the same page view twice: one row, read time 40, scroll depth kept at the higher value, time kept from the first send. **Not run**: `npm test` and `npm run build` (no network here to install packages), so the real test tool has not run any test, old or new. D1 itself (Cloudflare's SQLite) was not used. Run `npm test` and `npm run build` before you deploy.

**Not done yet (Phase 6)**: the Worker (`wrangler.toml`, the endpoint, rate limit, CORS to the site only), the beacon script in the article page (session id, page view id, active read time, scroll depth, `sendBeacon`), the rollup jobs and the deletion of old raw events, the dashboard (live 5 minutes, 1 hour, 24 hours, 7 days, lifetime), the source names (Google, Discover, Facebook and so on), the consent rule for analytics, the "Trending" block.

## 0.31.0 (2026-11-14): Phase 5 (part 14), the consent button words are settings

The words on the three consent buttons ("Accept", "No thanks", "Ad choices") can now be written by the owner: `consentAccept`, `consentDecline` and `consentChoices` in `config/ad-loader.json`, and three boxes in the dashboard screen **Ad loader**. Nothing changes for readers with the shipped settings: the words are empty, so the built-in English words are used, and the loader is still off by default.

**Added**
- `config/ad-loader.json`: `consentAccept`, `consentDecline`, `consentChoices` (all empty).
- `src/lib/ad-loader.ts`: `cleanConsentLabel` (empty = built-in word; otherwise 2 to 24 characters on one line without `<` or `>`; a bad value stops the build with a plain message that names the setting, also in compliance mode), the constants `CONSENT_LABEL_MIN` and `CONSENT_LABEL_MAX`, and three optional plan fields (each present only when a word is set, so the plan for the shipped file is unchanged).
- `site/public/admin/js/ad-loader-config.js`: the same rules for the dashboard (`cleanConsentLabel`, reading the file, the form values, and the words "and your own button words" in the live sentence). A bad word in the file opens as empty.
- Dashboard screen **Ad loader**: three boxes in the card "Consent answer" ("Accept button word", "No thanks button word", "Ad choices button word").
- `src/lib/ads-client.js`: `word(key, fallback)` gives the button words; plain text only, never HTML.
- Tests: 11 new (build rules 4 (empty by default, valid words, refused words, shipped file), same rules in build and dashboard 4, bar and Ad choices button in a test browser 2).

**Changed**
- `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js`, `site/public/admin/js/ad-loader-config.js`, `site/public/admin/js/app.js`, `site/config/ad-loader.json`, `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `consent.test.ts` (the helper `page` has one more option), `site/package.json` and `package-lock.json` (version 0.31.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`. Also the version notes inside the code comments and test names of v0.30.0 now say v0.30.0 (they said v0.29.0 by mistake).

**Removed**: nothing. No file was deleted and no file was added (177 files before and after).

**Checked**: the new rules of the build copy and the dashboard copy were run in plain Node on the same inputs (both agree; the plan has none of the three keys when empty); the browser file, `app.js` and the three test files pass a syntax check. **Not run**: `npm test` and `npm run build` (no network here to install packages), so the new tests and the old ones have not been run. Run both before you deploy.

**Not done yet (Phase 5)**: Google's certified consent tool (needed before AdSense can serve the EU and UK), the label of the bar itself for screen readers (`aria-label`, still English), AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.30.0 (2026-11-14): Phase 5 (part 13), the consent bar text is a setting

The sentence in the consent bar (PLAN 28.7) can now be written by the owner: `consentText` in `config/ad-loader.json` and a box in the dashboard screen **Ad loader**. Nothing changes for readers with the shipped settings: the text is empty, so the built-in English sentence is used, and the loader is still off by default.

**Added**
- `config/ad-loader.json`: `consentText` (empty).
- `src/lib/ad-loader.ts`: `cleanConsentText` (empty = built-in sentence; otherwise one line of 20 to 300 characters without `<` or `>`; a bad value stops the build with a plain message, also in compliance mode), the constants `CONSENT_TEXT_MIN` and `CONSENT_TEXT_MAX`, and the optional plan field `consentText` (present only when a text is set, so the plan for the shipped file is unchanged).
- `site/public/admin/js/ad-loader-config.js`: the same rules for the dashboard (`cleanConsentText`, reading the file, the form value `consentText`, and the words "and the bar shows your own text" in the live sentence). A broken text in the file opens as empty.
- Dashboard screen **Ad loader**: a box "Bar text" in the card "Consent answer".
- `src/lib/ads-client.js`: the bar uses `cfg.consentText` when it is a text of 1 to 300 characters, set as plain text (never as HTML); otherwise the built-in sentence.
- Tests: 10 new (build rules 4, same rules in build and dashboard 4, bar in a test browser 2).

**Changed**
- `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js`, `site/public/admin/js/ad-loader-config.js`, `site/public/admin/js/app.js`, `site/config/ad-loader.json`, `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `consent.test.ts` (the helper `page` has one more option), `site/package.json` and `package-lock.json` (version 0.30.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (177 files before and after).

**Checked**: the new rules of the build copy and the dashboard copy were run in plain Node on the same inputs (both agree, plan has no `consentText` key when empty); the browser file and `app.js` pass a syntax check. **Not run**: `npm test` and `npm run build` (this step had no network to install packages), so the 10 new tests and the old ones have not been run. Run both before you deploy.

**Not done yet (Phase 5)**: Google's certified consent tool (needed before AdSense can serve the EU and UK), the button labels ("Accept", "No thanks", "Ad choices") as settings, AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.29.0 (2026-11-14): Phase 4 leftover, weekly backup workflow

A GitHub Actions job now makes a weekly backup (PLAN 28.5, BUGS B3, CODING_PLAN section 5). Nothing changes for readers or for the site build.

**Added**
- `.github/workflows/backup.yml`: runs every Sunday 02:30 UTC and by hand. It puts a Git tag `backup-YYYY-MM-DD` on the current state (skipped if the tag already exists) and uploads `backup-YYYY-MM-DD.zip` (`site/content`, `site/config`, `site/public/media`, `site/brand`) as a workflow artifact kept 90 days.

**Changed**
- `site/package.json` and `site/package-lock.json` (version 0.29.0), `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`.github/workflows/backup.yml`): 176 files before, 177 after.

**Checked**: the zip step was run by hand on this project folder and worked. The workflow itself has **not** run on GitHub. `npm test` and `npm run build` were **not** run in this step (no network here to install packages); no site code changed.

**Not done yet**: the XML export is made in the dashboard, not by this job; a separate private repo for the zip (PLAN 28.5); restore steps.

## 0.28.0 (2026-11-14): Phase 5 (part 12), consent days in the settings and the dashboard

The number of days a reader's consent answer is kept (PLAN 28.7) is now a setting: `consentDays` in `config/ad-loader.json` and a box in the dashboard screen **Ad loader**. Nothing changes for readers with the shipped settings: the value is 180, the same as before, and the loader is still off by default.

**Added**
- `config/ad-loader.json`: `consentDays` (180).
- `src/lib/ad-loader.ts`: `cleanConsentDays` (empty = 180, otherwise a whole number from 30 to 365; a bad value stops the build with a plain message, also in compliance mode), the constants `CONSENT_DAYS_DEFAULT`, `CONSENT_DAYS_MIN`, `CONSENT_DAYS_MAX`, and the field `consentDays` in the plan. The plan goes into the article page, so the browser file now gets the number from the settings.
- `site/public/admin/js/ad-loader-config.js`: the same rules for the dashboard (`cleanConsentDays`, reading the file, the form value `consentDays`, and a sentence in the live text: "their answer is kept N days"). An old file without the field opens with 180; an odd value in the file also gives 180.
- Dashboard screen **Ad loader**: a card "Consent answer" with the box "Days to keep the answer".
- Tests: 14 new in total (build rules 3, same rules in build and dashboard 2 plus 8 new cases in the sync list, dashboard helpers 3, screen 2).

**Changed**
- `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js` (only the comment: the number now comes from the settings), `site/public/admin/js/ad-loader-config.js`, `site/public/admin/js/app.js`, `site/config/ad-loader.json`, `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `admin-ad-loader.test.ts` (old expectations now include `consentDays`), `site/package.json` and `package-lock.json` (version 0.28.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (176 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post, compliance mode off, test values and `consentDays` 30: the number is in the built article page only; the page was run in jsdom: an answer 20 days old is kept (no bar), an answer 40 days old asks again. The copy is not in the zip.

**Not done yet (Phase 5)**: Google's certified consent tool (needed before AdSense can serve the EU and UK), a bar text that can be edited in the dashboard, AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.27.0 (2026-11-14): Phase 5 (part 11), the consent answer expires

The answer a reader gave to the consent bar (Accept or No thanks) is now valid for 180 days. After that the bar asks again (PLAN 28.7; BUGS A1). Nothing changes for readers with the shipped settings: the loader is still off by default, so no bar appears anywhere.

**Added**
- `src/lib/ads-client.js`: the answer is saved as `yes|<time>` or `no|<time>` (key `adConsent`, time in milliseconds). `savedAnswer` accepts it only when the word is yes or no, the time has 10 to 15 digits, the time is not in the future and is not older than 180 days. Anything else (an old value without a time, a broken text, an empty text, a time in the future, a blocked storage) counts as "no answer", so the bar asks again and no ad is added before the click. A new answer saves the time of now, so the 180 days start again. The code also reads `cfg.consentDays` (a positive number) if a later part passes it; the build does not pass it yet, so the limit is 180 today.
- `tests/unit/consent.test.ts`: 5 new tests (valid after 179 days for yes and for no; asks again after 181 days; asks again for old values, future times and broken texts; a new answer saves the time of now; `consentDays` 30, 365 and bad values).

**Changed**
- `site/src/lib/ads-client.js`, `tests/unit/consent.test.ts` (the helper `page` has three more options; the old checks of the saved value now expect `yes|<time>` and `no|<time>`), `site/package.json` and `package-lock.json` (version 0.27.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (176 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post, compliance mode off and test values: only the article page has the loader; the built article page was run in jsdom with a faked screen and Worker. New reader: bar, Accept adds the social bar. Yes 10 days old: no bar, social bar. No 10 days old: no bar, nothing. Yes 200 days old: bar again, No thanks adds nothing. Old value "yes" without a time: bar again. The copy is not in the zip.

**Not done yet (Phase 5)**: a setting for the number of days in `config/ad-loader.json` and the dashboard, Google's certified consent tool (needed before AdSense can serve the EU and UK), a bar text that can be edited in the dashboard, AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.26.0 (2026-11-14): Phase 5 (part 10), "Ad choices" button

A reader from the EU, the EEA, the UK or Switzerland can now change the answer given to the consent bar (PLAN 28.7; BUGS A2). Nothing changes for readers with the shipped settings: the loader is still off by default, so no button and no bar appears anywhere.

**Added**
- `src/lib/ads-client.js`: `putChoices`. For readers who had to consent (Accept, No thanks, or an answer saved earlier) a small button "Ad choices" is added under the article text (after the smartlink line, if there is one; one button only). It is at least 44 px high. A click opens the consent bar again. When the answer changes (yes to no, or no to yes) the page reloads, so the new answer is used at once; ads that were already added cannot be taken back any other way. The same answer reloads nothing. The button is added only when the end of the text is still below the visible screen, so nothing moves under the reader (BUGS A2). It is never added where no consent is needed, where ads are off, or when the Worker fails.
- `tests/unit/consent.test.ts`: 8 new tests (button after Accept and No thanks, with a saved yes or no, not added in the cases above, not added when the text end is on screen, order after the smartlink and only once, same answer, yes to no reloads, no to yes reloads). The test page is wrapped so reloads can be counted.

**Changed**
- `site/src/lib/ads-client.js`, `tests/unit/consent.test.ts` (the helper `page` has two more options and wraps the window), `site/package.json` and `package-lock.json` (version 0.26.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (176 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post, compliance mode off and test values: only the article page has the loader; the built article page was run in jsdom with a faked screen and Worker. Germany with Accept, No thanks or a saved yes: the "Ad choices" button stands under the text. USA and India: no button. The copy is not in the zip.

**Not done yet (Phase 5)**: a yes that expires after some months, Google's certified consent tool (needed before AdSense can serve the EU and UK), a bar text that can be edited in the dashboard, AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.25.0 (2026-11-14): Phase 5 (part 9), consent gate for the ad loader

Readers from the EU, the EEA, the UK and Switzerland now have to click Accept before any ad loads (PLAN 13.5, 28.7; BUGS A1, A2). Nothing changes for readers with the shipped settings: the loader is still off by default, so no ad script and no bar appears anywhere.

**Added**
- `workers/geo/index.js`: the answer now has `consent: true|false`. `true` for the 27 EU states, Iceland, Liechtenstein, Norway, the UK and Switzerland, and also when the country is unknown (safe side). `false` elsewhere and for blocked countries. New exports `consentList` and `DEFAULT_CONSENT`.
- `workers/geo/wrangler.toml`: variable `CONSENT_COUNTRIES` (the 32 codes above). An empty value asks nobody.
- `src/lib/ads-client.js`: where the Worker says `consent: true` a small bar is fixed to the bottom of the screen (it never pushes the text), with two buttons "Accept" and "No thanks" (each at least 44 px high). No ad script and no box is added before the click. Accept adds the formats, No thanks adds nothing. The choice is saved in this browser (`localStorage`, key `adConsent`) and the question is not asked again. A missing `consent` field, a failed Worker, or a blocked storage all count as "consent needed". The AdSense unit is never added for readers who had to consent (Google needs its own certified consent tool for that).
- `tests/unit/consent.test.ts`: 10 new tests that run the very same browser text inside a real (jsdom) page: Accept, No thanks, saved yes and no, old Worker without the field, failed Worker, blocked storage, bar position and button height, non-article page.
- Tests for the Worker: 2 new (consent list, custom list), 3 old expectations now include `consent`.

**Changed**
- `site/src/lib/ads-client.js` (the country check function is now `geoAnswer`, returns `{ ads, consent }`), `workers/geo/index.js`, `workers/geo/wrangler.toml`, `tests/unit/geo-worker.test.ts`, `tests/unit/ads-client.test.ts` (the fake Worker answer now has `consent: false`), `site/package.json` and `package-lock.json` (version 0.25.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. One file was added (`tests/unit/consent.test.ts`): 175 files before, 176 after.

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post, compliance mode off and test values: only the article page has the loader; the built article page was run in jsdom with a faked screen and Worker. Germany: bar shown, no script before the click, Accept adds the social bar only (no AdSense box), No thanks adds nothing. USA: no bar, social bar and AdSense box added. India (ads off): no bar, nothing added. The copy is not in the zip.

**Not done yet (Phase 5)**: a way for the reader to change the choice later (a link in the footer), a yes that expires after some months, Google's certified consent tool (needed before AdSense can serve the EU and UK), AdSense display and multiplex units, auto ads, per-format country rules (AdSense in India), AMP.

## 0.24.0 (2026-11-14): Phase 5 (part 8), AdSense in-article unit

The ad loader can now place one Google AdSense in-article unit inside the article text (PLAN 13.5, 29.1; BUGS A1, A2, A6, H1, H2). Nothing changes for readers: the shipped settings still add no ad script and no box anywhere.

**Added**
- `config/ad-loader.json`: `adsense` block with `slot` (empty) and `afterParagraph` (5).
- `src/lib/ad-loader.ts`: `cleanAdsenseSlot` (digits only, 6 to 20), `ADSENSE_AFTER_DEFAULT` (5), the `AdsenseUnit` type, and the rule that a slot needs the AdSense id from `config/ads.json` (a slot without an id stops the build with a plain message, also in compliance mode). `adLoaderPlan(cfg, adsensePublisherId)` has a second argument and the plan has an `adsense` field (null when off). The native banner and the AdSense unit may not use the same paragraph number. Compliance mode and the geo address rules are the same as for the other formats, so the unit never loads without the country check and India is off for it too.
- `src/lib/ads-client.js`: `putAdsense`. After the country check says `ads: true` it adds one box after paragraph N of `.content` (minimum height 280 px, small "Advertisement" label, an `ins.adsbygoogle` tag with the id and the slot), then Google's script (fixed address, `async`, `crossorigin="anonymous"`) and asks for the ad. It adds nothing when the article has no more than N paragraphs, when the place is already on screen or above it, or when the browser cannot measure it. Order of formats: social bar, native banner, AdSense, smartlink, popunder.
- Dashboard screen **Ad loader**: a Google AdSense unit card with the slot number and the paragraph number; it reads the AdSense id from `config/ads.json` and shows whether one was found; the live sentence mentions the AdSense unit.
- Tests: 23 new (335 in total, all passing): AdSense rules in the build copy (6), the same rules compared with the dashboard copy for 12 new cases times 5 id values and the slot and paragraph helpers (1 extended, 1 new), the dashboard helpers (4), the screen (4), the browser file (8), one more import-guard check.

**Changed**
- `site/public/admin/js/ad-loader-config.js` (same AdSense rules, form values `adsenseSlot` and `adsenseAfter`, second argument for the AdSense id), `site/public/admin/js/app.js`, `site/config/ad-loader.json`, `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js`, `site/src/components/AdLoader.astro` (passes the AdSense id from `config/ads.json`), `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `admin-ad-loader.test.ts`, `ads-client.test.ts` (old expectations now include `adsense`), `site/package.json` and `package-lock.json` (version 0.24.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (175 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post of 9 paragraphs: with compliance mode off and test values only the article page has the loader (no other page has it, and no other page mentions `googlesyndication`), the build gate passes, the built article page was run in jsdom with a faked screen and Worker: the box appears right after paragraph 5 with the right id and slot, Google's script is added with `crossorigin="anonymous"`, and the ad queue gets one entry; with the Worker saying `ads: false` nothing is added. A slot without an AdSense id stops the build with the plain message. The same paragraph number for the native banner and the AdSense unit stops the build. The copy is not in the zip.

**Not done yet (Phase 5)**: AdSense display and multiplex units, auto ads, the consent banner (needed before AdSense for EEA and UK visitors), per-format country rules (AdSense in India), AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.23.0 (2026-11-14): Phase 5 (part 7), Smartlink

The ad loader can now add one Adsterra Smartlink as a plain "Sponsored link" under the article text (PLAN 13.1, 13.3; BUGS A1, A2, A6, H1, H2). Nothing changes for readers: the shipped settings still add no ad script and no link anywhere.

**Added**
- `config/ad-loader.json`: `adsterra.smartlink` (empty).
- `src/lib/ad-loader.ts`: the smartlink is a clean `https://` address like the script addresses; a bad value stops the build with a plain message, also in compliance mode. The plan has a `smartlink` field ('' when off). Compliance mode and the geo address rules are the same as for the other formats.
- `src/lib/ads-client.js`: `putSmartlink`. After the country check says `ads: true` it adds one line "Sponsored link" right after the article text: a normal link with `rel="sponsored nofollow noopener noreferrer"` and `target="_blank"`. No script, no automatic redirect. It adds nothing when the end of the text is already on screen or above it, or when the browser cannot measure it. Order of formats: social bar, native banner, smartlink, popunder.
- Dashboard screen **Ad loader**: a Smartlink card with one address box; the live sentence mentions the smartlink.
- Tests: 11 new (312 in total, all passing): smartlink rules in the build copy (3), the dashboard copy (1, plus extra cases in the existing sync checks and form checks), the screen (2), the browser file (5, with a fake article).

**Changed**
- `site/public/admin/js/ad-loader-config.js`, `site/public/admin/js/app.js`, `site/config/ad-loader.json`, `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js`, `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `admin-ad-loader.test.ts`, `ads-client.test.ts` (old expectations now include `smartlink`), `site/package.json` and `package-lock.json` (version 0.23.0), `site/README.md` (also the example file line now shows `smartlink` and `nativeBanner`), `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted and no file was added (175 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass), also on a freshly unzipped copy. Also on a temporary copy with one temporary post: with compliance mode off and test values only the article page has the loader (home, tag, search, category, author, admin do not), the build gate passes, the built article page was run in jsdom with a faked screen and Worker: the "Sponsored link" line appears right after the article text with the right address, `rel` and `target`, and no script is added; a `http://` smartlink address stops the build with the plain message. The copy is not in the zip.

**Not done yet (Phase 5)**: AdSense units, per-page-type and per-country rules beyond India, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.22.0 (2026-11-14): Phase 5 (part 6), Native Banner

The ad loader can now place one Adsterra Native Banner box inside the article text (PLAN 13.1, 13.3; BUGS A1, A2, A6, H1, H2). Nothing changes for readers: the shipped settings still add no ad script anywhere.

**Added**
- `config/ad-loader.json`: `adsterra.nativeBanner` with `script`, `containerId` and `afterParagraph` (all empty, 3).
- `src/lib/ad-loader.ts`: `cleanContainerId` (letters, numbers, `-` and `_`, starts with a letter, up to 80 characters), `cleanAfterParagraph` (whole number 1 to 20, empty = 3), and the rule that script and container id are filled together or both empty. The plan now has a `nativeBanner` field (null when not set). A bad value stops the build with a plain message, also in compliance mode. Compliance mode and the geo address rules are the same as for the other formats.
- `src/lib/ads-client.js`: `putNative`. After the country check says `ads: true` it adds one box after paragraph N of `.content`, with a 250 px minimum height and an "Advertisement" label, then the script. It adds nothing when the article has no more than N paragraphs, when the place is already on screen or above it, or when the browser cannot measure it. Order of formats: social bar, native banner, popunder. Every script now also gets `data-cfasync="false"`.
- Dashboard screen **Ad loader**: a Native banner card with the script address, the container id and the paragraph number; the live sentence mentions the native banner.
- Tests: 20 new (301 in total, all passing): native rules in the build copy (6), the same rules compared with the dashboard copy and the form helpers (2 and 1 extended cases), the screen (3), the browser file (9, with a fake article).

**Changed**
- `site/public/admin/js/ad-loader-config.js` (same native rules, form values `nativeScript`, `nativeContainer`, `nativeAfter`), `site/public/admin/js/app.js` (three new boxes, they are read and saved), `site/config/ad-loader.json`, `site/src/lib/ad-loader.ts`, `site/src/lib/ads-client.js`, `tests/unit/ad-loader.test.ts`, `ad-loader-config.test.ts`, `admin-ad-loader.test.ts`, `ads-client.test.ts` (old expectations now include `nativeBanner`), `site/package.json` and `package-lock.json` (version 0.22.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. No file was deleted. The zip has no new files (175 files before and after).

**Checked**: full `npm test` and `npm run build` (both pass). Also on a temporary copy with one temporary post of 6 paragraphs: with compliance mode off and test values only the article page has the loader (home, tag, category, author, search, admin do not), the build gate passes, the built article page was run in jsdom with a faked screen and Worker: the box appears after paragraph 3 with the right container id and the script after it; a half-filled native banner stops the build with the plain message. The copy is not in the zip.

**Not done yet (Phase 5)**: Smartlink, AdSense units, per-page-type and per-country rules beyond India, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.21.0 (2026-11-14): Phase 5 (part 5), Ad loader screen

The settings of the ad loader (`config/ad-loader.json`) can be edited in the dashboard, so the file no longer has to be changed by hand. Nothing changes for readers: the shipped settings still add no ad script anywhere.

**Added**
- `site/public/admin/js/ad-loader-config.js`: the same checks as `src/lib/ad-loader.ts` for the browser (clean `https://` addresses, script without geo address refused, compliance mode ON unless the file says `false`), plus read, form-to-config, one-sentence description and write helpers. A broken or odd file reads as the safe default (compliance mode ON, everything empty).
- Dashboard screen **Ad loader** (`#/ad-loader`, admins only): compliance mode tick box, geo Worker address, social bar and popunder script addresses, a live sentence that says what the file would do (OFF or ON for article pages only), one save to `config/ad-loader.json`. A bad value is refused with a plain message and nothing is saved. Turning scripts from OFF to ON asks first (popunders can put AdSense and Google News approval at risk); answering no saves nothing. Saving values while compliance mode stays on needs no question, because nothing goes live.
- Tests: `tests/unit/ad-loader-config.test.ts` (7, runs the dashboard copy and the build copy on the same inputs) and `tests/unit/admin-ad-loader.test.ts` (7, whole screen against a fake GitHub). 281 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (new screen, menu entry, file path, route; the help text of the Ads screen now points to the new screen), `site/package.json` and `package-lock.json` (version 0.21.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass), also on a freshly unzipped copy. Also: the file written by the dashboard code was put into a temporary copy with one temporary post and built; the build accepted it and only the article page got the loader (home did not). The copy is not in the zip.

**Not done yet (Phase 5)**: Native Banner and Smartlink formats, AdSense units, per-page-type and per-country rules beyond India, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.20.0 (2026-11-14): Phase 5 (part 4), ad loader

The loader that calls the geo Worker and decides if an ad script may enter an article (PLAN 13.2, 13.3, 29.1; BUGS A1, A3, A6, H1, H2). It is **off by default**: with the shipped settings no page changes and no ad script exists anywhere.

**Added**
- `site/config/ad-loader.json`: `complianceMode` (true), `geoUrl` (empty), `adsterra.popunder` and `adsterra.socialBar` (empty script addresses you copy from your Adsterra account).
- `site/src/lib/ad-loader.ts`: checks the settings. Compliance mode stays ON unless the file says `false`. A script without a `geoUrl` is refused (ads never load without the country check). Only clean `https://` addresses are accepted. A bad value stops the build with a plain message.
- `site/src/lib/ads-client.js`: the browser part, plain JavaScript. Article pages only; waits for the first touch, key, scroll or 4 seconds; asks the Worker without cookies and without cache; no answer, error, timeout or anything but `ads: true` means no ads; social bar added when allowed; popunder only from the 2nd article view of a session, once per session, never when the post hides it or when the browser blocks session storage.
- `site/src/components/AdLoader.astro`: writes the browser file and the checked settings into the page. Renders nothing with the default settings or when the post has `ads.hideAll`.
- Tests: `tests/unit/ad-loader.test.ts` (7), `tests/unit/ads-client.test.ts` (13: runs the very same browser text against a fake window, and checks that only the article template can import the component). 267 in total, all passing.

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`: uses `AdLoader` at the end of the article (the only place).
- `site/scripts/validate-html.mjs`: the "ad code outside an article" check also looks for `data-ad-loader` and `adsClient`.
- `site/package.json` and `package-lock.json` (version 0.20.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass). Also built on a temporary copy with one temporary post: with the shipped settings no page has the loader; with compliance mode off and test addresses only the article page has it (home, 404, search and category do not), the page script has valid JavaScript, and a bad address (`http://`) stops the build with a plain message. The copy is not in the zip.

**Not done yet (Phase 5)**: a dashboard screen for `ad-loader.json` (for now edit the file), Native Banner and Smartlink formats, AdSense units, per-page-type and per-country rules beyond India, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.19.0 (2026-11-14): Phase 5 (part 3), geo Worker

The country check for ads (PLAN 13.2, BUGS A1). Nothing calls it yet, so no ad is shown.

**Added**
- `workers/geo/index.js`: `GET /geo` answers `{ ads, country, reason }`. India off by default (`BLOCKED_COUNTRIES`), unknown country gives no ads unless `ADS_ON_UNKNOWN` is `"true"`, never cached, CORS only for `SITE_ORIGIN`, GET and OPTIONS only, no IP read or stored.
- `workers/geo/wrangler.toml`: name, vars (with the placeholder `YOUR-DOMAIN` to be set before deploy), no secrets.
- Tests: `tests/unit/geo-worker.test.ts` (8): decision rules and the HTTP answers. 247 in total, all passing.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.19.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass).

**Not done yet (Phase 5)**: format switches and page-type rules, the ad loader that calls the Worker (article pages only, fail-safe off), Adsterra formats, AdSense units, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.18.0 (2026-11-14): Phase 5 (part 2), Ads screen

The values of `config/ads.json` can be edited in the dashboard. No ad is shown to readers yet.

**Added**
- `site/public/admin/js/ads-config.js`: the same checks as `src/lib/ads-txt.ts` for the browser, plus read, form-to-config and write helpers.
- Dashboard screen **Ads** (`#/ads`, admins only): AdSense publisher id, extra ads.txt lines, live preview of the file, one save to `config/ads.json`. A bad value is refused and nothing is saved.
- Tests: `tests/unit/ads-config.test.ts` (6, runs the dashboard copy and the build copy on the same inputs) and `tests/unit/admin-ads.test.ts` (2, whole screen against a fake GitHub). 239 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (new screen, menu entry, file path), `site/public/admin/js/roles.js` (new `ads` action for admins), `site/package.json` and `package-lock.json` (version 0.18.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass).

**Not done yet (Phase 5)**: format switches and page-type rules, geo Worker and ad loader (India off, fail-safe off), Adsterra formats, AdSense units, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.17.0 (2026-11-14): Phase 5 (part 1), ads.txt

First step of Phase 5. No ad is shown yet.

**Added**
- `site/config/ads.json` (empty on purpose): `adsensePublisherId` and `extraLines`.
- `site/src/lib/ads-txt.ts`: builds the file. AdSense line with Google's fixed certification id from a `ca-pub-` or `pub-` id, your own lines checked (domain, account id, DIRECT or RESELLER, optional hex id), repeated lines written once. Empty config gives an empty file. A bad value stops the build with a plain message (BUGS A7).
- `site/src/pages/ads.txt.ts`: serves `/ads.txt`.
- Tests: `tests/unit/ads-txt.test.ts` (6). 231 in total, all passing.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.17.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build`. Also built on a copy of the config with a valid id and line (file content correct), and with a bad id (build stopped, exit code 1). The config was put back to empty.

**Not done yet (Phase 5)**: Ads Manager screen, geo Worker and ad loader (India off, fail-safe off), Adsterra formats, AdSense units, consent banner, AMP. Phase 4 leftovers: server-side image fetch, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending", weekly `backup.yml`.

## 0.16.0 (2026-11-14): Phase 4 (part 13), category rename with redirects

Closes BUGS U5: renaming a category no longer breaks the address of every post in it.

**Added**
- `site/public/admin/js/category-rename.js`: `planRename` builds the whole change. Posts move to the new folder with the new `category`, live and archived posts keep their old address in `redirects`, the old category page gets a redirect, the display name moves to the new slug. Refuses a bad or existing name, an unknown category, a taken path, over 1000 posts, and a change that would pass the 2000 redirect limit.
- **Rename** button on every category of the Categories screen (admin and editor, confirm box), saved in ONE commit.
- `GitHub.commitFiles()` accepts `{ path, delete: true }` to remove a file in the same commit.
- Tests: `tests/unit/category-rename.test.ts` (6) and `tests/unit/admin-category-rename.test.ts` (2, whole screen against a fake GitHub, checks one commit and the deleted files). 225 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (rename row, help text), `site/public/admin/js/github.js`, `site/package.json` and `package-lock.json` (version 0.16.0), `site/README.md`, `INCOMPLETE.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass).

**Not done yet (Phase 4)**: a server-side image fetch for hosts that block downloads, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics), weekly `backup.yml`.

## 0.15.0 (2026-11-14): Phase 4 (part 12), Links screen

The hand-made keyword list for automatic internal links (`config/links.json`) can now be edited in the dashboard.

**Added**
- `site/public/admin/js/link-list.js`: reads the file, checks one entry with the same rules as the build (`src/lib/autolink.ts`: 4+ characters, safe characters, site path only, no repeats, at most 500), writes the file.
- Dashboard screen **Links** (`#/links`, admin and editor): list, add, remove. Each change is one save.
- Tests: `tests/unit/link-list.test.ts` (5) and `tests/unit/admin-links.test.ts` (2, whole screen against a fake GitHub). 217 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (new screen, menu entry, file path), `site/public/admin/js/roles.js` (new `links` action for admin and editor), `site/package.json` and `package-lock.json` (version 0.15.0), `site/README.md`, `INCOMPLETE.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass).

**Not done yet (Phase 4)**: a server-side image fetch for hosts that block downloads, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics), weekly `backup.yml`.

## 0.14.0 (2026-11-14): Phase 4 (part 11), XML export

Last open item of the XML system (PLAN 11). The dashboard can now download a full backup of all posts and pages.

**Added**
- `site/public/admin/js/export-xml.js`: builds one Blogger-style Atom `.xml` file from the posts and pages. Text from Markdown to HTML, featured image first (absolute link), category then tags as labels, author name, dates, live address in the site time zone, description as summary. Drafts and archived posts are written as drafts. XML-safe (control characters removed, non-Latin text kept). File name `<site>-backup-YYYY-MM-DD.xml`.
- Dashboard screen **Export** (`#/export`, admin and editor): site address field, one download button, plain result line (counts, drafts, items without an address). Writes nothing to the repository.
- Tests: `tests/unit/export-xml.test.ts` (7, includes a round trip through `parseXml` and `planImport`) and `tests/unit/admin-export.test.ts` (2, whole screen against a fake GitHub). 210 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (new screen, menu entry, shared file reader), `site/public/admin/js/roles.js` (new `export` action for admin and editor), `site/package.json` and `package-lock.json` (version 0.14.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test` and `npm run build` (both pass).

**Not done yet (Phase 4)**: a server-side image fetch for hosts that block downloads, a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics), weekly `backup.yml`.

## 0.13.0 (2026-11-14): Phase 4 (part 10), download and re-host imported images

Fourth step of the Blogger and WordPress import (BUGS I2). The Save button now downloads the images first.

**Added**
- `site/public/admin/js/import-images.js`: lists the remote images of the items to save (each once), downloads them 4 at a time, names them `public/media/imported/<name>.<ext>` (a number is added when the name is taken), rewrites the Markdown images and the featured image, and turns a published post into a draft when its featured image is under 1200 px wide. A failed download keeps the old address and is reported with its reason.
- `GitHub.commitFiles()` now accepts image files (`bytes`): each becomes a blob, then everything goes into one commit.
- `setImageFetcher()` in `app.js` (lets tests replace the browser downloader; jsdom has no canvas).
- Tests: `tests/unit/import-images.test.ts` (9) and 3 new screen tests in `tests/unit/admin-import-save.test.ts` (images saved and rewritten, failed download, too small image). 201 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (download step with progress text, confirm box mentions the images, result card shows saved and failed images), `site/public/admin/js/github.js`, `site/package.json` and `package-lock.json` (version 0.13.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: full `npm test`, and `npm run build` on a copy with files made by the new code and two real WebP images (one 1600 px, one 800 px): the build passed, the 1600 px post was published with its local image and a 301, the 800 px post became a draft. That copy is not in the zip.

**Not done yet (Phase 4)**: XML export, a server-side image fetch for hosts that block downloads, a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics).

## 0.12.0 (2026-11-14): Phase 4 (part 9), save imported posts, pages and redirects

Third step of the Blogger and WordPress import. The Import screen now has a **Save to the site** card. Images are still not downloaded.

**Added**
- `site/public/admin/js/import-save.js`: turns the import plan into files. Posts to `content/blogs/<category>/<permalink>.md`, pages to `content/pages/<permalink>.md`. Never overwrites an existing file. A post without a category is skipped, or saved as a draft in the category the editor types. A live post keeps its old address in `redirects`; a live page adds a line to `config/redirects.json`; a draft post keeps its old address for later. Stops at the 2000 redirect limit of Cloudflare Pages and counts what it left out. Missing dates become the import time. Splits very long lists into commits of 200 files.
- `GitHub.commitFiles()` in `site/public/admin/js/github.js`: many files in ONE commit through the Git Data API (one deploy instead of one per file). If someone else saved at the same moment, nothing changes and the message says so.
- Tests: `tests/unit/import-save.test.ts` (10) and `tests/unit/admin-import-save.test.ts` (3, the whole screen against a fake GitHub: one commit, redirects, no category, "no" in the confirm box, failed save). 189 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (Save card, confirm box, result summary, page folder path), `site/public/admin/js/import-xml.js` (page permalinks are also unique against pages already on the site), `site/package.json` and `package-lock.json` (version 0.12.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. (The words "Preview only" on the Import screen were replaced because the screen can now save.)

**Checked**: full `npm test`, and `npm run build` on a copy that held files made by the new code (2 live posts, 1 draft, 1 page): the build passed, `_redirects` had the three 301 lines and the draft was not published. That copy is not in the zip.

**Not done yet (Phase 4)**: downloading and re-hosting the images (BUGS I2), XML export, a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics).

## 0.11.0 (2026-11-14): Phase 4 (part 8), HTML to Markdown for imports

Second step of the Blogger and WordPress import. The preview now holds the converted text of every item. **Nothing is saved to the repository yet.**

**Added**
- `site/public/admin/js/html-to-md.js`: converts the HTML of an imported post to clean Markdown. Handles paragraphs, line breaks, bold, italic, links, images, lists (nested), block quotes, code blocks, tables, rules; unwraps divs, spans, fonts and Blogger picture links. Safety (BUGS I5): scripts, styles, forms, inline styles and event handlers are dropped; only http(s), mailto, `#` and `/` links survive; inline `data:` images are dropped; embeds (iframes) become plain links. Headings (BUGS S1): the body starts at H2 and never skips a level, so the build linter accepts the result. Characters that would turn into Markdown by accident are escaped. Returns the Markdown, the list of images and plain warnings.
- Import plan now carries, for every item: `markdown`, `images`, a `description` (first 160 characters at a word boundary), and the first image as the featured `image` with its alt text (the title is used when the alt text is missing, with a warning).
- Import rules that match the site's publish gate: a post without an image, or with a text too short for a 50 character description, is planned as a draft and the reason is shown. A title shorter than 5 characters (2 for a page) is skipped, because the content schema would stop the build.
- Tests: `tests/unit/html-to-md.test.ts` (22) and 5 new tests in `import-xml.test.ts`. 176 in total, all passing.

**Changed**
- `site/public/admin/js/import-xml.js` (uses the converter, new rules), `site/public/admin/js/app.js` (preview shows image counts), `tests/unit/import-xml.test.ts`, `tests/unit/admin-import.test.ts`, `site/package.json` and `package-lock.json` (version 0.11.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. (A small word-count helper inside `import-xml.js` was replaced by the new text helper.)

**Not done yet (Phase 4)**: downloading and re-hosting the images (BUGS I2), saving the posts and pages as files with the redirects, XML export, a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics).

## 0.10.0 (2026-11-14): Phase 4 (part 7), XML import preview

First step of the Blogger and WordPress import: the dashboard reads the file and shows what would happen. **Nothing is saved to the repository yet** (saving comes next).

**Added**
- `site/public/admin/js/import-xml.js`: `parseXml` reads a Blogger Atom backup or a WordPress WXR export in the browser (UTF-8, byte order mark accepted, plain error messages for a broken or wrong file). Posts and pages are read; comments, settings, templates, attachments, menus, private and trashed items are skipped and counted. `planImport` makes the preview: category and tags (BUGS I3: first label is the category, the rest are tags; extra WordPress categories and tags are merged without repeats), a unique permalink site-wide (U2), the new address in the site time zone (U1), the redirect from the old address, duplicate detection by old address and by title and day, also inside the same file (I4), word count, and warnings (no category, so it becomes a draft; no date; title without Latin letters, so the permalink is generic).
- Dashboard screen **Import** (`#/import`, admin and editor): choose the XML file, see the counts and one line per item. Shows the first 200 items.
- Tests: `tests/unit/import-xml.test.ts` (16) and `tests/unit/admin-import.test.ts` (2, whole screen against a fake GitHub, checks that nothing is written). 149 in total, all passing.

**Changed**
- `site/public/admin/js/app.js` (new screen and menu entry), `site/public/admin/js/roles.js` (new `import` action for admin and editor), `site/package.json` and `package-lock.json` (version 0.10.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Not done yet (Phase 4)**: saving the imported posts (HTML to Markdown, cleaning, downloading images, writing the files and the redirects), XML export, a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, "Trending" (needs analytics).

## 0.9.0 (2026-11-14): Phase 4 (part 6), Read next and orphan report

**Added**
- "Read next" box under each article (`site/src/components/ReadNext.astro`): one story, the nearest older story of the same category, or the nearest newer one when nothing is older. It never shows a story that the text of the article already links to. Nothing is shown when the category has no other story.
- `site/src/lib/linking.ts`: one plan for all internal links of an article (auto links from v0.8.0, Related stories from v0.7.0, Read next). The page and the orphan report use the same plan, so the report matches what readers see.
- `site/src/lib/orphans.ts` and a build warning `[orphan]`: an article that no other article links to (text, Related stories or Read next) is listed in the build log. Category and tag pages do not count, because they list every post. A warning only, the build is not stopped. One article alone is never reported.
- Tests: `tests/unit/linking.test.ts` (9). 131 in total, all passing.

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro` (uses the plan, shows Read next above Related stories), `site/src/styles/global.css` (small `.next` style), `site/package.json` and `package-lock.json` (version 0.9.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing. (The link code that sat inside the article page since v0.8.0 moved to `linking.ts`.)

**Checked**: full `npm test` and `npm run build`, plus a build on a copy with 5 temporary posts (Read next picked the right story, the lonely post was reported as an orphan). The temporary posts are not in the zip.

**Not done yet (Phase 4)**: "Trending" block (needs Phase 6 analytics), a dashboard screen for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, Blogger and WordPress XML import and export.

## 0.8.0 (2026-11-14): Phase 4 (part 5), auto internal links in the article text

**Added**
- `site/src/lib/autolink.ts`: links the first mention of a known phrase inside an article to the best internal page (PLAN section 7, LOGICS 4). Phrases come from the focus keyword and title of other posts (two or more words only), tag names, category names and a hand-made list. Rules: about one link per 250 words and at most 5; only inside paragraphs and list items; never inside headings, links, code, captions or buttons; never the post itself; each address once; whole words only; a story the text already links to by hand is skipped. Preference: hand-made entry, then same category, then shared tag, then other posts, then tag pages, then category pages.
- `site/config/links.json` (starts as `[]`): the hand-made "keyword to address" list. Each entry is `{ "keyword": "...", "url": "/path/" }`. Only paths of this site are accepted.
- Tests: `tests/unit/autolink.test.ts` (15). 122 in total, all passing.

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro`: the article text goes through the linker unless the post has `autoLinks: false` (the "Auto internal links" switch in the editor). Related stories now also skip stories that the text links to by itself (LOGICS 5). If the rendered text is not available the page falls back to the plain content.
- `site/package.json` and `package-lock.json` (version 0.8.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Checked**: a full `npm run build` on a copy with 4 temporary posts (links placed, heading skipped, `autoLinks: false` respected, related list not repeating linked stories). The temporary posts are not in the zip.

**Not done yet (Phase 4)**: "Read next" and "Trending" blocks, orphan-page report, a screen in the dashboard for `links.json`, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, Blogger and WordPress XML import and export.

## 0.7.0 (2026-11-14): Phase 4 (part 4), related stories

**Added**
- `site/src/lib/related.ts`: related posts score from LOGICS 5: 3 per shared tag, 2 for the same category, 2 times the keyword overlap, plus a recency boost. A post is related only if it shares a tag, the category or some keywords (a new post alone never counts). Never the post itself, never a post the article already links to, newest first when scores are equal. The popularity part waits for Phase 6 analytics (no made-up numbers).
- `site/src/components/Related.astro`: a "Related stories" block with up to 4 cards under each article. It is not shown at all when nothing is related.
- Tests: `tests/unit/related.test.ts` (7). 107 in total, all passing.

**Changed**
- `site/src/pages/[year]/[month]/[day]/blogs/[category]/[slug].astro` (adds the block), `site/package.json` and `package-lock.json` (version 0.7.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Note**: while writing the tests a bug of mine showed up (`.map(slugify)` passes the index as the length limit). It was fixed before release; the existing code never used that form.

**Not done yet (Phase 4)**: auto internal linking inside the article text (anchor phrases, the "Disable auto links" switch), "Read next" and "Trending" blocks, orphan-page report, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, Blogger and WordPress XML import and export.

## 0.6.0 (2026-11-14): Phase 4 (part 3), 410 Gone for archived posts

**Why a Function:** Cloudflare Pages `_redirects` only sends 301, 302, 303, 307 and 308. A 410 rule in that file is not applied. So 410 needs a small Pages Function.

**Added**
- `site/src/lib/gone.ts`: builds the list of addresses that answer 410 (archived posts and the old addresses they used). A live page always wins, a redirect always wins, duplicates and bad paths are dropped, and the list is capped at 100 (the `_routes.json` limit) with a build warning.
- `site/functions/_middleware.js`: Cloudflare Pages Function. It answers 410 with a short "This page has been removed" page for addresses in `gone.json`, and passes every other request on. If `gone.json` cannot be read it behaves like a normal static site.
- `scripts/build-redirects.mjs` now also writes `dist/gone.json` and `dist/_routes.json`. `_routes.json` makes the Function run ONLY for the gone addresses, so normal page views never run it (Functions are metered, static pages are free). With nothing gone it lists `/gone-check/`, an address no page uses, because the file needs one include rule.
- `/gone.json` in `public/_headers` gets `X-Robots-Tag: noindex`.
- Tests: `tests/unit/gone.test.ts` (5) and `tests/unit/gone-function.test.ts` (4). 100 in total, all passing.

**Changed**
- `site/src/pages/redirects-map.json.ts` (also reads archived posts and returns the gone list), `site/scripts/build-redirects.mjs`, `site/public/_headers`, `site/package.json` and `package-lock.json` (version 0.6.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Not done yet (Phase 4)**: category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, a way to mark a deleted file (not archived) as gone, auto internal linking, related posts, Blogger and WordPress XML import and export.

## 0.5.0 (2026-11-14): Phase 4 (part 2), Redirect Manager

**Added**
- Dashboard screen **Redirects** (`#/redirects`, admin and editor): add an old address and its new address, remove one, see the redirects that moved posts made by themselves (read only), export everything as CSV, import a CSV with two columns `from,to`. Bad rows are skipped and explained (not a usable path, same address, a live page, already has a redirect).
- `site/config/redirects.json` (starts as `[]`): the hand-made redirects. The build merges them with the post redirects, so one `_redirects` file holds both.
- `site/public/admin/js/redirects.js`: `normalizePath`, `cleanEntry`, `parseCsv`, `toCsv` (the path rule is tested to match `src/lib/redirects.ts`).
- Tests: `tests/unit/admin-redirects.test.ts` (4). 91 in total, all passing.

**Changed**
- `site/src/pages/redirects-map.json.ts`: a redirect may now point to any live page (posts, static pages, category pages, home), not only posts; hand-made entries are merged in.
- `site/public/admin/js/app.js`, `roles.js` (new `redirects` action for admin and editor), `site/package.json` and `package-lock.json` (version 0.5.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Not done yet (Phase 4)**: 410 for deleted and archived posts, category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, redirect hit counter, auto internal linking, related posts, Blogger and WordPress XML import and export.

## 0.4.0 (2026-11-14): Phase 4 (part 1), redirects and a safer move

**Added**
- `site/src/lib/redirects.ts`: redirect map builder. One path form, chains collapse to the final live URL (U3), a source that is a live page is dropped (U4), loops, dead ends and two claims on one old URL are dropped and reported.
- `site/src/pages/redirects-map.json.ts` and `site/scripts/build-redirects.mjs`: the build now writes `dist/_redirects` with real 301s for Cloudflare Pages (old URLs come from each post's `redirects` list), then removes the helper file. More than 2000 redirects stops the build with a clear message (Cloudflare limit).
- Tests: `tests/unit/redirects.test.ts` (8) and 1 dashboard test for a failed move. 87 in total, all passing.

**Fixed**
- Moving a live post (new category or permalink) wrote the new file first and then removed the old one. If the removal failed, two files shared one permalink and the whole site build stopped (U2). The dashboard now undoes the new file when the old one cannot be removed, and tells the editor what to do if even the undo fails.

**Changed**
- `site/public/admin/js/app.js`, `site/package.json` (version 0.4.0, build runs `build-redirects.mjs` after `astro build`), `site/package-lock.json` (version 0.4.0), `site/tests/unit/admin-app.test.ts`, `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Not done yet (Phase 4)**: redirect manager screen and CSV import/export, redirects for deleted or archived posts (410), category rename with bulk redirects, trailing-slash, uppercase and `index.html` rules, GitHub Pages stub pages, auto internal linking, related posts, Blogger and WordPress XML import and export.

## 0.3.0 (2026-11-14): Phase 3 (part 1), admin dashboard

**Added**
- Custom dashboard at `/admin/` (plain JavaScript, no build step, phone friendly): sign in, post list with filters and search, post editor, media library, authors, categories, site settings, robots settings, setup checklist.
- Post editor with every field from the data model, Markdown toolbar and safe preview, auto slug from the title, site-wide unique permalink check (U2), Save draft / Publish / Schedule / Update / Move to draft / Archive, date locked after publish (unlock on purpose), local autosave with restore, link to the file's Git history.
- Date and time are typed in the site time zone (U1). When the URL of a live post changes (permalink, category or date) the old URL is added to `redirects` automatically and any redirect that points to the live URL is removed (U3, U4, U8). Phase 4 turns the list into real 301s.
- Live SEO score (title, description, keyword, image, links, words, readability, headings, clickbait) and previews for Google, Discover and social cards.
- Publish rules in the editor, same as the build: image and alt text, description 50 to 160, one H1, no heading jumps, and a featured image under 1200 px wide is blocked (BUGS S9). The first publish is blocked until the time zone is confirmed.
- Media upload: converted to WebP in the browser, capped at 2400 px wide, saved as `public/media/YYYY/MM/name.webp`.
- Roles: admin, editor, author (author saves drafts only). Set in `public/admin/config.json`; a repo admin is admin by default.
- Sign in with GitHub through a Cloudflare Worker (`workers/auth/`): state cookie check, token sent only to `ADMIN_ORIGIN`, optional `ALLOWED_USERS`. A personal access token also works.
- `public/_headers` (noindex, no framing, no cache for `/admin/*`), `Disallow: /admin/` in robots.txt, admin folder skipped by the HTML validator and by Pagefind.
- `.github/workflows/icons.yml`: when `site/brand/source-icon.png` changes, icons are rebuilt and committed.
- Tests: 31 new (admin libraries, Worker, and the whole dashboard against a fake GitHub). 78 in total, all passing. `jsdom` added as a dev dependency.

**Fixed**
- `description` is now required (50 to 160 characters) only for published posts. Before, a draft saved without one would have stopped the build.

**Changed**
- `site/src/content.config.ts`, `site/src/pages/robots.txt.ts`, `site/scripts/validate-html.mjs`, `site/package.json` and `package-lock.json` (version 0.3.0), `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

**Not done yet (still Phase 3)**: pages editor, WYSIWYG mode, embed blocks, paste-from-Word cleanup, drag and drop images, menus editor, logo upload screen, one-click restore of old versions, commit to a separate `content` branch (B1).

## 0.2.3 (2026-11-14): Image width check and IndexNow fixes

**Fixed**
- Featured images narrower than 1200 px now print a `[gate]` warning at build (BUGS S9, Google Discover). It is a warning, not a stop; the Phase 3 editor will block it.
- IndexNow now pings the pages of content files that really changed in git (the post, its category page and the home page), so editing a post without setting `updated` is still pinged. Before, only items whose `date` / `updated` fell inside the time window were sent.
- Posts that a scheduled date made live are now pinged: `indexnow.yml` also runs hourly at minute 20 (after `rebuild.yml` deploys at minute 0) with a 1.25 hour window.
- Push runs of `indexnow.yml` fetch full git history (`fetch-depth: 0`) so the changed files can be compared with the previous push.

**Added**
- `site/scripts/indexnow-lib.mjs` (pure helpers), `--git <base>` and `--dry` options in `scripts/indexnow.mjs`, `imageWidth()` and `MIN_IMAGE_WIDTH` in `src/lib/media.ts`.
- Tests: `tests/unit/indexnow.test.ts` (5) and 1 image-width test in `live.test.ts`. 47 tests in total, all passing.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.2.3), `site/scripts/indexnow.mjs`, `site/src/lib/posts.ts`, `site/src/lib/media.ts`, `site/tests/unit/live.test.ts`, `.github/workflows/indexnow.yml`, `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

## 0.2.2 (2026-11-14): Fixes from the full code review

**Fixed**
- A published post with a missing local image (for example `/media/a.webp` not in `public/`) now stops the build with a clear message (BUGS S9, first step).
- A post with `status: published` and a future `date` is now treated as scheduled: it stays out of pages, feeds and sitemaps until its date, and goes live at the first hourly rebuild after that. The build prints a `[schedule]` line for each waiting post.
- Empty-site text is now written for visitors ("No stories yet / New stories will appear here soon."), not for developers.
- Empty author pages are no longer built; an author page exists only once the author has a live post.
- The sitemap index is never empty: the home page is always listed in `sitemap-pages.xml`. `lastmod` is left out when there is no real date.
- Accent colours now pass WCAG AA (4.5:1) in light and dark mode: `--acc` (fills with white text) and the new `--acc-t` (accent text). Old sunset `#d94a00` was 4.26:1; grape in dark mode was 2.78:1.
- `timeZone` in `config/site.json` is now `Asia/Kolkata` (was `UTC`), so URL dates match the publisher's day. Change it before the first post if the publisher is elsewhere: URLs are permanent.
- On Cloudflare Pages or GitHub Actions (`CF_PAGES` or `CI` set), a missing `SITE_URL` now fails the build instead of only warning.

**Added**
- `site/src/lib/live.ts`, `site/src/lib/media.ts`.
- Tests: `tests/unit/live.test.ts` (5), `tests/unit/contrast.test.ts` (2). 41 tests in total, all passing.

**Changed**
- `site/package.json` and `package-lock.json` (version 0.2.2), `site/config/site.json`, `site/src/lib/posts.ts`, `site/src/lib/site-data.ts`, `site/src/pages/sitemap-index.xml.ts`, `site/src/pages/author/[author]/[...rest].astro`, `site/src/components/Empty.astro`, `site/src/styles/global.css`, `site/scripts/validate-html.mjs`, `site/README.md`, `INCOMPLETE.md`, `CODING_PLAN.md`, `CHANGELOG.md`.

**Removed**: nothing.

## 0.2.1 (2026-11-14): Branding, real logo and icons

**Added**
- Real brand logo (orange "N" on yellow) at `site/brand/source-icon.png` (1024 px, colour-optimised, 144 KB).
- All icons made from it by `npm run icons`: `favicon.ico` (16, 32, 48), `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. They sit in `site/public/`.
- Header now shows the real logo image. Schema `publisher.logo`, `NewsMediaOrganization` logo and the web manifest icons now use it.
- `<link rel="icon" href="/favicon.ico">` in every page head.

**Changed**
- `site/scripts/make-icons.mjs`: reads `brand/source-icon.png` (not `public/`, so the big source file is not published), also writes `favicon.ico`, maskable icon uses the logo's own background colour.
- Brand colour: default accent and `theme-color` are now brand orange `#d94a00`; blue "sky" is still available in the colour dots.
- `config/site.json`: `logo` set to `/icon-512.png`, `themeColor` set to `#d94a00`.
- `src/lib/icons.ts`, `Base.astro`, `Header.astro`, `global.css`, `README.md`, `INCOMPLETE.md`.

**Removed**: nothing.

## 0.2.0 (2026-11-14): Phase 2, SEO engine

**Added**
- Head builder in `Base.astro`: Twitter tags, `og:image:alt`, `article:*` tags, verification tags (Google, Bing, Yandex from `config/site.json`), manifest, RSS link, icon links (only when real icons exist).
- JSON-LD (`src/lib/schema.ts`): `WebSite` + `SearchAction`, `NewsMediaOrganization`, `NewsArticle` (or `Article` / `BlogPosting`), `BreadcrumbList`, `CollectionPage` + `ItemList`, `ProfilePage`, `AboutPage`, `ContactPage`. Empty values are dropped, never faked.
- Sitemaps: `/sitemap-index.xml`, `/sitemap-posts.xml`, `-pages`, `-categories`, `-tags`, `-authors`, `-images`, and `/news-sitemap.xml` (last 48 h only). Empty sitemaps are not published. noindex posts, thin tags and posts with a foreign canonical are left out.
- `robots.txt` from `config/robots.json` (blocked bots, extra disallow, extra sitemaps).
- RSS: `/feed.xml` and `/feed/{category}.xml`.
- `/site.webmanifest` from `config/site.json`.
- Icon generator: `npm run icons` makes all sizes from `public/source-icon.png`. No placeholder icons are ever made.
- IndexNow: `scripts/indexnow.mjs` (key file at build, ping of changed URLs) and `.github/workflows/indexnow.yml`.
- Hourly rebuild: `.github/workflows/rebuild.yml` (news sitemap and active categories stay fresh).
- Heading linter (`src/lib/headings.ts`): the build stops if a post body has an H1 or skips a heading level.
- Pre-publish warnings (`src/lib/gate.ts`): clickbait title, under 300 words, no internal link.
- Build validator now also checks: canonical present, JSON-LD parses, article schema has all required fields, sitemaps list only real and indexable pages.
- Search page reads `?q=` so the sitelinks search box works.
- Tests: 25 new unit tests (34 in total, all passing).
- New files: `VERSIONING.md`, `CHANGELOG.md`, `config/robots.json`, `site/public/.gitkeep`.

**Changed**
- `site/package.json`: version `0.1.0` to `0.2.0`, new script `icons`, build now writes the IndexNow key file, `sharp` added as a dev dependency.
- `config/site.json`: new fields `logo`, `sameAs`, `publisherEmail`, `publisherCountry`, `newsMaxAgeHours`, `feedItems`, `verification`.
- `Listing.astro`, author page, home page, static page, article page, `posts.ts`, `readtime.ts`, `search.astro`: schema, heading lint and warnings added.
- `CODING_PLAN.md` (checkboxes), `INCOMPLETE.md` (phase status and gaps), `site/README.md`.

**Removed**: nothing.

## 0.1.0 (2026-11-13): Phase 1, base site
- Astro site, content schema, URL builder, layouts, pagination, Pagefind search, active categories, light and dark mode, build gate.

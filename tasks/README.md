# tasks/: How Work Gets Finished Properly (humans and AI)

Added in v0.101.6 (plan: `NEWS_WEBSITE_PLAN.md` Section 43, rules: `LOGICS.md` Section 31). One task is one file. Open tasks live in `tasks/open/`, finished ones in `tasks/done/`. The newest card number is the next free `T-0000`.

## States
`idea` (anyone may propose) then `ready` (the owner or an editor checked it) then `in-progress` (one person or AI claimed it) then `review` (work finished, evidence pasted) then `verify` (a second key or the live check is looking) then `done` (file moves to `tasks/done/`). `blocked` can be set at any step with a one-line `blocked-by:`.

## Risk, by what is touched
- **green**: posts, pages, authors, pictures, redirects, category names (`site/content/`, `site/public/media/`, `site/config/redirects.json`, `site/config/categories.json`).
- **yellow**: other config, site code, styles, tests, documents.
- **red**: `workers/`, `.github/`, `site/public/admin/`, `package.json` and lock files, anything with a secret, a deploy, DNS, an account outside GitHub, anything that deletes for good.

| Risk | Who may do it | Who confirms | Needs before `in-progress` |
|---|---|---|---|
| green | owner, editor, AI | the doer, with evidence | status `ready` |
| yellow | owner, AI (by pull request) | a second key | status `ready` |
| red | the owner; an AI may only prepare the pull request | the owner | `approved-by:` and a date in the card |

## Ready (before starting)
A card is `ready` only if it has: a one-sentence Goal, `owner`, `risk`, `paths`, Steps, **Done when** with checks anyone can run, an Evidence list, an "If it goes wrong" line, and a Stop-and-ask list. If one is missing it stays `idea`.

## Done (after finishing)
All "Done when" checks pass, the Evidence section is filled (see `AI_START_HERE.md` Section 5), the handoff note is written, the version and changelog are updated when code changed (`VERSIONING.md`), and a second key confirmed it when the risk is yellow or red.

## Claiming and conflicts
Set `status: in-progress` and `claimed-by: <name or tool>` with the date in the same commit that starts the work. One in-progress card per AI session. A claim older than 24 hours without a Log line is stale: anyone may release it. Work in a branch `ai/T-0000` (or `human/T-0000`), never on the same file as another open card.

## The second key (reviewer checklist, for a different AI session or a person)
1. Read the Goal and Done when, not the doer's summary. 2. Open the changed files list: is every file inside `paths`? 3. Run or read the check yourself. 4. Open the live address if there is one. 5. Try to break it: an empty field, a long title, a bad address, dark mode on a phone. 6. Look for facts that were invented. 7. Write "Confirmed by <name>, <date>" or the problem, in the Log.

## Checking the cards
Run `npm run tasks:check` in `site/` (added in v0.101.8). It prints `TASKS PASS` or one plain line per problem: missing keys, wrong values, a risk lower than the paths need, a red card without `approved-by`, missing sections, empty Evidence, a secret, a missing `needs` card, two in-progress cards on the same path.

## The Validate action
`.github/workflows/validate.yml` (added in v0.101.15) runs on every pull request and on every push to `main`, `ai/` and `human/` branches: content check with `--base`, task check, tests, build. It reads only and uses no secret. A red run means the change is not ready; a green run is evidence for the card (paste the run link). It does not replace the second key.

## The Auto-merge action
`.github/workflows/automerge.yml` (added in v0.101.16) is off until the owner sets the repository variable `AUTO_MERGE` to `on`. It then merges a green, content-only pull request from `ai/T-0000` or `human/T-0000` by itself. Anything else, and any yellow or red card, still needs a second key or the owner. Steps and the warning about protecting `main`: `site/README.md`.

## The one check before you finish
Run `npm run preflight` in `site/` (added in v0.101.9). It runs the tests, the build, the content check (`npm run check:content`, added in v0.101.14), the tasks check and the document budgets, and ends with one line: `PREFLIGHT PASS` or `PREFLIGHT FAIL: <steps>`. Paste that line in the card's Evidence. `--fast` skips tests and build; `--strict-budgets` makes an over-budget document fail (by default it is a warning until decision 43 is answered).

## The live check
For anything public, run `npm run verify:live -- https://yourdomain.com /the/new/address/` in `site/` from a computer that can reach the site (added in v0.101.10). One line per address (status, canonical, no noindex, JSON-LD parses, no http picture or script, under 3 seconds), then `VERIFY-LIVE PASS` or `FAIL`. `/old@301` expects that redirect; `--allow-noindex` is for a page meant to be noindex. Paste the lines in the card's Evidence.

## Archiving old documents
`npm run docs:archive` in `site/` (added in v0.101.11) shows which old "Open Items After vX" blocks and changelog entries would move to `docs/archive/`; it changes nothing. `npm run docs:archive -- --apply` writes the archive, proves that no word was lost, then rewrites the main file. Run it only after decision 43 is answered (task T-0008).

## The two gates
`npm run tasks:gate -- paths --branch ai/T-0006 --base origin/main` (added in v0.101.12) lists every changed file that is outside the card's `paths` (the card's own file is always allowed). `npm run tasks:gate -- close T-0006 [--owners login1,login2]` says whether a card may be closed: yellow and red cards need a Log line `Confirmed by <name>, <date>` from someone other than the doer, and a red card only from an owner login. Both print `GATE PASS` or `GATE FAIL`. Until the pull request workflow exists, the second key runs them by hand.

## The Tasks screen
In the dashboard, **Tasks** (added in v0.101.13, read only) shows what waits for the owner (shortest first), the decisions that block work, the board, and a **Copy AI prompt** button for each card. It reads this folder and `INCOMPLETE.md`; to change a card, edit the file.

## Adding a task
Copy `tasks/TEMPLATE.md` to `tasks/open/T-0000.md` (next number), or open an Issue with the Task form (the owner's issues are tasks; issues from other people are only suggestions). Keep it small: if it takes more than a day, split it.

## Owner tasks are tasks too
Anything only the owner can do (Cloudflare secrets, GitHub App, AdSense, facts about the company) has `owner: human`, a `time:` estimate and numbered steps in plain words. An AI may not mark an owner step as done without evidence from the owner.

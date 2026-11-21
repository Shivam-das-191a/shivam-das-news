// Phase 7, part 1: the required pages (PLAN 16, Google News trust pages).
// The pages are made from the owner's real details in config/publisher.json. With any detail missing nothing is made
// (PLAN 25: no placeholder text, no generic dummy pages). This file only builds text; scripts/make-pages.mjs writes the files.
import { findEmoji } from './no-emoji-lib.mjs';

/** The owner details every page needs. Each one is a single line of plain text. */
export const FIELDS = [
  { key: 'legalName', label: 'legalName (the person or company that publishes the site)', max: 120 },
  { key: 'ownerName', label: 'ownerName (the person who runs the site)', max: 120 },
  { key: 'email', label: 'email (the address readers can write to)', max: 120 },
  { key: 'address', label: 'address (a real postal address)', max: 300 },
  { key: 'country', label: 'country (where the publisher is based)', max: 80 },
  { key: 'foundedYear', label: 'foundedYear (four digits, for example 2026)', max: 4 },
  { key: 'fundingSummary', label: 'fundingSummary (one sentence: how the site pays for itself)', max: 300 },
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Returns { missing: [label], bad: [message] } for the owner details. Empty arrays mean the details are usable. */
export function checkPublisher(cfg, now = new Date()) {
  const missing = [];
  const bad = [];
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  for (const f of FIELDS) {
    const raw = c[f.key];
    const v = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!v) { missing.push(f.label); continue; }
    if (v.length > f.max) bad.push(`${f.key} is longer than ${f.max} characters`);
    if (/[\r\n\t]/.test(v)) bad.push(`${f.key} must be one line`);
    if (/[<>]/.test(v)) bad.push(`${f.key} must not contain < or >`);
    if (/[{}]/.test(v)) bad.push(`${f.key} must not contain { or }`);
    if (findEmoji(v).length) bad.push(`${f.key} must not contain an emoji (PLAN 29.3)`);
    if (/lorem ipsum|example\.com|your site name/i.test(v)) bad.push(`${f.key} looks like placeholder text`);
  }
  const email = String(c.email ?? '').trim();
  if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(email)) bad.push('email is not a valid address');
  const year = String(c.foundedYear ?? '').trim();
  if (year && !(/^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= now.getUTCFullYear())) bad.push('foundedYear must be a four digit year from 1900 to this year');
  return { missing, bad };
}

const clean = (v) => String(v).trim();

/** Which guarded features are on. Each is on only when its config file is really filled (PLAN 25: say only what the site does). */
export function featuresFrom({ contact, analytics, push } = {}) {
  const set = (o, k) => !!(o && typeof o === 'object' && String(o[k] ?? '').trim());
  return {
    contactForm: set(contact, 'endpoint') && set(contact, 'turnstileSiteKey'),
    analytics: set(analytics, 'endpoint'),
    push: set(push, 'endpoint'),
  };
}

/** BOT_PROTECTION 3d: the Privacy page section about Turnstile and the fill-time stamp. Empty text when no guarded feature is on. */
function personCheckSection(f = {}) {
  const parts = [];
  if (f.contactForm) {
    parts.push('The form on the Contact Us page uses Cloudflare Turnstile to check that the sender is a person and not a script. Turnstile runs a small check in your browser and gives Cloudflare the information it needs for that check; most people see no puzzle. Cloudflare handles that information under its own privacy policy.');
  }
  const uses = [];
  if (f.contactForm) uses.push('use the form on the Contact Us page');
  if (f.analytics) uses.push('read an article');
  if (f.push) uses.push('sign up for notifications');
  if (uses.length) {
    const list = uses.length === 1 ? uses[0] : `${uses.slice(0, -1).join(', ')} or ${uses[uses.length - 1]}`;
    parts.push(`When you ${list}, our server first gives your browser a small signed time stamp. It holds only a time and a signature. It has no name, no email address and no number that identifies you, and we do not store it. We use it to tell a person who opened the page from a script that sends data without opening it.`);
  }
  return parts.length ? `## Checks that you are a person\n${parts.join('\n\n')}\n\n` : '';
}

/** The page list: slug, title, description (max 160) and the body as Markdown. v = cleaned owner details, site = site name. */
function defs(v, site, features = {}) {
  const who = `${v.legalName}, based in ${v.country}`;
  return [
    {
      slug: 'about-us',
      title: 'About Us',
      description: `About ${site}: who publishes it, who runs it, how it works and how to reach us.`,
      body: `${site} is an English language news website. It is published by ${who}, and it has been running since ${v.foundedYear}. The site is run by ${v.ownerName}.

We write and publish news for readers. Every article has a named author, a publication date and, when it changes, an updated date.

To understand how we work, read our Editorial Policy, our Corrections Policy and our Ownership and Funding page. To reach us, use the Contact Us page.`,
    },
    {
      slug: 'contact-us',
      title: 'Contact Us',
      description: `How to write to ${site}: email address, postal address and what to include for a correction.`,
      body: `You can write to us at ${v.email}.

Our postal address is ${v.address}.

If you found a mistake in an article, write to the same email address. Put the word Correction in the subject, and add the link of the article and what is wrong.

We read every message. We cannot promise an answer to every message, but a report of a factual error is always read.`,
    },
    {
      slug: 'editorial-policy',
      title: 'Editorial Policy',
      description: `The rules ${site} follows when it writes, checks and publishes news.`,
      body: `These are the rules we follow at ${site}.

## Who writes the news
Every article carries the name of its author. The site is edited by ${v.ownerName}.

## How we check facts
We check names, numbers, dates and quotes against a source before we publish. When we can, we use the original source: the document, the statement, the person involved. When a fact cannot be confirmed, we say so in the article.

## Headlines
A headline says what the article says. We do not write headlines to mislead or to shock.

## Opinion and news
An opinion piece is labelled as an opinion. News reports tell what happened, not what we wish had happened.

## Images
We credit the source of every image we did not make ourselves.

## Paid content
Advertising does not decide what we publish. If we ever publish a sponsored article, it is marked as Sponsored.

## Mistakes
When we are wrong, we fix it and say so. See the Corrections Policy.`,
    },
    {
      slug: 'corrections-policy',
      title: 'Corrections Policy',
      description: `How ${site} fixes mistakes and how readers can report an error.`,
      body: `We make mistakes sometimes. When we do, we correct them.

## How to report an error
Write to ${v.email} with the word Correction in the subject. Add the link of the article and say what is wrong. If you have a document or a link that shows the right fact, send it.

## What we do
We check the report. If it is right, we fix the article as soon as we can and the article shows a new updated date. For a mistake that changes the meaning of the article, we also add a note at the end of the article that says what was changed.

## What we do not do
We do not quietly delete an article to hide a mistake. If an article must be removed, we say why.`,
    },
    {
      slug: 'ownership-and-funding',
      title: 'Ownership and Funding',
      description: `Who owns ${site}, who runs it and how it pays for itself.`,
      body: `## Owner
${site} is owned and published by ${who}. The site is run by ${v.ownerName}. It started in ${v.foundedYear}.

## Funding
${v.fundingSummary}

## Advertising
Advertising may appear inside articles. It is separate from our reporting. Advertisers do not see articles before they are published and cannot ask us to change them.

## Contact
Questions about ownership or funding: ${v.email}.`,
    },
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      description: `What information ${site} collects when you read it, what it does not collect and the choices you have.`,
      body: `This page explains what ${site}, published by ${v.legalName}, does with information about readers.

## What we measure
When you read an article, a small script sends us: the address of the page, a random session number that is not linked to your name, your country (read from the network, your IP address is not stored), your time zone, the site you came from, your device type and browser, how long you actively read and how far you scrolled. We use it to count readers and to see which articles are useful. The analytics script uses no cookies.

## Advertising
Advertising can appear on article pages only. It is never shown on the home page, on category pages or on pages like this one. Ad companies that show ads may set their own cookies or similar technology on your device. In some regions, such as the European Union, the United Kingdom and Switzerland, we ask for your choice first and load advertising only after you accept. Your choice is saved in your own browser and you can change it with the Ad choices button at the end of an article. The choice is asked again after some time.

${personCheckSection(features)}## Messages you send us
If you write to us, we keep your message and your email address to answer you and to keep a record of corrections. We do not sell them.

## Your choices
You can refuse or delete cookies in your browser settings. You can ask us to delete a message you sent by writing to ${v.email}.

## Changes
When this page changes, the date on it changes.

## Contact
${v.legalName}, ${v.address}. Email: ${v.email}.`,
    },
    {
      slug: 'terms-and-conditions',
      title: 'Terms and Conditions',
      description: `The terms for reading and using ${site}.`,
      body: `By using ${site} you agree to these terms. If you do not agree, please do not use the site.

## Our content
The articles, images and design on ${site} belong to ${v.legalName} or to the people who gave us permission to use them. You may quote a short part of an article with a clear link back to the article. You may not copy whole articles without our written permission.

## Accuracy
We work to be accurate, but news changes. The site is provided as it is, and we do not promise that it is free of mistakes or always available. Nothing on the site is professional advice.

## Links
Our articles can link to other websites. We do not control them and we are not responsible for what they say or do.

## Changes
We can change these terms. The new terms apply from the day they are published here.

## Law
These terms follow the laws of ${v.country}.

## Contact
${v.legalName}, ${v.address}. Email: ${v.email}.`,
    },
    {
      slug: 'cookie-policy',
      title: 'Cookie Policy',
      description: `What ${site} stores in your browser, what it never stores and how to control it.`,
      body: `This page tells you what ${site} keeps in your browser.

## What the site itself stores
The site does not set cookies of its own. It uses your browser storage for four small things:
- Your colour and dark mode choice, so the page looks the same on your next visit.
- A random session number while you read, used to count readers. It is not linked to your name and it is removed when you close the tab.
- On article pages only: a count of the pages you opened in the session, used to limit how often advertising is shown.
- On article pages only: your answer to the advertising question (Accept or No thanks), so we do not ask again each time.

## Advertising companies
Advertising can appear on article pages only. When it does, the companies that show it can set their own cookies or use similar technology on your device. Where the law asks for your choice first, such as in the European Union, the United Kingdom and Switzerland, we load advertising only after you accept. You can change your answer with the Ad choices button at the end of an article.

## How to control it
You can delete browser storage and cookies in your browser settings, or tell your browser to refuse them. The site still works. You will be asked the advertising question again where it applies.

## Contact
Questions: ${v.email}.`,
    },
    {
      slug: 'disclaimer',
      title: 'Disclaimer',
      description: `The limits of what ${site} promises: news and information only, no professional advice.`,
      body: `The articles on ${site} are published for news and general information.

## No professional advice
Nothing on this site is legal, medical, financial or other professional advice. If a decision matters to you, ask a qualified person.

## Accuracy
We work to be accurate and we fix our mistakes (see the Corrections Policy). News changes quickly, so an article shows what was known when it was written or last updated.

## Opinions
An opinion piece shows the view of its author. It is not the view of every person who works with us.

## Links to other sites
We link to other websites to help readers. We do not control them and we are not responsible for what they say or do.

## Advertising
Advertisements are not articles. Showing an advertisement does not mean that we support the product or the company.

## Contact
${v.legalName}, ${v.address}. Email: ${v.email}.`,
    },
    {
      slug: 'dmca',
      title: 'DMCA and Copyright Notices',
      description: `How to tell ${site} that something on it uses your copyright work without permission.`,
      body: `We respect the rights of authors, photographers and other creators. If you believe that something on ${site} uses your work without permission, tell us.

## What to send
Write to ${v.email} with the word Copyright in the subject, and include:
- Your name and how we can reach you.
- A description of your work, and a link to it if it is online.
- The link of the page on ${site} that uses it.
- A statement that you believe in good faith that the use is not allowed by you, by your agent or by the law.
- A statement that what you wrote is accurate and that you are the owner of the work or are allowed to act for the owner.
- Your name typed at the end as your signature.

## What we do
We read the notice. If it is complete and the claim is reasonable, we remove the material or stop showing it, and we may tell the person who supplied it. If you think we removed something by mistake, you can write to us in the same way and explain why.

## Please be truthful
A false notice can have legal consequences. If you are not sure, ask a lawyer first.

## Our address
${v.legalName}, ${v.address}.`,
    },
    {
      slug: 'advertise-with-us',
      title: 'Advertise With Us',
      description: `How to ask ${site} about advertising, and the rules that keep advertising apart from our news.`,
      body: `If you want to advertise on ${site}, write to ${v.email}. Put the word Advertising in the subject, and tell us who you are, what you want to promote and what you have in mind. We do not publish a price list on this page.

## Where advertising can appear
Advertising can appear inside article pages only. It is never shown on the home page, on category pages, on the search page or on pages like this one.

## What advertising cannot do
Advertising is separate from our reporting. An advertiser cannot choose, see or change an article before it is published, and cannot pay for good coverage or for the removal of an article. If we ever publish a sponsored article, it is marked as Sponsored, and the Editorial Policy applies to it as well.

## What we may refuse
We can refuse any advertisement. We do not accept advertising that is false, that misleads readers or that breaks the law.

## Contact
${v.legalName}, ${v.address}. Email: ${v.email}.`,
    },
    {
      slug: 'affiliate-disclosure',
      title: 'Affiliate Disclosure',
      description: `What ${site} tells you when a link may earn us money, and why it does not change what we write.`,
      body: `Some websites earn a small fee when a reader buys something after following a link. This page tells you how ${site} treats such links.

## What we tell you
If an article on ${site} contains an affiliate link, a link that can earn us a fee, the article says so near the link. A link that is not marked is not an affiliate link.

## What it costs you
A fee, if there is one, is paid to us by the seller. The price you pay does not go up because you used our link.

## What it does not change
A fee does not decide what we write. We do not praise a product because it pays, and we do not hide a fault to make a sale. See the Editorial Policy.

## Other kinds of income
Advertising is a different kind of income. You can read about it on the Ownership and Funding page and on the Advertise With Us page.

## Contact
Questions about a link: ${v.email}.`,
    },
  ];
}

const yaml = (s) => JSON.stringify(s); // a JSON string is a valid YAML string

/**
 * Builds the pages. status is 'draft' (default, the owner reads first) or 'published'.
 * Returns [{ slug, file, markdown }]. Throws with a plain message when the details are missing or bad.
 */
export function buildPages({ publisher, siteName, now = new Date(), status = 'draft', features = {} }) {
  if (status !== 'draft' && status !== 'published') throw new Error("status must be 'draft' or 'published'");
  const site = clean(siteName ?? '');
  if (!site) throw new Error('config/site.json has no siteName');
  const { missing, bad } = checkPublisher(publisher, now);
  if (missing.length || bad.length) {
    const lines = [...missing.map((m) => `missing: ${m}`), ...bad.map((b) => `wrong: ${b}`)];
    throw new Error(`config/publisher.json is not ready:\n  ${lines.join('\n  ')}`);
  }
  const v = Object.fromEntries(FIELDS.map((f) => [f.key, clean(publisher[f.key])]));
  const iso = now.toISOString();
  return defs(v, site, features).map((d) => {
    if (!SLUG.test(d.slug)) throw new Error(`bad slug ${d.slug}`);
    if (d.description.length > 160) throw new Error(`${d.slug}: description is longer than 160 characters (${d.description.length})`);
    const markdown = `---\ntitle: ${yaml(d.title)}\npermalink: ${yaml(d.slug)}\ndate: ${iso}\ndescription: ${yaml(d.description)}\nstatus: ${status}\n---\n\n${d.body}\n`;
    return { slug: d.slug, file: `${d.slug}.md`, markdown };
  });
}

/** Splits the pages into what to write and what to leave alone (a page that already exists is never changed: its date is part of its address). */
export function planWrites(pages, existingPermalinks) {
  const have = new Set(existingPermalinks);
  return { write: pages.filter((p) => !have.has(p.slug)), skip: pages.filter((p) => have.has(p.slug)) };
}

# HTML.md: HTML Structure Specification

Templates use `{{variables}}` filled from real post data at build time. No demo text is shipped.

## 1. Article Page Skeleton
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{metaTitle}} | {{siteName}}</title>
  <meta name="description" content="{{description}}">
  <link rel="canonical" href="{{canonicalUrl}}">
  <link rel="amphtml" href="{{ampUrl}}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="{{themeColor}}">
  <meta name="color-scheme" content="light dark">

  <!-- Open Graph / Twitter -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="{{siteName}}">
  <meta property="og:title" content="{{title}}">
  <meta property="og:description" content="{{description}}">
  <meta property="og:url" content="{{canonicalUrl}}">
  <meta property="og:image" content="{{imageUrl}}">
  <meta property="og:locale" content="en_US">
  <meta property="article:published_time" content="{{publishedISO}}">
  <meta property="article:modified_time" content="{{modifiedISO}}">
  <meta property="article:section" content="{{categoryName}}">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Icons and manifest -->
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <link rel="alternate" type="application/rss+xml" title="{{siteName}}" href="/feed.xml">
  <link rel="preload" as="image" href="{{heroImage}}" fetchpriority="high">
  <style>/* inlined CSS for this page */</style>
  <script type="application/ld+json">{{jsonLdNewsArticle}}</script>
  <script type="application/ld+json">{{jsonLdBreadcrumb}}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header"> ...logo, nav, search... </header>
  <main id="main">
    <nav aria-label="Breadcrumb"> ... </nav>
    <article>
      <header>
        <p class="kicker"><a href="{{categoryUrl}}">{{categoryName}}</a></p>
        <h1>{{title}}</h1>
        <p class="meta">By <a rel="author" href="{{authorUrl}}">{{authorName}}</a>
          · <time datetime="{{publishedISO}}">{{publishedHuman}}</time>
          · Updated <time datetime="{{modifiedISO}}">{{modifiedHuman}}</time>
          · {{readTime}} min read</p>
      </header>
      <figure>
        <img src="{{heroImage}}" srcset="{{heroSrcset}}" sizes="(min-width:900px) 800px, 100vw"
             width="{{w}}" height="{{h}}" alt="{{imageAlt}}" fetchpriority="high">
        <figcaption>{{caption}} {{credit}}</figcaption>
      </figure>
      <div class="key-points">...</div>
      <div class="toc">...</div>
      <div class="content">{{articleHtml}}</div>
      <footer> tags, share buttons, author box, corrections log </footer>
    </article>
    <aside aria-label="Related"> related, trending </aside>
  </main>
  <footer class="site-footer"> menus, legal links, copyright </footer>
  <script>/* bundled JS: theme, search, analytics beacon, ads loader */</script>
</body>
</html>
```

## 2. Rules
- Exactly **one H1** (the title). Content headings start at H2, no skipped levels.
- Use `<article>`, `<time>`, `<figure>`, `<nav>`, `<aside>`, `<main>` correctly.
- Every image has `alt`, `width`, `height`; only the hero is not lazy-loaded.
- External links: `rel="noopener"`; sponsored: `rel="sponsored nofollow"`; user content: `rel="ugc nofollow"`.
- Ad containers: `<div class="ad-slot" data-slot="..." style="min-height:...">` empty until allowed.
- All text in the page source (no content injected by JS).
- Valid HTML checked in CI.
- **No emojis (PLAN 29.3).** Icons are inline `<svg class="icon" aria-hidden="true" focusable="false">` only. Never an emoji, never a symbol character or HTML entity used as a picture (for example an arrow, a half circle or three dots). The build fails on any emoji in a page.

## 3. Page Types
| Type | Main elements |
|---|---|
| Home | Breaking strip, lead story, category sections, trending |
| Article | Skeleton above |
| Category | H1 category name, description, post list, pagination |
| Tag | Same as category |
| Author | H1 name, bio, photo, post list, `ProfilePage` schema |
| Page | H1 title, content, no ads on legal pages |
| Search | Form, results container, `noindex` |
| 404 | Message, search, latest posts |
| Contact | Form, chat widget, contact details |
| AMP | `<html amp lang="en">`, AMP boilerplate, inline CSS under 75 KB, no custom JS |

## 4. JSON-LD Template (NewsArticle)
```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "{{title}}",
  "image": ["{{image16x9}}", "{{image4x3}}", "{{image1x1}}"],
  "datePublished": "{{publishedISO}}",
  "dateModified": "{{modifiedISO}}",
  "author": [{"@type": "Person", "name": "{{authorName}}", "url": "{{authorUrl}}"}],
  "publisher": {"@type": "NewsMediaOrganization", "name": "{{siteName}}",
                "logo": {"@type": "ImageObject", "url": "{{logoUrl}}"}},
  "mainEntityOfPage": {"@type": "WebPage", "@id": "{{canonicalUrl}}"},
  "articleSection": "{{categoryName}}",
  "keywords": "{{keywords}}",
  "wordCount": {{wordCount}}
}
```

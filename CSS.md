# CSS.md: Styling System

## 1. Approach
- Tailwind CSS (utility) with a small custom layer for article typography.
- **Inline critical CSS per page**; unused CSS removed at build. Shared remainder cached.
- Mobile-first; no CSS frameworks that need heavy JS.
- AMP version: same design, trimmed CSS under 75 KB.

## 2. Design Tokens (CSS variables)
```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f6f7f9;
  --color-text: #14171a;
  --color-muted: #5b6670;
  --color-border: #e3e7ec;
  --color-accent: {{accent}};
  --font-body: "{{bodyFont}}", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-head: "{{headFont}}", Georgia, "Times New Roman", serif;
  --radius: 10px;
  --space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem;
  --space-6: 1.5rem; --space-8: 2rem; --space-12: 3rem;
  --measure: 70ch;
}
@media (prefers-color-scheme: dark) {
  :root { --color-bg:#0e1114; --color-surface:#171b20; --color-text:#e8ecef;
          --color-muted:#9aa5b0; --color-border:#2a3036; }
}
[data-theme="dark"]  { /* manual toggle overrides */ }
[data-theme="light"] { /* manual toggle overrides */ }
```

## 5. Breakpoints
| Name | Min width |
|---|---|
| sm | 480 px |
| md | 768 px |
| lg | 1024 px |
| xl | 1280 px |

## 6. Typography
- Fluid type with `clamp()`: body 16 to 19 px, H1 28 to 44 px.
- Line height 1.6 body, 1.2 headings; max line length `var(--measure)`.
- Article blockquote, lists, tables, code, figure captions all styled.
- Self-hosted fonts, `font-display: swap`, subset to Latin.

## 7. Layout
- CSS Grid for page layout, Flexbox for components.
- Article: single column up to md; content plus sidebar from lg.
- Container max width 1200 px; article column about 720 to 800 px.
- Use `dvh` with `vh` fallback; `aspect-ratio` for media.

## 8. Components
Header and mobile menu, search box, breadcrumbs, post card (large, medium, compact), breaking strip, pagination, category chips, author box, share bar, table of contents, key points box, related posts, ad slot, cookie banner, chat bubble, toast messages, admin screens.

## 9. Layout Stability (CLS) Rules
- Every image has width/height or `aspect-ratio`.
- Ad slots have `min-height` per breakpoint.
- Fonts use size-adjust fallbacks to avoid shift.
- Chat bubble and cookie banner are fixed and never push content.

## 10. Accessibility and Preferences
- Visible focus: `:focus-visible { outline: 3px solid var(--color-accent); }`
- `prefers-reduced-motion`: disable animations.
- Contrast at least 4.5:1 in light and dark.
- `color-scheme: light dark` set.

## 11. Print
Hide header, ads, share bar, related; show article title, byline, date, content, and the page URL.

## 12. Browser Support
Last 2 versions of Chrome, Safari, Firefox, Edge, Samsung Internet; iOS 14+ and Android 8+. Provide fallbacks for `:has()`, `dvh`, `clamp()`, `aspect-ratio` where needed.

## 13. Icons (SVG Only, No Emojis)
HARD RULE (PLAN 29.3): the site never uses emojis, and never uses letters or symbols as pictures (no arrow characters, no check marks, no half-circle or dots characters). Every icon is an inline SVG.
- Drawn in `site/src/lib/svg-icons.ts`: 24 x 24 view box, outline style, 2 px stroke, round ends. Used with `<Icon name="..." size={20} />`.
- Colour: `stroke: currentColor` (and `fill: currentColor` for solid parts). Never a fixed colour, so dark mode and hover just work. The base class is `.icon` in `global.css`.
- Icon with text: put the SVG and the text in a `.btn.ico` (flex, 8 px gap). Icon only: `.btn` with an `aria-label`.
- Decorative: `aria-hidden="true"` and `focusable="false"`; the name comes from the text or `aria-label` of the button or link.
- Size: 18 px in text buttons, 22 to 24 px in header buttons, tap target still at least 44 px.
- Current icons: `search`, `contrast` (dark mode), `menu-dots`, `arrow-left`, `arrow-right`, `alert`, `bell` (push soft prompt, v0.56.0; header link, v0.57.0; article button, v0.63.0), `x` (the X logo), `mark-h` and `mark-s` (the owner's project marks; colours come from the `mk-*` classes in `global.css`). To add one: add it to `svg-icons.ts`, then to this list.
- The dashboard has its own small copy (`public/admin/js/ui.js`, `icon()`); a test fails if the drawings differ from the site.
- Social share buttons and brand logos are SVG too, never emoji.

## 14. Newsroom Theme and Dark Mode Tokens (plan added in v0.101.5, PLAN 42, LOGICS 30; not built yet)
The real stylesheet is plain CSS in `src/styles/global.css` (the Tailwind lines above are the early plan). The planned tokens, written once in `theme/tokens.json` and generated into `src/styles/tokens.css`:
```css
:root { --bg:#ffffff; --surface:#f4f6fa; --surface-2:#e9edf4; --text:#0f172a; --text-body:#0f172a;
        --muted:#475569; --border:#d5dce8; --border-strong:#7a8aa3; --acc:#c2410c; --acc-t:#b43a0a; }
/* dark, for the system setting and for a forced choice */
:root[data-theme="dark"] { --bg:#0b1220; --surface:#111a2e; --surface-2:#18233d; --text:#e6ebf5; --text-body:#dbe3f1;
        --muted:#9fb0cc; --border:#2a3752; --border-strong:#5f7090; --acc:#c2410c; --acc-t:#ff8f55; color-scheme:dark; }
```
Rules: three surfaces and no shadow in dark; text 4.5 : 1 or more on every surface; input and button borders 3 : 1 or more; accent text brighter than the fill in dark; no raw hex in components; `data-look="playful"` keeps today's values; print is light. The contrast test reads `tokens.json`.

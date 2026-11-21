// Part 8e (POLISH, Visual and Accessibility): the final style of the site keeps three promises.
// Pure function, no files, no network.
//   checkCssPolish(css): { errors, warnings }
//   errors: a print style is missing (@media print); a visible focus ring is missing (a :focus-visible rule with an outline);
//           the style moves things (transition, animation, smooth scroll) but has no @media (prefers-reduced-motion) block
const MOTION = /(?:^|[;{\s])(?:transition|animation|scroll-behavior)(?:-[a-z-]+)?\s*:\s*(?!none\b|0s?\b|0ms\b|auto\b|initial\b|unset\b)[^;}]+/i;

export function checkCssPolish(css) {
  const errors = [], warnings = [];
  if (typeof css !== 'string' || !css.trim()) return { errors: ['no style was found for the pages'], warnings };
  const c = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/@media[^{]*\bprint\b/i.test(c)) errors.push('the style has no print rule (@media print)');
  let focus = false;
  for (const m of c.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^{}]*)\}/gi))
    if (/(?:^|[;\s])outline(?:-width)?\s*:\s*(?!none\b|0\b)[^;}]+/i.test(m[2])) focus = true;
  if (!focus) errors.push('the style has no visible focus ring (a :focus-visible rule with an outline)');
  if (MOTION.test(c) && !/@media[^{]*prefers-reduced-motion/i.test(c))
    errors.push('the style uses motion (transition, animation or smooth scroll) but has no @media (prefers-reduced-motion) rule');
  return { errors, warnings };
}

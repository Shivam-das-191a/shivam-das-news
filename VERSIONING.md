# VERSIONING.md: Rules for Every Code Edit

Anyone who edits code in this project follows these steps every time:

1. **Bump the version** in `site/package.json`.
   - Small fix: `0.2.0` to `0.2.1`
   - New feature or finished phase: `0.2.0` to `0.3.0`
   - Big change that breaks old content or URLs: `0.x` to `1.0.0`
2. **Add one entry at the top of `CHANGELOG.md`**: version, date, what changed, which files were added, changed or removed.
3. **Name the zip with the version**: `News_Website_Plan_v0.2.0.zip`.
4. **Update `INCOMPLETE.md`**: phase status and open items.
5. **Run before zipping**: `npm test` and `npm run build` must pass.
6. **Never leave test data in the zip**: no demo posts, no placeholder icons, no `node_modules`, `dist` or `.astro` folders.
7. **Never delete a file silently**: a removed file must be listed in the changelog.
8. **No emojis, ever.** Icons are inline SVG only (PLAN 29.3). `npm test` and `npm run build` fail if one slips in.

// Roles (PLAN 19 #24). These control what the dashboard shows. The real lock is GitHub itself:
// only people with write access to the repo can commit, and the auth Worker can limit who may sign in.
const RULES = {
  admin: ['post:draft', 'post:publish', 'post:edit-any', 'post:noindex', 'post:canonical', 'post:raw', 'media', 'media:delete', 'media:replace', 'media:rename', 'authors', 'categories', 'redirects', 'import', 'export', 'links', 'ads', 'analytics', 'settings', 'robots', 'tasks'],
  editor: ['post:draft', 'post:publish', 'post:edit-any', 'post:noindex', 'post:canonical', 'media', 'media:delete', 'media:replace', 'media:rename', 'authors', 'categories', 'redirects', 'import', 'export', 'links', 'tasks'],
  author: ['post:draft', 'media'],
};

export const can = (role, action) => (RULES[role] || []).includes(action);

/** config.roles wins; with no entry, a repo admin is an admin; everyone else has no access. */
export function roleOf(config, login, perms = {}) {
  const r = (config.roles || {})[login];
  if (r && RULES[r]) return r;
  return perms.admin ? 'admin' : null;
}

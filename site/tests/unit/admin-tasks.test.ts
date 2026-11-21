// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toBase64 } from '../../public/admin/js/github.js';
import { can } from '../../public/admin/js/roles.js';
import { readCard, minutesOf, parseDecisions, unmetNeeds, board, waitingForOwner, blockingDecisions, aiPrompt, sectionText } from '../../public/admin/js/tasks.js';

const card = (o: Record<string, string>, extra = '') => `---\nid: ${o.id}\ntitle: ${o.title || 'A title'}\nowner: ${o.owner || 'ai'}\nrisk: ${o.risk || 'green'}\nstatus: ${o.status || 'ready'}\ntime: ${o.time || '30 min'}\nneeds: ${o.needs || '[]'}\npaths: ${o.paths || '[site/content/blogs/]'}\napproved-by: ${o.approved || ''}\nclaimed-by:\ncreated: 2026-11-16\n---\n\n## Goal\n${o.goal || 'One sentence goal.'}\n\n## Steps\n1. Do it.\n${extra}`;

const INCOMPLETE = `# Open\n\n## Decisions Still Needed\n| # | Item | Options | Needed by |\n|---|---|---|---|\n| 3 | Admin | Decided in v0.3.0: custom dashboard | Done |\n| 8 | Time zone | Set to Asia/Kolkata | Phase 1 |\n| 17 | Repository: keep it public or private | A public repo shows drafts | Before the first real post |\n| 43 | Document size budgets | AI_START_HERE 900 (proposed) | Task T-0008 |\n\n## Not Yet Fully Defined\n| 99 | Not a decision | x | y |\n`;

describe('tasks.js (pure)', () => {
  it('reads a card, lists, empty and filled keys, and the goal', () => {
    const c = readCard(card({ id: 'T-0002', needs: '[T-0001, decision-17]', paths: '[a/, b.md]', owner: 'human', time: '1 day', approved: 'Owner, 2026-11-16' }), 'tasks/open/T-0002.md');
    expect(c).toMatchObject({ id: 'T-0002', owner: 'human', status: 'ready', needs: ['T-0001', 'decision-17'], paths: ['a/', 'b.md'], approvedBy: 'Owner, 2026-11-16', claimedBy: '', goal: 'One sentence goal.', problem: '' });
  });
  it('a broken card does not throw and says what is wrong', () => {
    const c = readCard('just text, no front matter', 'tasks/open/T-0099.md');
    expect(c.id).toBe('T-0099');
    expect(c.problem).toMatch(/no id or no status/);
    expect(readCard('').problem).not.toBe('');
  });
  it('sectionText returns only the named section', () => {
    expect(sectionText('## Goal\nA\n\n## Steps\n1. B', 'Steps')).toBe('1. B');
    expect(sectionText('## Goal\nA', 'Nope')).toBe('');
  });
  it('minutesOf reads minutes, hours and days; unknown sorts last', () => {
    expect(minutesOf('20 min')).toBe(20);
    expect(minutesOf('2 hours')).toBe(120);
    expect(minutesOf('1 hour')).toBe(60);
    expect(minutesOf('1 day')).toBe(480);
    expect(minutesOf('soon')).toBe(Infinity);
    expect(minutesOf(undefined)).toBe(Infinity);
  });
  it('parseDecisions reads only the decision table and knows which rows are decided', () => {
    const d = parseDecisions(INCOMPLETE);
    expect(d.map((x) => x.num)).toEqual([3, 8, 17, 43]);
    expect(d.find((x) => x.num === 3)!.decided).toBe(true);
    expect(d.find((x) => x.num === 8)!.decided).toBe(false);
    expect(d.find((x) => x.num === 17)).toMatchObject({ item: 'Repository: keep it public or private', neededBy: 'Before the first real post', decided: false });
    expect(parseDecisions('')).toEqual([]);
  });
  it('the real INCOMPLETE.md has the 46 decisions', async () => {
    const { readFileSync } = await import('node:fs');
    const d = parseDecisions(readFileSync('../INCOMPLETE.md', 'utf8'));
    expect(d.length).toBeGreaterThanOrEqual(46);
    expect(d.every((x) => Number.isInteger(x.num) && x.item)).toBe(true);
  });
  it('unmetNeeds: a task not done, a decision not decided, and a missing decision', () => {
    const dec = parseDecisions(INCOMPLETE);
    const a = readCard(card({ id: 'T-0001', status: 'done' }), 'tasks/done/T-0001.md');
    const b = readCard(card({ id: 'T-0002', needs: '[T-0001, T-0003, decision-17, decision-3, decision-77]' }), 'tasks/open/T-0002.md');
    const c = readCard(card({ id: 'T-0003' }), 'tasks/open/T-0003.md');
    const need = unmetNeeds(b, [a, b, c], dec);
    expect(need).toHaveLength(3);
    expect(need.join('|')).toMatch(/T-0003 is not done yet/);
    expect(need.join('|')).toMatch(/decision 17: Repository/);
    expect(need.join('|')).toMatch(/decision 77 \(not found/);
  });
  it('board groups by status and an unknown status goes to idea', () => {
    const cols = board([readCard(card({ id: 'T-0002', status: 'review' })), readCard(card({ id: 'T-0001', status: 'review' })), readCard(card({ id: 'T-0003', status: 'weird' }))]);
    expect(cols.review.map((c) => c.id)).toEqual(['T-0001', 'T-0002']);
    expect(cols.idea.map((c) => c.id)).toEqual(['T-0003']);
  });
  it('waitingForOwner keeps human cards that are not done, shortest first', () => {
    const cs = [
      readCard(card({ id: 'T-0001', owner: 'human', time: '1 day' })),
      readCard(card({ id: 'T-0002', owner: 'human', time: '10 min' })),
      readCard(card({ id: 'T-0003', owner: 'ai', time: '5 min' })),
      readCard(card({ id: 'T-0004', owner: 'human', time: '5 min', status: 'done' })),
    ];
    expect(waitingForOwner(cs).map((c) => c.id)).toEqual(['T-0002', 'T-0001']);
  });
  it('blockingDecisions lists undecided decisions that an open card needs', () => {
    const dec = parseDecisions(INCOMPLETE);
    const cs = [readCard(card({ id: 'T-0004', needs: '[decision-17]' })), readCard(card({ id: 'T-0008', needs: '[decision-43]', status: 'done' })), readCard(card({ id: 'T-0009', needs: '[decision-3]' }))];
    expect(blockingDecisions(cs, dec).map((d) => [d.num, d.behind])).toEqual([[17, ['T-0004']]]);
  });
  it('aiPrompt names the card, the paths, the branch and the card text; red without approval says wait', () => {
    const red = readCard(card({ id: 'T-0007', risk: 'red', paths: '[workers/push/]' }), 'tasks/open/T-0007.md');
    const p = aiPrompt(red);
    expect(p).toContain('task T-0007');
    expect(p).toContain('AI_START_HERE.md');
    expect(p).toContain('workers/push/');
    expect(p).toContain('ai/T-0007');
    expect(p).toContain('has no approved-by line');
    expect(p).toContain('tasks/open/T-0007.md');
    expect(p).toContain('id: T-0007');
    const ok = aiPrompt(readCard(card({ id: 'T-0007', risk: 'red', approved: 'Owner, 2026-11-16' })));
    expect(ok).not.toContain('has no approved-by line');
    expect(aiPrompt(readCard(card({ id: 'T-0010', paths: '[]' })))).toContain('(none listed: ask the owner)');
  });
  it('roles: admin and editor see Tasks, author does not', () => {
    expect(can('admin', 'tasks')).toBe(true);
    expect(can('editor', 'tasks')).toBe(true);
    expect(can('author', 'tasks')).toBe(false);
  });
});

const files: Record<string, string> = {
  'tasks/open/T-0001.md': card({ id: 'T-0001', title: 'Fill the publisher facts', owner: 'human', time: '20 min' }),
  'tasks/open/T-0002.md': card({ id: 'T-0002', title: 'Publish five articles', owner: 'human', time: '1 day', needs: '[T-0001]' }),
  'tasks/open/T-0004.md': card({ id: 'T-0004', title: 'Narrow the sign-in permission', owner: 'human', risk: 'red', status: 'idea', time: '15 min', needs: '[decision-17]', paths: '[workers/auth/wrangler.toml]' }),
  'tasks/done/T-0003.md': card({ id: 'T-0003', title: 'Already finished', status: 'done' }),
  'INCOMPLETE.md': INCOMPLETE,
  'site/config/site.json': JSON.stringify({ siteName: 'Shivam Das News', timeZone: 'Asia/Kolkata', timeZoneConfirmed: true }),
  'site/content/authors/shivam-das.json': JSON.stringify({ name: 'Shivam Das', bio: '' }),
};
const puts: string[] = [];
function api(url: string, init: any = {}) {
  const u = new URL(url, 'http://localhost');
  const json = (o: any, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }));
  if (init.method && init.method !== 'GET') puts.push(`${init.method} ${u.pathname}`);
  if (u.pathname === '/admin/config.json') return json({ repo: 'o/r', branch: 'main', contentRoot: 'site', authUrl: '', roles: {} });
  if (u.pathname === '/user') return json({ login: 'owner' });
  if (u.pathname === '/repos/o/r') return json({ html_url: 'https://github.com/o/r', permissions: { admin: true, push: true } });
  if (u.pathname.startsWith('/repos/o/r/git/trees')) return json({ tree: Object.keys(files).map((p) => ({ path: p, type: 'blob', sha: 'sha-' + p })) });
  if (u.pathname.startsWith('/repos/o/r/git/blobs/')) { const p = decodeURIComponent(u.pathname.split('/blobs/sha-')[1]); return json({ content: toBase64(files[p]) }); }
  const path = decodeURIComponent(u.pathname.replace('/repos/o/r/contents/', ''));
  if (u.pathname.startsWith('/repos/o/r/contents/')) return files[path] !== undefined ? json({ content: toBase64(files[path]), sha: 'sha-' + path }) : json({ message: 'Not Found' }, 404);
  return json({ message: 'unhandled ' + u.pathname }, 500);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const texts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent!.trim());

describe('Tasks screen (jsdom)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; puts.length = 0; sessionStorage.setItem('adm.token', 'tok'); location.hash = ''; });
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((u: any, i: any) => api(String(u), i)));
    const { boot } = await import('../../public/admin/js/app.js');
    await boot(document.getElementById('app')!);
    location.hash = '#/tasks';
    await tick(400);
  };
  it('shows the nav item, the owner list shortest first, the blocking decision and the board', async () => {
    await open();
    expect(texts('nav a')).toContain('Tasks');
    const html = document.body.textContent!;
    expect(html).toContain('Waiting for the owner (3)');
    expect(html.indexOf('T-0004')).toBeLessThan(html.indexOf('T-0001')); // 15 min before 20 min
    expect(html.indexOf('T-0001')).toBeLessThan(html.indexOf('T-0002')); // 20 min before 1 day
    expect(html).toContain('Decisions that block work (1)');
    expect(html).toContain('Decision 17: Repository: keep it public or private. Blocks T-0004.');
    expect(html).toContain('Waiting for: T-0001 is not done yet');
    expect(html).toContain('Red: no owner approval yet.');
    expect(texts('.col h3')).toEqual(expect.arrayContaining(['Idea (1)', 'Ready (2)', 'Done (1)']));
  });
  it('Copy AI prompt puts the prompt on the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copy AI prompt') as HTMLElement;
    btn.click();
    await tick();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect((writeText.mock.calls[0] as unknown as string[])[0]).toContain('AI_START_HERE.md');
  });
  it('is read only: nothing is written to GitHub', async () => {
    await open();
    expect(puts).toEqual([]);
  });
});

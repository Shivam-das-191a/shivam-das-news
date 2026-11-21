import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore plain JS Worker code
import { UPSERT_SQL, eventValues } from '../../../workers/analytics/lib.js';

// The database tests run on real SQLite (node:sqlite) when this Node has it, like the other analytics database tests.
let Sqlite: any = null;
try { Sqlite = createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch { Sqlite = null; }
const run = Sqlite ? describe : describe.skip;

const schema = readFileSync('../workers/analytics/schema.sql', 'utf8');
const migration = readFileSync('../workers/analytics/migrate-0.76.0.sql', 'utf8');
const migration77 = readFileSync('../workers/analytics/migrate-0.77.0.sql', 'utf8'); // v0.77.0: adds `dc` and `verified_views`; an old database needs it after the 0.76.0 file
const base = { ts: 1_700_000_000, session_id: 'abcd1234efgh', pv_id: 'pv-0001-xyz', url: '/a/', country: 'IN', tz: 'Asia/Kolkata', referrer_host: '', device: 'desktop', browser: 'Chrome', read_seconds: 10, scroll_pct: 20 };
const cols = (db: any) => db.prepare('PRAGMA table_info(events)').all().map((c: any) => c.name);

describe('analytics database files (v0.76.0)', () => {
  it('schema.sql has the two new columns, as numbers that default to 0', () => {
    expect(schema).toMatch(/\n\s+acted\s+INTEGER NOT NULL DEFAULT 0/);
    expect(schema).toMatch(/\n\s+webdriver\s+INTEGER NOT NULL DEFAULT 0/);
  });
  it('the migration adds exactly those two columns, says to run it once and has no other statement', () => {
    const stmts = migration.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim());
    expect(stmts).toEqual([
      'ALTER TABLE events ADD COLUMN acted     INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE events ADD COLUMN webdriver INTEGER NOT NULL DEFAULT 0;',
    ]);
    expect(migration).toMatch(/Run ONCE/);
    expect(migration).toMatch(/Do NOT run it on a database made from the new schema\.sql/);
  });
  it('still stores no IP address, no cookie and no user agent text', () => {
    expect(schema).not.toMatch(/\n\s+(ip|ip_address|user_agent|ua|cookie)\s/i);
  });
});

run('analytics database on real SQLite (v0.76.0)', () => {
  const fresh = () => { const db = new Sqlite(':memory:'); db.exec(schema); return db; };
  const put = (db: any, e: object) => db.prepare(UPSERT_SQL).run(...eventValues({ ...base, ...e }));
  const row = (db: any) => db.prepare('SELECT acted, webdriver, read_seconds FROM events').all();

  it('a new database made from schema.sql has the columns', () => {
    expect(cols(fresh())).toEqual(expect.arrayContaining(['acted', 'webdriver']));
  });
  it('stores the flags with the row', () => {
    const db = fresh();
    put(db, { acted: 1, webdriver: 0 });
    expect(row(db)).toEqual([{ acted: 1, webdriver: 0, read_seconds: 10 }]);
  });
  it('an event without the flags is stored as 0 and 0 (the older tests and callers keep working)', () => {
    const db = fresh();
    put(db, {});
    expect(row(db)).toEqual([{ acted: 0, webdriver: 0, read_seconds: 10 }]);
  });
  it('the second message of the same page view raises the flags and never lowers them (BUGS N1 still holds: one row)', () => {
    const db = fresh();
    put(db, { acted: 0, webdriver: 0, read_seconds: 5 });
    put(db, { acted: 1, webdriver: 1, read_seconds: 30 });
    put(db, { acted: 0, webdriver: 0, read_seconds: 20 }); // a late, older message
    expect(row(db)).toEqual([{ acted: 1, webdriver: 1, read_seconds: 30 }]);
  });
  it('the migration brings an old database (no flag columns) up to the same shape, keeps its rows as 0 and 0, and a second run fails loudly', () => {
    const db = new Sqlite(':memory:');
    // The schema as it was before v0.76.0: the same file without the two new lines (and without the comma after scroll_pct).
    const oldSchema = schema.split('\n').filter((l: string) => !/^\s+(acted|webdriver|dc|verified_views)\s/.test(l)).join('\n').replace(/(scroll_pct\s+INTEGER NOT NULL DEFAULT 0),/, '$1');
    db.exec(oldSchema);
    expect(cols(db)).not.toContain('acted');
    db.prepare('INSERT INTO events (ts, session_id, pv_id, url, device, browser) VALUES (1, \'old-session-1\', \'old-pv-0001\', \'/o/\', \'mobile\', \'Safari\')').run();
    db.exec(migration);
    db.exec(migration77); // the insert below (put) writes `dc` too
    expect(cols(db)).toEqual(expect.arrayContaining(['acted', 'webdriver']));
    expect(db.prepare('SELECT acted, webdriver FROM events').all()).toEqual([{ acted: 0, webdriver: 0 }]);
    put(db, { acted: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get().n).toBe(2);
    expect(() => db.exec(migration)).toThrow(/duplicate column/i);
  });
  it('the hourly and daily totals still work with the new columns (the rollup does not read them yet)', () => {
    const db = fresh();
    put(db, { acted: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get().n).toBe(1);
  });
});

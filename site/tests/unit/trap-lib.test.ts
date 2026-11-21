import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS Worker file
import { isTrapRequest, normalizeIp, isReservedIp, claimsGoodBot, decideTrapHit, blockItem, untilOf, expiredItemIds, countOurs, hasRoom, addRequest, deleteRequest, TRAP_PATH, BLOCK_HOURS, MAX_PER_CALL } from '../../../workers/trap/lib.js';

// v0.89.0 (BOT_PROTECTION Part 7a): the rules of the trap link. Plain functions: no network, no clock, no secret.
const NOW = Date.parse('2026-11-16T10:00:00.000Z');
const ACC = 'a'.repeat(32);
const LST = '0123456789abcdef0123456789abcdef';

describe('the trap request', () => {
  it('is only GET or HEAD to exactly /trap/', () => {
    expect(TRAP_PATH).toBe('/trap/');
    expect(isTrapRequest('GET', '/trap/')).toBe(true);
    expect(isTrapRequest('HEAD', '/trap/')).toBe(true);
    for (const [m, p] of [['POST', '/trap/'], ['GET', '/trap'], ['GET', '/Trap/'], ['GET', '/trap/x'], ['GET', '/'], ['GET', '/trapdoor/']]) expect(isTrapRequest(m, p), m + ' ' + p).toBe(false);
  });
});

describe('addresses', () => {
  it('cleans IPv4 and IPv6 and refuses anything else', () => {
    expect(normalizeIp(' 203.0.114.7 ')).toBe('203.0.114.7');
    expect(normalizeIp('2A00:1450:4001:081B:0000:0000:0000:200E')).toBe('2a00:1450:4001:81b::200e');
    for (const bad of ['', 'abc', '1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', '1.2.3.4:80', '[::1]', 'fe80::1%eth0', '1.2.3.4/24', '2001:db8::/32', null, undefined, 42, 'x'.repeat(60)]) expect(normalizeIp(bad as any), String(bad)).toBe(null);
  });

  it('knows the addresses no real reader has', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '0.0.0.0', '169.254.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '192.0.2.5', '198.18.0.1', '198.51.100.9', '203.0.113.9', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1', '::ffff:10.0.0.1', 'not an address']) expect(isReservedIp(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '203.0.114.7', '172.32.0.1', '100.128.0.1', '2a00:1450:4001:81b::200e', '::ffff:8.8.8.8']) expect(isReservedIp(ip), ip).toBe(false);
  });
});

describe('what to do with a hit', () => {
  const cfg = { ownIps: ['198.51.100.200', '2a00:1450:4001:81b::200e'] };

  it('blocks an ordinary client', () => {
    expect(decideTrapHit({ ip: '203.0.114.7', userAgent: 'python-requests/2.31' }, cfg)).toEqual({ action: 'block', ip: '203.0.114.7', reason: 'trap' });
    expect(decideTrapHit({ ip: '203.0.114.7', userAgent: '' }, {}).action).toBe('block');
  });

  it('never blocks a reserved address, a bad address or an own address', () => {
    expect(decideTrapHit({ ip: '10.0.0.5' }, cfg)).toEqual({ action: 'ignore', ip: '10.0.0.5', reason: 'reserved-address' });
    expect(decideTrapHit({ ip: 'junk' }, cfg)).toEqual({ action: 'ignore', ip: null, reason: 'bad-address' });
    expect(decideTrapHit({ ip: undefined }, cfg).action).toBe('ignore');
    const own = decideTrapHit({ ip: '2A00:1450:4001:081B::200E', userAgent: 'curl/8' }, { ownIps: ['2a00:1450:4001:81b::200e'] });
    expect(own).toEqual({ action: 'ignore', ip: '2a00:1450:4001:81b::200e', reason: 'own-address' });
    expect(decideTrapHit({ ip: '8.8.8.8' }, { ownIps: ['8.8.8.8'] }).reason).toBe('own-address');
  });

  it('only records a client that says it is a good bot (the name can be faked and a real bot may follow the link once)', () => {
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'DuckDuckBot/1.1', 'facebookexternalhit/1.1']) expect(decideTrapHit({ ip: '8.8.4.4', userAgent: ua }, cfg), ua).toEqual({ action: 'record', ip: '8.8.4.4', reason: 'good-bot-name' });
    expect(claimsGoodBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe(false);
    expect(claimsGoodBot(undefined)).toBe(false);
  });

  it('works with no settings at all', () => {
    expect(decideTrapHit(undefined as any).action).toBe('ignore');
    expect(decideTrapHit({ ip: '8.8.8.8' }).action).toBe('block');
  });
});

describe('the list item and its end time', () => {
  it('writes the address and a comment with the end time, 24 hours later by default', () => {
    expect(BLOCK_HOURS).toBe(24);
    expect(blockItem('203.0.114.7', NOW)).toEqual({ ip: '203.0.114.7', comment: 'sdn-trap until=2026-11-17T10:00:00.000Z seen=2026-11-16T10:00:00.000Z' });
    expect(blockItem('203.0.114.7', NOW, 1).comment).toContain('until=2026-11-16T11:00:00.000Z');
  });

  it('refuses a bad address, a bad time and hours outside 1 to 168', () => {
    expect(() => blockItem('nope', NOW)).toThrow(/valid address/);
    expect(() => blockItem('8.8.8.8', NaN)).toThrow(/time/);
    for (const h of [0, 169, 1.5, -1, '24' as any]) expect(() => blockItem('8.8.8.8', NOW, h), String(h)).toThrow(/hours/);
  });

  it('reads the end time back, and only from its own comments', () => {
    expect(untilOf(blockItem('8.8.8.8', NOW).comment)).toBe(NOW + 24 * 3600 * 1000);
    for (const c of ['', 'office wifi', 'sdn-trap until=soon', 'sdn-trap until=2026-11-17', 'xsdn-trap until=2026-11-17T10:00:00.000Z', null, undefined]) expect(untilOf(c as any), String(c)).toBe(null);
  });
});

describe('the clean-up', () => {
  const ours = (id: string, ip: string, at: number) => ({ id, ip, comment: blockItem(ip, at, 1).comment });
  const items = [
    ours('old1', '8.8.8.8', NOW - 3 * 3600 * 1000),      // ended 2 hours ago
    ours('edge', '8.8.4.4', NOW - 3600 * 1000),           // ends exactly now
    ours('live', '1.1.1.1', NOW),                         // ends in 1 hour
    { id: 'mine1', ip: '9.9.9.9', comment: 'owner blocked by hand' },
    { id: 'mine2', ip: '9.9.9.10', comment: '' },
    { id: 'broken', ip: '9.9.9.11', comment: 'sdn-trap until=garbage' },
    { id: '', ip: '9.9.9.12', comment: blockItem('9.9.9.12', NOW - 9e7, 1).comment },
  ];

  it('returns only our own items whose time is over (the end time itself counts as over)', () => {
    expect(expiredItemIds(items, NOW)).toEqual(['old1', 'edge']);
  });

  it('never returns the owner\'s entries, a broken comment or an item without an id; a bad list gives nothing', () => {
    const got = expiredItemIds(items, NOW + 1e12);
    expect(got).not.toContain('mine1');
    expect(got).not.toContain('mine2');
    expect(got).not.toContain('broken');
    expect(got).not.toContain('');
    expect(expiredItemIds(null as any, NOW)).toEqual([]);
    expect(expiredItemIds([null, 5, {}] as any, NOW)).toEqual([]);
  });

  it('counts only our own items, and the limit leaves room for more', () => {
    expect(countOurs(items)).toBe(4);
    expect(countOurs(null as any)).toBe(0);
    expect(hasRoom(0)).toBe(true);
    expect(hasRoom(999)).toBe(true);
    expect(hasRoom(1000)).toBe(false);
    expect(hasRoom(990, 10)).toBe(true);
    expect(hasRoom(991, 10)).toBe(false);
    expect(hasRoom(-1)).toBe(false);
  });
});

describe('the two Cloudflare calls (text only, nothing is sent)', () => {
  it('builds the add call: POST to the list items address, a JSON list of address and comment', () => {
    const item = blockItem('203.0.114.7', NOW);
    const r = addRequest(ACC, LST, [item]);
    expect(r.method).toBe('POST');
    expect(r.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACC}/rules/lists/${LST}/items`);
    expect(JSON.parse(r.body)).toEqual([item]);
  });

  it('builds the delete call: DELETE with the ids', () => {
    const r = deleteRequest(ACC, LST, ['old1xxxxx', 'edgeyyyyy']);
    expect(r.method).toBe('DELETE');
    expect(r.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACC}/rules/lists/${LST}/items`);
    expect(JSON.parse(r.body)).toEqual({ items: [{ id: 'old1xxxxx' }, { id: 'edgeyyyyy' }] });
  });

  it('refuses a wrong account or list id (nothing can be built for another address)', () => {
    const item = blockItem('8.8.8.8', NOW);
    for (const bad of ['', 'abc', 'A'.repeat(32), 'g'.repeat(32), ACC + 'a', '../' + ACC, undefined as any]) {
      expect(() => addRequest(bad, LST, [item]), 'account ' + bad).toThrow(/account id/);
      expect(() => addRequest(ACC, bad, [item]), 'list ' + bad).toThrow(/list id/);
      expect(() => deleteRequest(bad, LST, ['abcdefgh']), 'del account ' + bad).toThrow(/account id/);
    }
  });

  it('refuses an item that must not be blocked, an item that is not ours, and a call that is empty or too big', () => {
    expect(() => addRequest(ACC, LST, [{ ip: '10.0.0.1', comment: blockItem('8.8.8.8', NOW).comment }])).toThrow(/must not be blocked/);
    expect(() => addRequest(ACC, LST, [{ ip: '8.8.8.8', comment: 'my note' }])).toThrow(/trap comment/);
    expect(() => addRequest(ACC, LST, [])).toThrow(/1 to/);
    expect(() => addRequest(ACC, LST, null as any)).toThrow(/1 to/);
    expect(() => addRequest(ACC, LST, new Array(MAX_PER_CALL + 1).fill(blockItem('8.8.8.8', NOW)))).toThrow(/1 to/);
    expect(() => addRequest(ACC, LST, new Array(MAX_PER_CALL).fill(blockItem('8.8.8.8', NOW)))).not.toThrow();
    expect(() => deleteRequest(ACC, LST, [])).toThrow(/1 to/);
    expect(() => deleteRequest(ACC, LST, ['bad id!'])).toThrow(/id looks wrong/);
    expect(() => deleteRequest(ACC, LST, [123 as any])).toThrow(/id looks wrong/);
  });
});

describe('the file holds only plain functions', () => {
  it('uses no network, no clock, no secret and no storage', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('../workers/trap/lib.js', 'utf8').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/\bfetch\s*\(|Date\.now|new Date\(\)|\benv\b|\bprocess\b|localStorage|\bimport\s/);
  });
});

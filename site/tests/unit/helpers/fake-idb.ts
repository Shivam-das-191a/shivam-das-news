// A small stand-in for the browser's IndexedDB: only what push-client.js and public/push-sw.js use
// (open, onupgradeneeded, transaction, objectStore get, put and delete). Tests only; it keeps the data in memory.
export function fakeIdb(o: { failOpen?: boolean } = {}) {
  const dbs = new Map<string, Map<string, Map<any, any>>>();
  const stats = { opened: 0, closed: 0 };
  const request = (work: () => any) => {
    const req: any = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = work();
        req.onsuccess && req.onsuccess();
      } catch (e) {
        req.error = e;
        req.onerror && req.onerror();
      }
    });
    return req;
  };
  const idb = {
    open(name: string, _version?: number) {
      if (o.failOpen) throw new Error('IndexedDB is blocked');
      const req: any = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        let stores = dbs.get(name);
        const isNew = !stores;
        if (!stores) {
          stores = new Map();
          dbs.set(name, stores);
        }
        const mine = stores;
        stats.opened++;
        const db = {
          objectStoreNames: { contains: (n: string) => mine.has(n) },
          createObjectStore: (n: string) => void mine.set(n, new Map()),
          close: () => void stats.closed++,
          transaction(n: string, _mode: string) {
            const store = mine.get(n);
            if (!store) throw new Error('NotFoundError');
            return {
              objectStore: () => ({
                get: (k: any) => request(() => (store.has(k) ? structuredClone(store.get(k)) : undefined)),
                put: (v: any, k: any) =>
                  request(() => {
                    store.set(k, structuredClone(v));
                    return k;
                  }),
                delete: (k: any) =>
                  request(() => {
                    store.delete(k);
                  }),
              }),
            };
          },
        };
        req.result = db;
        if (isNew) req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
  return { idb, dbs, stats };
}

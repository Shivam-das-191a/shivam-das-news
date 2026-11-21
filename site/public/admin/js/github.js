// Minimal GitHub REST client for the dashboard. The token lives only in this tab (sessionStorage).
export function toBase64(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const decodeText = (b64) => new TextDecoder().decode(fromBase64(b64));
export const joinPath = (...p) => p.filter(Boolean).join('/').replace(/\/+/g, '/');

export class GitHub {
  constructor({ token, repo, branch }) {
    Object.assign(this, { token, repo, branch });
  }

  async req(path, opts = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch { /* keep status text */ }
      const e = new Error(`GitHub ${res.status}: ${msg}`);
      e.status = res.status;
      throw e;
    }
    return res.status === 204 ? null : res.json();
  }

  user() { return this.req('/user'); }
  repoInfo() { return this.req(`/repos/${this.repo}`); }
  async tree() {
    const r = await this.req(`/repos/${this.repo}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
    return r.tree.filter((t) => t.type === 'blob');
  }
  async blobText(sha) { return decodeText((await this.req(`/repos/${this.repo}/git/blobs/${sha}`)).content); }
  async blobBytes(sha) { return fromBase64((await this.req(`/repos/${this.repo}/git/blobs/${sha}`)).content); }
  async getText(path) {
    const f = await this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.branch)}`);
    return { text: decodeText(f.content), sha: f.sha };
  }
  async put(path, content, message, sha) {
    return this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: toBase64(content), branch: this.branch, ...(sha ? { sha } : {}) }),
    });
  }
  async remove(path, sha, message) {
    return this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: this.branch }),
    });
  }
  /** v0.12.0: many files in ONE commit (one deploy). v0.13.0: images (files with `bytes`) too. v0.16.0: `{ path, delete: true }` removes a file. Uses the Git Data API; the branch moves only if nobody else saved meanwhile. */
  async commitFiles(files, message) {
    const ref = `/repos/${this.repo}/git/refs/heads/${this.branch.split('/').map(encodeURIComponent).join('/')}`;
    const parent = (await this.req(ref.replace('/git/refs/', '/git/ref/'))).object.sha;
    const base = (await this.req(`/repos/${this.repo}/git/commits/${parent}`)).tree.sha;
    // v0.13.0: a file with `bytes` (an image) becomes a blob first; a file with `text` goes into the tree directly.
    const entries = [];
    for (let i = 0; i < files.length; i += 5) {
      entries.push(...await Promise.all(files.slice(i, i + 5).map(async (f) => {
        if (f.delete) return { path: f.path, mode: '100644', type: 'blob', sha: null }; // v0.16.0: remove a file in the same commit
        if (!f.bytes) return { path: f.path, mode: '100644', type: 'blob', content: f.text };
        const b = await this.req(`/repos/${this.repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: toBase64(f.bytes), encoding: 'base64' }) });
        return { path: f.path, mode: '100644', type: 'blob', sha: b.sha };
      })));
    }
    const tree = await this.req(`/repos/${this.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base, tree: entries }) });
    const commit = await this.req(`/repos/${this.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }) });
    try {
      await this.req(ref, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    } catch (e) {
      if (e.status === 422 || e.status === 409) throw new Error('Someone else saved at the same moment, so nothing was changed. Try again.');
      throw e;
    }
    return commit.sha;
  }
}

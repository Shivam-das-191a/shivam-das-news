// Auto image hosting, the flow (PLAN 34.3 steps 8 and 9; Phase 3c Part 3c-7, v0.101.51).
// It joins the pipeline (hosting-pipeline.js) and the screen (hosting-screen.js): one Save, then the list with Retry and Confirm that run the pipeline again.
//   hostingFlow({ post, deps, dryRun?, onResult?, onReplace?, canEdit? })  -> { el, start(), state() }
// opts:
//   post       the post as the editor has it now (copied; the editor's own object is never changed)
//   deps       what savePostWithHosting needs ({ gh, postPath, mediaPath, serializePost, fetchPictures, optimize, ownHosts, ... }); `confirmed` may start filled
//   dryRun     true: every run is a preview and writes nothing (a Paste preview)
//   onResult   (result) => void   called after every run that did not fail, with the answer of savePostWithHosting; `result.next.post` is the post with the new addresses
//              (the editor puts it in its text field). A callback that throws is ignored: it can not undo a save that was made.
//   onReplace  optional, passed to the screen ({ url }) => void
//   canEdit    false hides the buttons
// start()      runs the first Save (or preview), draws the list and answers the last result (or null). A second start() while one runs gives the same promise.
// state()      { post, confirmed, status, running }: a copy of what the next run starts from.
// Rules: one run at a time (the screen disables the buttons, and the flow refuses a second run itself); every run starts from the post of the run before (after a failed commit that
// is the post AS IT WAS); Retry runs the pipeline again for the pictures that are still outside (the pipeline finds them itself); Confirm remembers the confirmed addresses
// (only pictures that really wait, by confirmFor) and runs again; an address or a token is never put in a message here (plainMessage); a stale Confirm that confirms nothing
// does not start a run. The flow does not fetch, does not read a token and does not touch GitHub by itself: all of it is in `deps`. It writes nothing and nothing calls it
// yet, so the live site and the dashboard do not change.
import { savePostWithHosting, plainMessage } from './hosting-pipeline.js';
import { confirmFor } from './hosting-result.js';
import { hostingScreen } from './hosting-screen.js';

export function hostingFlow(given) {
  const o = given && typeof given === 'object' ? given : {};
  const baseDeps = o.deps && typeof o.deps === 'object' ? o.deps : {};
  let post = o.post && typeof o.post === 'object' && !Array.isArray(o.post) ? { ...o.post } : {};
  let confirmed = Array.isArray(baseDeps.confirmed) ? [...baseDeps.confirmed] : [];
  let list = null; // the list of the last run that gave one
  let last = null; // the last result
  let running = false;
  let starting = null;

  // One run of the pipeline. It throws one plain sentence when the run failed, so the screen shows it as a bad message and keeps the list.
  async function once() {
    if (running) throw new Error('Wait for the picture job that is running.');
    running = true;
    try {
      const r = await savePostWithHosting(post, { ...baseDeps, confirmed: [...confirmed], dryRun: o.dryRun === true });
      if (!r || r.ok !== true) throw new Error(r && typeof r.message === 'string' && r.message ? r.message : 'Something went wrong. Nothing was changed.');
      last = r;
      list = r.list;
      if (r.next && r.next.post && typeof r.next.post === 'object') post = { ...r.next.post };
      if (typeof o.onResult === 'function') { try { o.onResult(r); } catch { /* a callback can not undo a save */ } }
      return { list: r.list, message: r.message };
    } finally {
      running = false;
    }
  }

  const screen = hostingScreen({
    list: null,
    canEdit: o.canEdit,
    onReplace: o.onReplace,
    onRetry: () => once(),
    onConfirm: async ({ urls, wholeHost } = {}) => {
      const next = confirmFor(list, confirmed, { urls, wholeHost: wholeHost === true });
      if (next.length === confirmed.length) return { message: 'There is nothing to confirm.' };
      confirmed = next;
      return once();
    },
  });

  function start() {
    if (starting) return starting;
    screen.setBusy(true);
    starting = (async () => {
      try {
        const out = await once();
        screen.update(out.list);
        screen.say(out.message);
      } catch (e) {
        screen.say(plainMessage(e), true);
      } finally {
        screen.setBusy(false);
        starting = null;
      }
      return last;
    })();
    return starting;
  }

  return {
    el: screen.el,
    start,
    state: () => ({ post: { ...post }, confirmed: [...confirmed], status: last ? last.status : null, running }),
  };
}

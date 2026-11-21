// v0.41.0 (Phase 6 part 9): browser side of the "Trending now" block (PLAN 7, 28.2). Plain JavaScript on purpose: the build puts this text
// inside the home page and article pages (see src/components/Trending.astro) and the tests run the very same text. It touches the page only through `win`.
// Steps: ask the analytics Worker for the best articles of the last 24 hours (addresses and scores), then read the title list the site publishes
// (/trending-titles.json) and write a numbered list into the block. The block stays hidden (attribute `hidden`) until at least one real article is listed:
// no numbers, no title, a failed call or a page with JavaScript off all leave the page exactly as it was. No cookie, nothing is sent about the reader.
// The article being read is left out of its own list. Titles are written as plain text (never as HTML).
function trendingClient(win, cfg) {
  var doc = win.document;
  if (!doc || !doc.body || !cfg || !cfg.url || !cfg.titles || typeof win.fetch !== 'function') return null;
  var type = doc.body.getAttribute('data-page-type');
  if (type !== 'home' && type !== 'article') return null;
  var box = doc.querySelector('[data-trending]');
  var list = box && box.querySelector('ol');
  if (!box || !list) return null;

  var MAX = 5;
  var ARTICLE = /^\/\d{4}\/\d{2}\/\d{2}\/blogs\/[a-z0-9-]+\/[a-z0-9-]+\/$/;
  var here = type === 'article' && win.location ? win.location.pathname : '';

  function getJson(address) {
    return win.fetch(address, { credentials: 'omit' }).then(function (r) {
      if (!r || !r.ok) throw new Error('not ok');
      return r.json();
    });
  }

  return getJson(cfg.url).then(function (answer) {
    var items = answer && Array.isArray(answer.items) ? answer.items : [];
    var urls = [];
    for (var i = 0; i < items.length; i++) {
      var u = items[i] && items[i].url;
      if (typeof u === 'string' && ARTICLE.test(u) && u !== here && urls.indexOf(u) < 0) urls.push(u);
    }
    if (!urls.length) return false;
    return getJson(cfg.titles).then(function (titles) {
      var shown = 0;
      for (var j = 0; j < urls.length && shown < MAX; j++) {
        var has = titles && Object.prototype.hasOwnProperty.call(titles, urls[j]);
        var title = has && typeof titles[urls[j]] === 'string' ? titles[urls[j]].trim() : '';
        if (!title) continue;
        var li = doc.createElement('li');
        var a = doc.createElement('a');
        a.setAttribute('href', urls[j]);
        a.textContent = title;
        li.appendChild(a);
        list.appendChild(li);
        shown++;
      }
      if (!shown) return false;
      box.removeAttribute('hidden');
      return true;
    });
  }).then(function (ok) { return ok === true; }, function () { return false; });
}

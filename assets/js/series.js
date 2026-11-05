/* ==========================================================================
   One series: /serie/<id> (Vercel rewrite) or /serie/?s=<id>
   ========================================================================== */
(() => {
  "use strict";
  const LK = window.LK;
  const { $, esc, tr, tx, I } = LK;

  const fromPath = decodeURIComponent((location.pathname.match(/\/serie\/([^/]+)\/?$/) || [])[1] || "");
  const slug = new URLSearchParams(location.search).get("s") || (fromPath !== "index.html" ? fromPath : "");

  LK.ready.then((site) => {
    const byId = new Map((site.photos || []).map((p) => [p.id, LK.photo(p)]));
    const all = (site.series || []).filter((s) => (s.photos || []).some((id) => byId.has(id)));
    const idx = all.findIndex((s) => s.id === slug);
    const head = $("[data-series-head]");
    if (idx < 0) {
      head.innerHTML = `<p class="series__lead">${esc(tr("notFound"))}</p><a class="series__back" href="/#series">← ${esc(tr("allSeries"))}</a>`;
      return;
    }
    const s = all[idx];
    const photos = s.photos.map((id) => byId.get(id)).filter(Boolean);
    const next = all[(idx + 1) % all.length];
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][idx] || idx + 1;

    function render() {
      document.title = `${tx(s.title)} — Louis Koller`;
      head.innerHTML = `
        <a class="series__back" href="/#series">← ${esc(tr("allSeries"))}</a>
        <div class="series__title-row">
          <span class="series__no">${roman}</span>
          <h1 class="series__title">${esc(tx(s.title))}</h1>
        </div>
        <p class="series__meta">${[s.year, tr("photos", { n: photos.length })].filter(Boolean).map(esc).join(" · ")}</p>
        ${tx(s.text) ? `<p class="series__text">${esc(tx(s.text))}</p>` : ""}`;
      const nx = $("[data-series-next]");
      if (next && next !== s) {
        nx.hidden = false;
        nx.innerHTML = `<span>${esc(tr("nextSeries"))}</span><b>${esc(tx(next.title))} →</b>`;
        nx.href = `/serie/${encodeURIComponent(next.id)}`;
        nx.dataset.cursor = tr("view");
      }
    }
    render();
    // the order from the admin is the order here
    LK.gallery($("[data-grid]"), photos, { shuffle: false });
    I.onChange(render);
  }).catch((e) => console.error(e));
})();

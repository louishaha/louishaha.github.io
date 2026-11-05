/* ==========================================================================
   Start page: hero, selected photos, series, profile
   ========================================================================== */
(() => {
  "use strict";
  const LK = window.LK;
  const { $, $$, esc, tr, tx, I } = LK;

  LK.ready.then((site) => {
    const all = (site.photos || []).map(LK.photo);
    const byId = new Map(all.map((p) => [p.id, p]));
    const selected = all.filter((p) => p.selected);

    /* Name */
    const [first, last] = site.name || ["Louis", "Koller"];
    $("[data-first]").textContent = first;
    $("[data-last]").textContent = last;

    /* Hero — full-bleed photographs behind the name. Each one comes into
       focus; the ticks show progress and jump to a frame when clicked. */
    const heroSet = all.filter((p) => p.hero).length ? all.filter((p) => p.hero) : selected.slice(0, 6);
    const hero = $("[data-hero]");
    const heroBg = $("[data-hero-bg]");
    const heroImgs = [$("[data-hero-a]"), $("[data-hero-b]")];
    const heroCap = $("[data-hero-caption]");
    const ticks = $("[data-hero-ticks]");
    const HERO_MS = 4000;
    let heroIdx = 0, heroFront = 0, heroTimer;

    const paintTicks = () => {
      ticks.innerHTML = heroSet.map((p, i) => `<button type="button" class="hero__tick" data-tick="${i}" aria-label="${esc(tr("show", { t: LK.titleOf(p) }))}"></button>`).join("");
    };
    paintTicks();
    ticks.style.setProperty("--dur", `${HERO_MS}ms`);
    const caption = (p) => `<b>${esc(LK.titleOf(p))}</b>${LK.whereOf(p) ? `, ${esc(LK.whereOf(p))}` : ""}`;

    function showHero(i) {
      const p = heroSet[i];
      if (!p) return;
      heroIdx = i;
      const tickEls = $$("[data-tick]", ticks);
      tickEls.forEach((t, j) => { t.classList.toggle("is-done", j < i); t.classList.remove("is-on"); });
      void ticks.offsetWidth;
      if (!LK.reduceMotion) tickEls[i]?.classList.add("is-on");
      heroCap.innerHTML = caption(p);
      const img = heroImgs[heroFront ^ 1];
      const swap = () => {
        if (heroIdx !== i) return;
        heroImgs[heroFront].classList.remove("is-front");
        heroImgs[heroFront].classList.add("is-back");
        img.classList.remove("is-front", "is-back");
        void img.offsetWidth;
        img.classList.add("is-front");
        heroFront ^= 1;
      };
      if (img.src.endsWith(p.full) && img.complete) swap();
      else { img.onload = swap; img.src = p.full; }
      const next = heroSet[(i + 1) % heroSet.length];
      if (next) new Image().src = next.full; // warm the cache for the next frame
    }
    const queueHero = () => {
      clearTimeout(heroTimer);
      if (LK.reduceMotion || heroSet.length < 2) return;
      heroTimer = setTimeout(() => { showHero((heroIdx + 1) % heroSet.length); queueHero(); }, HERO_MS);
    };
    showHero(0);
    queueHero();
    ticks.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tick]");
      if (!t) return;
      showHero(Number(t.dataset.tick));
      queueHero();
    });
    heroBg.addEventListener("click", () => LK.lightbox(heroSet, heroIdx));
    heroBg.dataset.i18nCursor = "view";
    heroBg.dataset.cursor = tr("view");

    // scrolling away: the photograph lags behind and dims. Touch screens
    // scroll on a separate thread, so a position set from JS would trail
    // behind the finger; there the CSS does it with a scroll timeline.
    if (!LK.reduceMotion) {
      let ticking = false;
      const onScroll = () => {
        ticking = false;
        const h = hero.offsetHeight;
        const y = Math.min(scrollY, h);
        const lag = !LK.touchScroll && !LK.Lite.on();
        heroBg.style.setProperty("--py", lag ? `${(y * 0.35).toFixed(1)}px` : "0px");
        heroBg.style.setProperty("--dim", (0.12 + (y / h) * 0.6).toFixed(3));
      };
      addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
      LK.onEffects(onScroll);
    }

    /* Selected photos */
    LK.gallery($("[data-grid]"), selected, { shuffle: site.shuffle ?? true });

    /* Series — a table of contents. The cover follows the pointer on
       desktop; phones get a strip of small frames under each title. */
    const list = $("[data-series]");
    const series = (site.series || []).filter((s) => (s.photos || []).some((id) => byId.has(id)));
    const roman = (n) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"][n] || String(n + 1);
    function renderSeries() {
      list.innerHTML = series.map((s, i) => {
        const ph = s.photos.map((id) => byId.get(id)).filter(Boolean);
        const cover = byId.get(s.cover) || ph[0];
        return `
          <li>
            <a class="toc__item" href="/serie/${encodeURIComponent(s.id)}" data-cover="${esc(cover.small)}" data-cursor="${esc(tr("view"))}">
              <span class="toc__no">${roman(i)}</span>
              <span class="toc__title">${esc(tx(s.title))}</span>
              <span class="toc__dots" aria-hidden="true"></span>
              <span class="toc__meta">${[s.year, tr("photos", { n: ph.length })].filter(Boolean).map(esc).join(" · ")}</span>
              <span class="toc__strip" aria-hidden="true">${ph.slice(0, 4).map((p) => `<img src="${esc(p.small)}" alt="" loading="lazy">`).join("")}</span>
            </a>
          </li>`;
      }).join("");
    }
    renderSeries();
    $("[data-series-wrap]").hidden = !series.length;

    if (LK.finePointer) {
      const prev = document.createElement("div");
      prev.className = "toc-preview";
      prev.innerHTML = "<img alt=\"\">";
      document.body.appendChild(prev);
      const pimg = $("img", prev);
      let px = 0, py = 0, cx = 0, cy = 0, raf = 0, on = false;
      const move = () => {
        cx += (px - cx) * 0.18; cy += (py - cy) * 0.18;
        prev.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
        if (on || Math.abs(px - cx) > 0.5) raf = requestAnimationFrame(move); else raf = 0;
      };
      list.addEventListener("pointermove", (e) => {
        px = e.clientX + 150; py = e.clientY;
        if (!raf) raf = requestAnimationFrame(move);
      });
      list.addEventListener("pointerover", (e) => {
        const a = e.target.closest("[data-cover]");
        if (!a) return;
        if (!on) { cx = e.clientX + 150; cy = e.clientY; }
        on = true;
        if (!pimg.src.endsWith(a.dataset.cover)) pimg.src = a.dataset.cover;
        prev.classList.add("is-on");
      });
      list.addEventListener("pointerleave", () => { on = false; prev.classList.remove("is-on"); });
    }

    /* Profile: facts only */
    const facts = $("[data-facts]");
    function renderFacts() {
      const val = (v) => {
        if (v && typeof v === "object" && "text" in v) {
          return v.url ? `<a href="${esc(v.url)}"${/^https?:/.test(v.url) ? ' target="_blank" rel="noopener"' : ""}>${esc(tx(v.text))}</a>` : esc(tx(v.text));
        }
        return esc(tx(v));
      };
      facts.innerHTML = (site.facts || [])
        .filter((f) => (f.value || []).length)
        .map((f) => `<div><dt>${esc(tx(f.label))}</dt>${f.value.map((v) => `<dd>${val(v)}</dd>`).join("")}</div>`)
        .join("");
    }
    renderFacts();

    I.onChange(() => {
      $$("[data-tick]", ticks).forEach((t, i) => t.setAttribute("aria-label", tr("show", { t: LK.titleOf(heroSet[i]) })));
      heroCap.innerHTML = caption(heroSet[heroIdx]);
      heroBg.dataset.cursor = tr("view");
      renderSeries();
      renderFacts();
    });
  }).catch((e) => {
    console.error(e);
  });
})();

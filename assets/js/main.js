/* ==========================================================================
   Louis Koller — Photography
   Renders everything from window.PORTFOLIO (assets/js/content.js).
   ========================================================================== */
(() => {
  "use strict";

  const P = window.PORTFOLIO || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ratioOf = (r) => {
    const [w, h] = String(r || "").split("/").map(Number);
    return w && h ? w / h : 1.5;
  };

  const photos = (P.photos || []).map((p) => ({
    ...p,
    thumb: p.thumb || p.src,
    ratio: ratioOf(p.ratio),
    where: [p.place, p.year].filter(Boolean).join(", "),
  }));
  const alt = (p) => (p.where ? `${p.title}, ${p.where}` : p.title);

  /* Text --------------------------------------------------------------- */
  const fullname = (P.name || []).join(" ");
  $$("[data-fullname]").forEach((el) => (el.textContent = fullname));
  $("[data-name]").innerHTML = (P.name || []).map((w) => `<span>${esc(w)}</span>`).join(" ");
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $("[data-role]").textContent = P.role || "";
  const subjects = (P.about?.details || []).find((d) => /subject/i.test(d.label));
  $("[data-subjects]").textContent = subjects ? subjects.items.join(", ") : "";
  $("[data-statement]").textContent = P.about?.statement || "";
  $("[data-about]").innerHTML = (P.about?.body || []).map((t) => `<p>${esc(t)}</p>`).join("");
  $("[data-details]").innerHTML = (P.about?.details || [])
    .map((d) => `<div><dt>${esc(d.label)}</dt><dd>${d.items.map(esc).join("<br>")}</dd></div>`)
    .join("");
  $("[data-photo-count]").textContent = `${photos.length} photographs`;

  const mail = $("[data-mail]");
  mail.href = `mailto:${P.email}`;
  mail.innerHTML = `<span>${esc(P.email)}</span>`;
  $("[data-links]").innerHTML = (P.links || [])
    .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
    .join("");

  /* Fit big type to the full width ------------------------------------- */
  const fitEls = $$("[data-fit]");
  const fit = () => {
    fitEls.forEach((el) => {
      const parts = [...el.children];
      if (!parts.length) return;
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      const avail = el.clientWidth;
      // one line: the whole run of words; stacked (mobile): the widest word
      const stacked = parts.length > 1 && parts[1].offsetTop > parts[0].offsetTop;
      const w = stacked
        ? Math.max(...parts.map((n) => n.getBoundingClientRect().width))
        : parts[parts.length - 1].getBoundingClientRect().right - parts[0].getBoundingClientRect().left;
      // the negative letter-spacing after the last letter makes the box narrower than the ink
      const ls = -parseFloat(getComputedStyle(el).letterSpacing) || 0;
      if (w > 0) el.style.fontSize = `${(base * avail) / (w + ls)}px`;
    });
  };
  fit();
  document.fonts?.ready.then(fit);
  let fitRaf;
  addEventListener("resize", () => {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(fit);
  });

  /* Featured photo (slow crossfade) ------------------------------------ */
  const heroSet = photos.filter((p) => p.hero).length ? photos.filter((p) => p.hero) : photos.slice(0, 5);
  const featImgs = [$("[data-feature-a]"), $("[data-feature-b]")];
  const featTitle = $("[data-feature-title]");
  const dots = $("[data-feature-dots]");
  let featIdx = 0;
  let front = 0;
  let featTimer;

  dots.innerHTML = heroSet
    .map((p, i) => `<button type="button" aria-label="Show ${esc(p.title)}" data-dot="${i}"></button>`)
    .join("");

  function showFeature(i, first) {
    const p = heroSet[i];
    if (!p) return;
    featIdx = i;
    const next = first ? featImgs[front] : featImgs[front ^ 1];
    const swap = () => {
      if (!first) {
        featImgs[front].classList.remove("is-on");
        front ^= 1;
      }
      next.classList.add("is-on");
    };
    next.alt = alt(p);
    next.onload = swap;
    next.src = p.src;
    if (next.complete && next.naturalWidth) { next.onload = null; swap(); }
    featTitle.innerHTML = `<b>${esc(p.title)}</b>${p.where ? ` — ${esc(p.where)}` : ""}`;
    $$("button", dots).forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
  }
  const startFeature = () => {
    clearInterval(featTimer);
    if (reduceMotion || heroSet.length < 2) return;
    featTimer = setInterval(() => showFeature((featIdx + 1) % heroSet.length), 6000);
  };
  if (heroSet.length) {
    showFeature(0, true);
    startFeature();
    // warm the cache for the next ones
    addEventListener("load", () => heroSet.slice(1).forEach((p) => (new Image().src = p.src)));
  } else {
    $("[data-feature]").hidden = true;
  }
  dots.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dot]");
    if (!b) return;
    showFeature(+b.dataset.dot);
    startFeature();
  });
  $("[data-feature-open]").addEventListener("click", () => openLightbox(photos, photos.indexOf(heroSet[featIdx])));

  /* Gallery ------------------------------------------------------------ */
  const gallery = $("[data-gallery]");
  const items = photos.map((p, i) => {
    const fig = document.createElement("figure");
    fig.className = "ph reveal";
    fig.innerHTML = `
      <button class="ph__btn" type="button" data-open="${i}" aria-label="Open ${esc(p.title)}">
        <div class="ph__img" style="aspect-ratio:${p.ratio}">
          <img src="${esc(p.thumb)}" alt="${esc(alt(p))}" loading="lazy" decoding="async" width="1200" height="${Math.round(1200 / p.ratio)}">
        </div>
        <figcaption class="ph__cap">
          <span class="ph__title">${esc(p.title)}</span>
          <span class="ph__meta">${esc(p.where)}</span>
        </figcaption>
      </button>`;
    return fig;
  });
  const colCount = () => (innerWidth <= 560 ? 1 : innerWidth <= 1000 ? 2 : 3);
  let cols = 0;
  function layoutGallery() {
    const n = colCount();
    if (n === cols) return;
    cols = n;
    gallery.style.setProperty("--cols", n);
    const colEls = Array.from({ length: n }, () => {
      const c = document.createElement("div");
      c.className = "gallery__col";
      return c;
    });
    // add each photo to the currently shortest column, so the reading order stays intact
    const heights = new Array(n).fill(0);
    items.forEach((fig, i) => {
      const k = heights.indexOf(Math.min(...heights));
      colEls[k].appendChild(fig);
      heights[k] += 1 / photos[i].ratio + 0.12;
    });
    gallery.replaceChildren(...colEls);
  }
  layoutGallery();
  addEventListener("resize", layoutGallery);
  $$(".ph__img img", gallery).forEach((img) => {
    const done = () => img.classList.add("is-loaded");
    if (img.complete) done();
    else { img.addEventListener("load", done); img.addEventListener("error", done); }
  });
  gallery.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openLightbox(photos, +b.dataset.open);
  });

  /* Films (optional) --------------------------------------------------- */
  const films = (P.films || []).filter((f) => f.stills && f.stills.length);
  if (films.length) {
    $("[data-films]").hidden = false;
    $("[data-films-link]").hidden = false;
    const stillList = [];
    $("[data-films-list]").innerHTML = films
      .map((f) => {
        const meta = [f.kind, f.year, f.runtime, f.role, f.stock, f.aspect && `${f.aspect}:1`].filter(Boolean).join(" · ");
        const stills = f.stills
          .map((s) => {
            const idx = stillList.push({ src: s.src, title: f.title, where: [s.timecode, s.subtitle].filter(Boolean).join(" — ") }) - 1;
            return `<button type="button" data-still="${idx}" aria-label="Open still from ${esc(f.title)}">
              <img src="${esc(s.src)}" alt="Still from ${esc(f.title)}" loading="lazy">
              ${s.timecode ? `<span>${esc(s.timecode)}</span>` : ""}
            </button>`;
          })
          .join("");
        return `<article class="film reveal">
          <div class="film__head"><h3 class="film__title">${esc(f.title)}</h3><span class="film__meta">${esc(meta)}</span></div>
          ${f.note ? `<p class="film__note">${esc(f.note)}</p>` : ""}
          <div class="film__stills">${stills}</div>
        </article>`;
      })
      .join("");
    $("[data-films-list]").addEventListener("click", (e) => {
      const b = e.target.closest("[data-still]");
      if (b) openLightbox(stillList, +b.dataset.still);
    });
  }

  /* Reveal on scroll --------------------------------------------------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  /* Lightbox ----------------------------------------------------------- */
  const lb = $("[data-lb]");
  const lbImg = $("[data-lb-img]");
  let lbList = [];
  let lbIdx = 0;
  let lastFocus = null;

  function renderLb() {
    const it = lbList[lbIdx];
    lbImg.classList.add("is-loading");
    lbImg.onload = () => lbImg.classList.remove("is-loading");
    lbImg.src = it.src;
    lbImg.alt = alt(it);
    $("[data-lb-title]").textContent = it.title;
    $("[data-lb-meta]").textContent = it.where || "";
    $("[data-lb-count]").textContent = `${pad(lbIdx + 1)} / ${pad(lbList.length)}`;
    const nxt = lbList[(lbIdx + 1) % lbList.length];
    if (nxt) new Image().src = nxt.src;
  }
  function openLightbox(list, i) {
    if (!list.length || i < 0) return;
    lbList = list;
    lbIdx = i;
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    renderLb();
    $("[data-lb-close]").focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
    lastFocus?.focus?.();
  }
  const step = (d) => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; renderLb(); };

  $("[data-lb-close]").addEventListener("click", closeLightbox);
  $("[data-lb-prev]").addEventListener("click", () => step(-1));
  $("[data-lb-next]").addEventListener("click", () => step(1));
  $("[data-lb-stage]").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeLightbox();
    else step(e.clientX < innerWidth / 2 ? -1 : 1);
  });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });
})();

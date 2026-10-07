/* ==========================================================================
   Louis Koller — portfolio
   Everything is rendered from assets/js/content.js
   ========================================================================== */
(() => {
  "use strict";

  const P = window.PORTFOLIO;
  if (!P) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ------------------------------------------------------------------------
     Placeholders — painted "photographs" until real images are added
     ------------------------------------------------------------------------ */
  const TONES = {
    //       sky top    horizon    ground top  ground bot  light
    dusk:   ["#1d2b3c", "#e3895a", "#2b201c", "#0c0a09", "#ffc890"],
    fog:    ["#8e9594", "#cfcdc4", "#70726c", "#2e2f2b", "#ffffff"],
    sodium: ["#06090f", "#3c2b1a", "#19120b", "#040302", "#ff9b3d"],
    sea:    ["#9db6c2", "#ebdfca", "#3e5762", "#1a252a", "#fff4de"],
    neon:   ["#0a0b1c", "#4c1f52", "#120d1b", "#050407", "#ff4d70"],
    desert: ["#c7af8b", "#f2dab0", "#8a6744", "#3a2a1b", "#fff2d2"],
    moss:   ["#26332a", "#93a68d", "#2a3427", "#0d110c", "#eef3d4"],
  };
  const toneNames = Object.keys(TONES);

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function parseRatio(r, fallback = 1.5) {
    if (!r) return fallback;
    const s = String(r);
    if (s.includes("/")) { const [a, b] = s.split("/").map(Number); return a / b || fallback; }
    return Number(s) || fallback;
  }

  let noiseTile;
  function getNoise() {
    if (noiseTile) return noiseTile;
    noiseTile = document.createElement("canvas");
    noiseTile.width = noiseTile.height = 160;
    const ctx = noiseTile.getContext("2d");
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return noiseTile;
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function paint(seedStr, ratio, toneName) {
    const r = rng(hash(seedStr));
    const tone = TONES[toneName] || TONES[toneNames[Math.floor(r() * toneNames.length)]];
    const W = 1100;
    const H = Math.round(W / ratio);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    // sky + ground
    const hz = 0.38 + r() * 0.34;
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, tone[0]);
    lg.addColorStop(hz, tone[1]);
    lg.addColorStop(Math.min(1, hz + 0.012), tone[2]);
    lg.addColorStop(1, tone[3]);
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);

    // light source
    const lx = W * (0.15 + r() * 0.7);
    const ly = H * (hz - 0.04 - r() * 0.22);
    const lr = Math.max(W, H) * (0.18 + r() * 0.3);
    g.globalCompositeOperation = "screen";
    const rg = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
    rg.addColorStop(0, hexA(tone[4], 0.85));
    rg.addColorStop(0.18, hexA(tone[4], 0.35));
    rg.addColorStop(1, hexA(tone[4], 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);

    // reflection streak
    g.globalAlpha = 0.25;
    const sg = g.createLinearGradient(0, H * hz, 0, H);
    sg.addColorStop(0, hexA(tone[4], 0.7));
    sg.addColorStop(1, hexA(tone[4], 0));
    g.fillStyle = sg;
    g.fillRect(lx - W * 0.02, H * hz, W * 0.04, H * (1 - hz));
    g.globalAlpha = 1;

    // silhouettes: skyline, poles or a lone figure
    g.globalCompositeOperation = "source-over";
    g.fillStyle = hexA(tone[3], 0.92);
    const mode = r();
    if (mode < 0.4) {
      let x = 0;
      while (x < W) {
        const w = W * (0.03 + r() * 0.09);
        const h = H * (0.03 + r() * 0.2) * (r() < 0.25 ? 0.2 : 1);
        g.fillRect(x, H * hz - h, w + 1, h + 2);
        x += w;
      }
    } else if (mode < 0.7) {
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const x = W * r();
        const h = H * (0.15 + r() * 0.45);
        g.fillRect(x, H * hz - h, Math.max(2, W * 0.004), h);
      }
    } else {
      const x = W * (0.25 + r() * 0.5);
      const h = H * (0.1 + r() * 0.16);
      const w = h * 0.26;
      const base = H * (hz + 0.05 + r() * 0.15);
      g.beginPath();
      g.ellipse(x, base - h + w * 0.45, w * 0.36, w * 0.45, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.roundRect ? g.roundRect(x - w / 2, base - h + w, w, h - w, [w / 2, w / 2, 2, 2]) : g.rect(x - w / 2, base - h + w, w, h - w);
      g.fill();
    }

    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    // grain
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.16;
    g.fillStyle = g.createPattern(getNoise(), "repeat");
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    return c;
  }

  const srcCache = new Map();
  function resolveSrc(item, key, ratio) {
    if (item.src) return Promise.resolve(item.src);
    if (srcCache.has(key)) return srcCache.get(key);
    const p = new Promise((resolve) => {
      const run = () => {
        const c = paint(key, ratio, item.tone);
        if (c.toBlob) c.toBlob((b) => resolve(URL.createObjectURL(b)), "image/jpeg", 0.86);
        else resolve(c.toDataURL("image/jpeg", 0.86));
      };
      (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(run);
    });
    srcCache.set(key, p);
    return p;
  }

  function setImg(img, srcPromise) {
    img.decoding = "async";
    img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    srcPromise.then((src) => { img.src = src; });
  }

  /* ------------------------------------------------------------------------
     Data
     ------------------------------------------------------------------------ */
  const photos = (P.photos || []).map((p, i) => {
    const ratio = parseRatio(p.ratio);
    return {
      ...p,
      no: pad(i + 1, 3),
      ratio,
      src$: () => resolveSrc(p, `photo-${i}-${p.title}`, ratio),
      thumb$: () => (p.thumb ? Promise.resolve(p.thumb) : resolveSrc(p, `photo-${i}-${p.title}`, ratio)),
      title: p.title || "Untitled",
      where: [p.place, p.year].filter(Boolean).join(", "),
      meta: [p.place, p.camera, p.year].filter(Boolean).join(" — "),
    };
  });

  const films = (P.films || []).map((f, fi) => {
    const ratio = parseRatio(f.aspect, 2.39);
    return {
      ...f,
      ratio,
      stills: (f.stills || []).map((s, si) => ({
        ...s,
        ratio,
        film: f,
        src$: () => resolveSrc(s, `still-${fi}-${si}-${f.title}`, ratio),
        title: f.title,
        meta: [f.kind, f.year, s.timecode].filter(Boolean).join(" — "),
      })),
    };
  });
  const allStills = films.flatMap((f) => f.stills);

  /* ------------------------------------------------------------------------
     Static text
     ------------------------------------------------------------------------ */
  const fullName = P.name.join(" ");
  const year = new Date().getFullYear();
  $$("[data-year]").forEach((el) => (el.textContent = year));
  $$("[data-fullname]").forEach((el) => (el.textContent = fullName));
  $("[data-name]").textContent = fullName;
  $("[data-first]").textContent = P.name[0];
  $("[data-last]").textContent = P.name[1];
  $("[data-role]").textContent = P.role || "";
  const years = photos.map((p) => +p.year).filter(Boolean);
  $("[data-coords]").textContent =
    P.coords || (years.length ? `${Math.min(...years)} — ${Math.max(...years)}` : "");
  $("[data-photo-count]").textContent = `${pad(photos.length)} Frames`;

  $("[data-statement]").textContent = P.about?.statement || "";
  $("[data-about]").innerHTML = (P.about?.body || []).map((t) => `<p>${esc(t)}</p>`).join("");

  const contactBlock = {
    label: "Contact",
    html: [`<li><a href="mailto:${esc(P.email)}">${esc(P.email)}</a></li>`]
      .concat((P.links || []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a></li>`))
      .join(""),
  };
  $("[data-details]").innerHTML =
    (P.about?.details || [])
      .map((d) => `<div><h3>${esc(d.label)}</h3><ul>${d.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`)
      .join("") + `<div><h3>${contactBlock.label}</h3><ul>${contactBlock.html}</ul></div>`;

  $("[data-links]").innerHTML = (P.links || [])
    .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
    .join("");

  const mail = $("[data-mail]");
  mail.href = `mailto:${P.email}`;
  mail.dataset.cursor = "Write";
  const chunk = `<span>Say hello —</span><span><i>${esc(P.email)}</i> —</span>`;
  $("[data-marquee]").innerHTML = chunk.repeat(4);

  /* Clock */
  const clockEl = $("[data-clock]");
  const locEl = $("[data-location]");
  const fmt = (() => {
    try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: P.timezone }); }
    catch (e) { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  })();
  const tick = () => {
    const t = fmt.format(new Date());
    clockEl.textContent = `${P.location || "Local"} ${t}`;
    locEl.textContent = `${P.location || "Local time"}, ${t.slice(0, 5)}`;
  };
  tick();
  setInterval(tick, 1000);

  /* Theme */
  const themeLabel = $("[data-theme-label]");
  const applyThemeLabel = () => {
    const light = document.documentElement.dataset.theme === "light";
    themeLabel.textContent = light ? "Darkroom" : "Light table";
    $('meta[name="theme-color"]').content = light ? "#ebe5d9" : "#0d0c0a";
  };
  applyThemeLabel();
  $("[data-theme-toggle]").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    store.set("lk-theme", next);
    applyThemeLabel();
  });

  /* ------------------------------------------------------------------------
     Hero — cycling frame between first and last name
     ------------------------------------------------------------------------ */
  const heroSet = photos.filter((p) => p.hero).length ? photos.filter((p) => p.hero) : photos.slice(0, 6);
  const heroImgs = [$("[data-hero-a]"), $("[data-hero-b]")];
  const heroCap = $("[data-hero-caption]");
  let heroIdx = 0;
  let heroFront = 0;

  function showHero(i) {
    const p = heroSet[i];
    if (!p) return;
    const img = heroImgs[heroFront ^ 1];
    p.thumb$().then((src) => {
      const swap = () => {
        heroImgs[heroFront].classList.remove("is-front");
        heroImgs[heroFront].style.zIndex = 1;
        img.style.zIndex = "";
        img.classList.remove("is-front");
        void img.offsetWidth;
        img.classList.add("is-front");
        img.alt = p.where ? `${p.title}, ${p.where}` : p.title;
        heroFront ^= 1;
        heroCap.innerHTML = `Fr. ${pad(i + 1)}/${pad(heroSet.length)} — <b>${esc(p.title)}</b>${p.where ? `, ${esc(p.where)}` : ""}`;
      };
      if (img.src === src && img.complete) swap();
      else { img.onload = swap; img.src = src; }
    });
  }
  showHero(0);
  heroSet.forEach((p) => p.thumb$()); // warm cache
  let heroTimer;
  const startHero = () => {
    if (reduceMotion || heroSet.length < 2) return;
    clearInterval(heroTimer);
    heroTimer = setInterval(() => { heroIdx = (heroIdx + 1) % heroSet.length; showHero(heroIdx); }, 2600);
  };
  startHero();
  $("[data-hero-frame]").addEventListener("click", () => openLightbox(photos, photos.indexOf(heroSet[heroIdx])));

  /* ------------------------------------------------------------------------
     Photographs — grid + index
     ------------------------------------------------------------------------ */
  const grid = $("[data-grid]");
  grid.innerHTML = photos
    .map((p, i) => `
      <figure class="ph p${i % 8}">
        <button class="ph__btn" type="button" data-open="${i}" data-cursor="View" aria-label="Open ${esc(p.title)}">
          <div class="ph__frame" style="aspect-ratio:${p.ratio}">
            <img alt="${esc(p.where ? `${p.title}, ${p.where}` : p.title)}" loading="lazy">
          </div>
        </button>
        <figcaption class="ph__cap">
          <span class="ph__no">${p.no}</span>
          <span class="ph__title">${esc(p.title)}</span>
          <span class="ph__exif">${esc(p.where)}</span>
        </figcaption>
      </figure>`)
    .join("");

  $$(".ph", grid).forEach((fig, i) => setImg($("img", fig), photos[i].thumb$()));
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openLightbox(photos, +b.dataset.open);
  });

  const indexList = $("[data-index-list]");
  indexList.innerHTML = photos
    .map((p, i) => `
      <li><button class="index__row" type="button" data-open="${i}" data-cursor="View">
        <span>${p.no}</span><span class="t">${esc(p.title)}</span><span>${esc(p.place || "—")}</span><span>${esc(p.camera || "—")}</span><span>${esc(p.year || "—")}</span>
      </button></li>`)
    .join("");
  indexList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openLightbox(photos, +b.dataset.open);
  });

  // view toggle
  const indexWrap = $("[data-index]");
  const setView = (v) => {
    $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    grid.hidden = v !== "grid";
    indexWrap.hidden = v !== "index";
    store.set("lk-view", v);
    if (v === "grid") $$(".ph", grid).forEach((el) => io.observe(el));
    requestAnimationFrame(measureStills);
  };
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  // floating preview in index mode
  const preview = $(".preview");
  const previewImg = $("[data-preview-img]");
  if (finePointer) {
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const loop = () => {
      px += (tx - px) * 0.16; py += (ty - py) * 0.16;
      preview.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    indexList.addEventListener("pointermove", (e) => {
      tx = e.clientX + 120; ty = e.clientY;
      if (!preview.classList.contains("is-on")) { px = tx; py = ty; }
      if (!raf) raf = requestAnimationFrame(loop);
    });
    indexList.addEventListener("pointerover", (e) => {
      const b = e.target.closest("[data-open]");
      if (!b) return;
      photos[+b.dataset.open].thumb$().then((src) => { previewImg.src = src; });
      preview.classList.add("is-on");
    });
    indexList.addEventListener("pointerleave", () => preview.classList.remove("is-on"));
  }

  /* ------------------------------------------------------------------------
     Stills — film strip, pinned horizontal scroll
     ------------------------------------------------------------------------ */
  const track = $("[data-track]");
  let stillIdx = 0;
  track.innerHTML = films
    .map((f, fi) => {
      const card = `
        <article class="film-card">
          <div>
            <span class="film-card__no">Reel ${pad(fi + 1)} / ${pad(films.length)}</span>
            <h3 class="film-card__title">${esc(f.title)}</h3>
            ${f.note ? `<p class="film-card__note">${esc(f.note)}</p>` : ""}
          </div>
          <dl>
            ${[["Type", f.kind], ["Year", f.year], ["Runtime", f.runtime], ["Role", f.role], ["Camera", f.stock], ["Aspect", f.aspect ? `${f.aspect} : 1` : ""]]
              .filter(([, v]) => v)
              .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`)
              .join("")}
          </dl>
        </article>`;
      const stills = f.stills
        .map((s, si) => {
          const idx = stillIdx++;
          return `
          <button class="still" type="button" data-still="${idx}" data-reel-no="${fi}" data-cursor="View" style="--ar:${f.ratio}" aria-label="Open still from ${esc(f.title)}">
            <div class="still__frame">
              <img alt="Still from ${esc(f.title)}${s.subtitle ? `: ${esc(s.subtitle)}` : ""}" loading="lazy">
              ${s.timecode ? `<span class="still__tc">${esc(s.timecode)}</span>` : ""}
              ${s.subtitle ? `<span class="still__sub">${esc(s.subtitle)}</span>` : ""}
            </div>
            <span class="still__edge"><span>▸ ${pad(si + 1)}A</span><span>${esc(f.title)} · ${esc(f.year)}</span><span>${pad(si + 1)} ▸</span></span>
          </button>`;
        })
        .join("");
      return card + stills;
    })
    .join("");

  $$("[data-still]", track).forEach((b) => setImg($("img", b), allStills[+b.dataset.still].src$()));
  track.addEventListener("click", (e) => {
    const b = e.target.closest("[data-still]");
    if (b) openLightbox(allStills, +b.dataset.still);
  });

  const stillsSec = $("[data-stills]");
  if (!allStills.length) {
    // no films yet: drop the section and its nav link
    stillsSec.remove();
    $('.nav__links a[href="#stills"]')?.remove();
    $("#info .section-head__num").textContent = "(02)";
    $('.nav__links a[href="#info"] sup').textContent = "02";
  }
  const progressEl = $("[data-progress]");
  const reelEl = $("[data-reel]");
  const filmCards = $$(".film-card", track);
  let pinned = false;
  let travel = 0;

  function measureStills() {
    if (!stillsSec.isConnected) return;
    pinned = !reduceMotion && innerWidth > 760;
    stillsSec.classList.toggle("is-native", !pinned);
    if (!pinned) {
      stillsSec.style.height = "";
      track.style.transform = "";
      return;
    }
    travel = Math.max(0, track.scrollWidth - innerWidth);
    stillsSec.style.height = `${travel + innerHeight}px`;
    updateStills();
  }

  function updateStills() {
    if (!pinned || !stillsSec.isConnected) return;
    const top = stillsSec.getBoundingClientRect().top;
    const prog = Math.min(1, Math.max(0, -top / (stillsSec.offsetHeight - innerHeight || 1)));
    track.style.transform = `translate3d(${-prog * travel}px,0,0)`;
    progressEl.style.transform = `scaleX(${prog})`;
    // which reel is in view
    let current = 0;
    filmCards.forEach((c, i) => { if (c.offsetLeft - prog * travel < innerWidth * 0.6) current = i; });
    reelEl.textContent = `Reel ${pad(current + 1)} — ${films[current]?.title || ""}`;
  }

  $(".stills__viewport", stillsSec).addEventListener("scroll", (e) => {
    if (pinned) return;
    const v = e.currentTarget;
    const prog = v.scrollLeft / Math.max(1, v.scrollWidth - v.clientWidth);
    progressEl.style.transform = `scaleX(${prog})`;
  }, { passive: true });

  addEventListener("scroll", () => requestAnimationFrame(updateStills), { passive: true });
  addEventListener("resize", () => requestAnimationFrame(measureStills));
  addEventListener("load", measureStills);
  if (document.fonts) document.fonts.ready.then(measureStills);

  /* ------------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------------ */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }),
    { rootMargin: "0px 0px -12% 0px" }
  );
  $$(".ph").forEach((el) => io.observe(el));

  const savedView = store.get("lk-view");
  setView(savedView === "index" ? "index" : "grid");

  /* ------------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------------ */
  const lb = $("[data-lb]");
  const lbImg = $("[data-lb-img]");
  const lbCount = $("[data-lb-count]");
  const lbTitle = $("[data-lb-title]");
  const lbMeta = $("[data-lb-meta]");
  let lbList = [];
  let lbIdx = 0;
  let lastFocus = null;

  function renderLb() {
    const it = lbList[lbIdx];
    lbImg.classList.add("is-swapping");
    lbCount.textContent = `${pad(lbIdx + 1)} / ${pad(lbList.length)}`;
    lbTitle.textContent = it.subtitle ? `“${it.subtitle}”` : it.title;
    lbMeta.textContent = it.subtitle ? `${it.title} — ${it.meta}` : it.meta;
    it.src$().then((src) => {
      const done = () => lbImg.classList.remove("is-swapping");
      if (lbImg.src === src) return done();
      lbImg.onload = done;
      lbImg.src = src;
      lbImg.alt = it.subtitle ? `Still from ${it.title}` : it.where ? `${it.title}, ${it.where}` : it.title;
    });
    // preload neighbours
    [1, -1].forEach((d) => lbList[(lbIdx + d + lbList.length) % lbList.length]?.src$());
  }
  function openLightbox(list, i) {
    if (!list.length || i < 0) return;
    lbList = list; lbIdx = i;
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.documentElement.classList.add("lb-open");
    renderLb();
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("[data-lb-close]").focus({ preventScroll: true });
  }
  function closeLightbox() {
    lb.classList.remove("is-open");
    document.documentElement.classList.remove("lb-open");
    setTimeout(() => { lb.hidden = true; }, 450);
    lastFocus?.focus?.({ preventScroll: true });
  }
  const step = (d) => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; renderLb(); };
  $("[data-lb-close]").addEventListener("click", closeLightbox);
  $("[data-lb-prev]").addEventListener("click", () => step(-1));
  $("[data-lb-next]").addEventListener("click", () => step(1));
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Tab") {
      const f = $$("button", lb);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // swipe
  let sx = null;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    sx = null;
  });

  /* ------------------------------------------------------------------------
     Custom cursor
     ------------------------------------------------------------------------ */
  if (finePointer) {
    const cur = $(".cursor");
    const label = $("[data-cursor-label]");
    document.documentElement.classList.add("has-cursor");
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cur.classList.remove("is-hidden"); }, { passive: true });
    document.addEventListener("pointerleave", () => cur.classList.add("is-hidden"));
    const loop = () => {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button");
      cur.classList.toggle("is-label", !!t);
      cur.classList.toggle("is-link", !t && !!link);
      label.textContent = t ? t.dataset.cursor : "";
    });
  }

  /* ------------------------------------------------------------------------
     Intro
     ------------------------------------------------------------------------ */
  const loader = $(".loader");
  const countEl = $(".loader__count");
  let seen = false;
  try { seen = sessionStorage.getItem("lk-intro") === "1"; sessionStorage.setItem("lk-intro", "1"); } catch (e) { /* ignore */ }

  const ready = () => {
    document.body.classList.add("is-ready");
    measureStills();
  };
  if (reduceMotion || seen) {
    loader.classList.add("is-skipped");
    requestAnimationFrame(ready);
  } else {
    const t0 = performance.now();
    const dur = 1300;
    const run = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      countEl.textContent = pad(Math.round(eased * 100), 3);
      if (k < 1) requestAnimationFrame(run);
      else {
        loader.classList.add("is-done");
        setTimeout(ready, 250);
      }
    };
    requestAnimationFrame(run);
  }
})();

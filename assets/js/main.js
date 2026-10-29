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

  // Social links go in front of the static Impressum / Datenschutz links
  $("[data-links]").insertAdjacentHTML("afterbegin", (P.links || [])
    .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
    .join(""));

  const mail = $("[data-mail]");
  mail.href = `mailto:${P.email}`;
  mail.dataset.cursor = "Write";
  const chunk = `<span>Say hello —</span><span><i>${esc(P.email)}</i> —</span>`;
  $("[data-marquee]").innerHTML = chunk.repeat(4);

  /* Time of day — follows the visitor's own clock: the hero opens with
     photographs in the same light, and the meta line names it. */
  const LIGHTS = [
    // from hour, photo tag, label
    [5, "morning", "Morning light"],
    [11, "day", "Daylight"],
    [17, "dusk", "Golden hour"],
    [21, "night", "After dark"],
  ];
  const lightAt = (h) => [...LIGHTS].reverse().find(([from]) => h >= from) || LIGHTS[LIGHTS.length - 1];

  /* Clock */
  const clockEl = $("[data-clock]");
  const locEl = $("[data-location]");
  const fmt = (() => {
    try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: P.timezone }); }
    catch (e) { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  })();
  const fmtOwn = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
  const tick = () => {
    const now = new Date();
    clockEl.textContent = `${P.location || "Local"} ${fmt.format(now)}`;
    locEl.textContent = `${lightAt(now.getHours())[2]}, ${fmtOwn.format(now)}`;
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

  /* Gap year — one line from the route page's data: a countdown before the
     trip, where I am while it runs. Opens the same code prompt as the lock. */
  const tripEl = $("[data-trip]");
  fetch("route/data/trip.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((trip) => {
      const stops = (trip?.stops || []).filter((s) => s && s.name);
      if (!stops.length) return;
      const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
      const today = iso(new Date());
      const start = trip.start || stops[0].from || stops[0].to;
      const last = stops[stops.length - 1];
      const end = last.to || last.from;
      let long, short, live = false;
      if (start && today < start) {
        const n = days(today, start);
        long = `Gap year in ${n} ${n === 1 ? "day" : "days"}`;
        short = `Gap year −${n}d`;
      } else if (end && today > end) {
        long = short = `Gap year · ${stops.length} stops`;
      } else {
        const here = stops.find((s) => s.id === trip.current) || [...stops].reverse().find((s) => s.from && s.from <= today) || stops[0];
        long = `${here.name} · Day ${start ? days(start, today) + 1 : "–"}`;
        short = here.name;
        live = true;
      }
      tripEl.innerHTML = `<span class="nav__trip-dot"></span><span class="nav__trip-long">${esc(long)}</span><span class="nav__trip-short">${esc(short)}</span>`;
      tripEl.classList.toggle("is-live", live);
      tripEl.setAttribute("aria-label", `${long} — Gapyear-Route öffnen`);
      tripEl.hidden = false;
    })
    .catch(() => { /* no route data: stay quiet */ });
  tripEl.addEventListener("click", () => $("[data-lock]")?.click());

  /* ------------------------------------------------------------------------
     Hero — full-bleed photographs behind the name. Each one comes into
     focus; the ticks show progress and jump to a frame when clicked.
     ------------------------------------------------------------------------ */
  const heroes = photos.filter((p) => p.hero).length ? photos.filter((p) => p.hero) : photos.slice(0, 6);
  const nowLight = lightAt(new Date().getHours())[1];
  let firsts = heroes.filter((p) => p.light === nowLight);
  // too few hero frames for this hour: borrow landscape photos in the same light
  if (firsts.length < 2) firsts = firsts.concat(photos.filter((p) => !p.hero && p.light === nowLight && p.ratio >= 1.3).slice(0, 3));
  const heroSet = firsts.concat(heroes.filter((p) => !firsts.includes(p)));
  const hero = $("[data-hero]");
  const heroBg = $("[data-hero-bg]");
  const heroImgs = [$("[data-hero-a]"), $("[data-hero-b]")];
  const heroCap = $("[data-hero-caption]");
  const ticks = $("[data-hero-ticks]");
  const HERO_MS = 4000;
  let heroIdx = 0;
  let heroFront = 0;
  let heroTimer;

  ticks.innerHTML = heroSet.map((p, i) => `<button type="button" class="hero__tick" data-tick="${i}" aria-label="Show ${esc(p.title)}"></button>`).join("");
  ticks.style.setProperty("--dur", `${HERO_MS}ms`);
  const tickEls = $$("[data-tick]", ticks);

  function showHero(i) {
    const p = heroSet[i];
    if (!p) return;
    heroIdx = i;
    tickEls.forEach((t, j) => {
      t.classList.toggle("is-done", j < i);
      t.classList.remove("is-on");
    });
    void ticks.offsetWidth;
    if (!reduceMotion) tickEls[i].classList.add("is-on");
    heroCap.innerHTML = `Fr. ${pad(i + 1)}/${pad(heroSet.length)} — <b>${esc(p.title)}</b>${p.where ? `, ${esc(p.where)}` : ""}`;
    const img = heroImgs[heroFront ^ 1];
    p.src$().then((src) => {
      if (heroIdx !== i) return;
      const swap = () => {
        heroImgs[heroFront].classList.remove("is-front");
        heroImgs[heroFront].classList.add("is-back");
        img.classList.remove("is-front", "is-back");
        void img.offsetWidth;
        img.classList.add("is-front");
        heroFront ^= 1;
      };
      if (img.src.endsWith(src) && img.complete) swap();
      else { img.onload = swap; img.src = src; }
    });
    heroSet[(i + 1) % heroSet.length].src$(); // warm cache for the next frame
  }
  const queueHero = () => {
    clearTimeout(heroTimer);
    if (reduceMotion || heroSet.length < 2) return;
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
  heroBg.addEventListener("click", () => openLightbox(photos, photos.indexOf(heroSet[heroIdx])));

  // scrolling away: the photograph lags behind and dims
  if (!reduceMotion) {
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const h = hero.offsetHeight;
      const y = Math.min(scrollY, h);
      heroBg.style.setProperty("--py", `${(y * 0.35).toFixed(1)}px`);
      heroBg.style.setProperty("--dim", (0.12 + (y / h) * 0.6).toFixed(3));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     Photographs — grid
     ------------------------------------------------------------------------ */
  const grid = $("[data-grid]");
  grid.innerHTML = photos
    .map((p, i) => `
      <figure class="ph" style="--r:${p.ratio}">
        <button class="ph__btn" type="button" data-open="${i}" data-cursor="View" data-af aria-label="Open ${esc(p.title)}">
          <div class="ph__frame">
            <img alt="${esc(p.where ? `${p.title}, ${p.where}` : p.title)}">
          </div>
        </button>
        <figcaption class="ph__cap">
          <span class="glass"><span class="ph__no">${p.no}</span><span class="ph__title">${esc(p.title)}</span></span>
          <span class="glass ph__exif">${esc(p.where)}</span>
        </figcaption>
      </figure>`)
    .join("");

  const figs = $$(".ph", grid);
  figs.forEach((fig, i) => setImg($("img", fig), photos[i].thumb$()));
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openLightbox(photos, +b.dataset.open);
  });

  /* Justified rows. Each row fills the width and every photo keeps its own
     aspect ratio. The target height cycles so the rhythm alternates between
     near-fullscreen single frames and calmer rows of two or three. */
  let laidOutFor = 0;
  function layoutGrid() {
    const W = grid.clientWidth;
    if (!W || W === laidOutFor) return;
    laidOutFor = W;
    const gap = parseFloat(getComputedStyle(grid).getPropertyValue("--gap")) || 10;
    const vh = innerHeight;
    const mobile = W < 700;
    const targets = mobile ? [W / 1.15, W * 0.42, W * 0.55] : [vh * 0.95, vh * 0.6, vh * 0.42, vh * 0.72];
    const maxH = mobile ? W * 1.25 : vh * 0.95;
    const heightOf = (row) => (W - gap * (row.length - 1)) / row.reduce((t, i) => t + photos[i].ratio, 0);

    const rows = [];
    let row = [];
    for (let i = 0; i < photos.length; i++) {
      const target = targets[rows.length % targets.length];
      const before = row.length ? heightOf(row) : Infinity;
      row.push(i);
      const after = heightOf(row);
      if (after <= target) {
        // close the row with whichever version lands closer to the target
        if (row.length > 1 && Math.abs(Math.log(before / target)) < Math.abs(Math.log(after / target)) && before <= maxH) {
          row.pop();
          rows.push(row);
          row = [i];
        } else {
          rows.push(row);
          row = [];
        }
      }
    }
    if (row.length) rows.push(row);

    grid.textContent = "";
    rows.forEach((r) => {
      const el = document.createElement("div");
      el.className = "row";
      const h = heightOf(r);
      if (h > maxH) {
        // too tall (e.g. a lone portrait): shrink the row instead of cropping
        const sum = r.reduce((t, i) => t + photos[i].ratio, 0);
        el.style.maxWidth = `${maxH * sum + gap * (r.length - 1)}px`;
      }
      r.forEach((i) => el.appendChild(figs[i]));
      grid.appendChild(el);
    });
  }
  layoutGrid();
  addEventListener("resize", () => requestAnimationFrame(layoutGrid));

  /* Ambient light — the page takes on a faint tint of the photographs on
     screen, like a room lit by a projected slide. Each thumbnail's colour is
     measured once in OKLab (colourful pixels count more), then the tints in
     view are mixed by how much of the screen they cover. */
  const AMB_MAX = 0.045; // strongest tint (OKLab chroma) a single photo can give
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  function oklab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }
  function tintOf(img) {
    const S = 24;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    let A = 0, B = 0, W = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [, a, b] = oklab(d[i], d[i + 1], d[i + 2]);
      const w = Math.hypot(a, b) + 0.01;
      A += a * w; B += b * w; W += w;
    }
    A /= W; B /= W;
    // lift faint colour so it shows on a dark wall, cap strong colour
    const C = Math.hypot(A, B) || 1;
    const k = (AMB_MAX * (1 - Math.exp(-C / 0.03))) / C;
    return [A * k, B * k];
  }
  const tints = [];
  figs.forEach((fig, i) => {
    $("img", fig).addEventListener("load", (e) => {
      try { tints[i] = tintOf(e.currentTarget); } catch (err) { /* e.g. opened from file:// */ }
    }, { once: true });
  });

  const root = document.documentElement;
  let bgLab = [0, 0, 0];
  const readBg = () => {
    const m = getComputedStyle(root).getPropertyValue("--bg").trim().match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); bgLab = oklab((n >> 16) & 255, (n >> 8) & 255, n & 255); }
  };
  readBg();
  new MutationObserver(() => { readBg(); ambient(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  function ambient() {
    const vw = innerWidth, vh = innerHeight;
    let a = 0, b = 0, cover = 0;
    figs.forEach((fig, i) => {
      if (!tints[i]) return;
      const r = fig.getBoundingClientRect();
      const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (h <= 0 || !r.width) return;
      const w = (h * r.width) / (vw * vh);
      a += tints[i][0] * w; b += tints[i][1] * w; cover += w;
    });
    if (cover < 0.02) { root.style.removeProperty("--amb"); return; }
    const dark = bgLab[0] < 0.5;
    const k = dark ? 1 : 0.7; // a lit table needs less
    const L = bgLab[0] + Math.min(cover, 1) * (dark ? 0.018 : -0.012);
    root.style.setProperty("--amb", `oklab(${L.toFixed(4)} ${(bgLab[1] + a * k).toFixed(4)} ${(bgLab[2] + b * k).toFixed(4)})`);
  }
  let ambT = 0, ambEnd;
  addEventListener("scroll", () => {
    clearTimeout(ambEnd);
    ambEnd = setTimeout(ambient, 160); // settle on where the scroll stopped
    const now = performance.now();
    if (now - ambT > 120) { ambT = now; requestAnimationFrame(ambient); }
  }, { passive: true });
  addEventListener("load", ambient); // landing mid-page (anchor, reload)

  // which photo is hovered (drives the dimming in WebGL)
  let hoveredIdx = -1;
  if (finePointer) {
    grid.addEventListener("pointerover", (e) => {
      const b = e.target.closest("[data-open]");
      hoveredIdx = b ? +b.dataset.open : -1;
    });
    grid.addEventListener("pointerleave", () => { hoveredIdx = -1; });
  }

  // view
  const setView = () => {
    layoutGrid(); $$(".ph", grid).forEach((el) => io.observe(el));
    requestAnimationFrame(measureStills);
  };

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
          <button class="still" type="button" data-still="${idx}" data-reel-no="${fi}" data-cursor="View" data-af style="--ar:${f.ratio}" aria-label="Open still from ${esc(f.title)}">
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

  setView();

  /* ------------------------------------------------------------------------
     Smooth scrolling. macOS already scrolls with inertia; on Windows/Linux a
     mouse wheel jumps in steps, so we glide towards the target ourselves.
     This loop is registered before the WebGL warp loop on purpose: it moves the
     page first, the warp then reads the new position in the same frame.
     ------------------------------------------------------------------------ */
  const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
  if (finePointer && !reduceMotion && !isApple) {
    const root = document.documentElement;
    let cur = scrollY, tgt = scrollY, applied = scrollY, last = performance.now();
    const maxY = () => Math.max(0, root.scrollHeight - innerHeight);

    addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.defaultPrevented || root.classList.contains("lb-open")) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      e.preventDefault();
      tgt = Math.min(maxY(), Math.max(0, tgt + e.deltaY * unit));
    }, { passive: false });

    // scrolled by something else (keyboard, scrollbar, anchor link): follow it
    addEventListener("scroll", () => {
      if (Math.abs(scrollY - applied) > 2) cur = tgt = applied = scrollY;
    }, { passive: true });

    const glide = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (cur !== tgt) {
        cur += (tgt - cur) * (1 - Math.pow(1 - 0.085, dt / 16.67));
        if (Math.abs(tgt - cur) < 0.3) cur = tgt;
        scrollTo({ top: cur, behavior: "instant" });
        applied = scrollY;
      }
      requestAnimationFrame(glide);
    };
    requestAnimationFrame(glide);
  }

  /* Scroll warp (WebGL) */
  if (!reduceMotion && window.LKWarp) {
    try {
      window.LKWarp({
        items: figs.map((fig, i) => ({
          i, fig,
          frame: $(".ph__frame", fig),
          img: $("img", fig),
          radius: () => parseFloat(getComputedStyle(grid).getPropertyValue("--radius")) || 0,
        })),
        hovered: () => hoveredIdx,
      });
    } catch (e) {
      document.documentElement.classList.remove("gl-on");
    }
  }

  /* ------------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------------ */
  const lb = $("[data-lb]");
  const lbImg = $("[data-lb-img]");
  const lbCount = $("[data-lb-count]");
  const lbTitle = $("[data-lb-title]");
  const lbMeta = $("[data-lb-meta]");
  const lbExp = $("[data-lb-exp]");
  const lbVf = $("[data-lb-vf]");
  let lbList = [];
  let lbIdx = 0;
  let lastFocus = null;

  // viewfinder corners sit on the picture itself, whatever its shape
  const placeVf = () => {
    lbVf.style.cssText = `left:${lbImg.offsetLeft}px;top:${lbImg.offsetTop}px;width:${lbImg.offsetWidth}px;height:${lbImg.offsetHeight}px`;
  };
  addEventListener("resize", () => { if (!lb.hidden) placeVf(); });

  function renderLb() {
    const it = lbList[lbIdx];
    lbImg.classList.add("is-swapping");
    lb.classList.remove("is-focused");
    lbExp.textContent = it.exposure || "";
    lbCount.textContent = `${pad(lbIdx + 1)} / ${pad(lbList.length)}`;
    lbTitle.textContent = it.subtitle ? `“${it.subtitle}”` : it.title;
    lbMeta.textContent = it.subtitle ? `${it.title} — ${it.meta}` : it.meta;
    it.src$().then((src) => {
      const done = () => {
        lbImg.classList.remove("is-swapping");
        lb.classList.add("is-focused");
        placeVf();
      };
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
  $("[data-lb-close-zone]").addEventListener("click", closeLightbox);
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
    const blob = $(".cursor__blob");
    const af = $(".cursor__af");
    const label = $("[data-cursor-label]");
    document.documentElement.classList.add("has-cursor");

    // Chromium can run an SVG filter on the backdrop: real refraction.
    const chromium = !!(navigator.userAgentData?.brands || []).some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
    if (chromium) {
      buildLensFilter();
      document.documentElement.classList.add("has-lg");
    }

    // The blob element is 100px; every size below is scaled by SIZE (20% smaller).
    const SIZE = 0.8;
    const SIZES = { dot: 0.1 * SIZE, link: 0.36 * SIZE, label: 1 * SIZE };
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    let scale = SIZES.dot, target = SIZES.dot, press = 1, stretch = 0, angle = 0;
    let lastSY = scrollY, scrollV = 0, lastProbe = 0, last = performance.now();
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cur.classList.remove("is-hidden"); }, { passive: true });
    // over a photo the cursor is an AF point; pressing lights it red like
    // the focus confirmation in a Canon viewfinder
    let focusT;
    addEventListener("pointerdown", () => { press = 0.82; clearTimeout(focusT); cur.classList.add("is-focus"); });
    addEventListener("pointerup", () => { press = 1; focusT = setTimeout(() => cur.classList.remove("is-focus"), 220); });
    document.addEventListener("pointerleave", () => cur.classList.add("is-hidden"));

    const setHover = (el) => {
      const t = el?.closest?.("[data-cursor]");
      const link = el?.closest?.("a, button");
      const isAf = !!t && t.hasAttribute("data-af");
      cur.classList.toggle("is-af", isAf);
      cur.classList.toggle("is-label", !!t && !isAf);
      cur.classList.toggle("is-link", !t && !!link);
      target = isAf ? SIZES.dot : t ? SIZES.label : link ? SIZES.link : SIZES.dot;
      if (t) label.textContent = t.dataset.cursor;
    };

    // time based easing, so it feels the same on 60, 120 and 144 Hz screens
    const k = (rate, dt) => 1 - Math.pow(1 - rate, dt / 16.67);

    const loop = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const px = cx, py = cy;
      cx += (x - cx) * k(0.15, dt); cy += (y - cy) * k(0.15, dt);

      // scrolling moves the page under the pointer: treat it as movement too,
      // and keep the hover state up to date while content slides past
      const sy = scrollY;
      scrollV += ((sy - lastSY) * (16.67 / dt) - scrollV) * k(0.2, dt);
      lastSY = sy;
      if (Math.abs(scrollV) > 0.5 && now - lastProbe > 70) {
        lastProbe = now;
        setHover(document.elementFromPoint(x, y));
      }

      const vx = (cx - px) * (16.67 / dt), vy = (cy - py) * (16.67 / dt) + scrollV * 0.6;
      const speed = Math.hypot(vx, vy);
      // liquid: stretch along the direction of travel, wobble back when it stops
      stretch += (Math.min(speed / 45, 0.38) - stretch) * k(0.14, dt);
      if (speed > 0.4) angle = Math.atan2(vy, vx);
      scale += (target * press - scale) * k(0.14, dt);
      blob.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${angle}rad) scale(${scale * (1 + stretch)}, ${scale * (1 - stretch * 0.55)})`;
      label.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      af.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    document.addEventListener("pointerover", (e) => setHover(e.target));
  }

  /* SVG filter for the lens: a generated displacement map bends the backdrop
     towards the centre (magnifies) and much harder at the rim (refraction);
     each colour channel bends a little differently (dispersion), then the
     result is inverted. */
  function buildLensFilter() {
    const S = 100, SCALE = 90;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const img = g.createImageData(S, S);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const nx = (i + 0.5) / S * 2 - 1, ny = (j + 0.5) / S * 2 - 1;
        const r = Math.hypot(nx, ny);
        let dx = 0, dy = 0;
        if (r < 1) {
          const t = Math.max(0, (r - 0.62) / 0.38);
          const k = 0.8 - 0.55 * t * t * (3 - 2 * t); // sample closer to centre near the rim
          dx = (k - 1) * nx * (S / 2);
          dy = (k - 1) * ny * (S / 2);
        }
        const o = (j * S + i) * 4;
        img.data[o] = Math.max(0, Math.min(255, Math.round((0.5 + dx / SCALE) * 255)));
        img.data[o + 1] = Math.max(0, Math.min(255, Math.round((0.5 + dy / SCALE) * 255)));
        img.data[o + 2] = 128;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const map = c.toDataURL();
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    const channel = (name, matrix, scale) => `
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d${name}"/>
      <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}"/>`;
    svg.innerHTML = `
      <filter id="lg" x="0" y="0" width="${S}" height="${S}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feImage href="${map}" x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="none" result="map"/>
        ${channel("r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", SCALE - 6)}
        ${channel("g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", SCALE)}
        ${channel("b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", SCALE + 6)}
        <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>
        <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="rgb"/>
        <feColorMatrix in="rgb" type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
      </filter>`;
    document.body.appendChild(svg);
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

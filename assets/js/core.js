/* ==========================================================================
   Louis Koller — shared runtime for every page
   Loads data/site.json, renders navigation and footer, theme and language
   switches, the glass cursor, smooth wheel scrolling, the lightbox and the
   photo gallery (justified rows + WebGL warp). Pages (home.js, series.js,
   film.js) build on window.LK.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
  // iPads report a fine pointer when a trackpad is attached, but scroll like a phone
  const touchScroll = !finePointer || (isApple && navigator.maxTouchPoints > 0);
  const I = window.LKI18N || { t: (k) => k, tx: (v) => v, onChange() {}, apply() {}, lang: "de" };
  const tr = I.t;
  const tx = I.tx;
  const Lite = window.LKLite || { on: () => false, onChange() {}, paint() {} };
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (p) => (!p ? "" : /^(https?:|blob:|data:|\/)/.test(p) ? p : "/" + p);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------------
     Data
     ------------------------------------------------------------------------ */
  let dataP = null;
  const load = () => dataP || (dataP = fetch("/data/site.json", { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`site.json ${r.status}`);
    return r.json();
  }));

  // what the pages work with: a photo plus a few derived values
  const photo = (p) => ({
    ...p,
    ratio: p.w && p.h ? p.w / p.h : 1.5,
    size: [1, 2, 3].includes(+p.size) ? +p.size : 2,
    full: url(p.src),
    small: url(p.thumb || p.src),
  });
  const titleOf = (p) => tx(p.title) || "";
  const whereOf = (p) => [tx(p.place), p.year].filter(Boolean).join(", ");
  // "Canon EOS 6D Mark II · 70 mm · f/2.8 · 1/250 s · ISO 100"
  function exposureOf(p) {
    const e = p.exposure || {};
    const parts = [];
    if (p.camera) parts.push(p.camera);
    if (e.lens && !(p.camera || "").includes(e.lens)) parts.push(e.lens);
    if (e.focal) parts.push(`${e.focal} mm`);
    if (e.aperture) parts.push(`f/${e.aperture}`);
    if (e.shutter) parts.push(`${e.shutter} s`);
    if (e.iso) parts.push(`ISO ${e.iso}`);
    return parts.join(" · ");
  }

  /* ------------------------------------------------------------------------
     Navigation + footer
     ------------------------------------------------------------------------ */
  const page = document.body.dataset.page || "";
  const header = document.createElement("header");
  header.className = "nav";
  document.body.prepend(header);
  const footer = $("[data-footer]");
  let site = null;
  let nowIn = null; // { place, tz } while the gap year is on

  function renderNav() {
    const gap = !!site?.gapyear;
    const link = (href, key, id) =>
      `<a href="${href}"${page === id || (id === "home" && page === "series") ? ' aria-current="page"' : ""} data-i18n="${key}">${esc(tr(key))}</a>`;
    header.innerHTML = `
      <a class="nav__name" href="/">${esc((site?.name || ["Louis", "Koller"]).join(" "))}</a>
      <nav class="nav__links" aria-label="Menü">
        ${link("/", "navPhotos", "home")}
        ${link("/film/", "navFilm", "film")}
        ${gap ? link("/route/", "navTrack", "track") : ""}
        ${link(page === "home" ? "#info" : "/#info", "navInfo", "info")}
      </nav>
      <div class="nav__right">
        ${gap ? `<a class="nav__now" href="/route/" data-now hidden></a>` : ""}
        <button class="nav__theme" type="button" data-theme-toggle data-i18n-aria="themeAria">
          <span class="nav__theme-dot"></span><span data-theme-label></span>
        </button>
        <span class="nav__lang" role="group" data-lang-toggle>
          <button type="button" data-lang="de">DE</button><button type="button" data-lang="en">EN</button><button type="button" data-lang="zh" lang="zh-Hans">中</button>
        </span>
        ${gap ? "" : `<button class="nav__lock" type="button" data-lock data-i18n-aria="lockAria" data-i18n-title="lockTitle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
        </button>`}
      </div>`;
    I.apply(header);
    applyThemeLabel();
    tickNow();
    window.LKLock?.bind();
  }

  function renderFooter() {
    if (!footer || !site) return;
    // social links: the ones in the profile ("Instagram | https://…") plus any in site.links
    const links = [
      ...(site.links || []).filter((l) => l.url),
      ...(site.facts || []).flatMap((f) => f.value || []).filter((v) => v && typeof v === "object" && /^https?:/.test(v.url || "")).map((v) => ({ label: v.text, url: v.url })),
    ];
    const canEdit = !!store.get("lk-route-gh");
    footer.innerHTML = `
      <div class="footer__mail">
        <span class="footer__label" data-i18n="contact">${esc(tr("contact"))}</span>
        <a href="mailto:${esc(site.email)}" data-cursor="${esc(tr("write"))}" data-i18n-cursor="write">${esc(site.email)}</a>
      </div>
      <div class="footer__row">
        <span>© ${new Date().getFullYear()} ${esc((site.name || []).join(" "))}</span>
        <span class="footer__links">
          ${links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(tx(l.label))}</a>`).join("")}
          <a href="/impressum/" data-i18n="imprint">${esc(tr("imprint"))}</a>
          <a href="/datenschutz/" data-i18n="privacy">${esc(tr("privacy"))}</a>
          ${canEdit ? '<a href="/admin/">Bearbeiten</a>' : ""}
          <button type="button" class="footer__lite" data-lite-toggle aria-pressed="false"><span data-i18n="liteLabel">${esc(tr("liteLabel"))}</span>: <span data-lite-state></span></button>
        </span>
        <a href="#top" data-i18n="backTop">${esc(tr("backTop"))}</a>
      </div>`;
    Lite.paint();
  }

  /* The bar tucks away while scrolling down and comes back on the way up,
     so it never sits on top of what you are looking at. */
  {
    let lastY = scrollY;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (Math.abs(y - lastY) < 6) return;
      header.classList.toggle("is-tucked", y > lastY && y > 160);
      lastY = y;
    }, { passive: true });
  }

  /* Theme */
  function applyThemeLabel() {
    const light = root.dataset.theme === "light";
    const l = $("[data-theme-label]", header);
    if (l) l.textContent = tr(light ? "darkroom" : "lightTable");
    const m = $('meta[name="theme-color"]');
    if (m) m.content = light ? "#ebe5d9" : "#0d0c0a";
  }
  header.addEventListener("click", (e) => {
    if (!e.target.closest("[data-theme-toggle]")) return;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    store.set("lk-theme", next);
    applyThemeLabel();
  });

  /* "Now in Melbourne · 21:04" while the gap year is on. The time zone comes
     from the country of the current stop (longitude for the big ones). */
  const TZ = {
    de: "Europe/Berlin", at: "Europe/Vienna", ch: "Europe/Zurich", fr: "Europe/Paris", it: "Europe/Rome", es: "Europe/Madrid",
    pt: "Europe/Lisbon", gb: "Europe/London", ie: "Europe/Dublin", nl: "Europe/Amsterdam", be: "Europe/Brussels", dk: "Europe/Copenhagen",
    se: "Europe/Stockholm", no: "Europe/Oslo", fi: "Europe/Helsinki", pl: "Europe/Warsaw", cz: "Europe/Prague", hu: "Europe/Budapest",
    hr: "Europe/Zagreb", gr: "Europe/Athens", tr: "Europe/Istanbul", is: "Atlantic/Reykjavik", sg: "Asia/Singapore", my: "Asia/Kuala_Lumpur",
    cn: "Asia/Shanghai", hk: "Asia/Hong_Kong", mo: "Asia/Macau", tw: "Asia/Taipei", jp: "Asia/Tokyo", kr: "Asia/Seoul", th: "Asia/Bangkok",
    vn: "Asia/Ho_Chi_Minh", kh: "Asia/Phnom_Penh", la: "Asia/Vientiane", mm: "Asia/Yangon", ph: "Asia/Manila", in: "Asia/Kolkata",
    lk: "Asia/Colombo", np: "Asia/Kathmandu", mv: "Indian/Maldives", ae: "Asia/Dubai", qa: "Asia/Qatar", om: "Asia/Muscat",
    nz: "Pacific/Auckland", fj: "Pacific/Fiji", za: "Africa/Johannesburg", na: "Africa/Windhoek", ke: "Africa/Nairobi", tz: "Africa/Dar_es_Salaam",
    ma: "Africa/Casablanca", eg: "Africa/Cairo", ar: "America/Argentina/Buenos_Aires", cl: "America/Santiago", pe: "America/Lima",
    bo: "America/La_Paz", co: "America/Bogota", ec: "America/Guayaquil", cr: "America/Costa_Rica", pa: "America/Panama", cu: "America/Havana",
    gt: "America/Guatemala", ru: "Europe/Moscow",
  };
  function tzFor(cc, lat, lng) {
    cc = String(cc || "").toLowerCase();
    if (cc === "au") return lng < 129 ? "Australia/Perth" : lng < 141 ? (lat < -26 ? "Australia/Adelaide" : "Australia/Darwin") : lat > -29 ? "Australia/Brisbane" : "Australia/Sydney";
    if (cc === "us") return lat < 25 && lng < -150 ? "Pacific/Honolulu" : lat > 52 ? "America/Anchorage" : lng > -87 ? "America/New_York" : lng > -101 ? "America/Chicago" : lng > -115 ? "America/Denver" : "America/Los_Angeles";
    if (cc === "ca") return lng > -63 ? "America/Halifax" : lng > -90 ? "America/Toronto" : lng > -102 ? "America/Winnipeg" : lng > -120 ? "America/Edmonton" : "America/Vancouver";
    if (cc === "id") return lng < 115 ? "Asia/Jakarta" : lng < 125 ? "Asia/Makassar" : "Asia/Jayapura";
    if (cc === "br") return lng < -60 ? "America/Manaus" : "America/Sao_Paulo";
    if (cc === "mx") return lng < -114.5 ? "America/Tijuana" : "America/Mexico_City";
    return TZ[cc] || null;
  }
  function tickNow() {
    const el = $("[data-now]", header);
    if (!el || !nowIn) return;
    let time = "";
    try { time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: nowIn.tz || undefined }).format(new Date()); } catch (e) { /* ignore */ }
    el.textContent = `${tr("nowIn", { place: nowIn.place })}${time ? ` · ${time}` : ""}`;
    el.hidden = false;
  }
  setInterval(tickNow, 15000);
  async function loadNowIn() {
    try {
      const trip = await fetch("/route/data/trip.json", { cache: "no-cache" }).then((r) => r.json());
      const stop = (trip.stops || []).find((s) => s.id === trip.current);
      if (!stop) return;
      nowIn = { place: stop.name, tz: tzFor(stop.cc, +stop.lat, +stop.lng) };
      tickNow();
    } catch (e) { /* no trip, no clock */ }
  }

  /* ------------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------------ */
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.dataset.i18nAria = "viewer";
  lb.innerHTML = `
    <div class="lb__top">
      <span data-lb-count></span>
      <button type="button" class="lb__close" data-lb-close><span data-i18n="close"></span> <span aria-hidden="true">✕</span></button>
    </div>
    <div class="lb__stage">
      <img alt="" data-lb-img>
      <button type="button" class="lb__hit lb__hit--prev" data-lb-prev data-i18n-cursor="prev" data-i18n-aria="prevAria"></button>
      <button type="button" class="lb__hit lb__hit--close" data-lb-close-zone data-i18n-cursor="close" data-i18n-aria="closeAria"></button>
      <button type="button" class="lb__hit lb__hit--next" data-lb-next data-i18n-cursor="next" data-i18n-aria="nextAria"></button>
    </div>
    <div class="lb__bottom">
      <span class="lb__title" data-lb-title></span>
      <span class="lb__meta"><span data-lb-where></span><span class="lb__exp" data-lb-exp></span></span>
    </div>`;
  document.body.appendChild(lb);
  I.apply(lb);
  const lbImg = $("[data-lb-img]", lb);
  let lbList = [], lbIdx = 0, lastFocus = null;

  function renderLb() {
    const it = lbList[lbIdx];
    lbImg.classList.add("is-swapping");
    $("[data-lb-count]", lb).textContent = `${lbIdx + 1} / ${lbList.length}`;
    $("[data-lb-title]", lb).textContent = titleOf(it);
    $("[data-lb-where]", lb).textContent = whereOf(it);
    $("[data-lb-exp]", lb).textContent = exposureOf(it);
    const done = () => lbImg.classList.remove("is-swapping");
    if (lbImg.src.endsWith(it.full)) done();
    else { lbImg.onload = done; lbImg.src = it.full; }
    lbImg.alt = [titleOf(it), whereOf(it)].filter(Boolean).join(", ");
    // preload the neighbours
    [1, -1].forEach((d) => { const n = lbList[(lbIdx + d + lbList.length) % lbList.length]; if (n) new Image().src = n.full; });
  }
  function openLightbox(list, i) {
    if (!list.length || i < 0) return;
    lbList = list; lbIdx = i;
    lastFocus = document.activeElement;
    lb.hidden = false;
    root.classList.add("lb-open");
    renderLb();
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $("[data-lb-close]", lb).focus({ preventScroll: true });
  }
  function closeLightbox() {
    lb.classList.remove("is-open");
    root.classList.remove("lb-open");
    setTimeout(() => { lb.hidden = true; refreshCursor(); }, 450);
    lastFocus?.focus?.({ preventScroll: true });
  }
  const step = (d) => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; renderLb(); };
  $("[data-lb-close]", lb).addEventListener("click", closeLightbox);
  $("[data-lb-close-zone]", lb).addEventListener("click", closeLightbox);
  $("[data-lb-prev]", lb).addEventListener("click", () => step(-1));
  $("[data-lb-next]", lb).addEventListener("click", () => step(1));
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
  let sx = null, sy = null;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) closeLightbox(); // swipe down closes
    sx = sy = null;
  });

  /* ------------------------------------------------------------------------
     Gallery — justified rows. Every row fills the full width, every photo in
     it has the same height and keeps its own aspect ratio. `size` (1–3) sets
     how big a photo wants to be; a random factor per photo keeps frames of
     the same size from all looking alike. Phones regroup the same order into
     smaller rows, so the order is nearly the same everywhere.
     ------------------------------------------------------------------------ */
  const WANT = {
    // row width / row height a photo of this size aims for: [desktop, phone]
    3: [[1.4, 2.3], [1.0, 1.4]],
    2: [[2.5, 3.7], [1.7, 2.7]],
    1: [[3.6, 5.2], [2.8, 4.0]],
  };
  const lerp = ([a, b], t) => a + (b - a) * t;
  const ratioSum = (row) => row.reduce((t, x) => t + x.ratio, 0);
  const miss = (row, want) => Math.abs(Math.log(ratioSum(row) / want));

  function groupRows(items, shuffle, rand) {
    const mix = (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    // how far the row would end up from its lead's wanted height with `c` added
    const cost = (row, c) => {
      const lead = row[0];
      if (lead.size === 3 || c.size === 3) return Infinity; // big photos get the full width to themselves
      if (c.size < lead.size && c.ratio > lead.ratio) return Infinity; // a smaller photo never ends up wider than the lead
      return miss([...row, c], lead.want) + (c.size !== lead.size ? 0.12 : 0);
    };
    // A big portrait can't fill the width on its own: it gets a column of two
    // smaller landscapes stacked beside it (an array inside the row).
    const stackable = (c) => c.size < 3 && c.ratio >= 1.2;
    // A short row of smaller photos joins the row with the most room left.
    const tidy = (rows) => {
      const plain = (row) => row.every((x) => !Array.isArray(x) && x.size < 3);
      for (let i = 0; i < rows.length; i++) {
        if (!plain(rows[i]) || ratioSum(rows[i]) >= 2) continue;
        const host = rows.filter((r) => r !== rows[i] && plain(r)).sort((a, b) => ratioSum(a) - ratioSum(b))[0];
        if (!host) continue;
        host.push(...rows[i]);
        rows.splice(i--, 1);
      }
      return rows;
    };
    const rows = [];
    if (shuffle === false) {
      for (let i = 0; i < items.length;) {
        const row = [items[i++]];
        const next = items.slice(i, i + 2);
        if (row[0].size === 3 && row[0].ratio < 1 && next.length === 2 && next.every(stackable)) { row.push(next); i += 2; }
        while (i < items.length && cost(row, items[i]) < miss(row, row[0].want)) row.push(items[i++]);
        rows.push(row);
      }
      return tidy(rows);
    }
    const pools = { 1: [], 2: [], 3: [] };
    mix(items).forEach((x) => pools[x.size].push(x));
    // big portraits come in the first half, while there is still plenty to stack beside them
    const big = pools[3];
    big.filter((x) => x.ratio < 1).forEach((x) => {
      big.splice(big.indexOf(x), 1);
      big.splice(Math.floor(rand() * Math.ceil(big.length / 2)), 0, x);
    });
    const perRow = { 1: 3, 2: 2, 3: 1 };
    let prev = 0;
    while (pools[1].length + pools[2].length + pools[3].length) {
      // which size leads the next row: roughly by how many rows each size still
      // fills; big rows never come back to back while others are left
      const otherRows = pools[1].length / perRow[1] + pools[2].length / perRow[2];
      const bigOk = prev !== 3 || !otherRows;
      const w = [pools[1].length / perRow[1], pools[2].length / perRow[2], bigOk ? pools[3].length * 2 : 0];
      let r = rand() * (w[0] + w[1] + w[2]), s = 0;
      while (s < 2 && (r -= w[s]) >= 0) s++;
      if (bigOk && pools[3].length > otherRows) s = 2;
      const size = pools[s + 1].length ? s + 1 : [3, 2, 1].find((n) => pools[n].length);
      const row = [pools[size].shift()];
      if (row[0].size === 3 && row[0].ratio < 1) {
        const col = mix([...pools[1], ...pools[2]].filter(stackable)).slice(0, 2);
        col.forEach((c) => pools[c.size].splice(pools[c.size].indexOf(c), 1));
        if (col.length === 2) row.push(col); else row.push(...col);
      }
      for (;;) {
        let best = null, bestCost = miss(row, row[0].want);
        for (const n of [1, 2, 3]) {
          for (const c of pools[n].slice(0, 4)) {
            const k = cost(row, c);
            if (k < bestCost) { best = c; bestCost = k; }
          }
        }
        if (!best) break;
        pools[best.size].splice(pools[best.size].indexOf(best), 1);
        row.push(best);
      }
      prev = size;
      rows.push(mix(row));
    }
    return tidy(rows);
  }

  // shared state for the effects below; one gallery per page
  let gallery = null;
  let hoveredIdx = -1;

  function makeGallery(el, list, opts = {}) {
    const shuffle = opts.shuffle ?? true;
    const rand = rng(typeof shuffle === "number" ? shuffle : shuffle ? Math.random() * 2 ** 32 : 1);
    const draft = list.map((p, k) => {
      const u = rand();
      return { p, k, size: p.size, ratio: p.ratio, want: lerp(WANT[p.size][0], u), wantPhone: lerp(WANT[p.size][1], u) };
    });
    const groups = groupRows(draft, shuffle, rand);
    const photos = groups.flat(2).map((d) => ({ ...d.p, want: d.want, wantPhone: d.wantPhone }));
    let n = 0;
    const rowGroups = groups.map((g) => g.map((x) => (Array.isArray(x) ? x.map(() => n++) : n++)));

    el.classList.add("grid");
    el.innerHTML = photos.map((p, i) => `
      <figure class="ph" style="--r:${p.ratio}">
        <button class="ph__btn" type="button" data-open="${i}" data-cursor="${esc(tr("view"))}" aria-label="${esc(tr("open", { t: titleOf(p) }))}">
          <div class="ph__frame"><img alt="${esc([titleOf(p), whereOf(p)].filter(Boolean).join(", "))}" decoding="async"></div>
        </button>
        <figcaption class="ph__cap">
          <span class="glass"><span class="ph__title">${esc(titleOf(p))}</span></span>
          <span class="glass ph__exif">${esc(whereOf(p))}</span>
        </figcaption>
      </figure>`).join("");
    const figs = $$(".ph", el);
    figs.forEach((fig, i) => {
      const img = $("img", fig);
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      img.src = photos[i].small;
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-open]");
      if (b) openLightbox(photos, +b.dataset.open);
    });
    if (finePointer) {
      el.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-open]"); hoveredIdx = b ? +b.dataset.open : -1; });
      el.addEventListener("pointerleave", () => { hoveredIdx = -1; });
    }

    const sumOf = (row) => row.reduce((t, i) => t + photos[i].ratio, 0);
    function phoneRows() {
      const order = rowGroups.flat(2);
      const rows = [];
      let row = [];
      for (let k = 0; k < order.length; k++) {
        const i = order[k];
        // a smaller portrait would fill the whole screen on its own: it gets
        // two landscapes from close by stacked beside it instead
        if (photos[i].size < 3 && photos[i].ratio < 1) {
          const ok = (j) => photos[j].size < 3 && photos[j].ratio >= 1.2;
          const stack = [...row.filter(ok), ...order.slice(k + 1, k + 4).filter(ok)].slice(0, 2);
          if (stack.length === 2) {
            row = row.filter((j) => !stack.includes(j));
            if (row.length) rows.push(row);
            row = [];
            stack.forEach((j) => { const at = order.indexOf(j, k + 1); if (at > k) order.splice(at, 1); });
            rows.push([i, stack]);
            continue;
          }
        }
        const next = [...row, i];
        const want = Math.min(...next.map((j) => photos[j].wantPhone));
        const alone = next.some((j) => photos[j].size === 3 || photos[j].ratio / sumOf(next) < 0.28);
        if (row.length && (alone || Math.abs(Math.log(sumOf(next) / want)) > Math.abs(Math.log(sumOf(row) / want)))) { rows.push(row); row = []; }
        row.push(i);
      }
      if (row.length) rows.push(row);
      return rows;
    }
    let laidOutFor = 0;
    function layout() {
      const W = el.clientWidth;
      if (!W || W === laidOutFor) return;
      laidOutFor = W;
      const gap = parseFloat(getComputedStyle(el).getPropertyValue("--gap")) || 10;
      const mobile = W < 700;
      const maxH = innerHeight * (mobile ? 0.85 : 1);
      const rows = mobile ? phoneRows() : rowGroups;
      const setR = (i, r) => figs[i].style.setProperty("--r", r);
      el.textContent = "";
      rows.forEach((r) => {
        const rowEl = document.createElement("div");
        rowEl.className = "row";
        const plain = r.filter((x) => !Array.isArray(x));
        const stack = r.find(Array.isArray);
        const free = W - gap * (r.length - 1);
        let colEl;
        if (stack) {
          // row height where the portrait and the stacked column end up equal
          const R = sumOf(plain);
          const S = stack.reduce((t, i) => t + 1 / photos[i].ratio, 0);
          const H = (free * S + gap * (stack.length - 1)) / (1 + R * S);
          [...plain, ...stack].forEach((i) => setR(i, photos[i].ratio));
          colEl = document.createElement("div");
          colEl.className = "col";
          colEl.style.flexGrow = (free - R * H) / H;
          stack.forEach((i) => colEl.appendChild(figs[i]));
        } else {
          // taller than the screen: crop top and bottom a little instead of
          // leaving empty space at the sides
          const f = Math.min(1.6, Math.max(1, free / (maxH * sumOf(plain))));
          plain.forEach((i) => setR(i, photos[i].ratio * f));
        }
        r.forEach((x) => rowEl.appendChild(Array.isArray(x) ? colEl : figs[x]));
        el.appendChild(rowEl);
      });
    }
    layout();
    addEventListener("resize", () => requestAnimationFrame(layout));

    // reveal on scroll
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      }),
      { rootMargin: "0px 0px -12% 0px" }
    );
    figs.forEach((f) => io.observe(f));

    I.onChange(() => {
      figs.forEach((fig, i) => {
        const p = photos[i];
        const b = $("[data-open]", fig);
        b.dataset.cursor = tr("view");
        b.setAttribute("aria-label", tr("open", { t: titleOf(p) }));
        $(".ph__title", fig).textContent = titleOf(p);
        $(".ph__exif", fig).textContent = whereOf(p);
      });
    });

    gallery = { el, figs, photos };
    stopWarp();
    if (!Lite.on()) startWarp();
    return gallery;
  }

  /* ------------------------------------------------------------------------
     Smooth scrolling. macOS already scrolls with inertia; on Windows/Linux a
     mouse wheel jumps in steps, so we glide towards the target ourselves.
     It starts before the WebGL warp loop on purpose: it moves the page
     first, the warp then reads the new position in the same frame.
     ------------------------------------------------------------------------ */
  let stopGlide = null;
  function startGlide() {
    if (stopGlide || !finePointer || reduceMotion || isApple) return;
    const ac = new AbortController();
    let cur = scrollY, tgt = scrollY, applied = scrollY, last = performance.now(), raf = 0;
    const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.defaultPrevented || root.classList.contains("lb-open") || root.classList.contains("film-open")) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.target.closest?.("[data-native-scroll]")) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      e.preventDefault();
      tgt = Math.min(maxY(), Math.max(0, tgt + e.deltaY * unit));
    }, { passive: false, signal: ac.signal });
    // scrolled by something else (keyboard, scrollbar, anchor link): follow it
    addEventListener("scroll", () => {
      if (Math.abs(scrollY - applied) > 2) cur = tgt = applied = scrollY;
    }, { passive: true, signal: ac.signal });
    const glide = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (cur !== tgt && dt > 0) {
        cur += (tgt - cur) * (1 - Math.pow(1 - 0.085, dt / 16.67));
        if (Math.abs(tgt - cur) < 0.3) cur = tgt;
        scrollTo({ top: cur, behavior: "instant" });
        applied = scrollY;
      }
      raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);
    stopGlide = () => { ac.abort(); cancelAnimationFrame(raf); stopGlide = null; };
  }

  /* Scroll warp (WebGL). Not on touch screens: they scroll on their own
     thread, and photos drawn from JS into a fixed canvas would trail behind
     the page in jumps. There the CSS gives each photo a scroll-linked drift. */
  let warp = null;
  function startWarp() {
    if (warp || !gallery || reduceMotion || touchScroll || !window.LKWarp) return;
    try {
      warp = window.LKWarp({
        items: gallery.figs.map((fig, i) => ({
          i, fig,
          frame: $(".ph__frame", fig),
          img: $("img", fig),
          radius: () => parseFloat(getComputedStyle(gallery.el).getPropertyValue("--radius")) || 0,
        })),
        hovered: () => hoveredIdx,
      });
    } catch (e) {
      warp = null;
      root.classList.remove("gl-on");
    }
  }
  function stopWarp() {
    warp?.destroy?.();
    warp = null;
  }

  /* ------------------------------------------------------------------------
     Custom cursor. Two layers that move together:
     - the lens (below) bends the backdrop through an SVG filter (Chromium)
       and carries the glass shading,
     - the blob (above) is a white disc blended with "difference": it inverts
       whatever is underneath. Blending works everywhere and costs almost
       nothing, so the inverted look stays even where the backdrop filter is
       too heavy or fails to draw.
     ------------------------------------------------------------------------ */
  const cursorEl = document.createElement("div");
  cursorEl.className = "cursor";
  cursorEl.setAttribute("aria-hidden", "true");
  cursorEl.innerHTML = `<div class="cursor__lens"></div><div class="cursor__blob"></div><span class="cursor__label" data-cursor-label></span>`;
  document.body.appendChild(cursorEl);
  let stopCursor = null;
  let refreshCursor = () => {};
  let lensBuilt = false;
  function startCursor() {
    if (stopCursor || !finePointer) return;
    const cur = cursorEl;
    const blob = $(".cursor__blob", cur);
    const lens = $(".cursor__lens", cur);
    const label = $("[data-cursor-label]", cur);
    const ac = new AbortController();
    const on = { passive: true, signal: ac.signal };
    root.classList.add("has-cursor");

    // Chromium can run an SVG filter on the backdrop: real refraction.
    const chromium = !!(navigator.userAgentData?.brands || []).some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
    if (chromium) {
      if (!lensBuilt) { buildLensFilter(); lensBuilt = true; }
      root.classList.add("has-lg");
    }

    // The blob element is 100px; every size below is scaled by SIZE.
    const SIZE = 0.8;
    const SIZES = { dot: 0.1 * SIZE, link: 0.36 * SIZE, label: 1 * SIZE };
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, seen = false;
    let scale = SIZES.dot, target = SIZES.dot, press = 1, stretch = 0, angle = 0;
    let lastSY = scrollY, scrollV = 0, lastProbe = 0, last = performance.now(), raf = 0;
    const show = () => cur.classList.remove("is-hidden");
    addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; cx = x; cy = y; }
      show();
    }, on);
    addEventListener("pointerdown", () => { press = 0.82; show(); }, on);
    addEventListener("pointerup", () => { press = 1; }, on);
    document.addEventListener("pointerleave", () => cur.classList.add("is-hidden"), on);

    const setHover = (el) => {
      const t = el?.closest?.("[data-cursor]");
      const link = el?.closest?.("a, button");
      cur.classList.toggle("is-label", !!t);
      cur.classList.toggle("is-link", !t && !!link);
      target = t ? SIZES.label : link ? SIZES.link : SIZES.dot;
      if (t) label.textContent = t.dataset.cursor;
    };
    document.addEventListener("pointerover", (e) => { show(); setHover(e.target); }, on);
    // something opened or closed under a still pointer (e.g. the lightbox)
    refreshCursor = () => { if (seen) setHover(document.elementFromPoint(x, y)); };

    // time based easing, so it feels the same on 60, 120 and 144 Hz screens
    const k = (rate, dt) => 1 - Math.pow(1 - rate, dt / 16.67);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(64, now - last);
      // two callbacks with the same timestamp would divide by zero below and
      // leave NaN in the state for good: the bubble would freeze in place
      if (!(dt > 0)) return;
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
      if (![cx, cy, scrollV, stretch, angle, scale].every(Number.isFinite)) {
        cx = x; cy = y; scrollV = 0; stretch = 0; angle = 0; scale = target;
      }
      const tf = `translate3d(${cx}px, ${cy}px, 0) rotate(${angle}rad) scale(${scale * (1 + stretch)}, ${scale * (1 - stretch * 0.55)})`;
      blob.style.transform = tf;
      lens.style.transform = tf;
      label.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    };
    raf = requestAnimationFrame(loop);

    stopCursor = () => {
      ac.abort();
      cancelAnimationFrame(raf);
      root.classList.remove("has-cursor", "has-lg");
      cur.classList.remove("is-label", "is-link");
      refreshCursor = () => {};
      stopCursor = null;
    };
  }

  /* SVG filter for the lens: a generated displacement map bends the backdrop
     towards the centre (magnifies) and much harder at the rim (refraction);
     each colour channel bends a little differently (dispersion). The
     inversion comes from the blob layered on top. */
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
        <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1"/>
      </filter>`;
    document.body.appendChild(svg);
  }

  /* ------------------------------------------------------------------------
     Effects on/off (lite version, see lite.js)
     ------------------------------------------------------------------------ */
  const effectSubs = [];
  function applyEffects() {
    if (Lite.on()) {
      stopWarp(); stopGlide?.(); stopCursor?.();
    } else {
      startGlide(); startWarp(); startCursor();
    }
    effectSubs.forEach((f) => f(Lite.on()));
  }
  Lite.onChange(applyEffects);

  I.onChange(() => {
    renderNav();
    renderFooter();
    I.apply(lb);
    if (!lb.hidden) renderLb();
    refreshCursor();
  });

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  renderNav();
  applyEffects();
  const ready = load().then((d) => {
    site = d;
    renderNav();
    renderFooter();
    if (d.gapyear) loadNowIn();
    return d;
  });
  ready.catch((e) => console.error(e));
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("is-ready")));

  window.LK = {
    $, $$, esc, pad, url, store, rng, tr, tx,
    reduceMotion, finePointer, touchScroll, isApple, root,
    I, Lite,
    ready,
    photo, titleOf, whereOf, exposureOf,
    gallery: makeGallery,
    lightbox: openLightbox,
    onEffects: (f) => effectSubs.push(f),
    refreshCursor: () => refreshCursor(),
  };
})();

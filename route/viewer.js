/* ==========================================================================
   Route — Ansicht (map + journal)
   ========================================================================== */
(() => {
  "use strict";

  const { $, $$, esc } = RT;
  const panel = $("[data-panel]");
  const body = $("[data-body]");
  const mobile = matchMedia("(max-width: 760px)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let model = null;
  let map = null;
  let layer = null;
  let backTo = "#/";
  let newestFirst = RT.store.get("lk-route-sort") !== "old";

  /* ------------------------------------------------ New since last visit */
  const LAST = "lk-route-last";
  const READ = "lk-route-read";
  let since = null;
  try { since = sessionStorage.getItem(LAST); } catch (e) { /* ignore */ }
  if (!since) {
    since = RT.store.get(LAST) || new Date().toISOString();
    try { sessionStorage.setItem(LAST, since); } catch (e) { /* ignore */ }
  }
  RT.store.set(LAST, new Date().toISOString());
  let read;
  try { read = new Set(JSON.parse(RT.store.get(READ) || "[]")); } catch (e) { read = new Set(); }
  const isNew = (p) => !!p.published && p.published > since && !read.has(p.id);
  const markRead = (id) => {
    if (read.has(id)) return;
    read.add(id);
    RT.store.set(READ, JSON.stringify([...read].slice(-500)));
  };

  /* ------------------------------------------------------- Bottom sheet
     Mobile only. The panel is a fixed-size layer moved with a transform:
       - follows the finger 1:1 (from where it was grabbed), rubber-bands at the ends
       - on release the flick is projected to a resting detent and a spring
         carries on with the finger's own velocity
       - can be grabbed again at any moment, also mid-flight                     */
  const SHEET = ["peek", "half", "full"];
  const OVER = 48; // must match --over
  let sheet = "peek";
  let sheetY = 0;
  let sheetAnim = null;

  const panelH = () => panel.offsetHeight;
  const safeBottom = () => parseFloat(getComputedStyle(panel).paddingBottom) || 0;
  const peekVisible = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--peek")) || 196) + safeBottom();
  const visibleFor = (st) => (st === "full" ? panelH() - OVER : st === "half" ? window.innerHeight * 0.52 : peekVisible());
  const yFor = (st) => panelH() - visibleFor(st);
  const applyY = (y) => {
    sheetY = y;
    panel.style.transform = `translate3d(0, ${y}px, 0)`;
  };
  const rubber = (y) => {
    const lo = yFor("full"), hi = yFor("peek");
    if (y < lo) return lo - Math.min(OVER - 2, RT.rubberband(lo - y, 300));
    if (y > hi) return hi + RT.rubberband(y - hi, 300);
    return y;
  };

  // Moves the sheet to a detent; velocity (px/s, + = down) is handed to the spring
  const setSheet = (st, velocity = 0) => {
    sheet = st;
    panel.dataset.sheet = st;
    if (map && st !== "full") recentre(450);
    if (!mobile.matches) return;
    sheetAnim && sheetAnim.stop();
    const to = yFor(st);
    if (reduceMotion) { applyY(to); return; }
    sheetAnim = RT.spring({
      from: sheetY, to, velocity,
      response: 0.42,
      damping: Math.abs(velocity) > 400 ? 0.82 : 1, // bounce only if a flick carried momentum
      onUpdate: applyY,
    });
  };
  const ensureSheet = (min) => {
    if (mobile.matches && SHEET.indexOf(sheet) < SHEET.indexOf(min)) setSheet(min);
  };
  const layoutSheet = () => {
    if (!mobile.matches) { sheetAnim && sheetAnim.stop(); panel.style.transform = ""; return; }
    sheetAnim && sheetAnim.stop();
    applyY(yFor(sheet));
  };
  panel.dataset.sheet = sheet;
  layoutSheet();
  mobile.addEventListener("change", layoutSheet);
  window.addEventListener("resize", () => { if (!(sheetAnim && sheetAnim.running) && !panel.classList.contains("is-dragging")) layoutSheet(); });

  (() => {
    let drag = null;
    const velocity = (hist, now) => {
      const last = hist[hist.length - 1];
      if (!last || now - last.t > 80) return 0; // finger rested before lifting
      const first = hist.find((h) => last.t - h.t <= 100) || hist[0];
      return last.t === first.t ? 0 : ((last.y - first.y) / (last.t - first.t)) * 1000;
    };

    panel.addEventListener("pointerdown", (e) => {
      if (!mobile.matches || e.button) return;
      if (sheet === "full" && body.contains(e.target)) return; // content scrolls here
      const interrupted = !!(sheetAnim && sheetAnim.running);
      sheetAnim && sheetAnim.stop(); // grab it wherever it is right now
      drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY, y0: sheetY, moved: false, interrupted,
        tap: !!e.target.closest("[data-handle],[data-head]"),
        hist: [{ t: e.timeStamp, y: e.clientY }],
      };
    });
    panel.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 8) return; // hysteresis before committing to a direction
        if (Math.abs(dx) > Math.abs(dy)) { if (drag.interrupted) setSheet(sheet); drag = null; return; }
        drag.moved = true;
        panel.setPointerCapture(e.pointerId);
        panel.classList.add("is-dragging");
      }
      drag.hist.push({ t: e.timeStamp, y: e.clientY });
      if (drag.hist.length > 8) drag.hist.shift();
      applyY(rubber(drag.y0 + dy));
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      panel.classList.remove("is-dragging");
      if (!d.moved) {
        if (d.interrupted) setSheet(sheet);
        else if (d.tap && e.type === "pointerup") setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "half");
        return;
      }
      const v = e.type === "pointercancel" ? 0 : velocity(d.hist, e.timeStamp);
      const projected = sheetY + RT.project(v);
      const best = SHEET.map((st) => [st, Math.abs(yFor(st) - projected)]).sort((p, q) => p[1] - q[1])[0][0];
      setSheet(best, v);
    };
    panel.addEventListener("pointerup", end);
    panel.addEventListener("pointercancel", end);
  })();

  const recentre = (ms) => {
    if (map._spinning || map.isMoving()) map.setPadding(padding());
    else map.easeTo({ padding: padding(), duration: ms });
  };

  const padding = () =>
    mobile.matches
      ? { top: 70, left: 30, right: 30, bottom: (sheet === "peek" ? peekVisible() : window.innerHeight * 0.52) + 24 }
      : { top: 70, left: 50, bottom: 50, right: panel.offsetWidth + 60 };

  /* ------------------------------------------------------------ Render */
  const stopName = (s) => (s ? esc(s.name) : "");

  const card = (p) => {
    const cover = RT.cover(p);
    const n = p.media.length;
    return `<button class="card" type="button" data-go="#/post/${esc(p.id)}">
      <span class="card__img ${cover ? "" : "card__img--none"}">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : RT.ICON.text}${n > 1 ? `<span class="card__n">${RT.ICON.stack}${n}</span>` : ""}</span>
      <span class="card__body">
        <span class="card__meta">${isNew(p) ? '<span class="badge">Neu</span>' : ""}${esc(RT.fmtDate(p.date))}${p.stopObj ? " · " + stopName(p.stopObj) : ""}</span>
        <span class="card__title">${esc(p.title || "Ohne Titel")}</span>
        <span class="card__ex">${esc(RT.excerpt(p.text))}</span>
      </span>
    </button>`;
  };

  const renderHead = () => {
    const t = model.trip;
    $("[data-title]").innerHTML = t.title ? esc(t.title).replace(/year$/i, (m) => `<em>${m}</em>`) : "Gap<em>year</em>";
    $("[data-sub]").textContent = [t.subtitle || "Route & Journal", model.current || !model.stops.length ? "" : "Geplant"].filter(Boolean).join(" · ");
    document.title = `${t.title || "Gapyear"} — Louis Koller`;

    const st = model.stats;
    const started = !!model.current;
    const cells = [
      [st.days ?? "–", st.days == null ? "Tage" : st.daysLabel],
      [started ? st.countries : st.countriesAll, (started ? st.countries : st.countriesAll) === 1 ? "Land" : "Länder"],
      [RT.fmtKm(started ? st.km : st.kmAll), "Kilometer"],
      [started ? st.places : st.placesAll, (started ? st.places : st.placesAll) === 1 ? "Ort" : "Orte"],
    ];
    $("[data-stats]").innerHTML = cells
      .map(([v, l]) => `<div class="stat"><span class="stat__v">${esc(v)}</span><span class="stat__l">${esc(l)}</span></div>`)
      .join("");

    const newCount = model.posts.filter(isNew).length;
    $("[data-n-posts]").textContent = model.posts.length ? (newCount ? `${newCount} neu` : model.posts.length) : "";
    $("[data-n-stops]").textContent = model.stops.length || "";

    const live = $("[data-live]");
    const where = (model.here && model.here.label) || (model.current && model.current.name);
    live.hidden = !where;
    if (where) $("[data-live-label]").textContent = `Jetzt: ${where}`;
    placeThumb();
  };

  const viewJournal = () => {
    const posts = model.posts.slice();
    if (newestFirst) posts.reverse();
    if (!posts.length) {
      return `<div class="view"><div class="empty"><p class="empty__t">Noch keine Beiträge.</p><p>Sobald es losgeht, erscheinen hier Geschichten, Fotos und Videos von unterwegs.</p></div></div>`;
    }
    let month = "";
    const html = posts
      .map((p) => {
        const m = RT.fmtMonth(p.date);
        const head = m !== month ? `<p class="month">${esc(m)}</p>` : "";
        month = m;
        return head + card(p);
      })
      .join("");
    return `<div class="view">${html}</div>`;
  };

  const viewStops = () => {
    if (!model.stops.length) {
      return `<div class="view"><div class="empty"><p class="empty__t">Die Route entsteht gerade.</p><p>Hier erscheinen bald alle Stationen der Reise.</p></div></div>`;
    }
    const rows = model.stops
      .map((s) => {
        const sub = [s.country, RT.fmtRange(s.from, s.to)].filter(Boolean).join(" · ");
        const mode = s.idx > 0 && RT.MODES[s.by] ? RT.MODES[s.by].icon : "";
        return `<li><button class="srow srow--${s.status}" type="button" data-go="#/ort/${esc(s.id)}">
          <span class="srow__dot"></span>
          <span><span class="srow__name">${esc(s.name)}</span><span class="srow__sub">${esc(sub)}</span></span>
          <span class="srow__side">${s.posts.length ? `${s.posts.length} ${s.posts.length === 1 ? "Beitrag" : "Beiträge"}` : ""}${mode}${RT.ICON.next}</span>
        </button></li>`;
      })
      .join("");
    return `<div class="view"><ol class="stops">${rows}</ol></div>`;
  };

  const statusPill = (s) =>
    s.status === "now"
      ? '<span class="pill pill--now">● Hier bin ich gerade</span>'
      : `<span class="pill">${s.status === "done" ? "Gereist" : "Geplant"}</span>`;

  const viewStop = (s) => {
    const i = s.idx;
    const prev = model.stops[i - 1], next = model.stops[i + 1];
    const posts = model.posts.filter((p) => p.stop === s.id).reverse();
    return `<div class="view">
      <button class="back" type="button" data-go="#/orte">${RT.ICON.chev}Alle Orte</button>
      <p class="eyebrow">Station ${String(i + 1).padStart(2, "0")} / ${String(model.stops.length).padStart(2, "0")}${s.country ? " · " + esc(s.country) : ""}</p>
      <h2 class="detail__title">${esc(s.name)}</h2>
      <div class="detail__meta">
        ${statusPill(s)}
        ${s.from || s.to ? `<span class="pill">${esc(RT.fmtRange(s.from, s.to))}</span>` : ""}
        ${i > 0 && RT.MODES[s.by] ? `<span class="pill">${RT.MODES[s.by].icon}${esc(RT.MODES[s.by].label)}</span>` : ""}
      </div>
      ${s.note ? `<div class="note prose">${RT.prose(s.note)}</div>` : ""}
      <p class="month">Beiträge von hier</p>
      ${posts.length ? posts.map(card).join("") : `<p class="empty" style="padding:14px 8px;text-align:left">Noch keine Beiträge von hier.</p>`}
      <div class="pager">
        ${prev ? `<button type="button" data-go="#/ort/${esc(prev.id)}"><span class="eyebrow">← Vorher</span><span>${esc(prev.name)}</span></button>` : "<span></span>"}
        ${next ? `<button type="button" data-go="#/ort/${esc(next.id)}"><span class="eyebrow">Danach →</span><span>${esc(next.name)}</span></button>` : "<span></span>"}
      </div>
    </div>`;
  };

  const galleryItem = (m, i) => {
    const ar = m.w && m.h ? `style="--ar:${m.w}/${m.h}"` : "";
    let inner;
    if (m.type === "img") inner = `<img src="${esc(RT.mediaSrc(m, true))}" alt="${esc(m.caption || "")}" loading="lazy">`;
    else if (m.type === "yt") inner = `<img src="${esc(RT.mediaThumb(m))}" alt="" loading="lazy"><span class="gallery__play">${RT.ICON.play}</span>`;
    else inner = (m.poster ? `<img src="${esc(m.poster)}" alt="" loading="lazy">` : `<video class="gallery__vid" src="${esc(RT.mediaSrc(m))}#t=0.1" muted playsinline preload="metadata"></video>`) + `<span class="gallery__play">${RT.ICON.play}</span>`;
    return `<button class="gallery__item" type="button" data-media="${i}" ${ar} aria-label="Medium ${i + 1} öffnen">${inner}</button>`;
  };

  const viewPost = (p) => {
    const list = model.posts;
    const i = list.indexOf(p);
    const older = list[i - 1], newer = list[i + 1];
    const backLabel = backTo.startsWith("#/ort/") ? (model.stops.find((s) => "#/ort/" + s.id === backTo)?.name || "Zurück") : backTo === "#/orte" ? "Alle Orte" : "Journal";
    return `<div class="view">
      <button class="back" type="button" data-go="${esc(backTo)}">${RT.ICON.chev}${esc(backLabel)}</button>
      <p class="eyebrow">${esc(RT.fmtDate(p.date))}${p.stopObj ? ` · <a href="#/ort/${esc(p.stopObj.id)}">${stopName(p.stopObj)}</a>${p.stopObj.country && p.stopObj.country !== p.stopObj.name ? ", " + esc(p.stopObj.country) : ""}` : ""}</p>
      <h2 class="detail__title">${esc(p.title || "Ohne Titel")}</h2>
      ${p.media.length ? `<div class="gallery">${p.media.map(galleryItem).join("")}</div>` : ""}
      <div class="prose">${RT.prose(p.text)}</div>
      <div class="actions">
        <button class="btn" type="button" data-share="${esc(p.id)}">${RT.ICON.share} Link teilen</button>
        ${p.stopObj ? `<button class="btn btn--ghost" type="button" data-fly="${esc(p.stopObj.id)}">${RT.ICON.pin} Auf der Karte</button>` : ""}
      </div>
      <div class="pager">
        ${older ? `<button type="button" data-go="#/post/${esc(older.id)}"><span class="eyebrow">← Älter</span><span>${esc(older.title || "Ohne Titel")}</span></button>` : "<span></span>"}
        ${newer ? `<button type="button" data-go="#/post/${esc(newer.id)}"><span class="eyebrow">Neuer →</span><span>${esc(newer.title || "Ohne Titel")}</span></button>` : "<span></span>"}
      </div>
    </div>`;
  };

  /* ------------------------------------------------------------ Router */
  let currentPost = null;
  const thumb = $("[data-seg-thumb]");
  const placeThumb = () => {
    const on = $("[data-seg] .tab.is-active");
    if (!on) return;
    thumb.style.width = on.offsetWidth + "px";
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!thumb.classList.contains("is-ready")) requestAnimationFrame(() => thumb.classList.add("is-ready"));
  };
  const setTab = (name, list = false) => {
    $$("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    placeThumb();
    const sort = $("[data-sort]");
    sort.hidden = !list || model.posts.length < 2;
    sort.textContent = newestFirst ? "Neueste zuerst ↓" : "Älteste zuerst ↑";
  };

  const route = () => {
    if (!model) return;
    const [kind, id] = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
    currentPost = null;
    let html;
    if (kind === "post" && model.posts.find((p) => p.id === id)) {
      const p = model.posts.find((x) => x.id === id);
      currentPost = p;
      html = viewPost(p);
      setTab(backTo.startsWith("#/ort") || backTo === "#/orte" ? "orte" : "journal");
      markRead(p.id);
      if (p.stopObj && layer) {
        layer.setActive(p.stopObj.id);
        if (!mobile.matches) layer.flyTo(p.stopObj.id, padding());
      }
      ensureSheet("full");
    } else if (kind === "ort" && model.stops.find((s) => s.id === id)) {
      const s = model.stops.find((x) => x.id === id);
      backTo = "#/ort/" + s.id;
      html = viewStop(s);
      setTab("orte");
      ensureSheet("half");
      if (layer) {
        layer.setActive(s.id);
        layer.flyTo(s.id, padding());
      }
    } else if (kind === "orte") {
      backTo = "#/orte";
      html = viewStops();
      setTab("orte");
      layer && layer.setActive(null);
    } else {
      backTo = "#/";
      html = viewJournal();
      setTab("journal", true);
      layer && layer.setActive(null);
    }
    body.innerHTML = html;
    body.scrollTop = 0;
    renderHead();
  };

  const go = (hash) => {
    if (location.hash === hash || (hash === "#/" && !location.hash)) route();
    else location.hash = hash;
  };

  window.addEventListener("hashchange", route);

  $$("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      ensureSheet("half");
      go(b.dataset.tab === "orte" ? "#/orte" : "#/");
    })
  );
  $("[data-sort]").addEventListener("click", () => {
    newestFirst = !newestFirst;
    RT.store.set("lk-route-sort", newestFirst ? "new" : "old");
    route();
  });
  $("[data-live]").addEventListener("click", () => {
    if (!layer || !model) return;
    if (model.current) go("#/ort/" + model.current.id);
    else if (model.here) map.flyTo({ center: [model.here.x, model.here.lat], zoom: 7, padding: padding(), duration: 1800 });
  });

  body.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) { e.preventDefault(); go(goEl.dataset.go); return; }
    const media = e.target.closest("[data-media]");
    if (media && currentPost) { openLightbox(currentPost.media, +media.dataset.media); return; }
    const share = e.target.closest("[data-share]");
    if (share) { sharePost(share.dataset.share); return; }
    const fly = e.target.closest("[data-fly]");
    if (fly && layer) {
      if (mobile.matches) setSheet("peek");
      layer.flyTo(fly.dataset.fly, padding());
    }
  });

  const sharePost = (id) => {
    const p = model.posts.find((x) => x.id === id);
    const url = location.origin + location.pathname + "#/post/" + encodeURIComponent(id);
    if (navigator.share && mobile.matches) {
      navigator.share({ title: p ? p.title : "Gapyear", url }).catch(() => {});
      return;
    }
    const done = () => RT.toast("Link kopiert. Der Code wird beim Öffnen abgefragt.");
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt("Link kopieren:", url));
    else prompt("Link kopieren:", url);
  };

  /* ---------------------------------------------------------- Lightbox */
  const lb = $("[data-lb]");
  const lbMedia = $("[data-lb-media]");
  let lbItems = [], lbIdx = 0, lbReturn = null;

  const lbShow = (i) => {
    lbIdx = (i + lbItems.length) % lbItems.length;
    const m = lbItems[lbIdx];
    let el;
    if (m.type === "img") el = `<img src="${esc(RT.mediaSrc(m))}" alt="${esc(m.caption || "")}">`;
    else if (m.type === "yt") el = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Video"></iframe>`;
    else el = `<video src="${esc(RT.mediaSrc(m))}" controls autoplay playsinline ${m.poster ? `poster="${esc(m.poster)}"` : ""}></video>`;
    lbMedia.innerHTML = el;
    $("[data-lb-count]").textContent = `${String(lbIdx + 1).padStart(2, "0")} / ${String(lbItems.length).padStart(2, "0")}`;
    $("[data-lb-cap]").textContent = m.caption || "";
    // Preload neighbours
    [lbIdx + 1, lbIdx - 1].forEach((j) => {
      const n = lbItems[(j + lbItems.length) % lbItems.length];
      if (n && n.type === "img") new Image().src = RT.mediaSrc(n);
    });
  };
  const openLightbox = (items, i) => {
    lbItems = items;
    lbReturn = document.activeElement;
    lb.hidden = false;
    lb.classList.toggle("is-single", items.length < 2);
    lbShow(i);
    $("[data-lb-close]").focus();
  };
  const closeLightbox = () => {
    lb.hidden = true;
    lbMedia.innerHTML = "";
    lbReturn && lbReturn.focus && lbReturn.focus();
  };
  $("[data-lb-close]").addEventListener("click", closeLightbox);
  $("[data-lb-prev]").addEventListener("click", () => lbShow(lbIdx - 1));
  $("[data-lb-next]").addEventListener("click", () => lbShow(lbIdx + 1));
  lbMedia.addEventListener("click", (e) => { if (e.target === lbMedia) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft" && lbItems.length > 1) lbShow(lbIdx - 1);
    else if (e.key === "ArrowRight" && lbItems.length > 1) lbShow(lbIdx + 1);
  });
  /* Lightbox gestures: the photo follows the finger. Sideways flicks page
     through (projected, with the finger's velocity), a vertical pull dismisses
     it while the background fades; anything undecided springs back. */
  (() => {
    const stage = $("[data-lb-stage]");
    let g = null, anim = null, swallow = false;
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const paint = (x, y) => {
      const p = Math.min(1, Math.abs(y) / (H() * 0.5));
      lbMedia.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 - p * 0.22})`;
      lb.style.setProperty("--lb-o", String(1 - p * 0.85));
    };
    const reset = () => { lbMedia.style.transform = ""; lb.style.removeProperty("--lb-o"); };
    const run = (o) => { anim && anim.stop(); anim = RT.spring({ response: 0.38, ...o }); return anim; };
    const vel = (h, now) => {
      const l = h[h.length - 1];
      if (!l || now - l.t > 80) return { x: 0, y: 0 };
      const f = h.find((q) => l.t - q.t <= 100) || h[0];
      const dt = l.t - f.t;
      return dt ? { x: ((l.x - f.x) / dt) * 1000, y: ((l.y - f.y) / dt) * 1000 } : { x: 0, y: 0 };
    };

    stage.addEventListener("pointerdown", (e) => {
      if (e.button || !e.target.closest("img")) return;
      anim && anim.stop();
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: 0, oy: 0, axis: null, h: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
    });
    stage.addEventListener("pointermove", (e) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.axis) {
        if (Math.hypot(dx, dy) < 10) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "x" && lbItems.length < 2) g.axis = "y";
        stage.setPointerCapture(e.pointerId);
      }
      g.h.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      if (g.h.length > 8) g.h.shift();
      if (g.axis === "x") paint(dx, 0);
      else paint(0, dy);
    });
    const end = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const d = g, v = e.type === "pointercancel" ? { x: 0, y: 0 } : vel(g.h, e.timeStamp);
      g = null;
      if (!d.axis) return;
      swallow = true; setTimeout(() => { swallow = false; }, 0);
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (d.axis === "x") {
        const end = dx + RT.project(v.x);
        if (Math.abs(end) > 110) {
          const dir = end < 0 ? 1 : -1, off = -dir * W();
          run({ from: dx, to: off, velocity: v.x, response: 0.28, damping: 1, rest: 2,
            onUpdate: (x) => paint(x, 0),
            onDone: () => {
              lbShow(lbIdx + dir);
              paint(-off, 0);
              run({ from: -off, to: 0, velocity: 0, response: 0.4, onUpdate: (x) => paint(x, 0), onDone: reset });
            } });
        } else run({ from: dx, to: 0, velocity: v.x, damping: 0.85, onUpdate: (x) => paint(x, 0), onDone: reset });
      } else {
        const end = dy + RT.project(v.y);
        if (Math.abs(end) > 160) {
          const off = (end < 0 ? -1 : 1) * H() * 0.6;
          run({ from: dy, to: off, velocity: v.y, response: 0.3, damping: 1, rest: 2,
            onUpdate: (y) => paint(0, y),
            onDone: () => { closeLightbox(); reset(); } });
        } else run({ from: dy, to: 0, velocity: v.y, damping: 0.85, onUpdate: (y) => paint(0, y), onDone: reset });
      }
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    lbMedia.addEventListener("click", (e) => { if (swallow) e.stopPropagation(); }, true);
  })();

  /* -------------------------------------------------------------- Boot */
  const load = async () => {
    const res = await fetch(`${RT.DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return RT.normalize(await res.json());
  };

  const start = async () => {
    if (RT.store.get("lk-route-gh")) $("[data-admin-link]").hidden = false;

    map = RT.createMap("map", { controls: !mobile.matches, attribution: mobile.matches ? "top-right" : "bottom-left" });
    // Keep the globe centred in the free area left of (or above) the panel
    map.setPadding(padding());
    let rz;
    window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => recentre(300), 150); });
    layer = new RT.RouteLayer(map, { onStop: (id) => go("#/ort/" + id) });

    let trip;
    try {
      trip = await load();
    } catch (e) {
      body.innerHTML = `<div class="view"><div class="empty"><p class="empty__t">Hoppla.</p><p>Die Route konnte nicht geladen werden. Bitte später nochmal versuchen.</p></div></div>`;
      RT.spin(map);
      return;
    }
    model = RT.model(trip);
    layer.set(model);
    route();

    RT.onLoad(map, () => {
      if (!model.stops.length) { RT.spin(map); return; }
      const [kind, id] = location.hash.replace(/^#\/?/, "").split("/");
      if (kind === "ort" || kind === "post") {
        const s = kind === "ort" ? model.stops.find((x) => x.id === id) : model.posts.find((x) => x.id === id)?.stopObj;
        if (s) { map.jumpTo({ center: [s.x, s.lat], zoom: 5.5, padding: padding() }); return; }
      }
      layer.fit(padding(), !reduceMotion);
    });
  };

  RT.gate(start);
})();

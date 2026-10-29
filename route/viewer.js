/* ==========================================================================
   Route — Ansicht (map + journal)
   ========================================================================== */
(() => {
  "use strict";

  const { $, $$, esc } = RT;
  const panel = $("[data-panel]");
  const body = $("[data-body]");
  const LEGAL = `<p class="legal-links"><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a></p>`;
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

  /* ------------------------------------------------------------ Motion
     Springs (damping ratio + response, as in UIKit) start from the value on
     screen and carry the finger's velocity, so every animation can be
     caught mid-flight and thrown again. */
  const spring = (from, to, velocity, { damping = 1, response = 0.4 } = {}, onFrame, onDone) => {
    if (reduceMotion) {
      onFrame(to, 0);
      onDone && onDone();
      return { stop() {}, value: to };
    }
    const k = ((2 * Math.PI) / response) ** 2;
    const c = (4 * Math.PI * damping) / response;
    let x = from, v = velocity || 0, last = null, raf = 0, live = true;
    const tick = (t) => {
      if (!live) return;
      const dt = last == null ? 1 / 60 : Math.min(0.05, (t - last) / 1000);
      last = t;
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
      if (Math.abs(x - to) < 0.3 && Math.abs(v) < 6) {
        live = false;
        onFrame(to, 0);
        onDone && onDone();
        return;
      }
      onFrame(x, v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { stop() { live = false; cancelAnimationFrame(raf); }, get value() { return x; } };
  };
  // Where a flick would come to rest (scroll-view deceleration)
  const project = (v, rate = 0.995) => ((v / 1000) * rate) / (1 - rate);
  // Progressive resistance past an edge
  const rubberband = (over, dim, k = 0.55) => (over * dim * k) / (dim + k * Math.abs(over));
  // Pointer velocity (px/s) from the last ~100 ms of samples
  const tracker = () => {
    let pts = [];
    return {
      add(e) { pts.push([e.clientX, e.clientY, e.timeStamp]); if (pts.length > 20) pts.shift(); },
      velocity(t) {
        const recent = pts.filter((p) => t - p[2] < 100);
        if (recent.length < 2) return { x: 0, y: 0 };
        const a = recent[0], b = recent[recent.length - 1], dt = (b[2] - a[2]) / 1000;
        return dt > 0 ? { x: (b[0] - a[0]) / dt, y: (b[1] - a[1]) / dt } : { x: 0, y: 0 };
      },
      reset() { pts = []; },
    };
  };

  /* ------------------------------------------------------- Bottom sheet */
  const SHEET = ["peek", "half", "full"];
  let sheet = "peek";
  let sheetAnim = null;
  const heightFor = (st) => {
    if (st === "full") return window.innerHeight * 0.88;
    if (st === "half") return window.innerHeight * 0.52;
    return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--peek")) || 188) + (parseFloat(getComputedStyle(panel).paddingBottom) || 0);
  };
  const sheetHeight = () => panel.getBoundingClientRect().height;
  const settleSheet = (velocity = 0) => {
    sheetAnim && sheetAnim.stop();
    if (!mobile.matches) { panel.style.height = ""; return; }
    // A little overshoot only when the sheet was thrown
    const thrown = Math.abs(velocity) > 300;
    sheetAnim = spring(sheetHeight(), heightFor(sheet), velocity, { damping: thrown ? 0.84 : 1, response: thrown ? 0.34 : 0.4 }, (h) => {
      panel.style.height = h + "px";
    });
  };
  const setSheet = (s, velocity) => {
    sheet = s;
    panel.classList.toggle("is-half", s === "half");
    panel.classList.toggle("is-full", s === "full");
    settleSheet(velocity);
    if (map && s !== "full") recentre(450);
  };
  const ensureSheet = (min) => {
    if (mobile.matches && SHEET.indexOf(sheet) < SHEET.indexOf(min)) setSheet(min);
  };
  mobile.addEventListener?.("change", () => settleSheet());

  (() => {
    const grab = [$("[data-handle]"), $("[data-head]")];
    const track = tracker();
    let startY = 0, startH = 0, dragging = false, moved = false, fromHead = false;
    const down = (e) => {
      if (!mobile.matches || e.button > 0) return;
      // Catch the sheet wherever it is right now
      sheetAnim && sheetAnim.stop();
      dragging = true; moved = false;
      fromHead = e.currentTarget.hasAttribute("data-head");
      startY = e.clientY;
      startH = sheetHeight();
      track.reset(); track.add(e);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      track.add(e);
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dy) < 6) return;
      if (!moved) { moved = true; panel.classList.add("is-dragging"); }
      const lo = heightFor("peek"), hi = heightFor("full");
      let h = startH - dy;
      if (h > hi) h = hi + rubberband(h - hi, window.innerHeight);
      else if (h < lo) h = lo - rubberband(lo - h, window.innerHeight);
      panel.style.height = h + "px";
    };
    const up = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("is-dragging");
      if (!moved) {
        if (e.type === "pointercancel") return settleSheet();
        if (fromHead && sheet === "full") return settleSheet();
        setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "half");
        return;
      }
      const v = -track.velocity(e.timeStamp).y; // px/s, positive = growing
      const h = sheetHeight();
      const target = h + project(v);
      let best = SHEET.reduce((a, st) => (Math.abs(heightFor(st) - target) < Math.abs(heightFor(a) - target) ? st : a), "peek");
      // A deliberate flick always moves in its own direction
      if (Math.abs(v) > 400 && (heightFor(best) - h) * v <= 0) {
        const ahead = SHEET.filter((st) => (v > 0 ? heightFor(st) > h + 1 : heightFor(st) < h - 1));
        if (ahead.length) best = v > 0 ? ahead[0] : ahead[ahead.length - 1];
      }
      setSheet(best, v);
    };
    grab.forEach((el) => {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  })();

  const recentre = (ms) => {
    if (map._spinning || map.isMoving()) map.setPadding(padding());
    else map.easeTo({ padding: padding(), duration: ms });
  };

  const padding = () =>
    mobile.matches
      ? { top: 70, left: 30, right: 30, bottom: sheet === "peek" ? heightFor("peek") + 16 : window.innerHeight * 0.52 + 30 }
      : { top: 70, left: 50, bottom: 50, right: panel.offsetWidth + 60 };

  /* ------------------------------------------------------------ Render */
  const stopName = (s) => (s ? esc(s.name) : "");

  const card = (p) => {
    const cover = RT.cover(p);
    const n = p.media.length;
    return `<button class="card" type="button" data-go="#/post/${esc(p.id)}">
      <span class="card__img ${cover ? "" : "card__img--none"}">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : RT.ICON.text}${n > 1 ? `<span class="card__n">${n}</span>` : ""}</span>
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
        const head = m !== month ? `<p class="eyebrow month">${esc(m)}</p>` : "";
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
          <span class="srow__side">${s.posts.length ? `${s.posts.length} ✎ ` : ""}${mode}</span>
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
      <button class="back" type="button" data-go="#/orte">Alle Orte</button>
      <p class="eyebrow">Station ${String(i + 1).padStart(2, "0")} / ${String(model.stops.length).padStart(2, "0")}${s.country ? " · " + esc(s.country) : ""}</p>
      <h2 class="detail__title">${esc(s.name)}</h2>
      <div class="detail__meta">
        ${statusPill(s)}
        ${s.from || s.to ? `<span class="pill">${esc(RT.fmtRange(s.from, s.to))}</span>` : ""}
        ${i > 0 && RT.MODES[s.by] ? `<span class="pill">${RT.MODES[s.by].icon}${esc(RT.MODES[s.by].label)}</span>` : ""}
      </div>
      ${s.note ? `<div class="note prose">${RT.prose(s.note)}</div>` : ""}
      <p class="eyebrow month">Beiträge von hier</p>
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
      <button class="back" type="button" data-go="${esc(backTo)}">${esc(backLabel)}</button>
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
  let lastDepth = 0;
  const setTab = (name) => {
    $$("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
    const sort = $("[data-sort]");
    sort.hidden = name !== "journal" || model.posts.length < 2;
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
      setTab("journal");
      layer && layer.setActive(null);
    }
    // Deeper views push in from the right, going back slides in from the left
    const depth = kind === "post" && currentPost ? 2 : html.includes('class="back"') ? 1 : 0;
    body.dataset.dir = depth > lastDepth ? "fwd" : depth < lastDepth ? "back" : "";
    lastDepth = depth;
    body.innerHTML = html + LEGAL;
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

  /* ---------------------------------------------------------- Lightbox
     A pager: neighbours sit left and right of the current item, the track
     follows the finger 1:1, a flick pages, a pull down dismisses. */
  const lb = $("[data-lb]");
  const stage = $("[data-lb-stage]");
  const lbMedia = $("[data-lb-media]");
  let lbItems = [], lbIdx = 0, lbReturn = null;
  let lbX = 0, lbY = 0, lbAnimX = null, lbAnimY = null, lbDragged = false;
  const pageW = () => stage.clientWidth + 24; // matches .lb__slide--prev/--next

  const paintLb = () => {
    const down = Math.max(0, lbY);
    lbMedia.style.transform = lbX || lbY ? `translate3d(${lbX}px, ${lbY}px, 0) scale(${1 - Math.min(0.3, down / 1500)})` : "";
    lb.style.setProperty("--fade", String(1 - Math.min(1, down / 420)));
  };
  const stopLb = () => {
    lbAnimX && lbAnimX.stop();
    lbAnimY && lbAnimY.stop();
    lbAnimX = lbAnimY = null;
  };

  const slideHtml = (m, full) => {
    if (!m) return "";
    if (!full) {
      const t = m.type === "img" ? RT.mediaSrc(m) : RT.mediaThumb(m);
      return t ? `<img src="${esc(t)}" alt="">` : "";
    }
    if (m.type === "img") return `<img src="${esc(RT.mediaSrc(m))}" alt="${esc(m.caption || "")}">`;
    if (m.type === "yt") return `<iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Video"></iframe>`;
    return `<video src="${esc(RT.mediaSrc(m))}" controls autoplay playsinline ${m.poster ? `poster="${esc(m.poster)}"` : ""}></video>`;
  };
  const lbShow = (i) => {
    const n = lbItems.length;
    lbIdx = (i + n) % n;
    const m = lbItems[lbIdx];
    const side = (j, cls) => `<div class="lb__slide lb__slide--${cls}" aria-hidden="true">${slideHtml(lbItems[(j + n) % n])}</div>`;
    lbMedia.innerHTML = (n > 1 ? side(lbIdx - 1, "prev") : "") + `<div class="lb__slide">${slideHtml(m, true)}</div>` + (n > 1 ? side(lbIdx + 1, "next") : "");
    lbX = lbY = 0;
    paintLb();
    $("[data-lb-count]").textContent = `${lbIdx + 1} von ${n}`;
    $("[data-lb-cap]").textContent = m.caption || "";
  };
  // Slide the neighbour in, carrying any velocity the finger left behind
  const page = (dir, velocity = 0) => {
    if (lbItems.length < 2) return;
    stopLb();
    if (lbY) lbAnimY = spring(lbY, 0, 0, { response: 0.3 }, (y) => { lbY = y; paintLb(); });
    lbAnimX = spring(lbX, -dir * pageW(), velocity, { damping: 1, response: 0.32 }, (x) => { lbX = x; paintLb(); }, () => {
      lbAnimX = null;
      lbShow(lbIdx + dir);
    });
  };
  const openLightbox = (items, i) => {
    lbItems = items;
    lbReturn = document.activeElement;
    stopLb();
    lb.classList.remove("is-closing", "is-opening");
    lb.hidden = false;
    lb.classList.toggle("is-single", items.length < 2);
    lbShow(i);
    void lb.offsetWidth;
    lb.classList.add("is-opening");
    $("[data-lb-close]").focus();
  };
  lbMedia.addEventListener("animationend", () => lb.classList.remove("is-opening"));
  const finishClose = () => {
    stopLb();
    lb.hidden = true;
    lb.classList.remove("is-closing", "is-opening");
    lbMedia.innerHTML = "";
    lbX = lbY = 0;
    paintLb();
    lbReturn && lbReturn.focus && lbReturn.focus();
  };
  const closeLightbox = (velocity) => {
    stopLb();
    if (typeof velocity === "number") {
      // Thrown down: keep going the way the finger went
      lbAnimY = spring(lbY, stage.clientHeight, Math.max(velocity, 400), { damping: 1, response: 0.35 }, (y) => { lbY = y; paintLb(); }, finishClose);
      return;
    }
    if (reduceMotion) return finishClose();
    lb.classList.remove("is-opening");
    lb.classList.add("is-closing");
    setTimeout(finishClose, 280);
  };
  $("[data-lb-close]").addEventListener("click", () => closeLightbox());
  $("[data-lb-prev]").addEventListener("click", () => page(-1));
  $("[data-lb-next]").addEventListener("click", () => page(1));
  lbMedia.addEventListener("click", (e) => {
    if (lbDragged) { lbDragged = false; return; }
    if (e.target === lbMedia || e.target.classList.contains("lb__slide")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") page(-1);
    else if (e.key === "ArrowRight") page(1);
  });
  (() => {
    const track = tracker();
    let id = null, sx = 0, sy = 0, bx = 0, by = 0, axis = null;
    stage.addEventListener("dragstart", (e) => e.preventDefault());
    stage.addEventListener("pointerdown", (e) => {
      if (id !== null || e.button > 0 || lb.classList.contains("is-closing") || e.target.closest("button, iframe")) return;
      if (e.pointerType === "mouse" && e.target.closest("video")) return; // leave video controls alone
      stopLb();
      lb.classList.remove("is-opening");
      id = e.pointerId;
      sx = e.clientX; sy = e.clientY; bx = lbX; by = lbY;
      // Caught mid-flight: carry on along the same axis
      axis = Math.abs(lbX) > 0.5 ? "x" : Math.abs(lbY) > 0.5 ? "y" : null;
      lbDragged = !!axis;
      track.reset(); track.add(e);
      if (axis) stage.setPointerCapture(id);
    });
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      track.add(e);
      if (!axis) {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.hypot(dx, dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        lbDragged = true;
        sx = e.clientX; sy = e.clientY; // start tracking from here, no jump
        stage.setPointerCapture(id);
      }
      if (axis === "x") {
        const x = bx + e.clientX - sx;
        lbX = lbItems.length > 1 ? x : Math.sign(x) * rubberband(Math.abs(x), stage.clientWidth);
      } else {
        const y = by + e.clientY - sy;
        lbY = y < 0 ? -rubberband(-y, stage.clientHeight) : y;
      }
      paintLb();
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      const a = axis;
      axis = null;
      if (!a) return;
      const v = track.velocity(e.timeStamp);
      const cancel = e.type === "pointercancel";
      if (a === "x") {
        const rest = lbX + project(v.x);
        if (!cancel && lbItems.length > 1 && Math.abs(rest) > pageW() * 0.3) return page(rest < 0 ? 1 : -1, v.x);
        lbAnimX = spring(lbX, 0, v.x, { damping: 1, response: 0.35 }, (x) => { lbX = x; paintLb(); });
      } else {
        if (!cancel && lbY + project(v.y) > 180) return closeLightbox(v.y);
        lbAnimY = spring(lbY, 0, v.y, { damping: 1, response: 0.35 }, (y) => { lbY = y; paintLb(); });
      }
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
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
    window.addEventListener("resize", () => {
      if (panel.style.height) settleSheet();
      clearTimeout(rz); rz = setTimeout(() => recentre(300), 150);
    });
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

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

  /* ------------------------------------------------------- Bottom sheet */
  const SHEET = ["peek", "half", "full"];
  let sheet = "peek";
  const setSheet = (s) => {
    sheet = s;
    panel.classList.toggle("is-half", s === "half");
    panel.classList.toggle("is-full", s === "full");
  };
  const ensureSheet = (min) => {
    if (mobile.matches && SHEET.indexOf(sheet) < SHEET.indexOf(min)) setSheet(min);
  };

  (() => {
    const grab = [$("[data-handle]"), $("[data-head]")];
    let startY = 0, startH = 0, dragging = false, moved = false, lastY = 0, lastT = 0, v = 0;
    const heightFor = (st) => {
      const peek = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--peek")) || 186) + (parseFloat(getComputedStyle(panel).paddingBottom) || 0);
      return st === "full" ? window.innerHeight * 0.88 : st === "half" ? window.innerHeight * 0.52 : peek;
    };
    const down = (e) => {
      if (!mobile.matches) return;
      if (sheet === "full" && e.currentTarget.hasAttribute("data-head")) return;
      dragging = true; moved = false;
      startY = lastY = e.clientY;
      startH = panel.offsetHeight;
      lastT = performance.now(); v = 0;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dy) < 5) return;
      if (!moved) { moved = true; panel.classList.add("is-dragging"); }
      const now = performance.now();
      v = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY; lastT = now;
      panel.style.height = Math.max(heightFor("peek"), Math.min(heightFor("full"), startH - dy)) + "px";
    };
    const up = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("is-dragging");
      panel.style.height = "";
      if (!moved) {
        setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "half");
        return;
      }
      const h = startH - (e.clientY - startY) - v * 180;
      const best = SHEET.map((st) => [st, Math.abs(heightFor(st) - h)]).sort((x, y) => x[1] - y[1])[0][0];
      setSheet(best);
    };
    grab.forEach((el) => {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  })();

  const padding = () =>
    mobile.matches
      ? { top: 70, left: 30, right: 30, bottom: sheet === "peek" ? 200 : window.innerHeight * 0.52 + 30 }
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
    $("[data-sub]").textContent = t.subtitle || "Route & Journal";
    document.title = `${t.title || "Gapyear"} — Louis Koller`;

    const st = model.stats;
    const started = !!model.current;
    const cells = [
      [st.days ?? "–", st.days == null ? "Tage" : st.daysLabel],
      [started ? st.countries : st.countriesAll, started ? (st.countries === 1 ? "Land" : "Länder") : "Länder geplant"],
      [RT.fmtKm(started ? st.km : st.kmAll), started ? "Kilometer" : "km geplant"],
      [started ? st.places : st.placesAll, started ? (st.places === 1 ? "Ort" : "Orte") : "Orte geplant"],
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
      <button class="back" type="button" data-go="#/orte">← Alle Orte</button>
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
      <button class="back" type="button" data-go="${esc(backTo)}">← ${esc(backLabel)}</button>
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
  (() => {
    let x0 = null, y0 = 0;
    const stage = $("[data-lb-stage]");
    stage.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (x0 == null || lbItems.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) lbShow(lbIdx + (dx < 0 ? 1 : -1));
    });
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

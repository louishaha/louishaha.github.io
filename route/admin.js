/* ==========================================================================
   Route — Bearbeiten
   Saves straight into the GitHub repo (one commit per "Veröffentlichen").
   Needs a fine-grained token with "Contents: Read and write" on the repo;
   it is stored only in this browser (localStorage).
   ========================================================================== */
(() => {
  "use strict";

  const { $, $$, esc } = RT;
  const API = "https://api.github.com";
  const GH_KEY = "lk-route-gh";
  const DRAFT_KEY = "lk-route-draft";
  const pane = $("[data-pane]");
  const statusEl = $("[data-status]");
  const publishBtn = $("[data-publish]");
  const mobile = matchMedia("(max-width: 760px)");

  let gh = null;
  try { gh = JSON.parse(RT.store.get(GH_KEY) || "null"); } catch (e) { gh = null; }
  let branch = null;
  let remoteRev = 0; // rev of the published trip our edits are based on
  let trip = RT.emptyTrip();
  const pending = new Map(); // path relative to /route/ -> Blob, not yet uploaded
  let dirty = false;
  let busy = false;
  let loaded = false; // never publish on top of a trip we failed to load
  let loadError = false;
  let tab = "orte";
  let editing = null; // { kind: "stop" | "post", obj, isNew }
  let map = null, layer = null, pick = null;

  const clean = (t) => JSON.parse(JSON.stringify(t, (k, v) => (k.startsWith("_") ? undefined : v)));
  const rand = () => Math.random().toString(36).slice(2, 8);
  const pad2 = (n) => String(n).padStart(2, "0");

  /* -------------------------------------------------------------- Status */
  const setStatus = (kind, text) => {
    statusEl.dataset.kind = kind;
    statusEl.textContent = text;
    publishBtn.disabled = !(dirty && !busy && gh && loaded);
  };
  const idleStatus = () => {
    if (!gh) setStatus("", "Nicht verbunden");
    else if (dirty) setStatus("dirty", "Ungespeicherte Änderungen");
    else setStatus("ok", "Alles veröffentlicht");
  };

  /* -------------------------------------------- Pending files (IndexedDB) */
  const idb = (() => {
    let dbp = null;
    const open = () =>
      dbp ||
      (dbp = new Promise((res, rej) => {
        const r = indexedDB.open("lk-route", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("files");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }));
    const run = async (mode, fn) => {
      try {
        const db = await open();
        return await new Promise((res, rej) => {
          const t = db.transaction("files", mode);
          const req = fn(t.objectStore("files"));
          t.oncomplete = () => res(req && req.result);
          t.onerror = () => rej(t.error);
        });
      } catch (e) {
        return undefined;
      }
    };
    return {
      put: (k, v) => run("readwrite", (s) => s.put(v, k)),
      get: (k) => run("readonly", (s) => s.get(k)),
      del: (k) => run("readwrite", (s) => s.delete(k)),
      clear: () => run("readwrite", (s) => s.clear()),
    };
  })();

  const addPending = (path, blob) => { pending.set(path, blob); idb.put(path, blob); };
  const dropPending = (path) => { if (path && pending.has(path)) { pending.delete(path); idb.del(path); } };
  const mediaPaths = (t) => {
    const out = new Set();
    (t.posts || []).forEach((p) =>
      (p.media || []).forEach((m) => [m.src, m.thumb, m.poster].forEach((x) => x && !/^https?:/.test(x) && out.add(x)))
    );
    return out;
  };

  /* -------------------------------------------------------------- Draft */
  let draftTimer, mapTimer;
  const saveDraft = () => {
    clearTimeout(draftTimer);
    if (dirty) RT.store.set(DRAFT_KEY, JSON.stringify({ baseRev: remoteRev, trip: clean(trip) }));
  };
  const touch = (opts = {}) => {
    dirty = true;
    idleStatus();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 300);
    if (opts.map !== false) {
      clearTimeout(mapTimer);
      mapTimer = setTimeout(refreshMap, 150);
    }
  };
  window.addEventListener("beforeunload", (e) => {
    saveDraft();
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
  window.addEventListener("pagehide", saveDraft);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveDraft(); });

  /* ------------------------------------------------------------- GitHub */
  const ghFetch = async (path, opts = {}) => {
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${gh.token}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    };
    let res;
    try {
      res = await fetch(API + path, { method: opts.method || "GET", body: opts.body, headers, cache: "no-store" });
    } catch (e) {
      const err = new Error("Keine Verbindung zu GitHub. Bist du online?");
      err.status = 0;
      throw err;
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).message || ""; } catch (e) { /* ignore */ }
      const msg =
        res.status === 401 ? "Token ungültig oder abgelaufen." :
        res.status === 403 ? "Keine Berechtigung. Der Token braucht „Contents: Read and write“ für das Repo." :
        res.status === 404 ? "Nicht gefunden (Repo-Name oder Token-Zugriff prüfen)." :
        `GitHub-Fehler ${res.status}${detail ? ": " + detail : ""}`;
      const err = new Error(msg);
      err.status = res.status;
      err.detail = detail;
      throw err;
    }
    return opts.raw ? res.text() : res.json();
  };

  const fetchRemoteTrip = async (ref) => {
    try {
      const txt = await ghFetch(`/repos/${gh.repo}/contents/${RT.DATA_PATH}?ref=${encodeURIComponent(ref)}`, {
        headers: { Accept: "application/vnd.github.raw+json" },
        raw: true,
      });
      return RT.normalize(JSON.parse(txt));
    } catch (e) {
      if (e.status === 404) return RT.emptyTrip();
      throw e;
    }
  };

  const toBase64 = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });

  const publish = async () => {
    if (busy || !gh || !dirty || !loaded) return;
    if (editing && editing.kind === "stop" && editing.isNew) {
      if (!confirm("Der neue Ort ist noch nicht hinzugefügt und wird nicht mit veröffentlicht. Trotzdem fortfahren?")) return;
    }
    busy = true;
    setStatus("busy", "Verbinde mit GitHub …");
    const blobShas = new Map();
    let overwriteOk = false;
    try {
      if (!branch) branch = (await ghFetch(`/repos/${gh.repo}`)).default_branch;
      for (let attempt = 0; attempt < 3; attempt++) {
        const head = (await ghFetch(`/repos/${gh.repo}/git/ref/heads/${branch}`)).object.sha;
        const remote = await fetchRemoteTrip(head);
        if ((remote.rev || 0) !== remoteRev && !overwriteOk) {
          if (!confirm("Die Route wurde inzwischen woanders geändert (z. B. auf einem anderen Gerät). Mit deinem Stand überschreiben?")) {
            throw new Error("Abgebrochen. Tipp: Seite neu laden, um den aktuellen Stand zu holen.");
          }
          overwriteOk = true;
        }
        const baseTree = (await ghFetch(`/repos/${gh.repo}/git/commits/${head}`)).tree.sha;

        const now = new Date().toISOString();
        trip.posts.forEach((p) => { if (!p.published) p.published = now; });
        const out = clean(trip);
        out.rev = (remote.rev || 0) + 1;
        out.updated = now;

        const used = mediaPaths(out);
        const uploads = [...pending.keys()].filter((k) => used.has(k));
        let n = 0;
        for (const key of uploads) {
          n++;
          if (blobShas.has(key)) continue;
          const blob = pending.get(key);
          setStatus("busy", `Lade hoch ${n}/${uploads.length} (${(blob.size / 1048576).toFixed(1)} MB) …`);
          const r = await ghFetch(`/repos/${gh.repo}/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: await toBase64(blob), encoding: "base64" }),
          });
          blobShas.set(key, r.sha);
        }
        setStatus("busy", "Speichere …");

        const removed = [...mediaPaths(remote)].filter((k) => !used.has(k));
        const entries = [
          { path: RT.DATA_PATH, mode: "100644", type: "blob", content: JSON.stringify(out, null, 2) + "\n" },
          ...uploads.map((k) => ({ path: "route/" + k, mode: "100644", type: "blob", sha: blobShas.get(k) })),
        ];
        const deletions = removed.map((k) => ({ path: "route/" + k, mode: "100644", type: "blob", sha: null }));
        let tree;
        try {
          tree = await ghFetch(`/repos/${gh.repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries.concat(deletions) }) });
        } catch (e) {
          if (!deletions.length) throw e;
          // A file to delete was already gone; save without deleting
          tree = await ghFetch(`/repos/${gh.repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries }) });
        }
        const parts = [];
        if (uploads.length) parts.push(`${uploads.length} Datei${uploads.length === 1 ? "" : "en"}`);
        if (removed.length) parts.push(`${removed.length} entfernt`);
        const commit = await ghFetch(`/repos/${gh.repo}/git/commits`, {
          method: "POST",
          body: JSON.stringify({ message: `Route aktualisiert${parts.length ? " (" + parts.join(", ") + ")" : ""}`, tree: tree.sha, parents: [head] }),
        });
        try {
          await ghFetch(`/repos/${gh.repo}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
        } catch (e) {
          if (e.status === 422 && attempt < 2) continue; // someone pushed meanwhile — rebuild on the new head
          throw e;
        }

        remoteRev = out.rev;
        trip.rev = out.rev;
        trip.updated = now;
        pending.clear();
        idb.clear();
        dirty = false;
        RT.store.del(DRAFT_KEY);
        busy = false;
        render();
        setStatus("ok", "Veröffentlicht ✓ In ca. 1 Minute online.");
        RT.toast("Veröffentlicht. GitHub Pages braucht ca. 1 Minute.", 4000);
        return;
      }
      throw new Error("Konnte nicht speichern, bitte nochmal versuchen.");
    } catch (e) {
      busy = false;
      setStatus("err", e.message || String(e));
    }
  };
  publishBtn.addEventListener("click", publish);

  /* -------------------------------------------------------------- Images */
  // <img> honours EXIF orientation everywhere; createImageBitmap is the fallback
  const decode = async (file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      return { src: img, done: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
    }
    if (window.createImageBitmap) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        return { src: bmp, done: () => bmp.close() };
      } catch (e) { /* unsupported */ }
    }
    throw new Error("Bildformat wird hier nicht unterstützt (HEIC?). Bitte als JPG exportieren.");
  };
  const toJpeg = (src, max, q) =>
    new Promise((res, rej) => {
      const w0 = src.videoWidth || src.naturalWidth || src.width;
      const h0 = src.videoHeight || src.naturalHeight || src.height;
      if (!w0 || !h0) return rej(new Error("Leeres Bild."));
      const k = Math.min(1, max / Math.max(w0, h0));
      const w = Math.round(w0 * k), h = Math.round(h0 * k);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, w, h);
      c.toBlob((b) => (b ? res({ blob: b, w, h, canvas: c }) : rej(new Error("Bild konnte nicht umgewandelt werden."))), "image/jpeg", q);
    });

  const addImage = async (post, file) => {
    const dec = await decode(file);
    let full;
    try { full = await toJpeg(dec.src, 2000, 0.82); } finally { dec.done(); }
    const thumb = await toJpeg(full.canvas, 720, 0.8);
    const base = `media/${post.id}/${rand()}`;
    const m = { type: "img", src: base + ".jpg", thumb: base + "-t.jpg", w: full.w, h: full.h };
    addPending(m.src, full.blob);
    addPending(m.thumb, thumb.blob);
    m._preview = URL.createObjectURL(full.blob);
    m._previewThumb = URL.createObjectURL(thumb.blob);
    post.media.push(m);
  };

  const videoPoster = (url) =>
    new Promise((res, rej) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      const t = setTimeout(() => rej(new Error("timeout")), 8000);
      v.addEventListener("loadeddata", () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); }, { once: true });
      v.addEventListener("seeked", () => { clearTimeout(t); toJpeg(v, 1280, 0.8).then(res, rej); }, { once: true });
      v.addEventListener("error", () => { clearTimeout(t); rej(new Error("video")); }, { once: true });
      v.src = url;
      v.load();
    });

  const addVideo = async (post, file) => {
    const mb = file.size / 1048576;
    if (mb > 95) throw new Error(`Das Video hat ${Math.round(mb)} MB, erlaubt sind max. 95 MB. Bitte kürzen oder als YouTube-Link einfügen.`);
    if (mb > 40 && !confirm(`Das Video hat ${Math.round(mb)} MB. Mit mobilen Daten dauert das Hochladen eine Weile. Trotzdem hinzufügen?`)) return;
    const ext = ((file.name.match(/\.(mp4|mov|m4v|webm)$/i) || [])[1] || (/webm/.test(file.type) ? "webm" : /quicktime/.test(file.type) ? "mov" : "mp4")).toLowerCase();
    const base = `media/${post.id}/${rand()}`;
    const m = { type: "video", src: `${base}.${ext}` };
    addPending(m.src, file);
    m._preview = URL.createObjectURL(file);
    try {
      const p = await videoPoster(m._preview);
      m.poster = `${base}-p.jpg`;
      m.w = p.w;
      m.h = p.h;
      addPending(m.poster, p.blob);
      m._previewPoster = URL.createObjectURL(p.blob);
    } catch (e) { /* no poster, the gallery falls back to the video itself */ }
    post.media.push(m);
    if (ext === "mov") RT.toast("Hinweis: .mov-Videos laufen nicht in jedem Browser. MP4 oder YouTube ist sicherer.", 6000);
  };

  const addFiles = async (post, files) => {
    for (const f of files) {
      setStatus("busy", `Verarbeite ${f.name} …`);
      try {
        if (/^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name)) await addVideo(post, f);
        else await addImage(post, f);
      } catch (e) {
        RT.toast(`${f.name}: ${e.message}`, 6000);
      }
      renderMedia(post);
      touch({ map: false });
    }
    idleStatus();
  };

  const thumbOf = (m) => {
    if (m.type === "yt") return `https://i.ytimg.com/vi/${m.id}/mqdefault.jpg`;
    if (m.type === "video") return m._previewPoster || m.poster || "";
    return m._previewThumb || m.thumb || m.src;
  };

  /* ---------------------------------------------------------- Geocoding */
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const placeName = (a, fallback) => a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.county || a.state || a.country || fallback || "";
  const geocode = async (q) => {
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&accept-language=de&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error("Suche fehlgeschlagen");
    return (await r.json()).map((x) => ({
      name: x.name || placeName(x.address || {}, x.display_name.split(",")[0]),
      country: (x.address && x.address.country) || "",
      cc: (x.address && x.address.country_code) || "",
      lat: +x.lat,
      lng: +x.lon,
      label: x.display_name,
    }));
  };
  const reverse = async (lat, lng) => {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=10&accept-language=de&lat=${lat}&lon=${lng}`);
    if (!r.ok) return null;
    const x = await r.json();
    if (!x || !x.address) return null;
    return { name: placeName(x.address, x.name), country: x.address.country || "", cc: x.address.country_code || "" };
  };

  /* ---------------------------------------------------------------- Map */
  const refreshMap = () => {
    if (layer) layer.set(RT.model(RT.normalize(clean(trip))));
  };
  const setPick = (stop) => {
    if (pick) { pick.remove(); pick = null; }
    $("[data-pick-hint]").hidden = !stop;
    if (!stop || !map) return;
    if (isFinite(stop.lat) && isFinite(stop.lng) && stop.lat !== null) {
      const el = document.createElement("div");
      el.className = "pickpin";
      pick = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([stop.lng, stop.lat]).addTo(map);
      pick.on("dragend", () => {
        const ll = pick.getLngLat().wrap();
        placeStop(stop, ll.lat, ll.lng, true);
      });
    }
  };
  const placeStop = async (stop, lat, lng, lookup) => {
    stop.lat = +lat.toFixed(5);
    stop.lng = +lng.toFixed(5);
    setPick(stop);
    paintCoords(stop);
    if (!editing.isNew) touch();
    if (lookup && (!stop.name || !stop.country)) {
      const r = await reverse(stop.lat, stop.lng).catch(() => null);
      if (r && editing && editing.obj === stop) {
        if (!stop.name) { stop.name = r.name; const i = $('[data-f="name"]', pane); if (i) i.value = r.name; }
        if (!stop.country) { stop.country = r.country; stop.cc = r.cc; const i = $('[data-f="country"]', pane); if (i) i.value = r.country; }
        if (!editing.isNew) touch();
      }
    }
  };
  const paintCoords = (stop) => {
    const el = $("[data-coords]", pane);
    if (!el) return;
    el.innerHTML = isFinite(stop.lat) && stop.lat !== null
      ? `Position: <b>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</b>`
      : "Noch keine Position: suche oben oder tippe auf die Karte.";
  };

  /* -------------------------------------------------------------- Views */
  const modeOptions = (sel) =>
    `<option value="">–</option>` +
    Object.entries(RT.MODES).map(([k, m]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(m.label)}</option>`).join("");
  const stopOptions = (sel, empty) =>
    `<option value="">${esc(empty)}</option>` +
    trip.stops.map((s, i) => `<option value="${esc(s.id)}" ${s.id === sel ? "selected" : ""}>${pad2(i + 1)} · ${esc(s.name)}</option>`).join("");

  const viewConnect = () => `
    <div class="pane">
      <h2 class="pane__t">Mit GitHub verbinden</h2>
      <p class="hint">Damit deine Änderungen für alle sichtbar werden, speichert diese Seite direkt in dein Website-Repo. Dafür brauchst du einmalig pro Gerät einen Zugangs-Token. Er bleibt nur in diesem Browser.</p>
      <ol class="steps">
        <li>Öffne <a class="hint" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token erstellen</a></li>
        <li>Name z. B. <code>Gapyear</code>, Ablauf: <b>nach Reiseende</b></li>
        <li>Repository access: <b>Only select repositories</b> → <code>${esc(RT.REPO)}</code></li>
        <li>Permissions → Repository → <b>Contents: Read and write</b></li>
        <li>„Generate token“ und den Token hier einfügen</li>
      </ol>
      <label class="field"><span>Token</span><input class="inp" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" data-token></label>
      <label class="field"><span>Repository</span><input class="inp" type="text" autocomplete="off" spellcheck="false" value="${esc(RT.REPO)}" data-repo></label>
      <div class="actions"><button class="btn btn--accent" type="button" data-act="connect">Verbinden</button></div>
    </div>`;

  const stopSub = (s) => [s.country, RT.fmtRange(s.from, s.to), RT.MODES[s.by] ? RT.MODES[s.by].label : ""].filter(Boolean).join(" · ");

  const viewStops = () => `
    <div class="pane">
      <p class="hint">Die Reihenfolge ist die Route. „Anreise“ gilt jeweils vom Ort davor. Wo du gerade bist, stellst du unter <b>Standort</b> ein.</p>
      ${trip.stops.length ? `<ol class="alist">${trip.stops.map((s, i) => `
        <li class="arow ${s.id === trip.current ? "is-now" : ""}">
          <span class="arow__n">${pad2(i + 1)}</span>
          <button class="arow__main" type="button" data-edit-stop="${esc(s.id)}"><b>${esc(s.name || "Ohne Namen")}</b><small>${esc(stopSub(s)) || "&nbsp;"}</small></button>
          <span class="arow__tools">
            <button type="button" data-move-stop="${esc(s.id)}" data-dir="-1" aria-label="Nach oben" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" data-move-stop="${esc(s.id)}" data-dir="1" aria-label="Nach unten" ${i === trip.stops.length - 1 ? "disabled" : ""}>↓</button>
          </span>
        </li>`).join("")}</ol>` : `<p class="hint">Noch keine Orte. Leg los mit dem ersten, z. B. deinem Startort.</p>`}
      <div class="actions"><button class="btn btn--accent" type="button" data-act="new-stop">+ Ort hinzufügen</button></div>
    </div>`;

  const viewStop = () => {
    const s = editing.obj;
    const idx = trip.stops.indexOf(s);
    return `
    <div class="pane">
      <button class="back" type="button" data-act="close">Alle Orte</button>
      <h2 class="pane__t">${editing.isNew ? "Neuer Ort" : "Ort bearbeiten"}</h2>
      <div class="field">
        <span>Ort suchen</span>
        <div class="inrow"><input class="inp" type="search" placeholder="z. B. Chiang Mai" data-q enterkeyhint="search"><button class="btn" type="button" data-act="search">Suchen</button></div>
        <div class="results" data-results></div>
        <small>… oder auf die Karte tippen. Den roten Marker kannst du verschieben.</small>
      </div>
      <p class="coords" data-coords></p>
      <label class="field"><span>Name</span><input class="inp" type="text" data-f="name" value="${esc(s.name)}"></label>
      <label class="field"><span>Land</span><input class="inp" type="text" data-f="country" value="${esc(s.country)}"></label>
      <div class="field2">
        <label class="field"><span>Ankunft</span><input class="inp" type="date" data-f="from" value="${esc(s.from)}"></label>
        <label class="field"><span>Abreise</span><input class="inp" type="date" data-f="to" value="${esc(s.to)}"></label>
      </div>
      <label class="field"><span>Anreise mit</span><select class="inp" data-f="by">${modeOptions(s.by)}</select>${idx === 0 ? "<small>Beim ersten Ort (Start) wird das nicht angezeigt.</small>" : ""}</label>
      <label class="field"><span>Notiz (optional)</span><textarea class="inp" rows="3" data-f="note" placeholder="Kurz, was du hier machst oder vorhast">${esc(s.note)}</textarea></label>
      <div class="actions">
        <button class="btn btn--accent" type="button" data-act="${editing.isNew ? "add-stop" : "close"}">${editing.isNew ? "Ort hinzufügen" : "Fertig"}</button>
        ${editing.isNew ? `<button class="btn btn--ghost" type="button" data-act="close">Abbrechen</button>` : `<button class="btn btn--danger" type="button" data-act="del-stop">Ort löschen</button>`}
      </div>
    </div>`;
  };

  const viewPosts = () => {
    const posts = trip.posts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return `
    <div class="pane">
      <div class="actions"><button class="btn btn--accent" type="button" data-act="new-post">+ Neuer Beitrag</button></div>
      ${posts.length ? `<ol class="alist">${posts.map((p) => {
        const s = trip.stops.find((x) => x.id === p.stop);
        const first = p.media.find((m) => thumbOf(m));
        return `<li class="arow arow--post">
          <span class="arow__img">${first ? `<img src="${esc(thumbOf(first))}" alt="" loading="lazy">` : RT.ICON.text}</span>
          <button class="arow__main" type="button" data-edit-post="${esc(p.id)}"><b>${esc(p.title || "Ohne Titel")}</b><small>${esc([RT.fmtDate(p.date), s && s.name, p.media.length ? p.media.length + " Medien" : "", p.published ? "" : "neu"].filter(Boolean).join(" · "))}</small></button>
        </li>`;
      }).join("")}</ol>` : `<p class="hint">Noch keine Beiträge.${trip.stops.length ? "" : " Tipp: Lege zuerst einen Ort an, dann kannst du Beiträge zuordnen."}</p>`}
    </div>`;
  };

  const viewPost = () => {
    const p = editing.obj;
    return `
    <div class="pane">
      <button class="back" type="button" data-act="close">Alle Beiträge</button>
      <h2 class="pane__t">Beitrag</h2>
      <label class="field"><span>Titel</span><input class="inp" type="text" data-f="title" value="${esc(p.title)}" placeholder="z. B. Erster Tag in Bangkok"></label>
      <div class="field2">
        <label class="field"><span>Datum</span><input class="inp" type="date" data-f="date" value="${esc(p.date)}"></label>
        <label class="field"><span>Ort</span><select class="inp" data-f="stop">${stopOptions(p.stop, "– kein Ort –")}</select></label>
      </div>
      <label class="field"><span>Text</span><textarea class="inp inp--area" data-f="text" placeholder="Was ist passiert?">${esc(p.text)}</textarea>
        <small>Leerzeile = neuer Absatz · **fett** · *kursiv* · [Linktext](https://…)</small></label>
      <div class="field">
        <span>Fotos &amp; Videos</span>
        <div class="mgrid" data-mgrid></div>
        <div class="actions">
          <label class="btn filebtn">+ Fotos / Videos<input type="file" accept="image/*,video/*" multiple data-files></label>
        </div>
        <small>Fotos werden automatisch verkleinert (max. 2000 px). Videos bis 95 MB, längere besser als YouTube-Link (gern „nicht gelistet“).</small>
        <div class="inrow"><input class="inp" type="url" placeholder="YouTube-Link einfügen" data-yt><button class="btn" type="button" data-act="add-yt">Hinzufügen</button></div>
      </div>
      <div class="actions">
        <button class="btn btn--accent" type="button" data-act="close">Fertig</button>
        <button class="btn btn--danger" type="button" data-act="del-post">Beitrag löschen</button>
      </div>
      <p class="hint">Änderungen sind erst nach „Veröffentlichen“ (oben rechts) für alle sichtbar.</p>
    </div>`;
  };

  const renderMedia = (post) => {
    const grid = $("[data-mgrid]", pane);
    if (!grid || !editing || editing.obj !== post) return;
    grid.innerHTML = post.media
      .map((m, i) => {
        const t = thumbOf(m);
        const preview = t
          ? `<img src="${esc(t)}" alt="">`
          : m.type === "video" ? `<video src="${esc(RT.mediaSrc(m))}#t=0.1" muted playsinline preload="metadata"></video>` : "";
        const type = m.type === "yt" ? "YouTube" : m.type === "video" ? "Video" : "";
        return `<div class="mitem ${pending.has(m.src) ? "is-new" : ""}">
          <div class="mitem__img">${preview}${type ? `<span class="mitem__type">${type}</span>` : ""}
            <div class="mitem__bar">
              <button type="button" data-mmove="${i}" data-dir="-1" aria-label="Nach vorne" ${i === 0 ? "disabled" : ""}>←</button>
              <button type="button" data-mmove="${i}" data-dir="1" aria-label="Nach hinten" ${i === post.media.length - 1 ? "disabled" : ""}>→</button>
              <button type="button" data-mdel="${i}" aria-label="Entfernen">✕</button>
            </div>
          </div>
          <input class="inp inp--sm" type="text" placeholder="Bildunterschrift" value="${esc(m.caption)}" data-cap="${i}">
        </div>`;
      })
      .join("");
  };

  const viewHere = () => {
    const ci = trip.stops.findIndex((s) => s.id === trip.current);
    const h = trip.here;
    return `
    <div class="pane">
      <label class="field"><span>Wo bist du gerade?</span>
        <select class="inp" data-current>${stopOptions(trip.current, "Noch nicht losgefahren")}</select>
        <small>Alles bis hier gilt als gereist (rote Linie), alles danach als geplant (gestrichelt).</small>
      </label>
      <div class="actions">
        <button class="btn" type="button" data-act="cur-prev" ${ci < 0 ? "disabled" : ""}>← Zurück</button>
        <button class="btn btn--accent" type="button" data-act="cur-next" ${ci >= trip.stops.length - 1 ? "disabled" : ""}>${ci < 0 ? "Reise starten →" : "Weiter zum nächsten Ort →"}</button>
      </div>
      <hr>
      <div class="field">
        <span>Live-Position (optional)</span>
        <p class="hint">Zeigt einen pulsierenden Punkt an deinem echten Standort, praktisch, wenn du gerade zwischen zwei Orten unterwegs bist. Die Position wird auf ca. 1 km gerundet.</p>
        <p class="coords">${h ? `Gesetzt: <b>${(+h.lat).toFixed(2)}, ${(+h.lng).toFixed(2)}</b>${h.at ? " · " + esc(new Date(h.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })) : ""}` : "Nicht gesetzt: es wird der aktuelle Ort angezeigt."}</p>
        ${h ? `<label class="field"><span>Beschriftung</span><input class="inp" type="text" data-here-label value="${esc(h.label)}" placeholder="z. B. Im Nachtzug nach Hanoi"></label>` : ""}
        <div class="actions">
          <button class="btn" type="button" data-act="gps">${h ? "GPS-Position aktualisieren" : "GPS-Position setzen"}</button>
          ${h ? `<button class="btn btn--ghost" type="button" data-act="here-clear">Entfernen</button>` : ""}
        </div>
      </div>
    </div>`;
  };

  const viewGeneral = () => `
    <div class="pane">
      <label class="field"><span>Titel</span><input class="inp" type="text" data-g="title" value="${esc(trip.title)}" placeholder="Gapyear"></label>
      <label class="field"><span>Untertitel (optional)</span><input class="inp" type="text" data-g="subtitle" value="${esc(trip.subtitle)}" placeholder="z. B. 2026 / 27"></label>
      <label class="field"><span>Reisestart (optional)</span><input class="inp" type="date" data-g="start" value="${esc(trip.start)}"><small>Für den Tage-Zähler. Leer = Ankunftsdatum des ersten Orts.</small></label>
      <hr>
      <div class="field"><span>Verbindung</span>
        <p class="hint">Verbunden mit <code>${esc(gh.repo)}</code>${branch ? ` (Branch <code>${esc(branch)}</code>)` : ""}. Der Token ist nur in diesem Browser gespeichert.</p>
        <div class="actions">
          <button class="btn" type="button" data-act="backup">Backup herunterladen</button>
          ${dirty ? `<button class="btn btn--ghost" type="button" data-act="discard">Änderungen verwerfen</button>` : ""}
          <button class="btn btn--danger" type="button" data-act="disconnect">Trennen</button>
        </div>
      </div>
    </div>`;

  const viewLoadError = () => `
    <div class="pane">
      <h2 class="pane__t">Konnte nicht laden</h2>
      <p class="hint">Die Route konnte nicht von GitHub geladen werden (Fehler steht oben). Prüfe deine Verbindung und lade die Seite neu. Ist der Token abgelaufen, trenne die Verbindung und verbinde dich mit einem neuen Token.</p>
      <div class="actions">
        <button class="btn btn--accent" type="button" data-act="reload">Neu laden</button>
        <button class="btn btn--danger" type="button" data-act="disconnect">Trennen</button>
      </div>
    </div>`;

  const render = () => {
    $("[data-tabs]").hidden = !gh;
    $$("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    let html;
    if (!gh) html = viewConnect();
    else if (!loaded) html = loadError ? viewLoadError() : `<div class="pane"><p class="hint">Lade Route …</p></div>`;
    else if (editing && editing.kind === "stop") html = viewStop();
    else if (editing && editing.kind === "post") html = viewPost();
    else if (tab === "posts") html = viewPosts();
    else if (tab === "here") html = viewHere();
    else if (tab === "general") html = viewGeneral();
    else html = viewStops();
    pane.innerHTML = html;
    if (editing && editing.kind === "stop") paintCoords(editing.obj);
    if (editing && editing.kind === "post") renderMedia(editing.obj);
    setPick(editing && editing.kind === "stop" ? editing.obj : null);
    if (layer) layer.setActive(editing && editing.kind === "stop" ? editing.obj.id : null);
    idleStatus();
  };

  const openStop = (stop, isNew) => {
    editing = { kind: "stop", obj: stop, isNew };
    tab = "orte";
    render();
    pane.parentElement.scrollTop = 0;
    if (!isNew && map && isFinite(stop.lat)) map.flyTo({ center: [stop.lng, stop.lat], zoom: Math.max(map.getZoom(), 5), duration: 1000 });
  };
  const openPost = (post, isNew) => {
    editing = { kind: "post", obj: post, isNew };
    tab = "posts";
    render();
    pane.parentElement.scrollTop = 0;
  };
  const closeEditor = () => {
    if (editing && editing.kind === "post") {
      const p = editing.obj;
      if (!p.title && !p.text && !p.media.length) trip.posts = trip.posts.filter((x) => x !== p);
    }
    editing = null;
    render();
    refreshMap();
  };

  /* ------------------------------------------------------------- Events */
  $$("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      if (editing) closeEditor();
      tab = b.dataset.tab;
      render();
    })
  );

  pane.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.f && editing) {
      editing.obj[el.dataset.f] = el.value;
      if (el.dataset.f === "country") editing.obj.cc = "";
      if (!(editing.kind === "stop" && editing.isNew)) touch({ map: editing.kind === "stop" });
    } else if (el.dataset.g) {
      trip[el.dataset.g] = el.value;
      touch({ map: false });
    } else if (el.hasAttribute("data-cap") && editing) {
      editing.obj.media[+el.dataset.cap].caption = el.value;
      touch({ map: false });
    } else if (el.hasAttribute("data-here-label") && trip.here) {
      trip.here.label = el.value;
      touch({ map: false });
    }
  });

  pane.addEventListener("change", (e) => {
    const el = e.target;
    if (el.hasAttribute("data-current")) {
      trip.current = el.value || null;
      touch();
      render();
    } else if (el.hasAttribute("data-files") && editing) {
      const files = [...el.files];
      el.value = "";
      addFiles(editing.obj, files);
    }
  });

  pane.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.hasAttribute("data-q")) { e.preventDefault(); runSearch(); }
    if (e.key === "Enter" && e.target.hasAttribute("data-yt")) { e.preventDefault(); addYt(); }
  });

  const runSearch = async () => {
    const q = $("[data-q]", pane).value.trim();
    const box = $("[data-results]", pane);
    if (!q) return;
    box.innerHTML = `<p class="hint">Suche …</p>`;
    try {
      const list = await geocode(q);
      lastResults = list;
      box.innerHTML = list.length
        ? list.map((r, i) => `<button type="button" data-result="${i}"><b>${esc(r.name)}${r.country ? ", " + esc(r.country) : ""}</b><small>${esc(r.label)}</small></button>`).join("")
        : `<p class="hint">Nichts gefunden. Versuch es anders oder tippe auf die Karte.</p>`;
    } catch (err) {
      box.innerHTML = `<p class="hint">Suche gerade nicht möglich. Tippe stattdessen auf die Karte.</p>`;
    }
  };
  let lastResults = [];

  const addYt = () => {
    const input = $("[data-yt]", pane);
    const id = RT.ytId(input.value.trim());
    if (!id) { RT.toast("Das sieht nicht nach einem YouTube-Link aus."); return; }
    editing.obj.media.push({ type: "yt", id });
    input.value = "";
    renderMedia(editing.obj);
    touch({ map: false });
  };

  const removeMedia = (post, i) => {
    const m = post.media[i];
    [m.src, m.thumb, m.poster].forEach(dropPending);
    post.media.splice(i, 1);
  };

  pane.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const act = t.dataset.act;

    if (t.hasAttribute("data-edit-stop")) return openStop(trip.stops.find((s) => s.id === t.dataset.editStop), false);
    if (t.hasAttribute("data-edit-post")) return openPost(trip.posts.find((p) => p.id === t.dataset.editPost), false);
    if (t.hasAttribute("data-move-stop")) {
      const i = trip.stops.findIndex((s) => s.id === t.dataset.moveStop);
      const j = i + +t.dataset.dir;
      if (j < 0 || j >= trip.stops.length) return;
      [trip.stops[i], trip.stops[j]] = [trip.stops[j], trip.stops[i]];
      touch();
      render();
      return;
    }
    if (t.hasAttribute("data-result")) {
      const r = lastResults[+t.dataset.result];
      if (!r) return;
      const s = editing.obj;
      s.name = r.name;
      s.country = r.country;
      s.cc = r.cc;
      $('[data-f="name"]', pane).value = s.name;
      $('[data-f="country"]', pane).value = s.country;
      $("[data-results]", pane).innerHTML = "";
      await placeStop(s, r.lat, r.lng, false);
      if (map) map.flyTo({ center: [r.lng, r.lat], zoom: 6, duration: 1200 });
      return;
    }
    if (t.hasAttribute("data-mmove")) {
      const p = editing.obj, i = +t.dataset.mmove, j = i + +t.dataset.dir;
      [p.media[i], p.media[j]] = [p.media[j], p.media[i]];
      renderMedia(p);
      touch({ map: false });
      return;
    }
    if (t.hasAttribute("data-mdel")) {
      removeMedia(editing.obj, +t.dataset.mdel);
      renderMedia(editing.obj);
      touch({ map: false });
      return;
    }

    switch (act) {
      case "connect": return connect();
      case "close": return closeEditor();
      case "search": return runSearch();
      case "add-yt": return addYt();
      case "new-stop": {
        const last = trip.stops[trip.stops.length - 1];
        openStop({ id: RT.uid("s"), name: "", country: "", cc: "", lat: null, lng: null, from: last && last.to ? last.to : "", to: "", by: trip.stops.length ? "plane" : "", note: "" }, true);
        setTimeout(() => { const q = $("[data-q]", pane); if (q && !mobile.matches) q.focus(); }, 50);
        return;
      }
      case "add-stop": {
        const s = editing.obj;
        if (!s.name || !isFinite(s.lat) || s.lat === null) { RT.toast("Bitte Ort suchen oder auf die Karte tippen, und einen Namen eingeben."); return; }
        trip.stops.push(s);
        editing = null;
        touch();
        render();
        return;
      }
      case "del-stop": {
        const s = editing.obj;
        const n = trip.posts.filter((p) => p.stop === s.id).length;
        if (!confirm(n ? `„${s.name}“ löschen? ${n} Beitrag/Beiträge bleiben erhalten, aber ohne Ort.` : `„${s.name}“ löschen?`)) return;
        trip.stops = trip.stops.filter((x) => x !== s);
        trip.posts.forEach((p) => { if (p.stop === s.id) p.stop = ""; });
        if (trip.current === s.id) trip.current = null;
        editing = null;
        touch();
        render();
        return;
      }
      case "new-post": {
        const cur = trip.stops.find((s) => s.id === trip.current) || trip.stops[trip.stops.length - 1];
        const p = { id: RT.uid("p"), stop: cur ? cur.id : "", date: RT.today(), title: "", text: "", media: [] };
        trip.posts.push(p);
        openPost(p, true);
        setTimeout(() => { const i = $('[data-f="title"]', pane); if (i && !mobile.matches) i.focus(); }, 50);
        return;
      }
      case "del-post": {
        const p = editing.obj;
        if (!confirm(`Beitrag „${p.title || "Ohne Titel"}“ mit allen Fotos löschen?`)) return;
        while (p.media.length) removeMedia(p, 0);
        trip.posts = trip.posts.filter((x) => x !== p);
        editing = null;
        touch({ map: false });
        render();
        refreshMap();
        return;
      }
      case "cur-prev":
      case "cur-next": {
        const i = trip.stops.findIndex((s) => s.id === trip.current);
        const j = act === "cur-next" ? i + 1 : i - 1;
        trip.current = j >= 0 && j < trip.stops.length ? trip.stops[j].id : null;
        if (act === "cur-next" && trip.here) {
          if (confirm("Live-Position entfernen? Sonst zeigt die Karte weiter den GPS-Punkt statt des neuen Orts.")) trip.here = null;
        }
        touch();
        render();
        return;
      }
      case "gps": {
        if (!navigator.geolocation) { RT.toast("GPS ist in diesem Browser nicht verfügbar."); return; }
        setStatus("busy", "Bestimme Position …");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            trip.here = {
              lat: +pos.coords.latitude.toFixed(2),
              lng: +pos.coords.longitude.toFixed(2),
              label: (trip.here && trip.here.label) || "",
              at: new Date().toISOString(),
            };
            touch();
            render();
            if (map) map.flyTo({ center: [trip.here.lng, trip.here.lat], zoom: 6, duration: 1200 });
          },
          (err) => { idleStatus(); RT.toast(err.code === 1 ? "Standortzugriff wurde verweigert." : "Position konnte nicht bestimmt werden."); },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
        return;
      }
      case "reload":
        location.reload();
        return;
      case "here-clear":
        trip.here = null;
        touch();
        render();
        return;
      case "backup": {
        const blob = new Blob([JSON.stringify(clean(trip), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `gapyear-backup-${RT.today()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      case "discard":
        if (!confirm("Alle unveröffentlichten Änderungen verwerfen?")) return;
        dirty = false;
        RT.store.del(DRAFT_KEY);
        pending.clear();
        idb.clear();
        location.reload();
        return;
      case "disconnect":
        if (dirty && !confirm("Es gibt unveröffentlichte Änderungen. Trotzdem trennen?")) return;
        RT.store.del(GH_KEY);
        dirty = false;
        location.reload();
        return;
    }
  });

  /* ------------------------------------------------------------ Connect */
  const connect = async () => {
    const token = $("[data-token]", pane).value.trim();
    const repo = $("[data-repo]", pane).value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    if (!token) { RT.toast("Bitte Token einfügen."); return; }
    gh = { token, repo };
    setStatus("busy", "Prüfe Token …");
    try {
      const info = await ghFetch(`/repos/${repo}`);
      if (info.permissions && !info.permissions.push) throw new Error("Der Token hat nur Leserechte. Bitte „Contents: Read and write“ wählen.");
      branch = info.default_branch;
      RT.store.set(GH_KEY, JSON.stringify(gh));
    } catch (e) {
      gh = null;
      setStatus("err", e.message);
      return;
    }
    try {
      await loadTrip();
      RT.toast("Verbunden ✓");
    } catch (e) {
      loadError = true;
      render();
      setStatus("err", e.message);
    }
  };

  /* ---------------------------------------------------------------- Load */
  const restorePreviews = async (t) => {
    for (const p of t.posts) {
      for (const m of p.media) {
        for (const [key, prop] of [["src", "_preview"], ["thumb", "_previewThumb"], ["poster", "_previewPoster"]]) {
          if (!m[key]) continue;
          const blob = await idb.get(m[key]);
          if (blob) {
            pending.set(m[key], blob);
            m[prop] = URL.createObjectURL(blob);
          }
        }
      }
    }
  };

  // The live site must be served from the branch we write to; warn if it isn't
  const checkSite = async (remote) => {
    if (!remote.updated || Date.now() - Date.parse(remote.updated) < 15 * 60000) return;
    try {
      const res = await fetch(`${RT.DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      const site = res.ok ? RT.normalize(await res.json()) : null;
      if (site && (site.rev || 0) === (remote.rev || 0)) return;
    } catch (e) { /* offline: no warning */ }
    const box = document.createElement("p");
    box.className = "hint warn";
    box.innerHTML = `Achtung: Die Website zeigt einen anderen Stand als der Branch <code>${esc(branch)}</code>, in den hier gespeichert wird. Wahrscheinlich läuft GitHub Pages noch von einem anderen Branch (Repo → Settings → Pages → Branch: <code>${esc(branch)}</code>).`;
    $(".adm__side").prepend(box);
  };

  const loadTrip = async () => {
    setStatus("busy", "Lade Route …");
    const remote = await fetchRemoteTrip(branch);
    remoteRev = remote.rev || 0;
    trip = remote;
    dirty = false;

    let draft = null;
    try { draft = JSON.parse(RT.store.get(DRAFT_KEY) || "null"); } catch (e) { draft = null; }
    if (draft && draft.trip) {
      const differs = JSON.stringify(clean(RT.normalize(draft.trip))) !== JSON.stringify(clean(remote));
      const fresh = draft.baseRev === remoteRev;
      if (differs && (fresh || confirm("Es gibt einen unveröffentlichten Entwurf, aber die Route wurde inzwischen woanders geändert. Entwurf trotzdem wiederherstellen? (Abbrechen = aktuellen Stand laden)"))) {
        trip = RT.normalize(draft.trip);
        await restorePreviews(trip);
        dirty = true;
        RT.toast("Unveröffentlichte Änderungen wiederhergestellt.", 3500);
      } else {
        RT.store.del(DRAFT_KEY);
        idb.clear();
      }
    }
    loaded = true;
    checkSite(remote);
    render();
    refreshMap();
    if (layer && trip.stops.length) RT.onLoad(map, () => layer.fit({ top: 40, bottom: 40, left: 40, right: 40 }));
  };

  /* ---------------------------------------------------------------- Boot */
  const start = async () => {
    map = RT.createMap("map", { controls: !mobile.matches, center: [60, 25], zoom: 1.2 });
    layer = new RT.RouteLayer(map, {
      onStop: (id) => {
        if (editing && editing.kind === "stop" && editing.isNew) return; // clicks place the new stop instead
        const s = trip.stops.find((x) => x.id === id);
        if (s) openStop(s, false);
      },
    });
    map.on("click", (e) => {
      if (!editing || editing.kind !== "stop") return;
      const ll = e.lngLat.wrap();
      placeStop(editing.obj, ll.lat, ll.lng, true);
    });

    render();
    if (!gh) return;
    try {
      if (!branch) branch = (await ghFetch(`/repos/${gh.repo}`)).default_branch;
      await loadTrip();
    } catch (e) {
      loadError = true;
      render();
      setStatus("err", e.message + (e.status === 401 ? " Unter „Allgemein“ trennen und neu verbinden." : ""));
    }
  };

  RT.gate(start);
})();

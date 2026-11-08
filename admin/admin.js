/* ==========================================================================
   Admin — photos, series, film, info, gap year
   Saves straight into the GitHub repo: one commit per "Veröffentlichen"
   with data/site.json and every new file. Uses the same token as the route
   admin (fine-grained, "Contents: Read and write", only stored in this
   browser). Unpublished changes, including picked files, survive a reload.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const API = "https://api.github.com";
  const GH_KEY = "lk-route-gh";
  const DRAFT_KEY = "lk-admin-draft";
  const DATA_PATH = "data/site.json";
  const DEFAULT_REPO = "louishaha/louishaha.github.io";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* full */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const main = $("[data-main]");
  const statusEl = $("[data-status]");
  const publishBtn = $("[data-publish]");
  const tabsEl = $("[data-tabs]");
  const sheet = $("[data-sheet]");
  const sheetBox = $("[data-sheet-box]");

  let gh = null;
  try { gh = JSON.parse(store.get(GH_KEY) || "null"); } catch (e) { gh = null; }
  let branch = null;
  let site = null;          // what we edit
  let baseRev = 0;          // rev of the published file our edits are based on
  let dirty = false, busy = false, loaded = false;
  let tab = "photos";
  let filter = "all";
  const pending = new Map(); // repo path -> Blob, not uploaded yet
  const previews = new Map(); // repo path -> object URL

  /* -------------------------------------------------------------- helpers */
  const slugify = (s) => String(s || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "x";
  const uniqueId = (base, taken) => {
    let id = base, n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    return id;
  };
  const rand = () => Math.random().toString(36).slice(2, 7);
  // text that may exist in three languages; one language only = plain string
  const L = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { de: v.de || "", en: v.en || "", zh: v.zh || "" } : { de: v || "", en: "", zh: "" });
  const packL = (o) => (o.en || o.zh ? { de: o.de, en: o.en, zh: o.zh } : o.de);
  const show = (v) => L(v).de || L(v).en || L(v).zh;
  const src = (p) => (!p ? "" : previews.get(p) || (/^(https?:|blob:|\/)/.test(p) ? p : "/" + p));
  const clean = (o) => JSON.parse(JSON.stringify(o));

  let toastT;
  const toast = (msg, ms = 2600) => {
    const t = $("[data-toast]");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, ms);
  };
  const setStatus = (kind, text) => {
    statusEl.dataset.kind = kind;
    statusEl.textContent = text;
    publishBtn.disabled = !(dirty && !busy && gh && loaded);
  };
  const idle = () => {
    if (!gh) setStatus("", "Nicht verbunden");
    else if (!loaded) setStatus("", "Lade …");
    else if (dirty) setStatus("dirty", "Nicht veröffentlicht");
    else setStatus("ok", "Alles veröffentlicht");
  };

  /* ------------------------------------------------- pending files (IndexedDB) */
  const idb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("lk-admin", 1);
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
      } catch (e) { return undefined; }
    };
    return {
      put: (k, v) => run("readwrite", (s) => s.put(v, k)),
      get: (k) => run("readonly", (s) => s.get(k)),
      keys: () => run("readonly", (s) => s.getAllKeys()),
      clear: () => run("readwrite", (s) => s.clear()),
    };
  })();
  const addFile = (path, blob) => {
    pending.set(path, blob);
    previews.set(path, URL.createObjectURL(blob));
    idb.put(path, blob);
  };
  // repo files the data points at (only our own folders)
  const filesOf = (d) => {
    const out = new Set();
    const add = (p) => { if (p && /^(images|media)\//.test(p)) out.add(p); };
    (d.photos || []).forEach((p) => { add(p.src); add(p.thumb); });
    (d.films || []).forEach((f) => { if (f.kind !== "youtube") add(f.src); add(f.poster); });
    return out;
  };

  /* ---------------------------------------------------------------- draft */
  let draftT;
  const saveDraft = () => { if (dirty && site) store.set(DRAFT_KEY, JSON.stringify({ baseRev, site })); };
  const touch = (rerender = false) => {
    dirty = true;
    idle();
    clearTimeout(draftT);
    draftT = setTimeout(saveDraft, 300);
    if (rerender) render();
  };
  addEventListener("beforeunload", (e) => { saveDraft(); if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  addEventListener("pagehide", saveDraft);

  /* --------------------------------------------------------------- GitHub */
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
      throw err;
    }
    return opts.raw ? res.text() : res.json();
  };
  const fetchRemote = async (ref) => {
    const txt = await ghFetch(`/repos/${gh.repo}/contents/${DATA_PATH}?ref=${encodeURIComponent(ref)}`, {
      headers: { Accept: "application/vnd.github.raw+json" }, raw: true,
    });
    return normalize(JSON.parse(txt));
  };
  const toBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  function normalize(d) {
    d = d || {};
    d.photos = d.photos || [];
    d.series = d.series || [];
    d.films = d.films || [];
    d.facts = d.facts || [];
    d.links = d.links || [];
    d.name = d.name || ["Louis", "Koller"];
    d.rev = d.rev || 0;
    return d;
  }

  async function publish() {
    if (busy || !gh || !dirty || !loaded) return;
    busy = true;
    setStatus("busy", "Verbinde mit GitHub …");
    const shas = new Map();
    let overwriteOk = false;
    try {
      if (!branch) branch = (await ghFetch(`/repos/${gh.repo}`)).default_branch;
      for (let attempt = 0; attempt < 3; attempt++) {
        const head = (await ghFetch(`/repos/${gh.repo}/git/ref/heads/${branch}`)).object.sha;
        const remote = await fetchRemote(head);
        if ((remote.rev || 0) !== baseRev && !overwriteOk) {
          if (!confirm("Die Seite wurde inzwischen woanders geändert (z. B. auf einem anderen Gerät). Mit deinem Stand überschreiben?")) {
            throw new Error("Abgebrochen. Tipp: Seite neu laden, um den aktuellen Stand zu holen.");
          }
          overwriteOk = true;
        }
        const baseTree = (await ghFetch(`/repos/${gh.repo}/git/commits/${head}`)).tree.sha;
        const now = new Date().toISOString();
        const out = clean(site);
        out.rev = (remote.rev || 0) + 1;
        out.updated = now;

        const used = filesOf(out);
        const uploads = [...pending.keys()].filter((k) => used.has(k));
        let n = 0;
        for (const key of uploads) {
          n++;
          if (shas.has(key)) continue;
          const blob = pending.get(key);
          setStatus("busy", `Lade hoch ${n}/${uploads.length} (${(blob.size / 1048576).toFixed(1)} MB) …`);
          const r = await ghFetch(`/repos/${gh.repo}/git/blobs`, { method: "POST", body: JSON.stringify({ content: await toBase64(blob), encoding: "base64" }) });
          shas.set(key, r.sha);
        }
        setStatus("busy", "Speichere …");
        const removed = [...filesOf(remote)].filter((k) => !used.has(k));
        const entries = [
          { path: DATA_PATH, mode: "100644", type: "blob", content: JSON.stringify(out, null, 2) + "\n" },
          ...uploads.map((k) => ({ path: k, mode: "100644", type: "blob", sha: shas.get(k) })),
        ];
        const deletions = removed.map((k) => ({ path: k, mode: "100644", type: "blob", sha: null }));
        let tree;
        try {
          tree = await ghFetch(`/repos/${gh.repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries.concat(deletions) }) });
        } catch (e) {
          if (!deletions.length) throw e;
          tree = await ghFetch(`/repos/${gh.repo}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree: entries }) });
        }
        const parts = [];
        if (uploads.length) parts.push(`${uploads.length} Datei${uploads.length === 1 ? "" : "en"}`);
        if (removed.length) parts.push(`${removed.length} entfernt`);
        const commit = await ghFetch(`/repos/${gh.repo}/git/commits`, {
          method: "POST",
          body: JSON.stringify({ message: `Seite aktualisiert${parts.length ? " (" + parts.join(", ") + ")" : ""}`, tree: tree.sha, parents: [head] }),
        });
        try {
          await ghFetch(`/repos/${gh.repo}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
        } catch (e) {
          if (e.status === 422 && attempt < 2) continue; // someone pushed meanwhile
          throw e;
        }
        baseRev = out.rev;
        site.rev = out.rev;
        pending.clear();
        idb.clear();
        dirty = false;
        store.del(DRAFT_KEY);
        busy = false;
        setStatus("ok", "Veröffentlicht ✓ In ca. 1 Minute online.");
        toast("Veröffentlicht. Vercel braucht ca. 1 Minute.", 4000);
        return;
      }
      throw new Error("Konnte nicht speichern, bitte nochmal versuchen.");
    } catch (e) {
      busy = false;
      setStatus("err", e.message || String(e));
    }
  }
  publishBtn.addEventListener("click", publish);

  /* ---------------------------------------------------------------- media */
  const decode = async (file) => {
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.src = u;
    try { await img.decode(); return { src: img, done: () => URL.revokeObjectURL(u) }; } catch (e) { URL.revokeObjectURL(u); }
    if (window.createImageBitmap) {
      try { const b = await createImageBitmap(file, { imageOrientation: "from-image" }); return { src: b, done: () => b.close() }; } catch (e) { /* no */ }
    }
    throw new Error(`${file.name}: Format wird hier nicht unterstützt (HEIC?). Bitte als JPG exportieren.`);
  };
  const toJpeg = (source, max, q) => new Promise((res, rej) => {
    const w0 = source.videoWidth || source.naturalWidth || source.width;
    const h0 = source.videoHeight || source.naturalHeight || source.height;
    if (!w0 || !h0) return rej(new Error("Leeres Bild."));
    const k = Math.min(1, max / Math.max(w0, h0));
    const w = Math.round(w0 * k), h = Math.round(h0 * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(source, 0, 0, w, h);
    c.toBlob((b) => (b ? res({ blob: b, w, h, canvas: c }) : rej(new Error("Bild konnte nicht umgewandelt werden."))), "image/jpeg", q);
  });
  const titleFromFile = (name) => {
    const base = name.replace(/\.[^.]+$/, "").replace(/^(IMG|DSC|DSCF|_MG|PXL|DJI|GOPR|MVI)[_-]?\d+(_\d+)*[_-]?/i, "");
    const t = base.replace(/^\d+[-_ ]*/, "").replace(/[-_]+/g, " ").trim();
    return t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  };

  async function addPhotos(files) {
    const taken = new Set(site.photos.map((p) => p.id));
    let n = 0, firstNew = null;
    for (const file of files) {
      n++;
      setStatus("busy", `Bereite Foto ${n}/${files.length} vor …`);
      try {
        const exif = await window.readExif(file);
        const dec = await decode(file);
        let full;
        try { full = await toJpeg(dec.src, 2400, 0.82); } finally { dec.done(); }
        const thumb = await toJpeg(full.canvas, 1200, 0.8);
        const title = titleFromFile(file.name);
        const id = uniqueId(slugify(title || `foto-${rand()}`), taken);
        taken.add(id);
        const p = {
          id,
          src: `images/photos/${id}.jpg`,
          thumb: `images/thumbs/${id}.jpg`,
          w: full.w, h: full.h,
          title: title || "Ohne Titel",
          place: "",
          year: exif.year || "",
          camera: exif.camera || "",
          exposure: { lens: exif.lens || "", focal: exif.focal || "", aperture: exif.aperture || "", shutter: exif.shutter || "", iso: exif.iso || "" },
          size: 2,
        };
        addFile(p.src, full.blob);
        addFile(p.thumb, thumb.blob);
        site.photos.unshift(p);
        firstNew = firstNew || p;
      } catch (e) {
        toast(e.message || String(e), 5000);
      }
    }
    touch(true);
    if (files.length === 1 && firstNew) editPhoto(firstNew.id);
    else toast(`${n} Foto${n === 1 ? "" : "s"} hinzugefügt. Titel & Co. jetzt ausfüllen.`);
  }

  const videoInfo = (u) => new Promise((res, rej) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto";
    const t = setTimeout(() => rej(new Error("Video lässt sich hier nicht lesen.")), 15000);
    v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); }, { once: true });
    v.addEventListener("seeked", () => {
      clearTimeout(t);
      toJpeg(v, 1600, 0.82).then((p) => res({ poster: p, w: v.videoWidth, h: v.videoHeight, duration: Math.round(v.duration || 0) }), rej);
    }, { once: true });
    v.addEventListener("error", () => { clearTimeout(t); rej(new Error("Dieses Videoformat kann der Browser nicht lesen. Bitte als MP4 (H.264) exportieren.")); }, { once: true });
    v.src = u;
    v.load();
  });

  async function addVideo(file) {
    const mb = file.size / 1048576;
    if (mb > 95) { toast(`Das Video hat ${Math.round(mb)} MB, erlaubt sind max. 95 MB. Kürzer exportieren oder als YouTube-Link einfügen.`, 6000); return; }
    if (mb > 50 && !confirm(`Das Video hat ${Math.round(mb)} MB. Große Clips laden auf Handys langsam. Empfohlen: 1080p, unter 50 MB. Trotzdem hinzufügen?`)) return;
    setStatus("busy", "Lese Video …");
    const ext = ((file.name.match(/\.(mp4|mov|m4v|webm)$/i) || [])[1] || (/webm/.test(file.type) ? "webm" : /quicktime/.test(file.type) ? "mov" : "mp4")).toLowerCase();
    const title = titleFromFile(file.name);
    const id = uniqueId(slugify(title || `clip-${rand()}`), new Set(site.films.map((f) => f.id)));
    const f = { id, kind: "file", src: `media/film/${id}.${ext}`, poster: `media/film/${id}.jpg`, w: 1920, h: 1080, duration: 0, title: title || "Ohne Titel", year: String(new Date().getFullYear()), text: "" };
    addFile(f.src, file);
    try {
      const info = await videoInfo(previews.get(f.src));
      Object.assign(f, { w: info.w, h: info.h, duration: info.duration });
      addFile(f.poster, info.poster.blob);
    } catch (e) {
      toast(`${e.message} Du kannst unten ein Vorschaubild wählen.`, 6000);
      f.poster = "";
    }
    site.films.unshift(f);
    touch(true);
    editFilm(f.id);
  }

  const ytId = (v) => {
    const s = String(v || "").trim();
    const m = s.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/);
    return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : "";
  };
  async function addYouTube(link) {
    const yid = ytId(link);
    if (!yid) { toast("Das sieht nicht wie ein YouTube-Link aus."); return; }
    const short = /shorts\//.test(link);
    const id = uniqueId(`yt-${yid.toLowerCase().replace(/[^a-z0-9]/g, "")}`, new Set(site.films.map((f) => f.id)));
    const f = { id, kind: "youtube", youtube: `https://youtu.be/${yid}`, poster: "", w: short ? 1080 : 1920, h: short ? 1920 : 1080, duration: 0, title: "Ohne Titel", year: String(new Date().getFullYear()), text: "" };
    setStatus("busy", "Hole Vorschaubild von YouTube …");
    // the poster is copied into the repo, so visitors never load it from YouTube
    for (const name of ["maxresdefault", "hqdefault"]) {
      try {
        const r = await fetch(`https://i.ytimg.com/vi/${yid}/${name}.jpg`);
        if (!r.ok) continue;
        const blob = await r.blob();
        if (blob.size < 2000) continue;
        f.poster = `media/film/${id}.jpg`;
        addFile(f.poster, blob);
        break;
      } catch (e) { /* blocked: pick one by hand */ }
    }
    site.films.unshift(f);
    touch(true);
    editFilm(f.id);
    if (!f.poster) toast("Vorschaubild konnte nicht geladen werden. Bitte eins auswählen (Screenshot reicht).", 6000);
  }

  /* --------------------------------------------------------------- render */
  const field = (label, html, hint = "") => `<label class="field"><span class="field__l">${label}</span>${html}${hint ? `<span class="field__h">${hint}</span>` : ""}</label>`;
  const input = (key, value, attrs = "") => `<input class="inp" data-f="${key}" value="${esc(value)}" ${attrs}>`;
  // a text in three languages: German first, the others folded away
  const i18nField = (label, key, value, area = false) => {
    const v = L(value);
    const el = (lang) => area
      ? `<textarea class="inp" rows="3" data-f="${key}.${lang}">${esc(v[lang])}</textarea>`
      : `<input class="inp" data-f="${key}.${lang}" value="${esc(v[lang])}">`;
    return `
      <div class="field">
        <span class="field__l">${label}</span>
        ${el("de")}
        <details class="i18n"${v.en || v.zh ? " open" : ""}>
          <summary>Übersetzung (EN / 中文) – leer = wie Deutsch</summary>
          <span class="i18n__l">English</span>${el("en")}
          <span class="i18n__l">中文</span>${el("zh")}
        </details>
      </div>`;
  };

  function render() {
    tabsEl.hidden = !gh || !loaded;
    $$("[data-tab]", tabsEl).forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
    if (!gh) { main.innerHTML = viewConnect(); return; }
    if (!loaded) { main.innerHTML = `<p class="muted">Lade …</p>`; return; }
    main.innerHTML = ({ photos: viewPhotos, series: viewSeries, films: viewFilms, info: viewInfo, settings: viewSettings })[tab]();
  }

  const viewConnect = () => `
    <section class="pane narrow">
      <h1>Mit GitHub verbinden</h1>
      <p class="muted">Diese Seite speichert direkt in dein Website-Repo. Dafür brauchst du einmal pro Gerät einen Zugangs-Token. Er bleibt nur in diesem Browser. Ist das Gerät schon mit der Route verbunden, bist du hier automatisch auch drin.</p>
      <ol class="steps">
        <li>Öffne <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token erstellen</a></li>
        <li>Name z. B. <code>Website</code>, Ablauf nach Wunsch</li>
        <li>Repository access: <b>Only select repositories</b> → <code>${esc(DEFAULT_REPO)}</code></li>
        <li>Permissions → Repository → <b>Contents: Read and write</b></li>
        <li>„Generate token“ und hier einfügen</li>
      </ol>
      ${field("Token", `<input class="inp" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" data-token>`)}
      ${field("Repository", `<input class="inp" autocomplete="off" spellcheck="false" value="${esc(DEFAULT_REPO)}" data-repo>`)}
      <button class="btn btn--accent" type="button" data-act="connect">Verbinden</button>
    </section>`;

  /* Photos */
  function viewPhotos() {
    const inSeries = new Set(site.series.flatMap((s) => s.photos));
    const sel = site.photos.filter((p) => p.selected).length;
    const list = site.photos.filter((p) =>
      filter === "selected" ? p.selected : filter === "hero" ? p.hero : filter === "loose" ? !inSeries.has(p.id) : true);
    return `
      <section class="pane">
        <div class="head">
          <div>
            <h1>Fotos <small>${site.photos.length}</small></h1>
            <p class="muted">★ = Auswahl auf der Startseite (gerade ${sel}, gut sind 12–20). Klick auf ein Foto zum Bearbeiten.</p>
          </div>
          <button class="btn btn--accent" type="button" data-act="add-photos">+ Fotos hochladen</button>
        </div>
        <div class="drop" data-drop>Fotos hierher ziehen oder <button type="button" class="link" data-act="add-photos">auswählen</button> · JPG, große Dateien werden automatisch verkleinert</div>
        <div class="filters">
          ${[["all", "Alle"], ["selected", "★ Auswahl"], ["hero", "Startbild"], ["loose", "Ohne Serie"]].map(([k, l]) => `<button type="button" data-filter="${k}" class="${filter === k ? "is-on" : ""}">${l}</button>`).join("")}
        </div>
        <ul class="cards">
          ${list.map((p) => `
            <li class="card${p.selected ? " is-sel" : ""}">
              <button type="button" class="card__img" data-act="edit-photo" data-id="${esc(p.id)}"><img src="${esc(src(p.thumb || p.src))}" alt="" loading="lazy"></button>
              <div class="card__row">
                <span class="card__t">${esc(show(p.title))}</span>
                <button type="button" class="star${p.selected ? " is-on" : ""}" data-act="toggle-sel" data-id="${esc(p.id)}" title="Auswahl">★</button>
              </div>
              <span class="card__s">${esc([show(p.place), p.year, `Größe ${p.size || 2}`].filter(Boolean).join(" · "))}${pending.has(p.src) ? ' · <b class="new">neu</b>' : ""}</span>
            </li>`).join("")}
        </ul>
      </section>`;
  }

  function editPhoto(id) {
    const p = site.photos.find((x) => x.id === id);
    if (!p) return;
    p.exposure = p.exposure || {};
    const e = p.exposure;
    openSheet(`
      <div class="sheet__head"><h2>Foto bearbeiten</h2><button type="button" class="btn" data-act="close-sheet">Fertig</button></div>
      <img class="sheet__img" src="${esc(src(p.thumb || p.src))}" alt="">
      <div data-scope="photo" data-id="${esc(p.id)}">
        ${i18nField("Titel", "title", p.title)}
        ${i18nField("Ort", "place", p.place)}
        <div class="cols">
          ${field("Jahr", input("year", p.year, 'inputmode="numeric"'))}
          ${field("Größe im Raster", `<select class="inp" data-f="size">${[1, 2, 3].map((n) => `<option value="${n}"${+p.size === n ? " selected" : ""}>${n} – ${["klein", "mittel", "groß"][n - 1]}</option>`).join("")}</select>`)}
        </div>
        <div class="checks">
          <label><input type="checkbox" data-f="selected"${p.selected ? " checked" : ""}> ★ Auswahl (Startseite)</label>
          <label><input type="checkbox" data-f="hero"${p.hero ? " checked" : ""}> Startbild (großes Bild oben)</label>
        </div>
        <h3>Kamera &amp; Belichtung <small>erscheint klein in der Großansicht</small></h3>
        ${field("Kamera", input("camera", p.camera))}
        ${field("Objektiv", input("exposure.lens", e.lens))}
        <div class="cols cols--4">
          ${field("Brennweite (mm)", input("exposure.focal", e.focal, 'inputmode="numeric" placeholder="70"'))}
          ${field("Blende f/", input("exposure.aperture", e.aperture, 'inputmode="decimal" placeholder="2.8"'))}
          ${field("Zeit (s)", input("exposure.shutter", e.shutter, 'placeholder="1/250"'))}
          ${field("ISO", input("exposure.iso", e.iso, 'inputmode="numeric" placeholder="100"'))}
        </div>
        <h3>Serien</h3>
        <div class="checks">
          ${site.series.map((s) => `<label><input type="checkbox" data-series-member="${esc(s.id)}"${s.photos.includes(p.id) ? " checked" : ""}> ${esc(show(s.title))}</label>`).join("") || '<span class="muted">Noch keine Serien.</span>'}
        </div>
        <div class="danger"><button type="button" class="btn btn--danger" data-act="delete-photo" data-id="${esc(p.id)}">Foto löschen</button></div>
      </div>`);
  }

  /* Series */
  function viewSeries() {
    return `
      <section class="pane">
        <div class="head">
          <div><h1>Serien <small>${site.series.length}</small></h1><p class="muted">Erscheinen auf der Startseite unter der Auswahl, jede mit eigener Seite. Reihenfolge mit ↑ ↓.</p></div>
          <button class="btn btn--accent" type="button" data-act="add-series">+ Neue Serie</button>
        </div>
        <ol class="rows">
          ${site.series.map((s, i) => {
            const cover = site.photos.find((p) => p.id === s.cover) || site.photos.find((p) => p.id === s.photos[0]);
            return `
              <li class="rowitem">
                <button type="button" class="rowitem__main" data-act="edit-series" data-id="${esc(s.id)}">
                  ${cover ? `<img src="${esc(src(cover.thumb || cover.src))}" alt="">` : '<span class="ph0"></span>'}
                  <span><b>${esc(show(s.title) || "Ohne Titel")}</b><span class="muted">${esc([s.year, `${s.photos.length} Bilder`].filter(Boolean).join(" · "))}</span></span>
                </button>
                <span class="move">
                  <button type="button" data-act="move-series" data-id="${esc(s.id)}" data-d="-1"${i === 0 ? " disabled" : ""}>↑</button>
                  <button type="button" data-act="move-series" data-id="${esc(s.id)}" data-d="1"${i === site.series.length - 1 ? " disabled" : ""}>↓</button>
                </span>
              </li>`;
          }).join("")}
        </ol>
      </section>`;
  }

  function editSeries(id) {
    const s = site.series.find((x) => x.id === id);
    if (!s) return;
    const byId = new Map(site.photos.map((p) => [p.id, p]));
    const members = s.photos.map((pid) => byId.get(pid)).filter(Boolean);
    const others = site.photos.filter((p) => !s.photos.includes(p.id));
    openSheet(`
      <div class="sheet__head"><h2>Serie bearbeiten</h2><button type="button" class="btn" data-act="close-sheet">Fertig</button></div>
      <div data-scope="series" data-id="${esc(s.id)}">
        ${i18nField("Titel", "title", s.title)}
        ${i18nField("Text (optional, nur Fakten wenn du willst)", "text", s.text, true)}
        <div class="cols">
          ${field("Jahr", input("year", s.year, 'placeholder="2026 oder 2018–2024"'))}
          ${field("Adresse", `<input class="inp" value="/serie/${esc(s.id)}" readonly>`, "Wird beim Anlegen aus dem Titel gebildet.")}
        </div>
        <h3>Bilder in der Serie <small>Reihenfolge = Reihenfolge auf der Seite · Klick aufs Bild = Titelbild</small></h3>
        <ol class="strip">
          ${members.map((p, i) => `
            <li class="${s.cover === p.id || (!s.cover && i === 0) ? "is-cover" : ""}">
              <button type="button" class="strip__img" data-act="set-cover" data-id="${esc(p.id)}" title="Als Titelbild"><img src="${esc(src(p.thumb || p.src))}" alt=""></button>
              <span class="strip__t">${esc(show(p.title))}</span>
              <span class="move">
                <button type="button" data-act="move-member" data-id="${esc(p.id)}" data-d="-1"${i === 0 ? " disabled" : ""}>←</button>
                <button type="button" data-act="move-member" data-id="${esc(p.id)}" data-d="1"${i === members.length - 1 ? " disabled" : ""}>→</button>
                <button type="button" data-act="drop-member" data-id="${esc(p.id)}" title="Aus Serie nehmen">✕</button>
              </span>
            </li>`).join("")}
        </ol>
        <details class="more"${members.length ? "" : " open"}>
          <summary>Bilder hinzufügen (${others.length} weitere)</summary>
          <ul class="pick">
            ${others.map((p) => `<li><button type="button" data-act="add-member" data-id="${esc(p.id)}"><img src="${esc(src(p.thumb || p.src))}" alt="" loading="lazy"><span>${esc(show(p.title))}</span></button></li>`).join("")}
          </ul>
        </details>
        <div class="danger"><button type="button" class="btn btn--danger" data-act="delete-series" data-id="${esc(s.id)}">Serie löschen</button> <span class="muted">Die Fotos bleiben erhalten.</span></div>
      </div>`);
  }

  /* Films */
  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  function viewFilms() {
    return `
      <section class="pane">
        <div class="head">
          <div><h1>Film <small>${site.films.length}</small></h1><p class="muted">Kurze Clips direkt hochladen (MP4, am besten 1080p und unter 50 MB) oder längere Filme als YouTube-Link.</p></div>
          <div class="btns">
            <button class="btn btn--accent" type="button" data-act="add-video">+ Clip hochladen</button>
            <button class="btn" type="button" data-act="add-yt">+ YouTube-Link</button>
          </div>
        </div>
        <ol class="rows">
          ${site.films.map((f, i) => `
            <li class="rowitem">
              <button type="button" class="rowitem__main" data-act="edit-film" data-id="${esc(f.id)}">
                ${f.poster ? `<img src="${esc(src(f.poster))}" alt="">` : '<span class="ph0"></span>'}
                <span><b>${esc(show(f.title))}</b><span class="muted">${esc([f.kind === "youtube" ? "YouTube" : "Clip", f.w && f.h ? (f.w >= f.h ? "quer" : "hochkant") : "", f.year, fmtDur(f.duration)].filter(Boolean).join(" · "))}${pending.has(f.src) ? ' · <b class="new">neu</b>' : ""}</span></span>
              </button>
              <span class="move">
                <button type="button" data-act="move-film" data-id="${esc(f.id)}" data-d="-1"${i === 0 ? " disabled" : ""}>↑</button>
                <button type="button" data-act="move-film" data-id="${esc(f.id)}" data-d="1"${i === site.films.length - 1 ? " disabled" : ""}>↓</button>
              </span>
            </li>`).join("") || '<li class="muted">Noch keine Clips.</li>'}
        </ol>
      </section>`;
  }

  function editFilm(id) {
    const f = site.films.find((x) => x.id === id);
    if (!f) return;
    openSheet(`
      <div class="sheet__head"><h2>${f.kind === "youtube" ? "YouTube-Film" : "Clip"} bearbeiten</h2><button type="button" class="btn" data-act="close-sheet">Fertig</button></div>
      ${f.poster ? `<img class="sheet__img" src="${esc(src(f.poster))}" alt="">` : '<p class="muted">Kein Vorschaubild.</p>'}
      <button type="button" class="btn" data-act="pick-poster" data-id="${esc(f.id)}">Vorschaubild ${f.poster ? "ersetzen" : "wählen"}</button>
      <div data-scope="film" data-id="${esc(f.id)}">
        ${i18nField("Titel", "title", f.title)}
        ${i18nField("Text (optional)", "text", f.text, true)}
        <div class="cols">
          ${field("Jahr", input("year", f.year, 'inputmode="numeric"'))}
          ${field("Länge (Sekunden)", input("duration", f.duration || "", 'inputmode="numeric"'), f.kind === "youtube" ? "Bei YouTube bitte selbst eintragen." : "")}
        </div>
        ${f.kind === "youtube" ? `
          ${field("YouTube-Link", input("youtube", f.youtube))}
          ${field("Format", `<select class="inp" data-f="format"><option value="land"${f.w >= f.h ? " selected" : ""}>Quer (16:9)</option><option value="port"${f.w < f.h ? " selected" : ""}>Hochkant (Shorts, 9:16)</option></select>`)}` : ""}
        <div class="danger"><button type="button" class="btn btn--danger" data-act="delete-film" data-id="${esc(f.id)}">Löschen</button></div>
      </div>`);
  }

  /* Info: the profile. Each row: a label and lines; "Text | https://…" makes a link. */
  const linesOf = (values, lang) => (values || []).map((v) => {
    if (v && typeof v === "object" && "text" in v) return `${L(v.text)[lang] || (lang === "de" ? "" : "")}${v.url ? ` | ${v.url}` : ""}`;
    return L(v)[lang];
  }).join("\n");
  function viewInfo() {
    return `
      <section class="pane narrow">
        <h1>Info</h1>
        <p class="muted">Der Steckbrief auf der Startseite. Eine Zeile pro Eintrag. <code>Text | https://…</code> macht einen Link (z. B. <code>Instagram | https://instagram.com/…</code>). Links in einer Zeile erscheinen auch unten im Footer. Englisch/Chinesisch leer lassen = wie Deutsch.</p>
        ${field("E-Mail", `<input class="inp" type="email" data-site="email" value="${esc(site.email)}">`)}
        <ol class="facts-ed">
          ${site.facts.map((f, i) => `
            <li data-fact="${i}">
              <div class="facts-ed__head">
                <span class="move">
                  <button type="button" data-act="move-fact" data-i="${i}" data-d="-1"${i === 0 ? " disabled" : ""}>↑</button>
                  <button type="button" data-act="move-fact" data-i="${i}" data-d="1"${i === site.facts.length - 1 ? " disabled" : ""}>↓</button>
                  <button type="button" data-act="delete-fact" data-i="${i}" title="Zeile löschen">✕</button>
                </span>
              </div>
              <div class="cols cols--3">
                ${["de", "en", "zh"].map((lang) => `
                  <div>
                    <span class="field__l">${{ de: "Deutsch", en: "English", zh: "中文" }[lang]}</span>
                    <input class="inp" placeholder="Bezeichnung" data-fact-label="${lang}" value="${esc(L(f.label)[lang])}">
                    <textarea class="inp" rows="4" placeholder="Einträge, eine Zeile pro Eintrag" data-fact-values="${lang}">${esc(linesOf(f.value, lang))}</textarea>
                  </div>`).join("")}
              </div>
            </li>`).join("")}
        </ol>
        <button type="button" class="btn" data-act="add-fact">+ Zeile</button>
      </section>`;
  }
  // three textareas back into values: [{de,en,zh} | "text" | {text,url}]
  function readFact(li) {
    const label = packL({ de: $('[data-fact-label="de"]', li).value.trim(), en: $('[data-fact-label="en"]', li).value.trim(), zh: $('[data-fact-label="zh"]', li).value.trim() });
    const rows = (lang) => $(`[data-fact-values="${lang}"]`, li).value.split("\n").map((s) => s.trim());
    const de = rows("de"), en = rows("en"), zh = rows("zh");
    const value = [];
    de.forEach((line, i) => {
      if (!line) return;
      const split = (s) => { const m = (s || "").match(/^(.*?)\s*\|\s*(\S+)\s*$/); return m ? [m[1].trim(), m[2]] : [s || "", ""]; };
      const [tDe, u] = split(line);
      const [tEn] = split(en[i]);
      const [tZh] = split(zh[i]);
      const text = packL({ de: tDe, en: tEn, zh: tZh });
      if (u) value.push({ text, url: /^[^@\s]+@[^@\s]+$/.test(u) ? `mailto:${u}` : u });
      else value.push(text);
    });
    return { label, value };
  }

  /* Settings */
  function viewSettings() {
    return `
      <section class="pane narrow">
        <h1>Einstellungen</h1>
        <div class="switch-card${site.gapyear ? " is-on" : ""}">
          <div>
            <h2>Gapyear-Modus</h2>
            <p class="muted">An: „Track me“ steht in der Navigation neben Fotografie und Film, Karte und Journal sind für alle ohne Code sichtbar, oben steht dein aktueller Ort mit Ortszeit. Aus: Die Reise ist nur über das Schloss mit Code erreichbar.</p>
            <a class="link" href="/route/admin.html">Reise bearbeiten (Orte, Standort, Beiträge) →</a>
          </div>
          <button type="button" class="toggle" role="switch" aria-checked="${!!site.gapyear}" data-act="toggle-gap"><span></span></button>
        </div>
        <div class="switch-card${site.shuffle !== false ? " is-on" : ""}">
          <div>
            <h2>Auswahl mischen</h2>
            <p class="muted">An: Die Auswahl auf der Startseite wird bei jedem Besuch neu angeordnet. Aus: feste Reihenfolge wie in der Fotoliste.</p>
          </div>
          <button type="button" class="toggle" role="switch" aria-checked="${site.shuffle !== false}" data-act="toggle-shuffle"><span></span></button>
        </div>
        <div class="cols">
          ${field("Vorname", `<input class="inp" data-name="0" value="${esc(site.name[0])}">`)}
          ${field("Nachname", `<input class="inp" data-name="1" value="${esc(site.name[1])}">`)}
        </div>
        <p class="muted small">Verbunden mit <code>${esc(gh?.repo || "")}</code> · <button type="button" class="link" data-act="disconnect">Trennen</button></p>
      </section>`;
  }

  /* ---------------------------------------------------------------- sheet */
  function openSheet(html) {
    sheetBox.innerHTML = html;
    sheet.hidden = false;
    document.documentElement.classList.add("sheet-open");
    sheetBox.scrollTop = 0;
  }
  function closeSheet() {
    sheet.hidden = true;
    document.documentElement.classList.remove("sheet-open");
    render();
  }
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

  /* -------------------------------------------------------------- editing */
  const setPath = (obj, path, val) => {
    const keys = path.split(".");
    let o = obj;
    while (keys.length > 1) { const k = keys.shift(); o[k] = o[k] && typeof o[k] === "object" ? o[k] : {}; o = o[k]; }
    o[keys[0]] = val;
  };
  function scopeObj(scope) {
    const id = scope.dataset.id;
    return { photo: site.photos, series: site.series, film: site.films }[scope.dataset.scope]?.find((x) => x.id === id);
  }
  function onField(e) {
    const el = e.target;
    const scope = el.closest("[data-scope]");
    if (el.dataset.site) { site[el.dataset.site] = el.value.trim(); return touch(); }
    if (el.dataset.name) { site.name[+el.dataset.name] = el.value.trim(); return touch(); }
    if (el.closest("[data-fact]")) {
      const li = el.closest("[data-fact]");
      site.facts[+li.dataset.fact] = readFact(li);
      return touch();
    }
    if (el.dataset.seriesMember && scope) {
      const p = scopeObj(scope);
      const s = site.series.find((x) => x.id === el.dataset.seriesMember);
      if (!p || !s) return;
      s.photos = s.photos.filter((x) => x !== p.id);
      if (el.checked) s.photos.push(p.id);
      return touch();
    }
    if (!scope || !el.dataset.f) return;
    const obj = scopeObj(scope);
    if (!obj) return;
    const f = el.dataset.f;
    const m = f.match(/^(title|place|text)\.(de|en|zh)$/);
    if (m) {
      const v = L(obj[m[1]]);
      v[m[2]] = el.value;
      obj[m[1]] = packL(v);
    } else if (el.type === "checkbox") {
      obj[f] = el.checked;
      if (!el.checked) delete obj[f];
    } else if (f === "size" || f === "duration") {
      obj[f] = Number(el.value) || (f === "size" ? 2 : 0);
    } else if (f === "format") {
      [obj.w, obj.h] = el.value === "port" ? [1080, 1920] : [1920, 1080];
    } else {
      setPath(obj, f, el.value.trim());
    }
    touch();
  }
  document.addEventListener("input", onField);
  document.addEventListener("change", (e) => { if (e.target.matches("select, input[type=checkbox]")) onField(e); });

  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  let posterFor = null;

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; render(); scrollTo(0, 0); return; }
    const fl = e.target.closest("[data-filter]");
    if (fl) { filter = fl.dataset.filter; render(); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    const d = Number(b.dataset.d);
    switch (b.dataset.act) {
      case "connect": return connect();
      case "disconnect":
        if (!confirm("Token von diesem Gerät entfernen? (Gilt auch für den Route-Admin.)")) return;
        store.del(GH_KEY); gh = null; loaded = false; render(); idle(); return;
      case "add-photos": return $("[data-pick-photos]").click();
      case "edit-photo": return editPhoto(id);
      case "toggle-sel": {
        const p = site.photos.find((x) => x.id === id);
        if (p) { p.selected = !p.selected; if (!p.selected) delete p.selected; touch(true); }
        return;
      }
      case "delete-photo": {
        if (!confirm("Foto wirklich löschen? Es verschwindet auch aus allen Serien.")) return;
        site.photos = site.photos.filter((x) => x.id !== id);
        site.series.forEach((s) => { s.photos = s.photos.filter((x) => x !== id); if (s.cover === id) s.cover = s.photos[0] || ""; });
        touch(); return closeSheet();
      }
      case "add-series": {
        const name = prompt("Name der Serie?");
        if (!name) return;
        const sid = uniqueId(slugify(name), new Set(site.series.map((s) => s.id)));
        site.series.push({ id: sid, title: name.trim(), text: "", year: "", cover: "", photos: [] });
        touch(true);
        return editSeries(sid);
      }
      case "edit-series": return editSeries(id);
      case "move-series": move(site.series, site.series.findIndex((s) => s.id === id), d); return touch(true);
      case "delete-series":
        if (!confirm("Serie löschen? Die Fotos bleiben erhalten.")) return;
        site.series = site.series.filter((s) => s.id !== id);
        touch(); return closeSheet();
      case "set-cover": case "move-member": case "drop-member": case "add-member": {
        const scope = b.closest("[data-scope]");
        const s = scopeObj(scope);
        if (!s) return;
        const i = s.photos.indexOf(id);
        if (b.dataset.act === "set-cover") s.cover = id;
        if (b.dataset.act === "move-member") move(s.photos, i, d);
        if (b.dataset.act === "drop-member") { s.photos.splice(i, 1); if (s.cover === id) s.cover = s.photos[0] || ""; }
        if (b.dataset.act === "add-member") s.photos.push(id);
        touch();
        const open = $(".more", sheetBox)?.open;
        editSeries(s.id);
        const more = $(".more", sheetBox);
        if (more && open) more.open = true;
        return;
      }
      case "add-video": return $("[data-pick-video]").click();
      case "add-yt": {
        const link = prompt("YouTube-Link einfügen:");
        if (link) await addYouTube(link);
        return;
      }
      case "edit-film": return editFilm(id);
      case "move-film": move(site.films, site.films.findIndex((f) => f.id === id), d); return touch(true);
      case "delete-film":
        if (!confirm("Clip wirklich löschen?")) return;
        site.films = site.films.filter((f) => f.id !== id);
        touch(); return closeSheet();
      case "pick-poster": posterFor = id; return $("[data-pick-poster]").click();
      case "add-fact": site.facts.push({ label: "", value: [] }); return touch(true);
      case "move-fact": move(site.facts, +b.dataset.i, d); return touch(true);
      case "delete-fact": site.facts.splice(+b.dataset.i, 1); return touch(true);
      case "toggle-gap":
        site.gapyear = !site.gapyear;
        toast(site.gapyear ? "Gapyear-Modus an. Wird mit „Veröffentlichen“ live." : "Gapyear-Modus aus. Wird mit „Veröffentlichen“ live.", 3500);
        return touch(true);
      case "toggle-shuffle": site.shuffle = site.shuffle === false; return touch(true);
      case "close-sheet": return closeSheet();
    }
  });

  $("[data-pick-photos]").addEventListener("change", (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length) addPhotos(files);
  });
  $("[data-pick-video]").addEventListener("change", (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) addVideo(f);
  });
  $("[data-pick-poster]").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    const f = site.films.find((x) => x.id === posterFor);
    if (!file || !f) return;
    try {
      const dec = await decode(file);
      let out;
      try { out = await toJpeg(dec.src, 1600, 0.82); } finally { dec.done(); }
      f.poster = `media/film/${f.id}-${rand()}.jpg`;
      addFile(f.poster, out.blob);
      if (f.kind === "youtube" && !f.w) { f.w = out.w; f.h = out.h; }
      touch();
      editFilm(f.id);
    } catch (err) { toast(err.message, 5000); }
  });
  // drag & drop photos anywhere on the photos tab
  addEventListener("dragover", (e) => { if (tab === "photos" && loaded) { e.preventDefault(); $("[data-drop]")?.classList.add("is-over"); } });
  addEventListener("dragleave", (e) => { if (!e.relatedTarget) $("[data-drop]")?.classList.remove("is-over"); });
  addEventListener("drop", (e) => {
    if (tab !== "photos" || !loaded) return;
    e.preventDefault();
    $("[data-drop]")?.classList.remove("is-over");
    const files = [...(e.dataTransfer?.files || [])].filter((f) => /^image\//.test(f.type));
    if (files.length) addPhotos(files);
  });

  /* ------------------------------------------------------------ connect/load */
  async function connect() {
    const token = $("[data-token]").value.trim();
    const repo = $("[data-repo]").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    if (!token) { toast("Bitte Token einfügen."); return; }
    gh = { token, repo };
    setStatus("busy", "Prüfe Token …");
    try {
      const info = await ghFetch(`/repos/${repo}`);
      if (info.permissions && !info.permissions.push) throw new Error("Der Token hat nur Leserechte. Bitte „Contents: Read and write“ wählen.");
      branch = info.default_branch;
      store.set(GH_KEY, JSON.stringify(gh));
    } catch (e) {
      gh = null;
      setStatus("err", e.message);
      return;
    }
    await load();
  }

  async function load() {
    loaded = false;
    idle();
    render();
    try {
      if (!branch) branch = (await ghFetch(`/repos/${gh.repo}`)).default_branch;
      const head = (await ghFetch(`/repos/${gh.repo}/git/ref/heads/${branch}`)).object.sha;
      const remote = await fetchRemote(head);
      baseRev = remote.rev || 0;
      site = remote;
      // an unpublished draft from earlier wins, with its files from IndexedDB
      let draft = null;
      try { draft = JSON.parse(store.get(DRAFT_KEY) || "null"); } catch (e) { draft = null; }
      if (draft && draft.site) {
        if (draft.baseRev !== baseRev) toast("Hinweis: Dein Entwurf basiert auf einem älteren Stand. Beim Veröffentlichen wirst du gefragt.", 6000);
        site = normalize(draft.site);
        baseRev = draft.baseRev;
        dirty = true;
        const keys = (await idb.keys()) || [];
        for (const k of keys) {
          const blob = await idb.get(k);
          if (blob) { pending.set(k, blob); previews.set(k, URL.createObjectURL(blob)); }
        }
      }
      loaded = true;
      tabsEl.hidden = false;
      idle();
      render();
    } catch (e) {
      setStatus("err", e.message || String(e));
      main.innerHTML = `<section class="pane narrow"><h1>Laden fehlgeschlagen</h1><p class="muted">${esc(e.message)}</p><button class="btn" type="button" data-act="disconnect">Token entfernen</button></section>`;
    }
  }

  render();
  idle();
  if (gh) load();
})();
